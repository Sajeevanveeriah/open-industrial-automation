param([string]$InstallFolder='evidence-local/installed',[string]$UserData)
$ErrorActionPreference='Stop'
$shortcut=(Get-ChildItem "$env:APPDATA/Microsoft/Windows/Start Menu/Programs" -Recurse -Filter 'Industrial Engineering Workshop.lnk' | Select-Object -First 1).FullName
$wsh=New-Object -ComObject WScript.Shell
$target=(Resolve-Path (Join-Path $InstallFolder 'Industrial Engineering Workshop.exe')).Path
if($wsh.CreateShortcut($shortcut).TargetPath -ne $target){throw 'Incorrect shortcut target'}
$earlier=@(Get-Process -Name 'Industrial Engineering Workshop' -ea 0 | Select-Object -Expand Id)
if ($UserData) {
  $full=[IO.Path]::GetFullPath($UserData)
  Start-Process -FilePath $shortcut -ArgumentList ('--user-data-dir="'+$full+'"')
} else { Start-Process -FilePath $shortcut }
$deadline=(Get-Date).AddSeconds(30)
do{
  $subject=Get-Process -Name 'Industrial Engineering Workshop' -ea 0 | Where-Object {$_.Id -notin $earlier -and $_.Path -eq $target -and $_.MainWindowTitle} | Select-Object -First 1
  if(-not $subject){Start-Sleep -Milliseconds 300}
}until($subject -or (Get-Date) -ge $deadline)
if(-not $subject){throw 'Normal shortcut did not expose a distribution floor window'}
try{
  Add-Type -AssemblyName UIAutomationClient
  Add-Type -AssemblyName UIAutomationTypes
  $root=[Windows.Automation.AutomationElement]::FromHandle($subject.MainWindowHandle)
  $end=(Get-Date).AddSeconds(12)
  do{
    $labels=@($root.FindAll([Windows.Automation.TreeScope]::Descendants,[Windows.Automation.Condition]::TrueCondition) | ForEach-Object {$_.Current.Name})
    if($labels -notcontains 'New order'){Start-Sleep -Milliseconds 300}
  }until($labels -contains 'New order' -or (Get-Date) -ge $end)
  Write-Output "Normal shortcut window: $($subject.MainWindowTitle); process: $($subject.Id)"
  $labels | Where-Object {$_ -in 'New order','Cell Studio','Distribution floor','Scenario','Follow vehicle','Processing plant'} | Sort-Object -Unique
  if ($labels -notcontains 'New order' -or $labels -notcontains 'Cell Studio'){throw 'Workshop controls unavailable from the normal shortcut window'}
}finally{
  [void]$subject.CloseMainWindow()
  if(-not $subject.WaitForExit(10000)){throw 'Test shortcut instance did not close normally'}
}
