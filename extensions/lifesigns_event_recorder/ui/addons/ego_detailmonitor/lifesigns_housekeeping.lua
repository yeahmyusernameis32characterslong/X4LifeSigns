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
    local maxRows=({REFRESH=true,LIST=true})[expected.verb] and 10 or 3
    if not ({READY=true,SCANNING=true,CANCELLED=true,STALE=true,ERROR=true,UNAVAILABLE=true})[state] or not page or not pages or pages<1 or page>=pages or not count or count>maxRows or #fields~=9+count*5 then return nil end
    if state=="READY" and page~=expected.page then return nil end
    local rows={}
    for i=1,count do
        local row={};for j=1,5 do row[j]=decode(fields[9+(i-1)*5+j]);if row[j]==nil then return nil end end
        rows[i]=row
    end
    local progress
    if state=="SCANNING" and count>0 then
        local labels={FOLDERS="Searching folders and files",XML_HEADERS="Identifying XML save files",SAVE_LOCKS="Securing scan inputs",SAVE_HASHES="Checking file contents",SAVE_HASH_RECHECK="Verifying file contents",SAVES="Checking saves",SAVE_RECHECK="Rechecking save inputs",DATABASES="Checking databases",DATABASE_RECHECK="Rechecking databases"}
        local row=rows[1];local label=labels[row[2]];local completed=uint(row[3]);local total=uint(row[4])
        if count==1 and row[1]=="ACTION" and row[2]=="Progress" then
            progress=row[3]..(P.productionMode and " (selected universe history)" or " (test copies only)")
        elseif count~=1 or row[1]~="PROGRESS" or not label or not completed or row[5]~="" then return nil
        elseif row[2]=="SAVES" or row[2]=="FOLDERS" then
            if row[4]~="" then return nil end
            progress=label..": "..completed.." checked."
        else
            if not total or completed>total then return nil end
            progress=label..": "..completed.." of "..total.." checked."
        end
    end
    return {state=state,page=page,pages=pages,rows=rows,progress=progress}
end
local function read(file)
    local adapter=LifeSignsDatabaseAdapter
    if not adapter or type(adapter.readReply)~="function" then return nil end
    local ok,text=pcall(adapter.readReply,file);return ok and text or nil
end
function P.request(verb,item,enabled,page)
    if not P.gen or P.seq>=999999999 then P.state="UNAVAILABLE";P.dirty=true;return end
    P.seq=P.seq+1
    P.pending={gen=P.gen,seq=P.seq,page=page or 0,verb=verb,enabled=enabled==true,since=getElapsedTime()};P.lastText=nil;P.progress=nil
    if verb=="REMOVELOCATION" then P.locationsChanged=true end
    P.mutating=verb=="APPLY" or verb=="RESTORE" or verb=="COMPACT" or verb=="DELETEUNIVERSE" or verb=="BACKUPDELETE"
    if verb~="CANCEL" then P.state="SCANNING";P.stale=true end
    if verb=="PROTECT" then P.progress="Saving protection preference..." end
    DebugError("LSHK1|"..P.gen.."|"..P.client.."|"..P.seq.."|"..verb.."|"..(item or 0).."|"..(enabled and 1 or 0).."|"..(page or 0).."|END")
    P.dirty=true
end
function P.extra(verb,item,text)
    if not P.gen or type(text)~="string" or #text==0 or #text>1024 or text:find("[%z\1-\31\127]") then P.state="ERROR";P.dirty=true;return end
    P.seq=P.seq+1
    if P.seq>999999999 then P.state="UNAVAILABLE";return end
    P.pending={gen=P.gen,seq=P.seq,page=0,verb=verb,since=getElapsedTime()};P.lastText=nil;P.progress=nil;P.state="SCANNING";P.stale=true;P.dirty=true
    if verb=="ADDLOCATION" then P.locationsChanged=true end
    local hex=text:gsub(".",function(c) return string.format("%02x",string.byte(c)) end)
    DebugError("LSHK2|"..P.gen.."|"..P.client.."|"..P.seq.."|"..verb.."|"..item.."|"..hex.."|END")
end
function P.spaceReview(verb,confirm)
    P.view="CONFIRM";P.confirmVerb=confirm;P.rows={};P.page=0;P.request(verb,P.selected)
end
function P.backupReview(id,restore)
    P.view="CONFIRM";P.confirmVerb=restore and "RESTORE" or "BACKUPDELETE";P.rows={};P.page=0
    P.extra(restore and "BACKUPRESTOREREVIEW" or "BACKUPREVIEW",P.selected,id)
end
function P.close(back)
    if P.active and P.gen then P.request("CANCEL") end
    P.active=false;P.pending=nil;P.progress=nil;P.rows={};P.stale=true;P.awaitInitial=false
    if P.menu and P.menu.onUpdate==P.menuUpdate then P.menu.onUpdate=P.nativeUpdate end
    -- Helper reads menu.onUpdate on each engine update. Let the restored native
    -- callback consume its own refresh flag after this extension stack unwinds.
    if back and P.menu then P.menu.delayedRefresh=getElapsedTime()-1 end
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
    menu.onUpdate=P.menuUpdate
    P.menu=menu;P.active=true;P.view="LIST";P.selected=nil;P.rows={};P.listRows=nil;P.page=0;P.pages=1
    P.gen=nil;P.heartbeat=nil;P.progress=nil;P.live=false;P.opened=getElapsedTime();P.state="UNAVAILABLE";P.stale=true;P.awaitInitial=true;P.dirty=true
    P.update()
    P.render()
end
function P.refresh()
    if not P.live then P.state="UNAVAILABLE";P.dirty=true;return end
    P.view="LIST";P.selected=nil;P.rows=P.listRows or {};P.page=0;P.request("REFRESH")
end
function P.select(id)
    if P.state~="READY" or P.stale or not uint(id) or id=="0" then return end
    P.view="DETAIL";P.selected=tonumber(id);P.protected=nil;P.selectedStatus=nil;for _,r in ipairs(P.listRows or {}) do if r[1]==id then P.selectedStatus=r[5] end end;P.rows={};P.page=0;P.request("DETAIL",P.selected)
end
function P.locations()
    if P.active and P.gen then P.request("CANCEL") end
    P.view="LOCATIONS";P.rows={};P.selected=nil;P.page=0;P.request("LOCATIONS")
end
function P.review(id,restore)
    if not (P.testMode or P.productionMode) or P.state~="READY" or P.stale then return end
    P.selected=tonumber(id);P.view="CONFIRM";P.confirmVerb=restore and "RESTORE" or "APPLY";P.rows={};P.page=0
    P.request(restore and "RESTOREREVIEW" or "REVIEW",P.selected)
end
-- Interpret exact independent status labels, never a loose "backup" substring.
-- These only gate presentation; fresh backend protection/input checks still apply.
function P.rowActions(data)
    local flags={};for label in (data[5] or ""):gmatch("[^;]+") do flags[(label:gsub("^%s+",""):gsub("%s+$",""))]=true end
    local available=(P.testMode or P.productionMode) and P.state=="READY" and not P.stale and not P.mutating and uint(data[1]) and data[1]~="0" and not flags["Protected"] and not flags["Needs attention"] and (flags["In use"] or flags["Possibly unused"] or flags["Recovery required"])
    return (available and flags["In use"] and not flags["No cleanup needed"])==true, (available and flags["Restore point recorded"])==true
end
function P.back()
    if P.mutating then return end
    if P.view=="LOCATIONS" and P.locationsChanged then P.refresh();return end
    if P.view=="BACKUPS" then P.select(tostring(P.selected));return end
    if P.view=="RESULT" then P.refresh();return end
    if P.view~="LIST" then
        P.request("CANCEL");P.view="LIST";P.selected=nil;P.rows={};P.request("LIST")
    else P.close(true) end
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
    if token(gen) and uint(tick) and (phase=="INITIAL" or phase=="TEST" or phase=="PRODUCTION") then
        P.testMode=phase=="TEST"
        P.productionMode=phase=="PRODUCTION"
        if gen~=P.gen then
            local restarting=P.gen~=nil
            P.gen=gen;P.heartbeat=tick;P.heartbeatAt=now;P.live=false;P.pending=nil;P.progress=nil
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
    local action=({REVIEW=true,RESTOREREVIEW=true,APPLY=true,RESTORE=true,COMPACTREVIEW=true,COMPACT=true,DELETEREVIEW=true,DELETEUNIVERSE=true,BACKUPREVIEW=true,BACKUPRESTOREREVIEW=true,BACKUPDELETE=true,BACKUPS=true})[pending.verb]
    if pending.verb~="REFRESH" and not action and now-pending.since>15 then P.state="ERROR";P.pending=nil;P.stale=true;P.dirty=true;return end
    local text=read(replyFile)
    if text==P.lastText then return end
    local reply=P.parse(text,pending);if not reply then return end
    P.lastText=text;P.state=reply.state;P.progress=reply.progress;P.dirty=true
    if reply.state=="READY" then
        P.mutating=false
        P.pending=nil;P.stale=false;P.page=reply.page;P.pages=reply.pages;P.rows=reply.rows
        if pending.verb=="ADDLOCATION" or pending.verb=="REMOVELOCATION" then P.locationsChanged=true end
        if pending.verb=="PROTECT" then P.protected=pending.enabled end
        if pending.verb=="REFRESH" then P.locationsChanged=false;P.view="LIST";P.selected=nil end
        if pending.verb=="APPLY" or pending.verb=="RESTORE" or pending.verb=="COMPACT" or pending.verb=="DELETEUNIVERSE" or pending.verb=="BACKUPDELETE" then P.view="RESULT" end
        if P.view=="LIST" then P.listRows=P.rows end
        for _,row in ipairs(P.rows) do if row[1]=="INFO" and row[2]=="Protection" then
            if row[3]=="Protected" then P.protected=true elseif row[3]=="Not protected" then P.protected=false else P.protected=nil end
        end end
    elseif reply.state~="SCANNING" then P.pending=nil;P.mutating=false;P.stale=true;if action or ((P.testMode or P.productionMode) and reply.state=="ERROR") then P.view="RESULT";P.rows=reply.rows end end
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
    -- Match the verified OptionsMenu/Extensions text and title conventions.
    local normal={font="Zekton outlined",fontsize=10,x=5,y=2,minRowHeight=19,wordwrap=true}
    local info={font="Zekton outlined",fontsize=10,x=5,y=2,minRowHeight=19,wordwrap=true}
    local heading={font="Zekton bold outlined",fontsize=10,x=5,y=2,minRowHeight=22,titleColor=Color["row_title"]}
    local title={font="Zekton bold outlined",fontsize=13,x=5,y=6,minRowHeight=34,titleColor=Color["row_title"]}
    -- Helper table:addRow bgColor propagates to cellBGColor. Keep native
    -- highlightMode and button colors untouched; alpha uses the 0-100 scale.
    local rowDark={r=8,g=12,b=18,a=92}
    local rowAlternate={r=18,g=24,b=32,a=92}
    local rowHeading={r=8,g=12,b=18,a=98}
    local back=P.back
    local function button(row,col,text,callback,active)
        row[col]:createButton({active=active~=false,height=19}):setText(text,{font="Zekton outlined",fontsize=10,halign="center"})
        row[col].handlers.onClick=callback
    end
    local function line(t,text,properties,background)
        local r=t:addRow(false,{fixed=true,bgColor=background});r[1]:setColSpan(4):createText(text,properties or info);return r
    end
    local header=frame:addTable(2,{tabOrder=1,x=menu.table.x,y=menu.table.y,width=menu.table.widthExtraWide,skipTabChange=true})
    header:setColWidth(1,menu.table.arrowColumnWidth,false)
    local r=header:addRow(true,{fixed=true})
    r[1]:setBackgroundColSpan(2):createButton({height=34}):setIcon("table_arrow_inv_left",{x=3})
    r[1].handlers.onClick=back;r[2]:createText(copy.title,title)
    local function headerLine(text,properties)
        local row=header:addRow(false,{fixed=true});row[2]:createText(text,properties or info)
    end
    headerLine(P.productionMode and "Manage actual Life Signs universe history" or P.testMode and "ISOLATED MAINTENANCE TEST - disposable copies only" or copy.intro,normal)
    headerLine(P.productionMode and "Preview first. Only your explicitly confirmed universe can be cleaned or restored." or P.testMode and "Clean and restore individual test universes. Original saves and live history are not cleanup targets." or copy.description)
    headerLine(P.productionMode and "Review each selected action before confirming. Saves are never deleted." or P.testMode and "Explicit confirmation and a verified backup are required. Test copies only." or copy.notice)
    headerLine(P.productionMode and copy.scope or P.testMode and "Inventory uses copied local native saves only. Gameplay routing is unchanged." or copy.scope)
    if P.state~="READY" then headerLine((P.state=="SCANNING" and P.progress) or (P.productionMode and P.state=="ERROR" and "History operation blocked. Read the result below, then Refresh to inspect the current state. Preserve backups.") or (P.testMode and P.state=="ERROR" and "Test operation blocked. Close X4 and report the result below. Preserve test copies and backups.") or messages[P.state] or "Waiting for companion...") end
    if P.stale and #P.rows>0 then headerLine("Previous results - stale. Refresh to update.") end
    local gap=Helper.scaleY(12)
    local gutter=menu.table.arrowColumnWidth+Helper.borderSize
    local x,width=menu.table.x+gutter,menu.table.widthExtraWide-gutter
    local controlY=header.properties.y+header:getVisibleHeight()+gap
    local controls=frame:addTable(4,{tabOrder=2,x=x,y=controlY,width=math.min(width,Helper.scaleX(640))})
    r=controls:addRow(true,{fixed=true})
    button(r,1,"Refresh",P.refresh,P.live and not P.mutating);button(r,2,"Save locations",P.locations,P.live and not P.mutating)
    button(r,3,"Cancel",function() P.request("CANCEL") end,P.state=="SCANNING" and not P.mutating);button(r,4,"Back",back,not P.mutating)
    local dataY=controlY+controls:getVisibleHeight()+gap
    local actions=(P.testMode or P.productionMode) and P.view=="LIST"
    local backupActions=P.productionMode and P.view=="BACKUPS"
    local locationActions=P.productionMode and P.view=="LOCATIONS"
    local columns=(actions or backupActions) and 6 or locationActions and 5 or 4
    local t=frame:addTable(columns,{tabOrder=3,x=x,y=dataY,width=width})
    local widths=(actions or backupActions) and {16,12,17,25,15} or P.view=="LIST" and {18,18,24} or P.view=="LOCATIONS" and (locationActions and {18,43,18,12} or {16,58,16}) or {20,24,18}
    for i,value in ipairs(widths) do t:setColWidthPercent(i,value) end
    local headers=P.view=="LIST" and {"Universe","Local saves","Database size","Status"} or P.view=="LOCATIONS" and {"Folder","Location","Scope","Notes"} or {"Section","Item","Value","Location / context"}
    if actions then headers[5]=P.productionMode and "Clean history" or "Clean test copy";headers[6]="Restore history" end
    if backupActions then headers={"Restore point","Created (UTC)","File size","Status","Restore","Delete"} end
    if locationActions then headers[5]="Remove" end
    r=t:addRow(false,{fixed=true,bgColor=rowHeading});for i=1,columns do r[i]:createText(headers[i],heading) end
    for index,data in ipairs(P.rows) do
        -- X4 rejects buttons in unselectable rows, even disabled buttons.
        r=t:addRow(P.view=="LIST" or locationActions or backupActions,{bgColor=index%2==1 and rowDark or rowAlternate})
        if P.view=="LIST" then local id=data[1];button(r,1,data[2],function() P.select(id) end,P.state=="READY" and not P.stale and id~="0") else r[1]:createText(data[2],normal) end
        for i=2,4 do local value=data[i+1];if P.view=="LOCATIONS" and i==2 and value then value=value:gsub("\\","\\ "):gsub("/","/ ") end;if value and value:sub(1,5)=="lsu1-" then value=value:gsub("-","- ") end;r[i]:createText(value,normal) end
        if actions then
            local id=data[1];local clean,restore=P.rowActions(data)
            button(r,5,"Clean...",function() P.review(id,false) end,clean)
            button(r,6,"Restore...",function() P.review(id,true) end,restore)
        end
        if backupActions then
            local id=data[1];local active=P.state=="READY" and not P.stale and P.protected~=true
            button(r,5,"Restore...",function() P.backupReview(id,true) end,active)
            button(r,6,"Delete...",function() P.backupReview(id,false) end,active)
        end
        if locationActions then local id=tonumber(data[1]);button(r,5,"Remove",function() P.request("REMOVELOCATION",id) end,P.state=="READY" and id and id>1) end
    end
    if #P.rows==0 then line(t,P.state=="SCANNING" and "Waiting for scan results..." or "No results to display.",nil,rowDark) end
    local pager=frame:addTable(3,{tabOrder=4,x=x,y=0,width=math.min(width,Helper.scaleX(340))})
    pager:setColWidth(1,Helper.scaleX(100),false);pager:setColWidth(3,Helper.scaleX(100),false)
    r=pager:addRow(true,{fixed=true})
    local function page(delta) P.request(P.view=="DETAIL" and "DETAIL" or P.view=="LOCATIONS" and "LOCATIONS" or P.view=="BACKUPS" and "BACKUPS" or "LIST",(P.view=="DETAIL" or P.view=="BACKUPS") and P.selected or 0,false,P.page+delta) end
    button(r,1,"Previous",function() page(-1) end,P.state=="READY" and P.page>0)
    r[2]:createText("Page "..(P.page+1).." / "..P.pages,{font="Zekton outlined",fontsize=10,x=5,y=2,minRowHeight=19,halign="center"})
    button(r,3,"Next",function() page(1) end,P.state=="READY" and P.page+1<P.pages)
    local notes=frame:addTable(4,{tabOrder=5,x=x,y=0,width=width})
    notes:setColWidth(1,menu.table.arrowColumnWidth,false)
    if P.view=="DETAIL" then
        r=notes:addRow(true,{fixed=true});r[1]:createCheckBox(P.protected==true,{active=P.state=="READY" and P.protected~=nil and not P.stale})
        r[1].handlers.onClick=function() P.request("PROTECT",P.selected,not P.protected,P.page) end
        r[2]:setColSpan(3):createText("Protect this universe",normal);line(notes,copy.protection)
        if P.productionMode then
            local state=P.selectedStatus or "";local active=P.state=="READY" and not P.stale and not P.protected
            r=notes:addRow(true,{fixed=true});r[1]:setColSpan(2);r[3]:setColSpan(2)
            button(r,1,"Reclaim disk space...",function() P.spaceReview("COMPACTREVIEW","COMPACT") end,active and state:find("In use",1,true) and state:find("No cleanup needed",1,true))
            button(r,3,"Restore points...",function() P.view="BACKUPS";P.rows={};P.request("BACKUPS",P.selected) end,P.state=="READY" and not P.stale and not state:find("Deletion pending",1,true))
            r=notes:addRow(true,{fixed=true});r[1]:setColSpan(4)
            button(r,1,state:find("Deletion pending",1,true) and "Resume deletion..." or "Delete orphan universe...",function() P.spaceReview("DELETEREVIEW","DELETEUNIVERSE") end,active and (state:find("Orphaned",1,true) or state:find("Deletion pending",1,true)))
        end
    end
    if P.view=="CONFIRM" then
        r=notes:addRow(true,{fixed=true});r[1]:setColSpan(2);r[3]:setColSpan(2)
        button(r,1,({APPLY="Confirm cleanup",RESTORE="Confirm restoration",COMPACT="Confirm compaction",DELETEUNIVERSE="Confirm permanent deletion",BACKUPDELETE="Confirm delete restore point"})[P.confirmVerb] or "Confirm",function() P.request(P.confirmVerb,P.selected,true,0) end,P.state=="READY" and not P.stale)
        button(r,3,"Cancel",P.back,not P.mutating)
    end
    if locationActions then
        line(notes,"Life Signs checks only the folders listed here. Add any folders where you keep archived saves.")
        line(notes,"All subfolders are included. Removing a location never changes its files.")
        r=notes:addRow(true,{fixed=true});r[1]:setColSpan(3)
        r[1]:createEditBox({description="Full local archive-folder path",defaultText="Enter an absolute local folder path",height=19}):setText(P.locationInput or "",{font="Zekton outlined",fontsize=10,halign="left"})
        r[1].handlers.onEditBoxDeactivated=function(_,text) P.locationInput=text;P.dirty=true end
        button(r,4,"Add folder",function() P.extra("ADDLOCATION",0,P.locationInput or "") end,P.state=="READY" and not P.stale and P.locationInput and #P.locationInput>0)
        r=notes:addRow(true,{fixed=true});r[1]:setColSpan(4);button(r,1,"Rescan",P.refresh,P.live and not P.mutating)
    end
    line(notes,copy.ancestry)
    if P.testMode or P.productionMode then
        line(notes,"A restore point is a database-history copy made before maintenance, not an X4 save.")
        line(notes,"Recorded restore points are verified when you select Restore. File size is not reclaimable space.")
    else line(notes,"History totals count records once. File size is not reclaimable space.") end
    local footerHeight=pager:getVisibleHeight()+notes:getVisibleHeight()+3*gap
    t.properties.maxVisibleHeight=math.max(1,menu.table.height-(dataY-menu.table.y)-footerHeight)
    pager.properties.y=dataY+t:getVisibleHeight()+gap
    notes.properties.y=pager.properties.y+pager:getVisibleHeight()+gap
    local chain={header,controls,t,pager}
    if P.view=="DETAIL" or P.view=="CONFIRM" or locationActions then chain[#chain+1]=notes end
    for i=1,#chain-1 do chain[i].properties.nextTable=chain[i+1].index;chain[i+1].properties.prevTable=chain[i].index end
    frame:display();P.dirty=false
end
function P.install(menu)
    if menu.lifeSignsHousekeepingHook then return end
    if type(menu.displayOptions)~="function" or type(menu.displayOption)~="function" or type(menu.createOptionsFrame)~="function" then return end
    menu.lifeSignsHousekeepingHook=true
    local display,option,update,close=menu.displayOptions,menu.displayOption,menu.onUpdate,menu.onCloseElement
    P.nativeUpdate=update
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
    P.menuUpdate=menu.onUpdate
    menu.onCloseElement=function(...)
        if P.active then P.back();return end
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
