"""Installed LuaJIT with mocked menu/status callbacks; no X4 launch or files changed.

Usage: python profiles/test/menu_startup_lua_test.py <lua51_64.dll>
"""
import ctypes
from pathlib import Path
import sys

lua = ctypes.CDLL(str(Path(sys.argv[1]).resolve(strict=True)))
lua.luaL_newstate.restype = ctypes.c_void_p
lua.luaL_openlibs.argtypes = [ctypes.c_void_p]
lua.luaL_loadstring.argtypes = [ctypes.c_void_p, ctypes.c_char_p]
lua.lua_pcall.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_int, ctypes.c_int]
lua.lua_tolstring.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_void_p]
lua.lua_tolstring.restype = ctypes.c_char_p
lua.lua_close.argtypes = [ctypes.c_void_p]
source = (Path(__file__).resolve().parents[2] / 'extensions/lifesigns_event_recorder/ui/addons/ego_detailmonitor/lifesigns_housekeeping.lua').read_text()

for launch in range(2):
    state = lua.luaL_newstate()
    lua.luaL_openlibs(state)

    def run(text):
        if lua.luaL_loadstring(state, text.encode()) or lua.lua_pcall(state, 0, 0, 0):
            raise AssertionError(lua.lua_tolstring(state, -1, None).decode(errors='replace'))

    try:
        run(r'''
clock=0;messages={};seen={};generation=string.rep('1',32)
hello='LSDB1|HOUSEKEEPING|HELLO|'..generation..'|139|INACTIVE|END\n'
LifeSignsDatabaseAdapter={readReply=function() return hello end}
function getElapsedTime() return clock end
function DebugError(text) messages[#messages+1]=text end
menu={name='OptionsMenu',isStartmenu=true,currentOption='main',table={},createOptionsFrame=function() end}
function menu.displayOption(_,data) seen[#seen+1]=data end
function menu.displayOptions(name) menu.currentOption=name;menu.displayOption({}, {id='settings'});return 'native',nil,42 end
function menu.onUpdate() end
Menus={menu}
''')
        run(source)
        run(r'''
P=LifeSignsHousekeeping;P.render=function() P.dirty=false end
local a,b,c=menu.displayOptions('main')
assert(a=='native' and b==nil and c==42)
assert(#seen==2 and seen[1].id=='lifesigns_housekeeping','Old INACTIVE must not hide the entry on a fresh launch')
seen[1].callback()
assert(P.active and not P.live and P.stale and P.state=='UNAVAILABLE')
assert(P.pending==nil and P.gen==nil and #messages==0,'Stale status must never authorise a request')
assert(not __LIFESIGNS_HOUSEKEEPING_WORLD_SEEN,'Disk status is not evidence this Lua runtime entered gameplay')
local clean,restore=P.rowActions({'1','Universe','1','1 MB','In use; Restore point recorded'})
assert(not clean and not restore)
-- No file/one fixed heartbeat is not a running companion. Two changing observations are still required.
hello=nil;clock=1;P.update();assert(not P.live and #messages==0)
hello='LSDB1|HOUSEKEEPING|HELLO|'..generation..'|1|PRODUCTION|END\n'
clock=2;P.update();assert(not P.live and P.pending==nil)
clock=3;P.update();assert(not P.live and P.pending==nil)
hello='LSDB1|HOUSEKEEPING|HELLO|'..generation..'|2|PRODUCTION|END\n'
clock=4;P.update();assert(P.live and P.pending.verb=='REFRESH' and #messages==1)
-- A genuine transition to INACTIVE revokes all live/action state immediately.
hello='LSDB1|HOUSEKEEPING|HELLO|'..generation..'|3|INACTIVE|END\n'
clock=4.3;P.update()
assert(P.active and P.initial(menu),'Keep a visible unavailable view without inventing a world transition')
assert(not P.live and P.stale and P.state=='UNAVAILABLE' and P.pending==nil and P.gen==nil)
local count=#messages;P.request('APPLY',1);P.extra('DELETEUNIVERSE',1,'anything')
assert(#messages==count,'No action request may use an inactive generation')
-- Reconnection after unavailable status requires fresh changing observations again.
hello='LSDB1|HOUSEKEEPING|HELLO|'..generation..'|4|PRODUCTION|END\n'
clock=5;P.update();assert(not P.live)
hello='LSDB1|HOUSEKEEPING|HELLO|'..generation..'|5|PRODUCTION|END\n'
clock=6;P.update();assert(P.live and P.pending.verb=='REFRESH')
-- Existing same-process gameplay exclusion is preserved.
P.worldObserved();assert(not P.active and not P.initial(menu))
seen={};menu.displayOptions('main');assert(#seen==1 and seen[1].id=='settings')
''')
        print(f'PASS: launch {launch + 1}: stale INACTIVE visibility, no permission, reconnect, revocation and gameplay exclusion')
    finally:
        lua.lua_close(state)
