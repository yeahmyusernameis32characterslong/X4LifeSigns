"""Installed LuaJIT + mock X4 widgets + real bounded native replies.

Usage: python profiles/test/housekeeping_lua_test.py <lua51_64.dll> <reader.dll>
Never launches X4. All native reply files are disposable.
"""
import ctypes
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
import gzip
import hashlib
from datetime import datetime, timezone

repo = Path(__file__).resolve().parents[2]
lua = ctypes.CDLL(str(Path(sys.argv[1]).resolve(strict=True)))
lua.luaL_newstate.restype = ctypes.c_void_p
lua.luaL_openlibs.argtypes = [ctypes.c_void_p]
lua.luaL_loadstring.argtypes = [ctypes.c_void_p, ctypes.c_char_p]
lua.lua_pcall.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_int, ctypes.c_int]
lua.lua_tolstring.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_void_p]
lua.lua_tolstring.restype = ctypes.c_char_p
lua.lua_settop.argtypes = [ctypes.c_void_p, ctypes.c_int]
lua.lua_close.argtypes = [ctypes.c_void_p]


def literal(value):
    return json.dumps(value, ensure_ascii=False)


class VM:
    def __init__(self):
        self.state = lua.luaL_newstate()
        lua.luaL_openlibs(self.state)

    def run(self, source, result=False):
        if lua.luaL_loadstring(self.state, source.encode('utf-8')) or lua.lua_pcall(self.state, 0, 1 if result else 0, 0):
            raise AssertionError(lua.lua_tolstring(self.state, -1, None).decode('utf-8', errors='replace'))
        if result:
            value = lua.lua_tolstring(self.state, -1, None)
            lua.lua_settop(self.state, 0)
            return value.decode('utf-8') if value else None

    def close(self):
        lua.lua_close(self.state)


HELLO = 'session-0-4-loaded-2000-01-01_00-00-00'
REPLY = 'session-0-5-loaded-2000-01-01_00-00-00'
GEN = '1' * 32
OTHER = '4' * 32


def frame(client, seq, state='READY', rows=None, page=0, pages=1, gen=GEN):
    rows = rows or []
    fields = ['LSDB1', 'HOUSEKEEPING', gen, client, str(seq), state, str(page), str(pages), str(len(rows))]
    fields += [value.encode('utf-8').hex() for row in rows for value in row]
    return '|'.join(fields + ['END']) + '\n'


mock = r'''
clock=0;messages={};replies={};labels={};buttons={};seen={};vanillaUpdates=0;vanillaCloses=0
function getElapsedTime() return clock end
function DebugError(text) messages[#messages+1]=text end
LifeSignsDatabaseAdapter={readReply=function(file) return replies[file] end}
local function cell()
 local c={handlers={}}
 function c:setColSpan() return self end
 function c:createText(text) labels[#labels+1]=text;return self end
 function c:createButton(properties) self.properties=properties;buttons[#buttons+1]=self;return self end
 function c:setText(text) self.text=text;return self end
 function c:createCheckBox(value,properties) self.check=value;self.properties=properties;return self end
 return c
end
local t={}
function t:addRow() return {cell(),cell(),cell(),cell()} end
local f={addTable=function() return t end,display=function() end}
Helper={clearDataForRefresh=function() end}
menu={name='OptionsMenu',isStartmenu=true,currentOption='main',table={x=0,y=0,width=1000,height=900},createOptionsFrame=function() return f end}
function menu.displayOption(_,option) seen[#seen+1]=option;return 'option',nil,42 end
function menu.displayOptions(name,...)
 menu.currentOption=name
 menu.displayOption(t,{id='continue'})
 menu.displayOption(t,{id='settings'})
 menu.displayOption(t,{id='new'})
 return 'preserved',nil,42
end
function menu.onUpdate() vanillaUpdates=vanillaUpdates+1 end
function menu.onCloseElement() vanillaCloses=vanillaCloses+1 end
function menu.onRowChanged() return 'vanilla-row' end
function menu.onSelectElement() return 'vanilla-select' end
Menus={menu}
'''

vm = VM()
try:
    vm.run(mock)
    vm.run((repo / 'extensions/lifesigns_event_recorder/ui/addons/ego_detailmonitor/lifesigns_housekeeping.lua').read_text(encoding='utf-8'))
    vm.run("P=LifeSignsHousekeeping;local a,b,c=menu.displayOptions('main');assert(a=='preserved' and b==nil and c==42);assert(#seen==4 and seen[2].id=='lifesigns_housekeeping');P.install(menu);seen={};menu.displayOptions('main');assert(#seen==4);menu.isStartmenu=false;seen={};menu.displayOptions('main');assert(#seen==3);menu.isStartmenu=true")
    client = vm.run('return P.client', True)
    def reply(file, value):
        vm.run('replies[' + literal(file) + ']=' + literal(value))
    reply(HELLO, f'LSDB1|HOUSEKEEPING|HELLO|{GEN}|1|INITIAL|END\n')
    vm.run('P.open(menu);assert(P.active and not P.live);clock=1.1')
    reply(HELLO, f'LSDB1|HOUSEKEEPING|HELLO|{GEN}|2|INITIAL|END\n')
    vm.run('P.update();assert(P.live and P.pending and P.pending.verb=="REFRESH");assert(P.state=="SCANNING")')
    seq = int(vm.run('return tostring(P.seq)', True))
    row = [['1', 'Universe 1', '2', '120 bytes', 'In use']]
    good = frame(client, seq, rows=row)
    for bad in [good.replace(client, OTHER), good.replace(GEN, OTHER), good.replace('|READY|', '|DELETE|'), good.rstrip('\n'), good + 'extra', good.replace('|0|1|1|', '|0|1|4|'), frame(client, seq, rows=row, page=1, pages=2)]:
        vm.run('assert(P.parse(' + literal(bad) + ',P.pending)==nil)')
    reply(REPLY, good)
    vm.run('clock=1.4;P.update();assert(P.state=="READY" and not P.stale and P.rows[1][2]=="Universe 1");P.render();assert(table.concat(labels," "):find(P.copy.notice,1,true));P.refresh();assert(P.stale and #P.rows==1);P.render();assert(table.concat(labels," "):find("Previous results - stale",1,true))')
    refresh_seq = int(vm.run('return tostring(P.seq)', True))
    vm.run('P.close(false);assert(not P.active and P.pending==nil)')
    reply(REPLY, frame(client, refresh_seq, rows=row))
    vm.run('clock=1.8;P.update();assert(#P.rows==0);P.open(menu);clock=2.2')
    reply(HELLO, f'LSDB1|HOUSEKEEPING|HELLO|{GEN}|3|INITIAL|END\n')
    vm.run('P.update();assert(P.seq>' + str(refresh_seq) + ')')
    reply(REPLY, frame(client, refresh_seq, rows=row))
    vm.run('clock=2.5;P.update();assert(P.stale and #P.rows==0)')
    current_seq = int(vm.run('return tostring(P.seq)', True))
    reply(REPLY, frame(client, current_seq, rows=row))
    vm.run('clock=2.8;P.update();P.select("1");assert(P.view=="DETAIL" and P.selected==1)')
    detail_seq = int(vm.run('return tostring(P.seq)', True))
    detail = [['INFO', 'Protection', 'Not protected', 'Whole universe', ''], ['SAVE', 'Local saves', 'A|B 船.xml.gz', 'Unknown', 'Filesystem modified UTC']]
    reply(REPLY, frame(client, detail_seq, rows=detail))
    vm.run('clock=3.1;P.update();assert(P.protected==false and P.rows[2][3]=="A|B 船.xml.gz");P.render();P.locations();assert(P.pending.verb=="LOCATIONS")')
    reply(HELLO, f'LSDB1|HOUSEKEEPING|HELLO|{OTHER}|1|INITIAL|END\n')
    vm.run('clock=3.4;P.update();assert(P.state=="STALE" and P.pending==nil and not P.live)')
    reply(HELLO, f'LSDB1|HOUSEKEEPING|HELLO|{OTHER}|2|INITIAL|END\n')
    vm.run('clock=4.5;P.update();assert(P.live);clock=11;P.update();assert(P.state=="UNAVAILABLE" and P.stale);P.worldObserved();assert(not P.active and not P.initial(menu));menu.onUpdate();assert(vanillaUpdates>0);menu.onCloseElement();assert(vanillaCloses==1)')
    print('PASS: actual LuaJIT compile/run; anchored injection, vanilla callbacks, correlation, stale/late/restart/close, Unicode, details, protection state and unavailable companion')
finally:
    vm.close()

# The unchanged first-party reader accepts reserved preview frames from a Unicode
# disposable extension root. No broader filesystem/native interface is introduced.
original_cwd = Path.cwd()
with tempfile.TemporaryDirectory(prefix='lifesigns-preview-native-') as temporary:
    root = Path(temporary)
    extension = root / 'Unicode 船' / 'extensions/lifesigns_event_recorder'
    (extension / 'native').mkdir(parents=True)
    (extension / 'runtime').mkdir()
    shutil.copyfile(Path(sys.argv[2]).resolve(strict=True), extension / 'native/lifesigns_status.dll')
    native_frame = frame('2' * 32, 1, rows=[['1', 'Universe 船', '1', '12 bytes', 'In use']])
    (extension / 'runtime' / (REPLY + '.reply')).write_bytes(native_frame.encode('ascii'))
    native_vm = VM()
    service = None
    try:
        os.chdir(extension.parents[1])
        native_vm.run("local f=assert(package.loadlib('./extensions/lifesigns_event_recorder/native/lifesigns_status.dll','luaopen_lifesigns_status'));native=f()")
        assert native_vm.run('return native.readReply(' + literal(REPLY) + ')', True) == native_frame
        native_vm.run('assert(native.readReply("../invalid")==nil)')
        print('PASS: real native reader returns bounded ASCII preview frame from Unicode disposable path; no native API expansion')
        storage = root / 'storage'
        storage.mkdir()
        saves = storage / 'saves'
        saves.mkdir()
        logs = storage / 'logs'
        logs.mkdir()
        debug = storage / 'debuglog.txt'
        debug.write_bytes(b'')
        universe = 'lsu1-2026-10-27_12-00-00-1-2-3-4'
        run = 'session-1-2-loaded-2026-10-27_12-00-00'
        setup = """
import {ProfileStore} from SOURCE;
const [root,u,run]=process.argv.slice(1),s=new ProfileStore(root,u,run);
const row=(n,kind,fields={})=>({run,session:'UNAVAILABLE',seq:'1',age:String(n),kind,fields:{record:String(n),...fields}});
s.ingest([row(1,'RUN_BEGIN',{database_protocol:'LSDB1',lifesigns_universe_id:u,parent_run:'NONE',parent_record:'0'}),row(2,'SNAPSHOT_BEGIN'),row(3,'SNAPSHOT_END',{profiles:'0'})]);s.close();
""".replace('SOURCE', literal((repo / 'profiles/store.mjs').as_uri()))
        subprocess.run(['node', '--input-type=module', '-e', setup, str(storage), universe, run], check=True, capture_output=True)
        save = saves / 'save.xml.gz'
        xml = f'<savegame><info><game id="X4" version="900"/></info><script><refs type="string"><ref id="1" string="{universe}"/><ref id="2" string="{run}"/></refs></script><md><script name="LifeSigns_EventRecorder"><cue name="UniverseIdentity"><vars><value name="$Id" type="string" value="1"/><value name="$CheckpointRun" type="string" value="2"/><value name="$CheckpointRecord" type="largefloat" value="3"/></vars></cue></script></md></savegame>'
        save.write_bytes(gzip.compress(xml.encode()))
        db = storage / 'local-data/profiles' / (universe + '.db')
        hashes = {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in [db, save]}
        settings_file = storage / 'local-data/housekeeping-preview-v1.json'
        settings_file.write_text(json.dumps({'owner':'LifeSignsReadOnlyPreview','version':1,'saveLocations':[str(saves)],'protectedUniverses':[]}), encoding='utf-8')
        args = ['node', str(repo / 'profiles/service.mjs'), '--logs', str(logs), '--replies', str(extension / 'runtime'), '--since', datetime.now(timezone.utc).isoformat(), '--control-stdin', '--root', str(storage), '--load-control', str(debug)]
        service = subprocess.Popen(args, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        deadline = time.monotonic() + 10
        while not (extension / 'runtime' / (HELLO + '.reply')).exists() and time.monotonic() < deadline:
            time.sleep(0.05)
        native_vm.run(mock)
        native_vm.run('LifeSignsDatabaseAdapter.readReply=native.readReply')
        native_vm.run((repo / 'extensions/lifesigns_event_recorder/ui/addons/ego_detailmonitor/lifesigns_housekeeping.lua').read_text(encoding='utf-8'))
        native_vm.run('P=LifeSignsHousekeeping;P.open(menu)')
        beginning = time.monotonic()
        sent = 0
        def await_ready(view):
            global sent
            deadline = time.monotonic() + 45
            while time.monotonic() < deadline:
                native_vm.run(f'clock={time.monotonic()-beginning};P.update()')
                count = int(native_vm.run('return tostring(#messages)', True))
                with debug.open('ab') as stream:
                    for i in range(sent+1, count+1):
                        stream.write((native_vm.run(f'return messages[{i}]',True)+'\n').encode('ascii'))
                sent = count
                if native_vm.run('return P.state', True) == 'READY' and native_vm.run('return P.view', True) == view:
                    return
                if service.poll() is not None:
                    raise AssertionError(service.stderr.read().decode(errors='replace'))
                time.sleep(0.1)
            raise AssertionError('Actual companion/native/Lua preview timed out: ' + str(native_vm.run('return P.state', True)))
        await_ready('LIST')
        native_vm.run('assert(P.rows[1][2]=="Universe 1" and P.rows[1][3]=="1" and P.rows[1][5]=="In use");P.select("1")')
        await_ready('DETAIL')
        native_vm.run('assert(P.protected==false);P.request("PROTECT",1,true)')
        await_ready('LIST')
        assert json.loads(settings_file.read_text())['protectedUniverses'] == [universe]
        native_vm.run('assert(P.rows[1][5]=="Protected");P.close(false)')
        assert all(hashlib.sha256(p.read_bytes()).hexdigest() == digest for p, digest in hashes.items())
        print('PASS: real Node service -> native reader -> Lua preview; local gzip root/details/protection persisted; save and SQLite bytes unchanged')
    finally:
        if service is not None:
            service.stdin.write(b'STOP\n')
            service.stdin.flush()
            service.stdin.close()
            service.wait(timeout=15)
            assert service.returncode == 0
        native_vm.close()
        os.chdir(original_cwd)
