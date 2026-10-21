-- Optional Windows profile test adapter. Reads only status replies; never evaluates file contents.
local Adapter = {}
LifeSignsDatabaseAdapter = Adapter
local ok, ffi = pcall(require, "ffi")
local native
local readerStage, readerDetail = "FFI_MODULE_UNAVAILABLE", ok and "" or tostring(ffi)
if ok then
    local declared, declarationError = pcall(ffi.cdef, [[
        void* __stdcall CreateFileA(const char*, unsigned long, unsigned long, void*, unsigned long, unsigned long, void*);
        int __stdcall ReadFile(void*, void*, unsigned long, unsigned long*, void*);
        int __stdcall CloseHandle(void*);
        unsigned long __stdcall GetModuleFileNameA(void*, char*, unsigned long);
    ]])
    readerStage, readerDetail = "FFI_DECLARATION_FAILED", declared and "" or tostring(declarationError)
    if declared then
        local bound, bindingError = pcall(function() return ffi.C.CreateFileA, ffi.C.ReadFile, ffi.C.CloseHandle, ffi.C.GetModuleFileNameA end)
        readerStage, readerDetail = "WINDOWS_SYMBOL_BINDING_FAILED", bound and "" or tostring(bindingError)
        if bound then native = ffi.C; readerStage = "WINDOWS_SYMBOLS_BOUND" end
    end
end

function Adapter.readerStatus() return readerStage, readerDetail end

function Adapter.directory()
    if not native then return nil end
    local buffer = ffi.new("char[32768]")
    local n = tonumber(native.GetModuleFileNameA(nil, buffer, 32768))
    if n == 0 or n >= 32768 then readerStage = "EXECUTABLE_PATH_UNAVAILABLE"; readerDetail = "length=" .. tostring(n); return nil end
    local executable = ffi.string(buffer, n)
    local directory = executable:match("^(.*)[/\\][^/\\]+$")
    if not directory then readerStage = "EXECUTABLE_PATH_INVALID"; readerDetail = "no directory separator"; return nil end
    readerStage, readerDetail = "READER_READY", ""
    return directory .. "/extensions/lifesigns_event_recorder/runtime/"
end

-- Runs when the addon loads, including the main menu. No save, actor or game API
-- is needed. Preserve the actual initialisation error in the local debug log.
do
    local success, pathOrError = pcall(Adapter.directory)
    if not success then readerStage, readerDetail = "EXECUTABLE_PATH_CALL_FAILED", tostring(pathOrError) end
    if type(DebugError) == "function" then
        DebugError("Life Signs database reader diagnostic: stage=" .. readerStage .. "; detail=" .. readerDetail:gsub("[\r\n]", " "):sub(1, 400))
    end
end

function Adapter.readReply(filename)
    if not native then return nil end
    local handle = native.CreateFileA(filename, 0x80000000, 7, nil, 3, 128, nil)
    if handle == ffi.cast("void*", -1) then return nil end
    local buffer, count = ffi.new("char[4096]"), ffi.new("unsigned long[1]")
    local success = native.ReadFile(handle, buffer, 4096, count, nil)
    native.CloseHandle(handle)
    if success == 0 or count[0] == 0 or count[0] >= 4096 then return nil end
    return ffi.string(buffer, tonumber(count[0]))
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
    local directory = Adapter.directory()
    if not directory then
        Adapter.health("NATIVE_READER_UNAVAILABLE")
        AddUITriggeredEvent("LifeSignsDatabase", "reply", {current.run,current.universe,"ERROR",0})
        return
    end
    local text = Adapter.readReply(directory .. current.run .. ".reply")
    if not text then Adapter.health("WAITING_FOR_REPLY_FILE"); return end
    if text == lastText then return end
    local response = Adapter.parse(text, current.run, current.universe)
    if response then
        lastText = text; Adapter.health("REPLY_FORWARDED")
        AddUITriggeredEvent("LifeSignsDatabase", "reply", response)
    else Adapter.health("INVALID_OR_MISMATCHED_REPLY") end
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
