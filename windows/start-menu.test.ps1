param([string]$InstallFolder='evidence-local/installed')
$ErrorActionPreference='Stop'
$shortcut=(Get-ChildItem "$env:APPDATA/Microsoft/Windows/Start Menu/Programs" -Recurse -Filter 'Industrial Engineering Workshop.lnk' | Select-Object -First 1).FullName
$wsh=New-Object -ComObject WScript.Shell
$target=(Resolve-Path (Join-Path $InstallFolder 'Industrial Engineering Workshop.exe')).Path
if($wsh.CreateShortcut($shortcut).TargetPath -ne $target){throw 'Incorrect shortcut target'}
$earlier=@(Get-Process -Name 'Industrial Engineering Workshop' -ea 0 | Select-Object -Expand Id)
Start-Process -FilePath $shortcut
$deadline=(Get-Date).AddSeconds(30)
do{
  $subject=Get-Process -Name 'Industrial Engineering Workshop' -ea 0 | Where-Object {$_.Id -notin $earlier -and $_.Path -eq $target -and $_.MainWindowTitle -like 'Packaging workshop*'} | Select-Object -First 1
  if(-not $subject){Start-Sleep -Milliseconds 300}
}until($subject -or (Get-Date) -ge $deadline)
if(-not $subject){throw 'Normal shortcut did not expose a packaging workshop window'}
try{
  Add-Type -AssemblyName UIAutomationClient
  Add-Type -AssemblyName UIAutomationTypes
  $root=[Windows.Automation.AutomationElement]::FromHandle($subject.MainWindowHandle)
  $end=(Get-Date).AddSeconds(12)
  do{
    $labels=@($root.FindAll([Windows.Automation.TreeScope]::Descendants,[Windows.Automation.Condition]::TrueCondition) | ForEach-Object {$_.Current.Name})
    if($labels -notcontains 'Place asset'){Start-Sleep -Milliseconds 300}
  }until($labels -contains 'Place asset' -or (Get-Date) -ge $end)
  Write-Output "Normal shortcut window: $($subject.MainWindowTitle); process: $($subject.Id)"
  $labels | Where-Object {$_ -in 'Place asset','New blank cell','Asset inspector','Packaging workshop','Project cabinet','Step 1 scan'} | Sort-Object -Unique
  if ($labels -notcontains 'Place asset' -or $labels -notcontains 'New blank cell'){throw 'Workshop controls unavailable from the normal shortcut window'}
}finally{
  [void]$subject.CloseMainWindow()
  if(-not $subject.WaitForExit(10000)){throw 'Test shortcut instance did not close normally'}
}
