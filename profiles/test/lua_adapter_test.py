"""Run the adapter with the installed LuaJIT DLL, real Win32 reads and mocked X4 UI callbacks.

Usage: python profiles/test/lua_adapter_test.py <installed-lua51_64.dll> <built-native-reader.dll>
This does not start X4 or write to its installation/profile.
"""
import ctypes
import json
from pathlib import Path
import sys
import tempfile
import os
import shutil
import hashlib
import subprocess

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


built = Path(sys.argv[2]).resolve(strict=True)
source = Path(__file__).resolve().parents[2] / "extensions/lifesigns_event_recorder/ui/addons/ego_detailmonitor/lifesigns_database.lua"
source_text = source.read_text(encoding="utf-8")
original_cwd = Path.cwd()
with tempfile.TemporaryDirectory(prefix="lifesigns-native-test-") as temporary:
    root = Path(temporary).resolve()
    assert root.parent == Path(tempfile.gettempdir()).resolve()
    game = root / "X4 Unicode \u8239"
    extension = game / "extensions/lifesigns_event_recorder"
    runtime = extension / "runtime"
    runtime.mkdir(parents=True)
    (extension / "native").mkdir()
    shutil.copyfile(built, extension / "native/lifesigns_status.dll")
    run = "session-1-2-loaded-2026-10-21_12-00-00"
    universe = "lsu1-2026-10-21_12-00-00-1-2-3-4"
    reply = runtime / (run + ".reply")
    text = f"LSDB1|{universe}|{run}|NEED_BASELINE|1|END\n"
    probe_run = "session-0-0-loaded-2026-01-01_00-00-00"
    probe_id = "lsu1-2026-01-01_00-00-00-0-0-0-0"
    (runtime / (probe_run + ".reply")).write_text(f"LSDB1|{probe_id}|{probe_run}|READY|0|END\n", encoding="ascii")
    reply.write_text(text, encoding="ascii")
    os.chdir(game)
    try:
        execute("callbacks={}; emitted={}; health={}; diagnostic={}; clock=1; function RegisterEvent(n,f) callbacks[n]=f end; function SetScript(n,f) callbacks[n]=f end; function getElapsedTime() return clock end; function GetUISafeModeOption() return false end; function DebugError(s) diagnostic[#diagnostic+1]=s end; function AddUITriggeredEvent(s,c,p) if c=='health' then health[#health+1]=p else emitted[#emitted+1]={s,c,p} end end")
        execute(source_text)
        execute("assert(#diagnostic==1 and diagnostic[1]:find('stage=NATIVE_MODULE_READY; probe=PASS',1,true)); assert(#emitted==0 and #health==0)")
        execute("probe_source=" + json.dumps(source_text))
        execute("""
local function failure(packageValue,safe,expected)
  local messages={}
  local env=setmetatable({Menus={},package=packageValue,GetUISafeModeOption=function() if safe=='throw' then error('synthetic policy failure') end; return safe end,
    RegisterEvent=function() end,SetScript=function() end,DebugError=function(s) messages[#messages+1]=s end},{__index=_G})
  local chunk=assert(loadstring(probe_source));setfenv(chunk,env);chunk()
  assert(env.LifeSignsDatabaseAdapter.readerStatus()==expected)
  assert(#messages==1 and messages[1]:find(expected,1,true))
end
failure(false,false,'NATIVE_LOADER_UNAVAILABLE')
failure({loadlib=function() return nil,'synthetic missing DLL' end},false,'NATIVE_MODULE_LOAD_FAILED')
failure({loadlib=function() return function() return {} end end},false,'NATIVE_MODULE_INTERFACE_FAILED')
failure({loadlib=function() error('must not load in protected mode') end},true,'NATIVE_MODULE_PROTECTED_MODE')
failure({loadlib=function() error('must not load with unknown policy') end},1,'NATIVE_MODULE_POLICY_UNAVAILABLE')
failure({loadlib=function() error('must not load with unknown policy') end},'throw','NATIVE_MODULE_POLICY_UNAVAILABLE')
""")
        execute("""
    local ffi=require('ffi')
    local calls=0
    function ConvertStringToLuaID(s) return s:gsub('ULL$','') end
    local function pending()
      return {crew={reassigned={roles={{tiers={{persons={{person=ffi.new('uint64_t',0xffffffffffffffffULL),newrole='marine'}}}}}}}}}
    end
    local m={name='MapMenu',infoSubmenuObject=ffi.new('uint64_t',123ULL),infoTablePersistentData={left=pending()}}
    LifeSignsDatabaseAdapter.readPersonRole=function(seed,host) assert(tostring(seed)=='18446744073709551615ULL' and tostring(host)=='123ULL'); return 'marine' end
    m.infoSubmenuConfirmCrewChanges=function(instance,a)
      calls=calls+1; assert(a=='unchanged');m.infoTablePersistentData[instance].crew.reassigned.roles={}; return nil, 'second', nil
    end
    LifeSignsDatabaseAdapter.installPersonnelObserver({m})
    LifeSignsDatabaseAdapter.installPersonnelObserver({m})
    local function results(...) return {n=select('#',...),...} end
    local r=results(m.infoSubmenuConfirmCrewChanges('left','unchanged'))
    assert(calls==1 and r.n==3 and r[1]==nil and r[2]=='second' and r[3]==nil)
    assert(#emitted==1 and emitted[1][1]=='LifeSignsPersonnel' and emitted[1][2]=='role_changed')
    assert(emitted[1][3][1]=='123' and emitted[1][3][2]=='18446744073709551615' and emitted[1][3][3]=='marine' and emitted[1][3][4]=='marine')
    local broken={name='MapMenu',infoSubmenuObject=123,infoTablePersistentData={left=pending()},infoSubmenuConfirmCrewChanges=function() error('original failure') end}
    LifeSignsDatabaseAdapter.installPersonnelObserver({broken})
    assert(not pcall(broken.infoSubmenuConfirmCrewChanges,'left'));assert(#emitted==1)
    emitted={}
    """)

        execute("""
    local ffi=require('ffi')
    local a=LifeSignsDatabaseAdapter
    local calls=0
    local names={['123ULL']='Old | name'}
    a.readComponentName=function(object) return names[tostring(object)] end
    local m={name='MapMenu'}
    local function context(fleet,text) m.contextMenuData={component=ffi.new('uint64_t',123ULL),newtext=text,fleetrename=fleet} end
    m.buttonRenameConfirm=function(confirmed,extra)
      calls=calls+1;assert(extra=='extra')
      local d=m.contextMenuData
      if confirmed and d.newtext and not d.fleetrename then names[tostring(d.component)]=d.newtext end
      m.contextMenuData=nil
      return nil,'second',nil
    end
    m.infoChangeObjectName=function(object,text,changed,extra)
      calls=calls+1;assert(extra=='extra')
      if changed then names[tostring(object)]=text end
      return 'first',nil,'third'
    end
    a.installRenameObservers({m});a.installRenameObservers({m})
    local function results(...) return {n=select('#',...),...} end
    context(false,'New | name')
    local r=results(m.buttonRenameConfirm(true,'extra'))
    assert(calls==1 and r.n==3 and r[1]==nil and r[2]=='second' and r[3]==nil)
    assert(#emitted==1 and emitted[1][1]=='LifeSignsProfiles' and emitted[1][2]=='name_changed')
    local p=emitted[1][3];assert(p[1]=='123' and p[2]=='Old | name' and p[3]=='PRESENT' and p[4]=='New | name' and p[5]=='MAP_RENAME_DIALOG')
    context(false,'Cancelled');m.buttonRenameConfirm(false,'extra');assert(#emitted==1)
    context(true,'Fleet label');m.buttonRenameConfirm(true,'extra');assert(#emitted==1)
    context(false,nil);m.buttonRenameConfirm(true,'extra');assert(#emitted==1)
    r=results(m.infoChangeObjectName(ffi.new('uint64_t',123ULL),'Info name',true,'extra'))
    assert(calls==5 and r.n==3 and r[1]=='first' and r[2]==nil and r[3]=='third')
    p=emitted[2][3];assert(p[2]=='New | name' and p[4]=='Info name' and p[5]=='MAP_INFO_EDIT')
    m.infoChangeObjectName(ffi.new('uint64_t',123ULL),'ignored',false,'extra');assert(#emitted==2)
    a.readComponentName=function() error('getter unavailable') end
    m.infoChangeObjectName(ffi.new('uint64_t',123ULL),'After unknown',true,'extra')
    p=emitted[3][3];assert(p[2]=='' and p[3]=='UNKNOWN')
    local broken={name='MapMenu',buttonRenameConfirm=function() error('original rename failure') end,contextMenuData={component=123,newtext='x'}}
    a.installRenameObservers({broken});assert(not pcall(broken.buttonRenameConfirm,true));assert(#emitted==3)
    local event=AddUITriggeredEvent;AddUITriggeredEvent=function() error('observer failure') end
    m.infoChangeObjectName(ffi.new('uint64_t',123ULL),'Still changes',true,'extra');assert(names['123ULL']=='Still changes')
    AddUITriggeredEvent=event
    emitted={}
    """)
        execute(f"run={json.dumps(run)}; universe={json.dumps(universe)}")
        execute("native=assert(package.loadlib('./extensions/lifesigns_event_recorder/native/lifesigns_status.dll','luaopen_lifesigns_status'))(); assert(type(native.readReply)=='function')")
        execute("local a=LifeSignsDatabaseAdapter; assert(a.readerStatus()=='NATIVE_MODULE_READY'); assert(a.readReply(run)); local p=a.parse(a.readReply(run),run,universe); assert(p[3]=='NEED_BASELINE' and p[4]==1); assert(not a.parse(a.readReply(run),'stale',universe)); assert(not a.parse(a.readReply(run),run,'other')); assert(not a.parse('return os.execute(1)',run,universe))")
        execute("for _,bad in ipairs({'../escape','C:/secret','session-01-2-loaded-2026-10-21_12-00-00','session-2147483648-2-loaded-2026-10-21_12-00-00',run..string.char(0)..'x',run..'/x'}) do local s,e=native.readReply(bad);assert(s==nil and e=='INVALID_RUN') end; assert(not native.readReply()); assert(not native.readReply(123)); assert(not native.readReply({})); assert(not native.readReply(run,'extra'))")
        execute("local s,e=native.readReply('session-3-4-loaded-2026-10-21_12-00-00'); assert(not s and e=='MISSING')")
        before = hashlib.sha256(reply.read_bytes()).hexdigest()
        kernel = ctypes.WinDLL('kernel32',use_last_error=True)
        kernel.GetCurrentProcess.restype = ctypes.c_void_p
        kernel.GetProcessHandleCount.argtypes = [ctypes.c_void_p, ctypes.POINTER(ctypes.c_ulong)]
        def handles():
            count=ctypes.c_ulong()
            assert kernel.GetProcessHandleCount(kernel.GetCurrentProcess(),ctypes.byref(count))
            return count.value
        execute("for i=1,20 do assert(native.readReply(run)) end")
        count_before=handles()
        execute("for i=1,1000 do assert(native.readReply(run)) end")
        assert handles() <= count_before+1, 'native file handles leaked'
        assert hashlib.sha256(reply.read_bytes()).hexdigest()==before
        execute("callbacks.LifeSignsDatabaseRequest(nil,run..'|'..universe); callbacks.onUpdate(); assert(#emitted==1 and emitted[1][1]=='LifeSignsDatabase'); clock=1.3; callbacks.onUpdate(); assert(#emitted==1)")
        reply.write_text(text.replace('NEED_BASELINE|1','READY|100'),encoding='ascii')
        execute("clock=1.6; callbacks.onUpdate(); assert(#emitted==2 and emitted[2][3][3]=='READY' and emitted[2][3][4]==100)")
        for data,expected in [(b'x'*4096,'FILE_SIZE'),(b'','FILE_SIZE'),(text.rstrip('\n').encode(),'INCOMPLETE'),(text.replace('READY','READY\n').encode() if 'READY' in text else text.replace('NEED_BASELINE','NEED\nBASELINE').encode(),'INCOMPLETE'),(text.replace('NEED_BASELINE','NEED\x00BASELINE').encode(),'INVALID_BYTES')]:
            reply.write_bytes(data)
            execute(f"local s,e=native.readReply(run);assert(s==nil and e=={json.dumps(expected)},tostring(e))")
        reply.write_text(text,encoding='ascii')
        alias=root/'hardlink.reply';os.link(reply,alias)
        execute("local s,e=native.readReply(run);assert(not s and e=='FILE_TYPE')")
        alias.unlink()
        # Replace only our temporary runtime directory with a junction into this fixture.
        saved_runtime=extension/'runtime-original';assert saved_runtime.is_relative_to(root)
        runtime.rename(saved_runtime)
        target=game/'other-replies';target.mkdir()
        quote=lambda p:"'"+str(p).replace("'","''")+"'"
        command='New-Item -ItemType Junction -Path '+quote(runtime)+' -Target '+quote(target)+' | Out-Null'
        subprocess.run(['powershell','-NoProfile','-Command',command],check=True,capture_output=True)
        execute("local s,e=native.readReply(run);assert(not s and e=='RUNTIME_DIRECTORY')")
        assert runtime.resolve().is_relative_to(root)
        os.rmdir(runtime)
        saved_runtime.rename(runtime)
        execute("assert(native.readReply(run)); assert(health[1][3]=='REQUEST_RECEIVED' and health[2][3]=='REPLY_FORWARDED')")
        print('PASS: actual compiled Lua module, Unicode path, bounded read-only replies, loader failure/protected-mode gates, traversal/argument/size/content/hard-link/junction rejection, handle closure, real DLL-to-adapter replies and crew callback preservation. Native X4 loading still requires owner probe.')
    finally:
        lua.lua_close(state)
        os.chdir(original_cwd)
