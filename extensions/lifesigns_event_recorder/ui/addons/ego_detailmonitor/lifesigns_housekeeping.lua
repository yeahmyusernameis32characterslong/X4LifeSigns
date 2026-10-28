-- Optional initial-menu preview. Runtime strings are data, never Lua source.
if LifeSignsHousekeeping and LifeSignsHousekeeping.close then LifeSignsHousekeeping.close(false) end
local P = {seq=0, state="UNAVAILABLE", view="LIST", page=0, pages=1, rows={}, stale=true}
LifeSignsHousekeeping = P
local helloFile = "session-0-4-loaded-2000-01-01_00-00-00"
local replyFile = "session-0-5-loaded-2000-01-01_00-00-00"
local nonce = {}
for i=1,8 do nonce[i]=string.format("%04x",math.random(0,65535)) end
P.client=table.concat(nonce)
local function uint(s) return type(s)=="string" and s:match("^%d+$") and (#s==1 or s:sub(1,1)~="0") and #s<=9 and tonumber(s) end
local function token(s) return type(s)=="string" and #s==32 and s:match("^[0-9a-f]+$") end
local function decode(s)
    if #s>192 or #s%2~=0 or s:find("[^0-9a-f]") then return nil end
    local text=s:gsub("..",function(v) return string.char(tonumber(v,16)) end)
    if text:find("[%z\1-\31\127]") then return nil end
    local i=1
    while i<=#text do
        local b=text:byte(i);local n=0
        if b<128 then n=1 elseif b>=194 and b<=223 then n=2 elseif b>=224 and b<=239 then n=3 elseif b>=240 and b<=244 then n=4 else return nil end
        for j=1,n-1 do local c=text:byte(i+j);if not c or c<128 or c>191 then return nil end end
        local c=text:byte(i+1)
        if (b==224 and c<160) or (b==237 and c>=160) or (b==240 and c<144) or (b==244 and c>=144) then return nil end
        i=i+n
    end
    return text
end
function P.parse(text, expected)
    if type(text)~="string" or #text>=4096 or not text:match("^[^\r\n]+\r?\n$") then return nil end
    local fields={};for v in text:gsub("\r?\n$",""):gmatch("([^|]*)|") do fields[#fields+1]=v end
    -- gmatch above stops before END, which is checked separately.
    if not text:match("|END\r?\n$") or #fields<9 then return nil end
    if fields[1]~="LSDB1" or fields[2]~="HOUSEKEEPING" or fields[3]~=expected.gen or fields[4]~=P.client or uint(fields[5])~=expected.seq then return nil end
    local state,page,pages,count=fields[6],uint(fields[7]),uint(fields[8]),uint(fields[9])
    local maxRows=({REFRESH=true,LIST=true,PROTECT=true})[expected.verb] and 10 or 3
    if not ({READY=true,SCANNING=true,CANCELLED=true,STALE=true,ERROR=true,UNAVAILABLE=true})[state] or not page or not pages or pages<1 or page>=pages or not count or count>maxRows or #fields~=9+count*5 then return nil end
    if state=="READY" and page~=expected.page then return nil end
    local rows={}
    for i=1,count do
        local row={};for j=1,5 do row[j]=decode(fields[9+(i-1)*5+j]);if row[j]==nil then return nil end end
        rows[i]=row
    end
    return {state=state,page=page,pages=pages,rows=rows}
end
local function read(file)
    local adapter=LifeSignsDatabaseAdapter
    if not adapter or type(adapter.readReply)~="function" then return nil end
    local ok,text=pcall(adapter.readReply,file);return ok and text or nil
end
function P.request(verb,item,enabled,page)
    if not P.gen or P.seq>=999999999 then P.state="UNAVAILABLE";P.dirty=true;return end
    P.seq=P.seq+1
    P.pending={gen=P.gen,seq=P.seq,page=page or 0,verb=verb,since=getElapsedTime()};P.lastText=nil
    if verb~="CANCEL" then P.state="SCANNING";P.stale=true end
    DebugError("LSHK1|"..P.gen.."|"..P.client.."|"..P.seq.."|"..verb.."|"..(item or 0).."|"..(enabled and 1 or 0).."|"..(page or 0).."|END")
    P.dirty=true
end
function P.close(back)
    if P.active and P.gen then P.request("CANCEL") end
    P.active=false;P.pending=nil;P.rows={};P.stale=true;P.awaitInitial=false
    if back and P.menu then P.menu.displayOptions("main") end
end
function P.worldObserved()
    __LIFESIGNS_HOUSEKEEPING_WORLD_SEEN=true
    P.close(false)
end
function P.initial(menu)
    if not menu.isStartmenu or __LIFESIGNS_HOUSEKEEPING_WORLD_SEEN then return false end
    local text=read(helloFile)
    if text and text:match("|INACTIVE|END\r?\n$") then return false end
    return true
end
function P.open(menu)
    if not P.initial(menu) or menu.animationDelay or menu.contextMenuMode then return end
    P.menu=menu;P.active=true;P.view="LIST";P.selected=nil;P.rows={};P.listRows=nil;P.page=0;P.pages=1
    P.gen=nil;P.heartbeat=nil;P.live=false;P.opened=getElapsedTime();P.state="UNAVAILABLE";P.stale=true;P.awaitInitial=true;P.dirty=true
    P.update()
    P.render()
end
function P.refresh()
    if not P.live then P.state="UNAVAILABLE";P.dirty=true;return end
    P.view="LIST";P.selected=nil;P.rows=P.listRows or {};P.page=0;P.request("REFRESH")
end
function P.select(id)
    if P.state~="READY" or P.stale or not uint(id) or id=="0" then return end
    P.view="DETAIL";P.selected=tonumber(id);P.protected=nil;P.rows={};P.page=0;P.request("DETAIL",P.selected)
end
function P.locations()
    if P.active and P.gen then P.request("CANCEL") end
    P.view="LOCATIONS";P.rows={};P.selected=nil;P.page=0;P.request("LOCATIONS")
end
function P.update()
    if not P.active then return end
    local now=getElapsedTime()
    if P.lastPoll and now>=P.lastPoll and now-P.lastPoll<0.25 then return end
    P.lastPoll=now
    if not P.initial(P.menu) then P.worldObserved();return end
    local h=read(helloFile)
    local gen,tick,phase
    if h then gen,tick,phase=h:match("^LSDB1|HOUSEKEEPING|HELLO|([0-9a-f]+)|(%d+)|([A-Z]+)|END\r?\n$") end
    if token(gen) and uint(tick) and phase=="INITIAL" then
        if gen~=P.gen then
            local restarting=P.gen~=nil
            P.gen=gen;P.heartbeat=tick;P.heartbeatAt=now;P.live=false;P.pending=nil
            if restarting then P.state="STALE";P.stale=true;P.dirty=true;P.awaitInitial=false end
        elseif tick~=P.heartbeat then
            P.heartbeat=tick;P.heartbeatAt=now;if not P.live then P.dirty=true end;P.live=true
        end
    end
    if not P.heartbeatAt or now-P.heartbeatAt>5 then
        if P.state~="UNAVAILABLE" then P.state="UNAVAILABLE";P.stale=true;P.live=false;P.dirty=true end
    end
    if P.awaitInitial and P.live then P.awaitInitial=false;P.refresh() end
    local pending=P.pending
    if not pending or not P.live then return end
    if pending.verb~="REFRESH" and pending.verb~="PROTECT" and now-pending.since>15 then P.state="ERROR";P.pending=nil;P.stale=true;P.dirty=true;return end
    local text=read(replyFile)
    if text==P.lastText then return end
    local reply=P.parse(text,pending);if not reply then return end
    P.lastText=text;P.state=reply.state;P.dirty=true
    if reply.state=="READY" then
        P.pending=nil;P.stale=false;P.page=reply.page;P.pages=reply.pages;P.rows=reply.rows
        if pending.verb=="REFRESH" or pending.verb=="PROTECT" then P.view="LIST";P.selected=nil end
        if P.view=="LIST" then P.listRows=P.rows end
        for _,row in ipairs(P.rows) do if row[1]=="INFO" and row[2]=="Protection" then
            if row[3]=="Protected" then P.protected=true elseif row[3]=="Not protected" then P.protected=false else P.protected=nil end
        end end
    elseif reply.state~="SCANNING" then P.pending=nil;P.stale=true end
end

local copy={
    title="Database Management",intro="Manage your universe histories",
    description="See which Life Signs databases belong to your local saves and identify history you may no longer need.",
    ancestry="Earlier history is preserved when a newer save still depends on it, even if the earlier save was overwritten.",
    protection="Prevent cleanup of this universe, including history not referenced by your current saves.",
    notice="Preview only. No databases or history will be changed.",
    scope="Only the selected local folders are checked. Cloud saves and copies stored elsewhere are not included."
}
P.copy=copy
local messages={SCANNING="Scanning selected local folders...",UNAVAILABLE="Companion unavailable. Start or restart the companion, then Refresh.",CANCELLED="Cancelled. Previous results are stale.",STALE="Results are stale. Refresh to scan the selected folders again.",ERROR="Preview failed. Check your save locations and local-data/housekeeping-preview-v1.json, then Refresh."}
function P.render()
    if not P.active then return end
    local menu=P.menu
    Helper.clearDataForRefresh(menu,4);menu.selectedOption=nil
    local frame=menu.createOptionsFrame(true)
    local t=frame:addTable(4,{tabOrder=1,x=menu.table.x,y=menu.table.y,width=menu.table.widthExtraWide,maxVisibleHeight=menu.table.height})
    local widths=P.view=="LIST" and {28,16,24} or {24,30,23}
    for i,width in ipairs(widths) do t:setColWidthPercent(i,width) end
    local function line(text,large)
        local r=t:addRow(false,{fixed=true});r[1]:setColSpan(4):createText(text,{wordwrap=true,fontsize=large and 20 or 12});return r
    end
    local function button(row,col,text,callback,active)
        row[col]:createButton({active=active~=false}):setText(text);row[col].handlers.onClick=callback
    end
    line(copy.title,true);line(copy.intro);line(copy.description);line(copy.notice);line(copy.scope)
    if P.state~="READY" then line(messages[P.state] or "Waiting for companion...") end
    if P.stale and #P.rows>0 then line("Previous results - stale. Refresh to update.") end
    local controls=t:addRow(true,{fixed=true})
    button(controls,1,"Refresh",P.refresh,P.live)
    button(controls,2,"Save locations",P.locations,P.live)
    button(controls,3,"Cancel",function() P.request("CANCEL") end,P.state=="SCANNING")
    button(controls,4,"Back",function() if P.view~="LIST" then P.request("CANCEL");P.view="LIST";P.selected=nil;P.rows={};P.request("LIST") else P.close(true) end end)
    local headers=P.view=="LIST" and {"Universe","Local saves","Database size","Status"} or {"Section","Item","Value","Provenance"}
    local heading=t:addRow(false,{fixed=true});for i=1,4 do heading[i]:createText(headers[i],{fontsize=14}) end
    for _,data in ipairs(P.rows) do
        local r=t:addRow(P.view=="LIST",{})
        if P.view=="LIST" then local id=data[1];button(r,1,data[2],function() P.select(id) end,P.state=="READY" and not P.stale and id~="0") else r[1]:createText(data[2],{wordwrap=true,fontsize=14}) end
        for i=2,4 do r[i]:createText(data[i+1],{wordwrap=true,fontsize=14}) end
    end
    local paging=t:addRow(true,{fixed=true})
    local function page(delta) P.request(P.view=="DETAIL" and "DETAIL" or P.view=="LOCATIONS" and "LOCATIONS" or "LIST",P.view=="DETAIL" and P.selected or 0,false,P.page+delta) end
    button(paging,1,"Previous",function() page(-1) end,P.state=="READY" and P.page>0)
    paging[2]:setColSpan(2):createText("Page "..(P.page+1).." / "..P.pages,{fontsize=12})
    button(paging,4,"Next",function() page(1) end,P.state=="READY" and P.page+1<P.pages)
    if P.view=="DETAIL" then
        local r=t:addRow(true,{fixed=true});r[1]:createCheckBox(P.protected==true,{active=P.state=="READY" and P.protected~=nil and not P.stale})
        r[1].handlers.onClick=function() P.request("PROTECT",P.selected,not P.protected) end
        r[2]:setColSpan(3):createText("Protect this universe",{wordwrap=true,fontsize=12});line(copy.protection)
    end
    line(copy.ancestry);line("Record and projection counts overlap; do not add them together. File size is not reclaimable space.")
    frame:display();P.dirty=false
end
function P.install(menu)
    if menu.lifeSignsHousekeepingHook then return end
    if type(menu.displayOptions)~="function" or type(menu.displayOption)~="function" or type(menu.createOptionsFrame)~="function" then return end
    menu.lifeSignsHousekeepingHook=true
    local display,option,update,close=menu.displayOptions,menu.displayOption,menu.onUpdate,menu.onCloseElement
    local main=false;local inserted=false
    menu.displayOptions=function(name,...)
        if P.active then P.close(false) end
        main=name=="main";inserted=false
        return display(name,...)
    end
    menu.displayOption=function(ftable,data,...)
        if main and menu.currentOption=="main" and data.id=="settings" and not inserted and P.initial(menu) then
            inserted=true
            option(ftable,{id="lifesigns_housekeeping",name="Life Signs",callback=function() P.open(menu) end,selectable=function() return not menu.animationDelay end})
        end
        return option(ftable,data,...)
    end
    menu.onUpdate=function(...)
        if P.active then P.update();if P.dirty then P.render() end;return end
        if not P.initial(menu) then if update then return update(...) end;return end
        if not inserted and menu.currentOption=="main" and menu.table and not menu.contextMenuMode and not menu.animationDelay then menu.displayOptions("main") end
        if update then return update(...) end
    end
    menu.onCloseElement=function(...)
        if P.active then P.close(true);return end
        if close then return close(...) end
    end
    for _,name in ipairs({"onRowChanged","onSelectElement"}) do
        local original=menu[name]
        if original then menu[name]=function(...) if not P.active then return original(...) end end end
    end
    for _,name in ipairs({"closeMenu","submenuHandler","onShowMenu","cleanup"}) do
        local original=menu[name]
        if original then menu[name]=function(...) if P.active then P.close(false) end;return original(...) end end
    end
end
for _,menu in ipairs(Menus or {}) do if menu.name=="OptionsMenu" then P.install(menu) end end
