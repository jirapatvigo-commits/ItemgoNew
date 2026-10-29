$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$startupFolder = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupFolder 'Itemgo Dev Server.lnk'
$launcherScript = Join-Path $PSScriptRoot 'launch-itemgo.vbs'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = Join-Path $env:SystemRoot 'System32\wscript.exe'
$shortcut.Arguments = "`"$launcherScript`""
$shortcut.WorkingDirectory = $projectRoot
$shortcut.Save()

Stop-ScheduledTask -TaskName 'Itemgo Dev Server' -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName 'Itemgo Dev Server' -Confirm:$false -ErrorAction SilentlyContinue

Write-Output "Created '$shortcutPath' to start Itemgo when this user signs in."

