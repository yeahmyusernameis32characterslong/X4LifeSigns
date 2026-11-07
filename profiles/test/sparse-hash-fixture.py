"""Create an owned disposable sparse hashing fixture; never opens owner data."""
import ctypes
from ctypes import wintypes
import hashlib
import os
from pathlib import Path
import sys
import tempfile

target=Path(sys.argv[1]).resolve()
assert target.parent.parent==Path(tempfile.gettempdir()).resolve()
assert target.parent.name.startswith('ls-large-hash-') and target.name=='large.bin'
size=4*1024**3+131
with target.open('xb') as stream:
    if os.name=='nt':
        import msvcrt
        kernel=ctypes.WinDLL('kernel32',use_last_error=True)
        kernel.DeviceIoControl.argtypes=[wintypes.HANDLE,wintypes.DWORD,ctypes.c_void_p,wintypes.DWORD,ctypes.c_void_p,wintypes.DWORD,ctypes.POINTER(wintypes.DWORD),ctypes.c_void_p]
        returned=wintypes.DWORD()
        if not kernel.DeviceIoControl(msvcrt.get_osfhandle(stream.fileno()),0x900c4,None,0,None,0,ctypes.byref(returned),None):
            raise ctypes.WinError(ctypes.get_last_error())
    stream.truncate(size)
    if os.name=='nt':
        class ZeroRange(ctypes.Structure):
            _fields_=[('start',ctypes.c_longlong),('end',ctypes.c_longlong)]
        zero=ZeroRange(0,size)
        if not kernel.DeviceIoControl(msvcrt.get_osfhandle(stream.fileno()),0x980c8,ctypes.byref(zero),ctypes.sizeof(zero),None,0,ctypes.byref(returned),None):
            raise ctypes.WinError(ctypes.get_last_error())
    stream.seek(0);stream.write(b'first')
    stream.seek(size-4);stream.write(b'last')
if os.name=='nt':
    kernel.GetCompressedFileSizeW.argtypes=[wintypes.LPCWSTR,ctypes.POINTER(wintypes.DWORD)]
    kernel.GetCompressedFileSizeW.restype=wintypes.DWORD
    high=wintypes.DWORD()
    allocated=kernel.GetCompressedFileSizeW(str(target),ctypes.byref(high))+(high.value<<32)
else:
    allocated=target.stat().st_blocks*512
assert allocated<2*1024**2, allocated
h=hashlib.sha256()
with target.open('rb') as stream:
    while chunk:=stream.read(1024**2):h.update(chunk)
print(h.hexdigest())
