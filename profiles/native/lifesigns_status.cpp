// First-party, read-only Lua 5.1 module. No X4 engine functions or game pointers.
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <array>
#include <cstdint>
#include <cstring>
#include <string>
#include <string_view>

struct lua_State;
using LuaFunction = int(__cdecl*)(lua_State*);
struct LuaApi {
    int (__cdecl* gettop)(lua_State*) = nullptr;
    int (__cdecl* type)(lua_State*, int) = nullptr;
    const char* (__cdecl* tolstring)(lua_State*, int, size_t*) = nullptr;
    void (__cdecl* pushnil)(lua_State*) = nullptr;
    void (__cdecl* pushlstring)(lua_State*, const char*, size_t) = nullptr;
    void (__cdecl* pushcclosure)(lua_State*, LuaFunction, int) = nullptr;
    void (__cdecl* createtable)(lua_State*, int, int) = nullptr;
    void (__cdecl* setfield)(lua_State*, int, const char*) = nullptr;
} api;
static HMODULE selfModule = nullptr;

template<class T> bool resolve(HMODULE host, T& target, const char* name) {
    FARPROC address = GetProcAddress(host, name);
    static_assert(sizeof(target) == sizeof(address));
    std::memcpy(&target, &address, sizeof(target));
    return target != nullptr;
}
static bool loadApi() {
    HMODULE host = GetModuleHandleW(L"lua51_64.dll");
    return host && resolve(host, api.gettop, "lua_gettop") &&
        resolve(host, api.type, "lua_type") && resolve(host, api.tolstring, "lua_tolstring") &&
        resolve(host, api.pushnil, "lua_pushnil") && resolve(host, api.pushlstring, "lua_pushlstring") &&
        resolve(host, api.pushcclosure, "lua_pushcclosure") && resolve(host, api.createtable, "lua_createtable") &&
        resolve(host, api.setfield, "lua_setfield");
}
static bool validRun(std::string_view s) {
    if (!s.starts_with("session-") || s.size() > 100) return false;
    size_t pos = 8;
    for (int limb = 0; limb < 2; ++limb) {
        const size_t begin = pos;
        uint64_t value = 0;
        while (pos < s.size() && s[pos] >= '0' && s[pos] <= '9') {
            if (pos - begin >= 10) return false;
            value = value * 10 + static_cast<unsigned>(s[pos++] - '0');
        }
        if (pos == begin || (pos - begin > 1 && s[begin] == '0') || value > 2147483647 || pos >= s.size() || s[pos++] != '-') return false;
    }
    if (s.substr(pos, 7) != "loaded-") return false;
    pos += 7;
    if (s.size() - pos != 19) return false;
    for (size_t i = 0; i < 19; ++i) {
        char expected = (i == 4 || i == 7 || i == 13 || i == 16) ? '-' : i == 10 ? '_' : 0;
        if (expected ? s[pos+i] != expected : (s[pos+i] < '0' || s[pos+i] > '9')) return false;
    }
    return true; // Filename grammar only; Node validates the full date/session identity.
}
struct Handle {
    HANDLE value;
    explicit Handle(HANDLE h) : value(h) {}
    ~Handle() { if (value != INVALID_HANDLE_VALUE) CloseHandle(value); }
    Handle(const Handle&) = delete;
    Handle& operator=(const Handle&) = delete;
};
struct Result {
    std::array<char,4096> bytes{};
    size_t length = 0;
    const char* error = nullptr;
};
static std::wstring finalPath(HANDLE handle) {
    std::wstring text(32768, L'\0');
    DWORD n = GetFinalPathNameByHandleW(handle, text.data(), static_cast<DWORD>(text.size()), FILE_NAME_NORMALIZED | VOLUME_NAME_DOS);
    return n && n < text.size() ? std::wstring(text.data(), n) : std::wstring();
}
static Result readFile(std::string_view run) {
    Result result;
    try {
        std::wstring path(32768, L'\0');
        DWORD n = GetModuleFileNameW(selfModule, path.data(), static_cast<DWORD>(path.size()));
        if (!n || n >= path.size()) { result.error = "MODULE_PATH"; return result; }
        std::wstring root(path.data(), n);
        size_t end = root.find_last_of(L"\\/");
        if (end == std::wstring::npos) { result.error = "MODULE_PATH"; return result; }
        root.resize(end);
        end = root.find_last_of(L"\\/");
        if (end == std::wstring::npos || _wcsicmp(root.c_str()+end+1, L"native") != 0) { result.error = "MODULE_LOCATION"; return result; }
        root.resize(end);
        end = root.find_last_of(L"\\/");
        if (end == std::wstring::npos || _wcsicmp(root.c_str()+end+1, L"lifesigns_event_recorder") != 0) { result.error = "MODULE_LOCATION"; return result; }
        root += L"\\runtime";
        Handle directory(CreateFileW(root.c_str(), FILE_READ_ATTRIBUTES, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            nullptr, OPEN_EXISTING, FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT, nullptr));
        BY_HANDLE_FILE_INFORMATION directoryInfo{};
        if (directory.value == INVALID_HANDLE_VALUE || !GetFileInformationByHandle(directory.value, &directoryInfo) ||
            !(directoryInfo.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) || (directoryInfo.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT)) {
            result.error = "RUNTIME_DIRECTORY"; return result;
        }
        const std::wstring filename(run.begin(), run.end());
        const std::wstring full = root + L"\\" + filename + L".reply";
        Handle file(CreateFileW(full.c_str(), GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            nullptr, OPEN_EXISTING, FILE_FLAG_OPEN_REPARSE_POINT | FILE_FLAG_SEQUENTIAL_SCAN, nullptr));
        if (file.value == INVALID_HANDLE_VALUE) { result.error = GetLastError() == ERROR_FILE_NOT_FOUND ? "MISSING" : "OPEN_FAILED"; return result; }
        BY_HANDLE_FILE_INFORMATION info{};
        if (GetFileType(file.value) != FILE_TYPE_DISK || !GetFileInformationByHandle(file.value, &info) ||
            (info.dwFileAttributes & (FILE_ATTRIBUTE_DIRECTORY | FILE_ATTRIBUTE_REPARSE_POINT)) || info.nNumberOfLinks != 1) {
            result.error = "FILE_TYPE"; return result;
        }
        const std::wstring parent = finalPath(directory.value), actual = finalPath(file.value);
        const std::wstring expected = parent + L"\\" + filename + L".reply";
        if (parent.empty() || actual.empty() || CompareStringOrdinal(expected.c_str(), -1, actual.c_str(), -1, TRUE) != CSTR_EQUAL) {
            result.error = "FILE_LOCATION"; return result;
        }
        LARGE_INTEGER size{}, after{};
        if (!GetFileSizeEx(file.value, &size) || size.QuadPart <= 0 || size.QuadPart >= 4096) { result.error = "FILE_SIZE"; return result; }
        DWORD count = 0;
        if (!ReadFile(file.value, result.bytes.data(), 4096, &count, nullptr) || count != size.QuadPart ||
            !GetFileSizeEx(file.value, &after) || after.QuadPart != size.QuadPart) { result.error = "READ_FAILED"; return result; }
        result.length = count;
        const std::string_view data(result.bytes.data(), result.length);
        if (!data.starts_with("LSDB1|") || data.back() != '\n' || data.find('\n') != data.size()-1) { result.error = "INCOMPLETE"; return result; }
        for (char c : data) if ((c < 32 || c > 126) && c != '\r' && c != '\n') { result.error = "INVALID_BYTES"; return result; }
    } catch (...) { result.error = "INTERNAL_ERROR"; }
    return result;
}
static int readReply(lua_State* state) {
    // All C++ resources/handles are destroyed before a Lua push can longjmp on OOM.
    const char* error = "INVALID_RUN";
    Result result;
    if (api.gettop(state) == 1 && api.type(state, 1) == 4) {
        size_t length = 0;
        const char* run = api.tolstring(state, 1, &length);
        if (run && validRun(std::string_view(run, length))) {
            result = readFile(std::string_view(run, length));
            error = result.error;
        }
    }
    if (error) { api.pushnil(state); api.pushlstring(state, error, std::strlen(error)); return 2; }
    api.pushlstring(state, result.bytes.data(), result.length);
    return 1;
}
extern "C" __declspec(dllexport) int luaopen_lifesigns_status(lua_State* state) {
    if (!loadApi()) return 0;
    api.createtable(state, 0, 1);
    api.pushcclosure(state, readReply, 0);
    api.setfield(state, -2, "readReply");
    return 1;
}
BOOL WINAPI DllMain(HINSTANCE instance, DWORD reason, LPVOID) {
    if (reason == DLL_PROCESS_ATTACH) selfModule = instance;
    return TRUE;
}
