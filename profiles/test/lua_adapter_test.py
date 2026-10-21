"""Run the adapter with the installed LuaJIT DLL, real Win32 reads and mocked X4 UI callbacks.

Usage: python profiles/test/lua_adapter_test.py <verified-installed-lua51_64.dll>
This does not start X4 or write to its installation/profile.
"""
import ctypes
import json
from pathlib import Path
import sys
import tempfile

dll = Path(sys.argv[1]).resolve(strict=True)
lua = ctypes.CDLL(str(dll))
lua.luaL_newstate.restype = ctypes.c_void_p
lua.luaL_openlibs.argtypes = [ctypes.c_void_p]
lua.luaL_loadstring.argtypes = [ctypes.c_void_p, ctypes.c_char_p]
lua.luaL_loadstring.restype = ctypes.c_int
lua.lua_pcall.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_int, ctypes.c_int]
lua.lua_pcall.restype = ctypes.c_int
lua.lua_tolstring.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_void_p]
lua.lua_tolstring.restype = ctypes.c_char_p
lua.lua_close.argtypes = [ctypes.c_void_p]
state = lua.luaL_newstate()
if not state:
    raise RuntimeError("Lua state allocation failed")
lua.luaL_openlibs(state)

def execute(source):
    if lua.luaL_loadstring(state, source.encode("utf-8")) or lua.lua_pcall(state, 0, 0, 0):
        raise RuntimeError(lua.lua_tolstring(state, -1, None).decode("utf-8", errors="replace"))

try:
    execute("callbacks={}; emitted={}; clock=1; function RegisterEvent(n,f) callbacks[n]=f end; function SetScript(n,f) callbacks[n]=f end; function getElapsedTime() return clock end; function AddUITriggeredEvent(s,c,p) emitted[#emitted+1]={s,c,p} end")
    source = Path(__file__).resolve().parents[2] / "extensions/lifesigns_event_recorder/ui/addons/ego_detailmonitor/lifesigns_database.lua"
    execute(source.read_text(encoding="utf-8"))
    with tempfile.TemporaryDirectory(prefix="lifesigns-lua-reply-") as folder:
        run = "session-1-2-loaded-2026-10-21_12-00-00"
        universe = "lsu1-2026-10-21_12-00-00-1-2-3-4"
        reply = Path(folder) / (run + ".reply")
        text = f"LSDB1|{universe}|{run}|NEED_BASELINE|1|END\n"
        reply.write_text(text, encoding="ascii")
        execute(f"run={json.dumps(run)}; universe={json.dumps(universe)}; file={json.dumps(str(reply))}; folder={json.dumps(folder + '/')}" )
        execute("assert(type(jit.version)=='string'); assert(LifeSignsDatabaseAdapter.directory()); assert(LifeSignsDatabaseAdapter.readReply(file)); assert(not LifeSignsDatabaseAdapter.readReply(file..'.missing'))")
        execute("local a=LifeSignsDatabaseAdapter; local p=a.parse(a.readReply(file),run,universe); assert(p[3]=='NEED_BASELINE' and p[4]==1); assert(not a.parse(a.readReply(file),'stale',universe)); assert(not a.parse(a.readReply(file),run,'other')); assert(not a.parse('return os.execute(1)',run,universe))")
        execute("LifeSignsDatabaseAdapter.directory=function() return folder end; callbacks.LifeSignsDatabaseRequest(nil,run..'|'..universe); callbacks.onUpdate(); assert(#emitted==1 and emitted[1][1]=='LifeSignsDatabase' and emitted[1][2]=='reply'); clock=1.3; callbacks.onUpdate(); assert(#emitted==1)")
        reply.write_text(text.replace("NEED_BASELINE|1", "READY|100"), encoding="ascii")
        execute("clock=1.6; callbacks.onUpdate(); assert(#emitted==2 and emitted[2][3][3]=='READY' and emitted[2][3][4]==100)")
        reply.write_text("x" * 4096, encoding="ascii")
        execute("assert(not LifeSignsDatabaseAdapter.readReply(file)); clock=2; callbacks.onUpdate(); assert(#emitted==2)")
    print("PASS: installed LuaJIT compilation, real Win32 reply reads, strict parsing, stale identity rejection, polling/deduplication and mocked UI return callback. X4 UI runtime remains untested.")
finally:
    lua.lua_close(state)
