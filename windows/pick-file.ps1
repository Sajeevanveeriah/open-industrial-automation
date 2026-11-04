param([Parameter(Mandatory)][int]$AppPid,[Parameter(Mandatory)][string]$File)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$subject=Get-Process -Id $AppPid
if ($subject.ProcessName -notin @('Industrial Engineering Workshop','electron')) {throw 'Expected a workshop test process'}
$filePath=(Resolve-Path -LiteralPath $File).Path
if ([IO.Path]::GetFileName($filePath) -ne 'photoeye-assembly.step'){throw 'Expected the bundled fixture'}
$processCondition=[Windows.Automation.PropertyCondition]::new([Windows.Automation.AutomationElement]::ProcessIdProperty,$AppPid)
$nameCondition=[Windows.Automation.PropertyCondition]::new([Windows.Automation.AutomationElement]::NameProperty,'Import self-contained STEP model')
$both=[Windows.Automation.AndCondition]::new($processCondition,$nameCondition)
$stopAt=[DateTime]::UtcNow.AddSeconds(20)
do {
  $chooser=[Windows.Automation.AutomationElement]::RootElement.FindFirst([Windows.Automation.TreeScope]::Children,$both)
  if (-not $chooser){Start-Sleep -Milliseconds 200}
} until ($chooser -or [DateTime]::UtcNow -gt $stopAt)
if (-not $chooser){throw 'Workshop native STEP picker did not appear'}

Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class WorkshopDialog {
  public delegate bool EnumProc(IntPtr hwnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr parent, EnumProc callback, IntPtr extra);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr hwnd, StringBuilder name,int size);
  [DllImport("user32.dll")] public static extern int GetDlgCtrlID(IntPtr hwnd);
  [DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr hwnd);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern IntPtr SendMessage(IntPtr hwnd,uint message,IntPtr w,string text);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern IntPtr PostMessage(IntPtr hwnd,uint message,IntPtr w,IntPtr l);
  public static IntPtr FileEdit(IntPtr dialog){
    IntPtr match=IntPtr.Zero;
    EnumChildWindows(dialog,(h,x)=>{
      var n=new StringBuilder(100); GetClassName(h,n,n.Capacity);
      if(n.ToString()!="Edit")return true;
      IntPtr parent=h;
      while(parent!=IntPtr.Zero && parent!=dialog){
        int id=GetDlgCtrlID(parent);
        if(id==1148){match=h;return false;}
        parent=GetParent(parent);
      }
      return true;
    },IntPtr.Zero);
    return match;
  }
}
"@
$handle=[IntPtr]$chooser.Current.NativeWindowHandle
$stopAt=[DateTime]::UtcNow.AddSeconds(8)
do{
 $field=[WorkshopDialog]::FileEdit($handle)
 if ($field -eq [IntPtr]::Zero){Start-Sleep -Milliseconds 150}
}until($field -ne [IntPtr]::Zero -or [DateTime]::UtcNow -gt $stopAt)
if ($field -eq [IntPtr]::Zero){throw 'File name control 1148 absent from the owned STEP picker'}
[void][WorkshopDialog]::SendMessage($field,12,[IntPtr]::Zero,$filePath)
[void][WorkshopDialog]::PostMessage($handle,273,[IntPtr]1,[IntPtr]::Zero)
Write-Output 'Actual Windows STEP Open dialog selected the bundled assembly.'
