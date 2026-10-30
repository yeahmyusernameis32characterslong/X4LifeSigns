# Internal companion IPC only. Paths are JSON data, never executable expressions.
param([switch]$ProbeAvailability)
$ErrorActionPreference='Stop'
# Node writes UTF-8 JSON to redirected stdin. Windows PowerShell's inherited
# console code page is not a UTF-8 contract, even when every reply is ASCII.
[Console]::InputEncoding=New-Object Text.UTF8Encoding($false)
[Console]::OutputEncoding=New-Object Text.UTF8Encoding($false)
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Win32.SafeHandles;
public static class LifeSignsMaintenanceHandles {
 [StructLayout(LayoutKind.Sequential)] public struct AttributeTag {public uint Attributes;public uint Tag;}
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]
 public static extern SafeFileHandle CreateFileW(string path,uint access,uint share,IntPtr security,uint creation,uint flags,IntPtr template);
 [DllImport("kernel32.dll",SetLastError=true)]
 public static extern bool SetFileInformationByHandle(SafeFileHandle file,int information,IntPtr data,uint length);
 [DllImport("kernel32.dll",SetLastError=true)] public static extern bool GetFileInformationByHandleEx(SafeFileHandle file,int information,out AttributeTag data,uint size);
 [DllImport("CldApi.dll")] public static extern uint CfGetPlaceholderStateFromAttributeTag(uint attributes,uint tag);
 public static long[] Probe(string path) {
  using(var h=CreateFileW(path,0,7,IntPtr.Zero,3,0x02200000,IntPtr.Zero)) {
   if(h.IsInvalid)return null;AttributeTag info;if(!GetFileInformationByHandleEx(h,9,out info,8))return null;
   return new long[]{info.Attributes,info.Tag,CfGetPlaceholderStateFromAttributeTag(info.Attributes,info.Tag)};
  }
 }
 public static bool Install(SafeFileHandle source,string target) {
  byte[] name=Encoding.Unicode.GetBytes(target);int ptrOffset=IntPtr.Size==8?8:4;int lenOffset=ptrOffset+IntPtr.Size;int nameOffset=lenOffset+4;
  IntPtr buffer=Marshal.AllocHGlobal(nameOffset+name.Length+2);
  try {for(int i=0;i<nameOffset+name.Length+2;i++)Marshal.WriteByte(buffer,i,0);Marshal.WriteInt32(buffer,0,3);Marshal.WriteInt32(buffer,lenOffset,name.Length);Marshal.Copy(name,0,IntPtr.Add(buffer,nameOffset),name.Length);return SetFileInformationByHandle(source,22,buffer,(uint)(nameOffset+name.Length+2));}
  finally {Marshal.FreeHGlobal(buffer);}
 }
}
'@
if($ProbeAvailability){
 $paths=ConvertFrom-Json -InputObject $env:LIFESIGNS_INVENTORY_ATTRIBUTE_PATHS
 $results=@(foreach($p in $paths){try{,([LifeSignsMaintenanceHandles]::Probe([string]$p))}catch{,$null}})
 ConvertTo-Json -InputObject $results -Depth 4 -Compress
 exit 0
}
$handles=New-Object 'System.Collections.Generic.List[Microsoft.Win32.SafeHandles.SafeFileHandle]'
$replaceable=@{}
try {
 while($null -ne ($line=[Console]::ReadLine())){
  $request=ConvertFrom-Json -InputObject $line
  if($request.command -eq 'CLOSE'){break}
  if($request.command -eq 'INSTALL'){
   if(-not $replaceable.ContainsKey([string]$request.source) -or -not $replaceable.ContainsKey([string]$request.target)){throw 'Replacement paths not held'}
   if(-not [LifeSignsMaintenanceHandles]::Install($replaceable[[string]$request.source],[string]$request.target)){throw 'Atomic handle replacement refused'}
   [Console]::WriteLine('LOCKED');[Console]::Out.Flush();continue
  }
  if($request.command -ne 'LOCK' -or @($request.paths).Count -gt 10000){throw 'Invalid handle request'}
  foreach($p in $request.paths){
   if(-not [IO.Path]::IsPathRooted([string]$p)){throw 'Absolute path required'}
   # GENERIC_READ; FILE_SHARE_READ|FILE_SHARE_DELETE, deliberately no SHARE_WRITE.
   # Also refuses existing writable handles whose granted access conflicts.
   $access=[uint32]2147483648;$share=1
   if($request.replaceable){$share=5}
   if($request.rename){$access=[uint32]2147549184}
   $h=[LifeSignsMaintenanceHandles]::CreateFileW([string]$p,$access,$share,[IntPtr]::Zero,3,0x100080,[IntPtr]::Zero)
   if($h.IsInvalid){$code=[Runtime.InteropServices.Marshal]::GetLastWin32Error();$h.Dispose();throw ('HANDLE_REFUSED_'+$code)}
   $handles.Add($h)
   if($request.replaceable){$replaceable[[string]$p]=$h}
  }
  [Console]::WriteLine('LOCKED');[Console]::Out.Flush()
 }
} catch {[Console]::WriteLine('REFUSED');[Console]::Out.Flush();exit 1}
finally {foreach($h in $handles){$h.Dispose()}}
