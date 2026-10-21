-- Optional read-only profile status adapter. File bytes are never evaluated.
local Adapter = {}
LifeSignsDatabaseAdapter = Adapter
local ok, ffi = pcall(require, "ffi") -- Existing game scalar getters only; no OS FFI.
local native
local readerStage, readerDetail = "NATIVE_MODULE_UNAVAILABLE", ""
local policyKnown, safe = false, nil
if type(GetUISafeModeOption) == "function" then
    local read, value = pcall(GetUISafeModeOption)
    policyKnown, safe = read and type(value) == "boolean", value
end
if not policyKnown then
    readerStage = "NATIVE_MODULE_POLICY_UNAVAILABLE"
elseif safe then
    readerStage = "NATIVE_MODULE_PROTECTED_MODE"
elseif type(package) ~= "table" or type(package.loadlib) ~= "function" then
    readerStage = "NATIVE_LOADER_UNAVAILABLE"
else
    local loaded, factory, loadError = pcall(package.loadlib,
        "./extensions/lifesigns_event_recorder/native/lifesigns_status.dll", "luaopen_lifesigns_status")
    if not loaded or type(factory) ~= "function" then
        readerStage, readerDetail = "NATIVE_MODULE_LOAD_FAILED", tostring(loaded and loadError or factory)
    else
        local created, module = pcall(factory)
        if created and type(module) == "table" and type(module.readReply) == "function" then
            native = module; readerStage = "NATIVE_MODULE_READY"
        else readerStage, readerDetail = "NATIVE_MODULE_INTERFACE_FAILED", tostring(module) end
    end
end
function Adapter.readerStatus() return readerStage, readerDetail end
function Adapter.readReply(run)
    if not native then return nil, "MODULE_UNAVAILABLE" end
    local success, text, reason = pcall(native.readReply, run)
    if not success then return nil, "MODULE_CALL_FAILED" end
    return text, reason
end

function Adapter.parse(text, expectedRun, expectedUniverse)
    if type(text) ~= "string" then return nil end
    local universe, run, state, number = text:match("^LSDB1|([^|]+)|([^|]+)|([A-Z_]+)|(%d+)|END\r?\n$")
    if run ~= expectedRun or universe ~= expectedUniverse then return nil end
    if state ~= "READY" and state ~= "NEED_BASELINE" and state ~= "BUILDING" and state ~= "ERROR" then return nil end
    local n = tonumber(number)
    if not n or n > 9007199254740991 or n % 1 ~= 0 then return nil end
    return { run, universe, state, n }
end

local current, lastText, lastPoll, lastHealth = nil, nil, 0, nil
function Adapter.health(stage)
    if current and stage ~= lastHealth then
        lastHealth = stage
        AddUITriggeredEvent("LifeSignsDatabase", "health", {current.run, current.universe, stage})
    end
end
function Adapter.receive(_, request)
    if type(request) ~= "string" then return end
    local run, universe = request:match("^([a-z0-9_-]+)|([a-z0-9_-]+)$")
    if not run or not run:match("^session%-%d+%-%d+%-loaded%-%d%d%d%d%-%d%d%-%d%d_%d%d%-%d%d%-%d%d$") or
       not universe:match("^lsu1%-%d%d%d%d%-%d%d%-%d%d_%d%d%-%d%d%-%d%d%-%d+%-%d+%-%d+%-%d+$") then return end
    if not current or current.run ~= run then
        current = { run = run, universe = universe }; lastText = nil; lastPoll = 0; lastHealth = nil
        Adapter.health("REQUEST_RECEIVED")
    end
    Adapter.update()
end
function Adapter.update()
    if not current then return end
    local now = getElapsedTime()
    if now - lastPoll < 0.25 then return end
    lastPoll = now
    if not native then
        Adapter.health("NATIVE_READER_UNAVAILABLE")
        AddUITriggeredEvent("LifeSignsDatabase", "reply", {current.run,current.universe,"ERROR",0})
        current = nil
        return
    end
    local text, reason = Adapter.readReply(current.run)
    if not text then Adapter.health(reason == "MISSING" and "WAITING_FOR_REPLY_FILE" or "REPLY_READ_FAILED"); return end
    if text == lastText then return end
    local response = Adapter.parse(text, current.run, current.universe)
    if response then
        lastText = text; Adapter.health("REPLY_FORWARDED")
        AddUITriggeredEvent("LifeSignsDatabase", "reply", response)
    else Adapter.health("INVALID_OR_MISMATCHED_REPLY") end
end
-- Owned synthetic probe is local only: it never sends READY or changes MD state.
do
    local run = "session-0-0-loaded-2026-01-01_00-00-00"
    local universe = "lsu1-2026-01-01_00-00-00-0-0-0-0"
    local text, reason = Adapter.readReply(run)
    local parsed = text and Adapter.parse(text, run, universe)
    local result = parsed and parsed[3] == "READY" and parsed[4] == 0 and "PASS" or reason or "INVALID"
    if type(DebugError) == "function" then
        DebugError("Life Signs native reader diagnostic: stage=" .. readerStage .. "; probe=" .. result .. "; detail=" .. readerDetail:gsub("[\r\n]", " "):sub(1, 400))
    end
end
RegisterEvent("LifeSignsDatabaseRequest", Adapter.receive)
SetScript("onUpdate", Adapter.update)

-- Observe the existing confirmation callback, never call a gameplay setter ourselves.
-- Capture before MapMenu clears its pending list; publish only after it returns.
local function pack(...) return { n = select("#", ...), ... } end
function Adapter.readPersonRole(seed, host)
    return ffi.string(ffi.C.GetPersonRole(seed, host))
end
function Adapter.installPersonnelObserver(menus)
    for _, menu in ipairs(menus or {}) do
        if menu.name == "MapMenu" and type(menu.infoSubmenuConfirmCrewChanges) == "function" and not menu.lifeSignsPersonnelObserver then
            local original = menu.infoSubmenuConfirmCrewChanges
            menu.infoSubmenuConfirmCrewChanges = function(instance, ...)
                local observations = {}
                local captured = pcall(function()
                    local host = ConvertStringToLuaID(tostring(menu.infoSubmenuObject))
                    local crew = menu.infoTablePersistentData[instance].crew
                    for _, role in ipairs(crew.reassigned.roles) do
                        for _, tier in ipairs(role.tiers) do
                            for _, person in ipairs(tier.persons) do
                                local seed = tostring(person.person):gsub("ULL$", "")
                                if seed:match("^%d+$") and type(person.newrole) == "string" then
                                    observations[#observations + 1] = {host, seed, person.newrole, person.person, menu.infoSubmenuObject}
                                end
                            end
                        end
                    end
                end)
                local result = pack(original(instance, ...))
                if captured then
                    for _, observation in ipairs(observations) do
                        local read, role = pcall(Adapter.readPersonRole, observation[4], observation[5])
                        pcall(AddUITriggeredEvent, "LifeSignsPersonnel", "role_changed", {observation[1],observation[2],observation[3],read and role or "UNAVAILABLE"})
                    end
                end
                return unpack(result, 1, result.n)
            end
            menu.lifeSignsPersonnelObserver = true
        end
    end
end
Adapter.installPersonnelObserver(Menus)

-- Passive observers of the two MapMenu component-name setter routes.
-- Fleet labels are separate from ship/station names and are deliberately excluded.
function Adapter.readComponentName(object)
    return ffi.string(ffi.C.GetComponentName(object))
end
local function captureRename(object, requested, source)
    if object == nil or type(requested) ~= "string" then return nil end
    local converted, id = pcall(function() return ConvertStringToLuaID(tostring(object)) end)
    if not converted or id == nil then return nil end
    local read, before = pcall(Adapter.readComponentName, object)
    local known = read and type(before) == "string"
    return {id, known and before or "", known and "PRESENT" or "UNKNOWN", requested, source}
end
local function publishRename(observation)
    if observation then pcall(AddUITriggeredEvent, "LifeSignsProfiles", "name_changed", observation) end
end
function Adapter.installRenameObservers(menus)
    for _, menu in ipairs(menus or {}) do
        if menu.name == "MapMenu" then
            if type(menu.buttonRenameConfirm) == "function" and not menu.lifeSignsRenameConfirmObserver then
                local original = menu.buttonRenameConfirm
                menu.buttonRenameConfirm = function(isconfirmed, ...)
                    local observation
                    pcall(function()
                        local data = menu.contextMenuData
                        if isconfirmed and data and not data.fleetrename then
                            observation = captureRename(data.component, data.newtext, "MAP_RENAME_DIALOG")
                        end
                    end)
                    local result = pack(original(isconfirmed, ...))
                    publishRename(observation)
                    return unpack(result, 1, result.n)
                end
                menu.lifeSignsRenameConfirmObserver = true
            end
            if type(menu.infoChangeObjectName) == "function" and not menu.lifeSignsInfoNameObserver then
                local original = menu.infoChangeObjectName
                menu.infoChangeObjectName = function(object, text, textchanged, ...)
                    local observation
                    if textchanged then pcall(function() observation = captureRename(object, text, "MAP_INFO_EDIT") end) end
                    local result = pack(original(object, text, textchanged, ...))
                    publishRename(observation)
                    return unpack(result, 1, result.n)
                end
                menu.lifeSignsInfoNameObserver = true
            end
        end
    end
end
Adapter.installRenameObservers(Menus)
