"""Real service + native reader + independent Lua states; never starts X4.

Usage: python profiles/test/load_permission_lua_test.py <lua51_64.dll> <reader.dll>
All service writes, control faults and simulated gameplay rows use a fresh fixture.
"""
import ctypes
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import time

repo = Path(__file__).resolve().parents[2]
source = (repo / 'extensions/lifesigns_event_recorder/ui/addons/ego_detailmonitor/lifesigns_database.lua').read_text()
lua = ctypes.CDLL(str(Path(sys.argv[1]).resolve(strict=True)))
lua.luaL_newstate.restype = ctypes.c_void_p
lua.luaL_openlibs.argtypes = [ctypes.c_void_p]
lua.luaL_loadstring.argtypes = [ctypes.c_void_p, ctypes.c_char_p]
lua.luaL_loadstring.restype = ctypes.c_int
lua.lua_pcall.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_int, ctypes.c_int]
lua.lua_pcall.restype = ctypes.c_int
lua.lua_tolstring.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_void_p]
lua.lua_tolstring.restype = ctypes.c_char_p
lua.lua_settop.argtypes = [ctypes.c_void_p, ctypes.c_int]
lua.lua_close.argtypes = [ctypes.c_void_p]


class VM:
    def __init__(self):
        self.state = lua.luaL_newstate()
        assert self.state
        lua.luaL_openlibs(self.state)
        self.exec("""
callbacks={};replies={};diagnostics={};clock=1;calls={}
function RegisterEvent(n,f) callbacks[n]=f end
function SetScript(n,f) callbacks[n]=f end
function getElapsedTime() return clock end
function GetUISafeModeOption() return false end
function DebugError(s) diagnostics[#diagnostics+1]=s end
function AddUITriggeredEvent(s,c,p) if c=='reply' then replies[#replies+1]=p end end
function LoadGame(...) calls[#calls+1]={n=select('#',...),...} end
""")
        self.exec(source)

    def exec(self, text, result=False):
        if lua.luaL_loadstring(self.state, text.encode()) or lua.lua_pcall(self.state, 0, 1 if result else 0, 0):
            raise AssertionError(lua.lua_tolstring(self.state, -1, None).decode(errors='replace'))
        if result:
            value = lua.lua_tolstring(self.state, -1, None).decode()
            lua.lua_settop(self.state, -2)
            return value

    def request(self, run):
        self.exec('clock=clock+0.3;callbacks.LifeSignsDatabaseRequest(nil,' + json.dumps(run+'|'+universe) + ')')

    def update(self):
        self.exec('clock=clock+0.3;callbacks.onUpdate()')

    def close(self):
        if self.state:
            lua.lua_close(self.state)
            self.state = None


universe = 'lsu1-2026-10-24_00-00-00-1-2-3-4'
old = 'session-1-2-loaded-2026-10-24_00-00-00'
new = 'session-3-4-loaded-2026-10-24_00-01-00'
challenge_run = 'session-0-1-loaded-2000-01-01_00-00-00'
ack_run = 'session-0-2-loaded-2000-01-01_00-00-00'
active_run = 'session-0-3-loaded-2000-01-01_00-00-00'


def wait_for(read, check):
    deadline = time.monotonic()+15
    while time.monotonic() < deadline:
        try:
            value = read()
            if check(value):
                return value
        except (OSError, ValueError):
            pass
        time.sleep(0.02)
    raise AssertionError('Fixture service did not reach the expected state')


original_cwd = Path.cwd()
with tempfile.TemporaryDirectory(prefix='lifesigns-permission-') as temporary:
    root = Path(temporary).resolve()
    assert root.parent == Path(tempfile.gettempdir()).resolve()
    runtime = root/'extensions/lifesigns_event_recorder/runtime'
    native = runtime.parent/'native'
    logs = root/'logs'
    for p in [runtime, native, logs]:
        p.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(Path(sys.argv[2]).resolve(strict=True), native/'lifesigns_status.dll')
    debug = root/'debuglog.txt'
    debug.write_bytes(b'')
    service = subprocess.Popen(['node', str(repo/'profiles/service.mjs'), '--logs', str(logs), '--replies', str(runtime),
                                '--since', '1970-01-01T00:00:00Z', '--control-stdin', '--root', str(root),
                                '--load-control', str(debug)], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE, creationflags=subprocess.CREATE_NO_WINDOW)
    vms = []
    def reply(run):
        return (runtime/(run+'.reply')).read_text()
    def append(run, rows):
        with (logs/('profiles-'+run+'.log')).open('a', encoding='ascii') as out:
            out.write('\n'.join(rows)+'\n')
    def row(run, n, kind, fields=''):
        return f'LSEV1|run={run}|session=UNAVAILABLE|seq=0|age={n}|{kind}|{fields}record={n}|END'
    def begin(run, parent='NONE', record=0):
        return row(run, 1, 'RUN_BEGIN', f'database_protocol=LSDB1|lifesigns_universe_id={universe}|parent_run={parent}|parent_record={record}|')
    def event(run, n):
        return row(run, n, 'ENTITY_EVENT', 'event_type=ATTACKED|subject_kind=SHIP|subject_seed=1|')
    def vm():
        value = VM()
        vms.append(value)
        return value
    try:
        os.chdir(root)
        wait_for(lambda: reply(challenge_run), lambda s: '|CHALLENGE|' in s)
        append(old, [begin(old)])
        wait_for(lambda: reply(active_run), lambda s: old in s)
        before = vm()
        before.request(old)
        before.exec("assert(#replies==1 and replies[1][3]=='NEED_BASELINE' and replies[1][4]==1)")
        append(old, [row(old, 2, 'SNAPSHOT_BEGIN'), row(old, 3, 'SNAPSHOT_END', 'profiles=0|partial=0|')])
        wait_for(lambda: reply(old), lambda s: '|READY|3|' in s)
        before.update()
        before.exec("assert(#replies==2 and replies[2][3]=='READY' and replies[2][4]==3)")
        before.exec("LoadGame('synthetic-save',nil,7);assert(#calls==0)")
        with debug.open('a', encoding='ascii') as out:
            out.write(before.exec("return table.concat(diagnostics,'\\n')", True)+'\n')
        wait_for(lambda: reply(ack_run), lambda s: '|FENCED|' in s)
        before.update()
        before.exec("assert(#calls==1 and calls[1].n==3 and calls[1][2]==nil and calls[1][3]==7)")
        before.close()  # Actual interpreter destruction, not a reset of one flag.
        after = vm()
        after.request(old)
        after.exec("assert(#replies==0,'recreated adapter forwarded stale READY');assert(LifeSignsDatabaseAdapter.loadFence.blocked)")
        append(old, [event(old, 4)])
        append(new, [begin(new, old, 3), event(new, 2)])
        wait_for(lambda: reply(active_run), lambda s: new in s)
        after.request(new)
        after.exec("assert(#replies==1 and replies[1][1]~='"+old+"' and replies[1][3]=='READY' and replies[1][4]==2)")
        after.exec("assert(table.concat(diagnostics,';'):find('NEW_RUN_ACCEPTED',1,true))")
        after.request(old)  # A previous success must not become permission for another request.
        after.exec("assert(#replies==1 and LifeSignsDatabaseAdapter.loadFence.blocked)")
        # Hold service output steady while faulting only disposable control files.
        service.stdin.write(b'STOP\n'); service.stdin.flush(); service.stdin.close(); service.wait(timeout=15)
        assert service.returncode == 0, service.stderr.read().decode()
        challenge_file = runtime/(challenge_run+'.reply')
        active_file = runtime/(active_run+'.reply')
        original_challenge = challenge_file.read_bytes()
        original_active = active_file.read_bytes()
        faults = [None, b'not a control reply\n', original_active.replace(universe.encode(), b'wrong-universe'),
                  original_active.replace(new.encode(), old.encode()),
                  original_active.replace(original_challenge.split(b'|')[4], b'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
                  original_active+original_active]
        for data in faults:
            if data is None:
                active_file.unlink()
            else:
                active_file.write_bytes(data)
            after.request(new)
            after.exec("assert(#replies==1 and LifeSignsDatabaseAdapter.loadFence.blocked,'cached permission bypassed invalid OPEN')")
        active_file.write_bytes(original_active)
        challenge_file.unlink()
        after.request(new)
        after.exec("assert(#replies==1 and LifeSignsDatabaseAdapter.loadFence.blocked)")
        challenge_file.write_bytes(original_challenge)
        after.update()
        after.exec("assert(#replies==2 and not LifeSignsDatabaseAdapter.loadFence.blocked)")
        after.update()
        after.exec("assert(#replies==2,'unchanged reply forwarded repeatedly')")
        after.close()
        another = vm()
        another.request(old)
        another.exec("assert(#replies==0)")
        another.request(new)
        another.exec("assert(#replies==1 and replies[1][4]==2)")
        db = sqlite3.connect('file:'+(root/'local-data/profiles'/f'{universe}.db').as_posix()+'?mode=ro', uri=True)
        try:
            assert db.execute('SELECT count(*) FROM records WHERE run_id=?', (old,)).fetchone()[0] == 3
            assert db.execute('SELECT count(*) FROM records WHERE run_id=?', (new,)).fetchone()[0] == 2
            assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
        finally:
            db.close()
        print('PASS: real Node/SQLite fence and native reader across three independent Lua states; stale READY blocked after recreation, current OPEN accepted, invalid/missing controls revoke permission, unchanged replies deduplicated, sealed SQL unchanged. No X4 launch; queued MD ACKs/F9 remain native gates.')
    finally:
        for value in vms:
            value.close()
        if service.poll() is None:
            service.stdin.write(b'STOP\n'); service.stdin.flush(); service.stdin.close(); service.wait(timeout=15)
        service.stdout.close(); service.stderr.close()
        os.chdir(original_cwd)
