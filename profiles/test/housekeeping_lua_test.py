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
clock=0;messages={};replies={};labels={};buttons={};editboxes={};seen={};vanillaUpdates=0;vanillaCloses=0;displays=0
function getElapsedTime() return clock end
function DebugError(text) messages[#messages+1]=text end
LifeSignsDatabaseAdapter={readReply=function(file) return replies[file] end}
local function cell(row)
 local c={handlers={}}
 function c:setColSpan() return self end
 function c:setBackgroundColSpan() return self end
 function c:setIcon() return self end
 function c:createText(text,properties) labels[#labels+1]=text;self.textProperties=properties;row.height=math.max(row.height,properties and properties.minRowHeight or 16);return self end
 function c:createButton(properties) assert(row.rowdata,'Button defined in an unselectable row');self.properties=properties;row.height=math.max(row.height,properties.height or 19);buttons[#buttons+1]=self;return self end
 function c:setText(text,properties) self.text=text;self.textProperties=properties;return self end
 function c:createEditBox(properties) editboxes[#editboxes+1]=self;self.properties=properties;row.height=math.max(row.height,properties.height or 19);return self end
 function c:createCheckBox(value,properties) self.check=value;self.properties=properties;row.height=math.max(row.height,19);return self end
 return c
end
local function makeTable(properties)
 local t={properties=properties or {},rows={},widths={}}
 function t:addRow(data,properties) local row={height=0,rowdata=data,properties=properties or {}};for i=1,6 do row[i]=cell(row) end;self.rows[#self.rows+1]=row;return row end
 function t:setColWidthPercent(col,width) self.widths[col]=width;return self end
 function t:setColWidth(col,width) self.widths[col]=width;return self end
 function t:getVisibleHeight() local height=0;for _,row in ipairs(self.rows) do height=height+row.height end;return math.min(height,self.properties.maxVisibleHeight or height) end
 return t
end
local t=makeTable()
-- Match the engine validation that previously escaped the widget mock.
do
 local ok,err=pcall(function() t:addRow(false)[1]:createButton({active=false}) end)
 assert(not ok and string.find(err,'Button defined in an unselectable row',1,true))
end
local f={addTable=function(_,columns,properties) local result=makeTable(properties);result.index=#renderTables+1;renderTables[#renderTables+1]=result;tableProperties=properties;columnWidths=result.widths;return result end,display=function() displays=displays+1;tableProperties=renderTables[3].properties;columnWidths=renderTables[3].widths end}
Color={row_title={r=0,g=128,b=255,a=100}}
Helper={borderSize=3,clearDataForRefresh=function() end,scaleX=function(v) return v end,scaleY=function(v) return v end}
menu={name='OptionsMenu',isStartmenu=true,currentOption='main',table={x=0,y=0,width=710,widthExtraWide=1130,arrowColumnWidth=20,height=900},createOptionsFrame=function(wide) wideFrame=wide;renderTables={};buttons={};labels={};editboxes={};return f end}
function menu.displayOption(_,option) seen[#seen+1]=option;return 'option',nil,42 end
function menu.displayOptions(name,...)
 menu.currentOption=name
 menu.displayOption(t,{id='continue'})
 menu.displayOption(t,{id='settings'})
 menu.displayOption(t,{id='new'})
 return 'preserved',nil,42
end
function menu.onUpdate()
 vanillaUpdates=vanillaUpdates+1
 if menu.delayedRefresh and menu.delayedRefresh<clock then menu.delayedRefresh=nil;menu.displayOptions('main') end
end
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
    progress = frame(client, seq, state='SCANNING', rows=[['PROGRESS', 'SAVES', '2', '', '']])
    vm.run('assert(P.parse(' + literal(progress) + ',P.pending).progress=="Checking saves: 2 checked.")')
    for data in [['PROGRESS', 'DATABASES', '3', '2', ''], ['PROGRESS', 'SAVES', '2', '3', ''], ['PROGRESS', 'PATH', '0', '', ''], ['PROGRESS', 'SAVES', '-1', '', '']]:
        vm.run('assert(P.parse(' + literal(frame(client, seq, state='SCANNING', rows=[data])) + ',P.pending)==nil)')
    reply(REPLY, progress)
    vm.run('clock=1.36;P.update();assert(P.state=="SCANNING" and P.pending and P.stale and #P.rows==0);P.render();assert(table.concat(labels," "):find("Checking saves: 2 checked.",1,true));P.lastPoll=nil')
    good = frame(client, seq, rows=row)
    for bad in [good.replace(client, OTHER), good.replace(GEN, OTHER), good.replace('|READY|', '|DELETE|'), good.rstrip('\n'), good + 'extra', good.replace('|0|1|1|', '|0|1|4|'), frame(client, seq, rows=row, page=1, pages=2)]:
        vm.run('assert(P.parse(' + literal(bad) + ',P.pending)==nil)')
    reply(REPLY, good)
    vm.run('clock=1.4;P.update();assert(P.state=="READY" and not P.stale and P.progress==nil and P.rows[1][2]=="Universe 1");P.render();assert(table.concat(labels," "):find(P.copy.notice,1,true));P.refresh();assert(P.stale and #P.rows==1);P.render();assert(table.concat(labels," "):find("Previous results - stale",1,true))')
    vm.run('assert(wideFrame==true and tableProperties.width==1107 and columnWidths[1]==18 and columnWidths[2]==18 and columnWidths[3]==24);assert(#renderTables==5);local controls,data,pager,notes=renderTables[2],renderTables[3],renderTables[4],renderTables[5];assert(controls.properties.width<data.properties.width and pager.properties.width<data.properties.width);assert(data.properties.y>controls.properties.y+controls:getVisibleHeight());assert(pager.properties.y>=data.properties.y+data:getVisibleHeight());assert(notes.properties.y>pager.properties.y+pager:getVisibleHeight());assert(notes.properties.y+notes:getVisibleHeight()<=menu.table.height);assert(renderTables[1].rows[1][2].textProperties.fontsize==13 and renderTables[1].rows[1][2].textProperties.titleColor==Color.row_title);assert(data.rows[1][1].textProperties.minRowHeight==22);assert(controls.properties.nextTable==data.index and pager.properties.prevTable==data.index)')
    vm.run(r'''
local oldRows,oldState,oldStale=P.rows,P.state,P.stale
P.testMode=true;P.state="READY";P.stale=false
local function actions(status,clean,restore,id)
 local a,b=P.rowActions({id or "1","Universe 1","1","1 MB",status});assert(a==clean and b==restore,status)
end
actions("In use; Restore point recorded",true,true)
actions("In use; Restore point recorded; Protected",false,false)
actions("Needs attention; Restore point recorded; Protected",false,false)
actions("In use; No cleanup needed; Restore point recorded",false,true)
actions("In use",true,false);actions("Possibly unused",false,false)
actions("Possibly unused; Restore point recorded",false,true)
actions("In use; backup",true,false);actions("Unknown; Restore point recorded",false,false)
actions("In use; Restore point recorded",false,false,"0")
actions("In use; Restore point recorded",false,false,"invalid")
P.stale=true;actions("In use; Restore point recorded",false,false);P.stale=false
for _,state in ipairs({"SCANNING","STALE","ERROR","UNAVAILABLE","CANCELLED"}) do P.state=state;actions("In use; Restore point recorded",false,false) end
P.state="READY";P.mutating=true;actions("In use; Restore point recorded",false,false);P.mutating=false
P.rows={{"1","Universe 1","1","1 MB","In use; Restore point recorded; Protected"},{"2","Universe 2","1","1 MB","In use; Restore point recorded"}}
P.render();local data=renderTables[3]
assert(data.rows[1].properties.bgColor.a==98 and data.rows[2].properties.bgColor.a==92 and data.rows[3].properties.bgColor.a==92)
assert(data.rows[2].properties.bgColor.r~=data.rows[3].properties.bgColor.r)
assert(data.rows[2].rowdata==true and data.properties.highlightMode==nil)
assert(data.rows[2][5].properties.bgColor==nil and data.rows[2][5].properties.highlightColor==nil)
assert(data.rows[2][5].properties.active==false and data.rows[2][6].properties.active==false)
assert(data.rows[3][5].properties.active==true and data.rows[3][6].properties.active==true)
for _,row in ipairs(renderTables[5].rows) do assert(row.properties.bgColor==nil) end
for _,tab in ipairs({renderTables[3],renderTables[5]}) do for _,row in ipairs(tab.rows) do for _,c in ipairs(row) do if c.textProperties then assert(c.textProperties.fontsize==10) end end end end
P.rows=oldRows;P.state=oldState;P.stale=oldStale;P.testMode=false
''')
    ten = frame(client, int(vm.run('return tostring(P.seq)', True)), rows=[[str(i), f'Universe {i}', '1', '1.25 GB', 'In use'] for i in range(1, 11)])
    vm.run('assert(#P.parse(' + literal(ten) + ',P.pending).rows==10);local e={gen=P.gen,seq=P.seq,page=0,verb="DETAIL"};assert(P.parse(' + literal(ten) + ',e)==nil)')
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
    vm.run('clock=2.8;menu.onUpdate();local before=displays;clock=2.81;menu.onUpdate();clock=2.82;menu.onUpdate();assert(displays==before);P.select("1");assert(P.view=="DETAIL" and P.selected==1)')
    detail_seq = int(vm.run('return tostring(P.seq)', True))
    detail = [['INFO', 'Protection', 'Not protected', 'Whole universe', ''], ['SAVE', 'Local saves', 'A|B 船.xml.gz', 'Unknown', 'Filesystem modified UTC']]
    reply(REPLY, frame(client, detail_seq, rows=detail))
    vm.run('clock=3.1;P.update();assert(P.protected==false and P.rows[2][3]=="A|B 船.xml.gz");P.render();P.locations();assert(P.pending.verb=="LOCATIONS")')
    vm.run('P.view="DETAIL";P.selected=1;P.protected=false;P.page=1;P.request("PROTECT",1,true,1)')
    protect_seq = int(vm.run('return tostring(P.seq)', True))
    reply(REPLY, frame(client, protect_seq, rows=[['SAVE','File modified (UTC)','save.xml','Unknown','location-1/save.xml']], page=1, pages=2))
    vm.run('clock=3.36;P.update();assert(P.state=="READY" and P.view=="DETAIL" and P.page==1 and P.selected==1 and P.protected==true);local before=#messages;menu.onCloseElement();assert(P.view=="LIST" and messages[#messages]:find("|LIST|",1,true) and #messages==before+2);P.lastPoll=nil')
    vm.run('assert(columnWidths[1]==20 and columnWidths[2]==24 and columnWidths[3]==18);P.view="LOCATIONS";P.render();assert(columnWidths[2]==58)')
    reply(HELLO, f'LSDB1|HOUSEKEEPING|HELLO|{OTHER}|1|INITIAL|END\n')
    vm.run('clock=3.4;P.update();assert(P.state=="STALE" and P.pending==nil and not P.live)')
    reply(HELLO, f'LSDB1|HOUSEKEEPING|HELLO|{OTHER}|2|INITIAL|END\n')
    vm.run('clock=4.5;P.update();assert(P.live);clock=11;P.update();assert(P.state=="UNAVAILABLE" and P.stale)')
    vm.run(r'''
-- Neither mouse Back nor keyboard close may synchronously rebuild the main menu.
for _,keyboard in ipairs({false,true}) do
 P.view="LIST";seen={};local before=#messages;local cancel=P.gen and 1 or 0
 if keyboard then menu.onCloseElement("back") else P.back() end
 assert(not P.active and P.pending==nil and #seen==0 and #messages==before+cancel)
 assert(menu.onUpdate==P.nativeUpdate and menu.delayedRefresh<clock)
 menu.onUpdate();assert(menu.delayedRefresh==nil and #seen==4 and seen[2].id=="lifesigns_housekeeping")
 P.open(menu);assert(P.active and menu.onUpdate==P.menuUpdate)
end
P.worldObserved();assert(not P.active and not P.initial(menu));menu.onUpdate();assert(vanillaUpdates>0);menu.onCloseElement();assert(vanillaCloses==1)
''')
    for stage, total in [('FOLDERS', ''), ('XML_HEADERS', '4'), ('SAVE_LOCKS', '4'), ('SAVE_HASHES', '4'), ('SAVE_HASH_RECHECK', '4')]:
        seq = int(vm.run('return tostring(P.seq)', True))
        payload = frame(client, seq, state='SCANNING', rows=[['PROGRESS', stage, '2', total, '']])
        vm.run('local p=P.parse(' + literal(payload) + ',{gen=' + literal(GEN) + ',seq=' + str(seq) + ',page=0,verb="REFRESH"});assert(p and p.progress and p.progress:find("2",1,true))')
    print('PASS: actual LuaJIT compile/run; anchored injection, vanilla callbacks, correlation, stale/late/restart/close, Unicode, details, protection state, scan phases and unavailable companion')
finally:
    vm.close()

# The unchanged first-party reader accepts reserved preview frames from a Unicode
# disposable extension root. No broader filesystem/native interface is introduced.
original_cwd = Path.cwd()
with tempfile.TemporaryDirectory(prefix='ls-ui-') as temporary:
    root = Path(temporary)
    extension = root / 'Unicode 船' / 'extensions/lifesigns_event_recorder'
    (extension / 'native').mkdir(parents=True)
    (extension / 'runtime').mkdir()
    shutil.copyfile(Path(sys.argv[2]).resolve(strict=True), extension / 'native/lifesigns_status.dll')
    native_frame = frame('2' * 32, 1, rows=[[str(i), f'Universe 船 {i}', '1', '1.25 GB', 'In use'] for i in range(1, 11)])
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
        saves = storage / 'save'
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
            raise AssertionError('Actual companion/native/Lua preview timed out: ' + str(native_vm.run('return P.state', True)) + ' frame=' + str(native_vm.run('return native.readReply(' + literal(REPLY) + ')', True)))
        await_ready('LIST')
        native_vm.run('assert(P.rows[1][2]=="Universe 1" and P.rows[1][3]=="1" and P.rows[1][5]=="In use");P.select("1")')
        await_ready('DETAIL')
        native_vm.run('assert(P.protected==false);P.request("PROTECT",1,true)')
        await_ready('DETAIL')
        native_vm.run('assert(P.protected==true and P.selected==1);P.back()')
        await_ready('LIST')
        assert json.loads(settings_file.read_text())['protectedUniverses'] == [universe]
        native_vm.run('assert(P.rows[1][5]=="In use; Protected");P.close(false)')
        assert all(hashlib.sha256(p.read_bytes()).hexdigest() == digest for p, digest in hashes.items())
        print('PASS: real Node service -> native reader -> Lua preview; local gzip root/details/protection persisted; save and SQLite bytes unchanged')
        service.stdin.write(b'STOP\n');service.stdin.flush();service.stdin.close();service.wait(timeout=15)
        assert service.returncode == 0
        service = None
        isolated_setup = """
import {ProfileStore} from STORE;
import {createMenuTest} from MAINTENANCE;
const [root,u,run,save,db]=process.argv.slice(1),s=new ProfileStore(root,u,run);
s.ingest([{run,session:'UNAVAILABLE',seq:'1',age:'4',kind:'ENTITY_EVENT',fields:{record:'4',subject_kind:'SHIP',event_type:'ATTACKED',subject_seed:'42'}}]);s.close();
await createMenuTest(root,{saveFiles:[save],profileFiles:[db]});
""".replace('STORE', literal((repo / 'profiles/store.mjs').as_uri())).replace('MAINTENANCE', literal((repo / 'profiles/maintenance-test.mjs').as_uri()))
        subprocess.run(['node','--input-type=module','-e',isolated_setup,str(storage),universe,run,str(save),str(db)],check=True,capture_output=True,timeout=60)
        original_hashes = {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in [db, save]}
        service = subprocess.Popen(args, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            if '|TEST|END' in (extension / 'runtime' / (HELLO + '.reply')).read_text():
                break
            time.sleep(0.05)
        native_vm.run((repo / 'extensions/lifesigns_event_recorder/ui/addons/ego_detailmonitor/lifesigns_housekeeping.lua').read_text(encoding='utf-8'))
        native_vm.run('P=LifeSignsHousekeeping;messages={};clock=0;P.open(menu)')
        sent = 0
        beginning = time.monotonic()
        await_ready('LIST')
        native_vm.run('assert(P.testMode);P.render();local found=false;for _,b in ipairs(buttons) do if b.text=="Clean..." and b.properties.active then found=true end end;assert(found);P.review("1",false)')
        await_ready('CONFIRM')
        native_vm.run('assert(P.rows[1][2]=="TEST COPY universe");P.render();local clicked=false;for _,b in ipairs(buttons) do if b.text=="Confirm cleanup" and b.properties.active then b.handlers.onClick();clicked=true;break end end;assert(clicked and P.mutating)')
        await_ready('RESULT')
        native_vm.run('assert(P.rows[2][2]=="Cleanup completed");P.back()')
        await_ready('LIST')
        native_vm.run('assert(P.rows[1][5]:find("Restore point recorded",1,true));P.review("1",true)')
        await_ready('CONFIRM')
        native_vm.run('P.render();local clicked=false;for _,b in ipairs(buttons) do if b.text=="Confirm restoration" and b.properties.active then b.handlers.onClick();clicked=true;break end end;assert(clicked)')
        await_ready('RESULT')
        native_vm.run('assert(P.rows[2][2]=="Restoration completed");P.close(false)')
        assert all(hashlib.sha256(p.read_bytes()).hexdigest() == digest for p,digest in original_hashes.items())
        print('PASS: real Lua buttons -> debug transport -> Node test worker -> backup/prune/selected restore -> native reply; original source save/DB unchanged')
        service.stdin.write(b'STOP\n');service.stdin.flush();service.stdin.close();service.wait(timeout=15)
        assert service.returncode == 0
        service = None
        production_setup = """
import fs from 'node:fs';import path from 'node:path';
import {registerProduction,contentDigest} from CONTRACT;import {DatabaseSync} from 'node:sqlite';
const [root,saves,file]=process.argv.slice(1),c=registerProduction(root,path.join(root,'production-anchor.json'));
fs.mkdirSync(path.join(c.directory,'local-data'));fs.writeFileSync(path.join(c.directory,'local-data/housekeeping-preview-v1.json'),JSON.stringify({owner:'LifeSignsReadOnlyPreview',version:1,saveLocations:[saves],protectedUniverses:[]}));
const db=new DatabaseSync(file,{readOnly:true});console.log(contentDigest(db));db.close();
""".replace('CONTRACT', literal((repo / 'profiles/production-contract.mjs').as_uri()))
        before_history = subprocess.run(['node','--input-type=module','-e',production_setup,str(storage),str(saves),str(db)],check=True,capture_output=True,text=True).stdout.strip()
        service = subprocess.Popen(args, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            if '|PRODUCTION|END' in (extension / 'runtime' / (HELLO + '.reply')).read_text():
                break
            time.sleep(0.05)
        native_vm.run((repo / 'extensions/lifesigns_event_recorder/ui/addons/ego_detailmonitor/lifesigns_housekeeping.lua').read_text(encoding='utf-8'))
        native_vm.run('P=LifeSignsHousekeeping;messages={};clock=0;P.open(menu)')
        sent = 0
        beginning = time.monotonic()
        await_ready('LIST')
        native_vm.run('assert(P.productionMode and not P.testMode);P.render();assert(table.concat(labels," "):find("Manage actual Life Signs universe history",1,true));P.review("1",false)')
        await_ready('CONFIRM')
        native_vm.run('assert(P.rows[1][2]=="Universe history");P.render();for _,b in ipairs(buttons) do if b.text=="Confirm cleanup" and b.properties.active then b.handlers.onClick();break end end;assert(P.mutating)')
        await_ready('RESULT')
        native_vm.run('assert(P.rows[2][2]=="Cleanup completed");P.back()')
        await_ready('LIST')
        native_vm.run('assert(P.rows[1][5]:find("No cleanup needed",1,true));P.review("1",true)')
        await_ready('CONFIRM')
        native_vm.run('P.render();for _,b in ipairs(buttons) do if b.text=="Confirm restoration" and b.properties.active then b.handlers.onClick();break end end;assert(P.mutating)')
        await_ready('RESULT')
        native_vm.run('assert(P.rows[2][2]=="Restoration completed");P.close(false)')
        inspect = "import {DatabaseSync} from 'node:sqlite';import {contentDigest} from CONTRACT;const db=new DatabaseSync(process.argv[1],{readOnly:true});console.log(contentDigest(db));db.close();".replace('CONTRACT', literal((repo / 'profiles/production-contract.mjs').as_uri()))
        after_history = subprocess.run(['node','--input-type=module','-e',inspect,str(db)],check=True,capture_output=True,text=True).stdout.strip()
        assert before_history == after_history
        assert hashlib.sha256(save.read_bytes()).hexdigest() == original_hashes[save]
        print('PASS: production Lua confirmation -> native transport -> Windows handle-excluded staging install and selected restore; all prior history rows restored')
        archive = storage / 'Archives \u65e5\u672c\u8a9e'
        archive.mkdir()
        (archive / 'archive.xml.gz').write_bytes(save.read_bytes())
        native_vm.run('P.open(menu)')
        await_ready('LIST')
        native_vm.run('P.locations()')
        await_ready('LOCATIONS')
        native_vm.run('P.render();assert(#editboxes==1);editboxes[1].handlers.onEditBoxDeactivated(nil,' + literal(str(archive)) + ',true);P.render();local clicked=false;for _,b in ipairs(buttons) do if b.text=="Add folder" and b.properties.active then b.handlers.onClick();clicked=true;break end end;assert(clicked)')
        await_ready('LOCATIONS')
        registration = json.loads((storage / 'local-data/housekeeping-production.json').read_text())
        production_settings = storage / 'local-data' / ('housekeeping-' + registration['id']) / 'local-data/housekeeping-preview-v1.json'
        assert str(archive) in json.loads(production_settings.read_text(encoding='utf-8'))['saveLocations'], (json.loads(production_settings.read_text(encoding='utf-8')), str(archive), native_vm.run('return messages[#messages]', True), native_vm.run('return P.locationInput', True))
        native_vm.run('P.back()')
        await_ready('LIST')
        native_vm.run('P.locations()')
        await_ready('LOCATIONS')
        native_vm.run('P.render();local clicked=false;for _,b in ipairs(buttons) do if b.text=="Remove" and b.properties.active then b.handlers.onClick();clicked=true;break end end;assert(clicked)')
        await_ready('LOCATIONS')
        assert json.loads(production_settings.read_text(encoding='utf-8'))['saveLocations'] == [str(saves)]
        assert (archive / 'archive.xml.gz').read_bytes() == save.read_bytes()
        print('PASS: native editbox callback -> bounded Unicode path transport -> persistent archive add/remove/rescan; mandatory native location and save bytes preserved')
        native_vm.run('P.back()')
        await_ready('LIST')
        native_vm.run('P.review("1",false)')
        await_ready('CONFIRM')
        native_vm.run('P.render();for _,b in ipairs(buttons) do if b.text=="Confirm cleanup" and b.properties.active then b.handlers.onClick();break end end')
        await_ready('RESULT')
        native_vm.run('P.back()')
        await_ready('LIST')
        native_vm.run('P.select("1")')
        await_ready('DETAIL')
        native_vm.run('P.render();local clicked=false;for _,b in ipairs(buttons) do if b.text=="Reclaim disk space..." and b.properties.active then b.handlers.onClick();clicked=true;break end end;assert(clicked)')
        await_ready('CONFIRM')
        native_vm.run('P.render();for _,b in ipairs(buttons) do if b.text=="Confirm compaction" and b.properties.active then b.handlers.onClick();break end end;assert(P.mutating)')
        await_ready('RESULT')
        native_vm.run('assert(P.rows[2][2]=="Compaction completed");P.back()')
        await_ready('LIST')
        native_vm.run('P.select("1")')
        await_ready('DETAIL')
        native_vm.run('P.render();for _,b in ipairs(buttons) do if b.text=="Restore points..." and b.properties.active then b.handlers.onClick();break end end')
        await_ready('BACKUPS')
        native_vm.run('P.render();local clicked=false;for _,b in ipairs(buttons) do if b.text=="Delete..." and b.properties.active then b.handlers.onClick();clicked=true;break end end;assert(clicked)')
        await_ready('CONFIRM')
        native_vm.run('P.render();for _,b in ipairs(buttons) do if b.text=="Confirm delete restore point" and b.properties.active then b.handlers.onClick();break end end')
        await_ready('RESULT')
        native_vm.run('assert(P.rows[1][2]=="Restore point deleted")')
        peer_universe = 'lsu1-2026-10-30_12-00-00-5-6-7-8'
        peer_run = 'session-5-6-loaded-2026-10-30_12-00-00'
        subprocess.run(['node','--input-type=module','-e',setup,str(storage),peer_universe,peer_run],check=True,capture_output=True)
        peer_db = storage / 'local-data/profiles' / (peer_universe + '.db')
        kept_hash = hashlib.sha256(db.read_bytes()).hexdigest()
        native_vm.run('P.back()')
        await_ready('LIST')
        native_vm.run('assert(#P.rows==2 and P.rows[2][5]:find("Orphaned",1,true));P.select("2")')
        await_ready('DETAIL')
        native_vm.run('P.render();for _,b in ipairs(buttons) do if b.text=="Delete orphan universe..." and b.properties.active then b.handlers.onClick();break end end')
        await_ready('CONFIRM')
        native_vm.run('assert(P.rows[2][3]:find("Permanently delete",1,true));P.render();for _,b in ipairs(buttons) do if b.text=="Confirm permanent deletion" and b.properties.active then b.handlers.onClick();break end end;assert(P.mutating)')
        await_ready('RESULT')
        native_vm.run('assert(P.rows[1][2]=="Orphan universe deleted");P.close(false)')
        assert json.loads(peer_db.read_text(encoding='utf-8'))['owner'] == 'LifeSignsRetiredUniverse'
        assert peer_db.stat().st_size < 1024
        assert hashlib.sha256(db.read_bytes()).hexdigest() == kept_hash
        assert hashlib.sha256(save.read_bytes()).hexdigest() == original_hashes[save]
        print('PASS: actual Lua compaction, selected restore-point deletion and orphan permanent-confirmation buttons -> native/Node workers; peer history and saves unchanged')

    finally:
        if service is not None:
            service.stdin.write(b'STOP\n')
            service.stdin.flush()
            service.stdin.close()
            service.wait(timeout=15)
            assert service.returncode == 0
        native_vm.close()
        os.chdir(original_cwd)
