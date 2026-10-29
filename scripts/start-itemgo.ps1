$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$mysqlExecutable = 'C:\xampp\mysql\bin\mysqld.exe'
$mysqlConfig = 'C:\xampp\mysql\bin\my.ini'
$logDirectory = Join-Path $projectRoot 'logs'
$logFile = Join-Path $logDirectory 'itemgo-startup.log'
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

function Write-StartupLog {
  param([string]$Message)
  Add-Content -LiteralPath $logFile -Value "$(Get-Date -Format o) $Message"
}

function Test-MySqlReady {
  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $connection = $client.ConnectAsync('127.0.0.1', 3306)
    return $connection.Wait(1000) -and $client.Connected
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

Set-Location $projectRoot
Write-StartupLog 'Itemgo startup supervisor started.'
while ($true) {
  $mysqlReady = Test-MySqlReady
  if (-not $mysqlReady) {
    if (-not (Test-Path $mysqlExecutable) -or -not (Test-Path $mysqlConfig)) {
      Write-StartupLog 'XAMPP MySQL executable or configuration was not found; retrying in 15 seconds.'
      [System.Threading.Thread]::Sleep(15000)
      continue
    }

    $mysqlProcess = Get-Process mysqld -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($mysqlProcess) {
      Write-StartupLog "XAMPP MySQL process $($mysqlProcess.Id) is already running; waiting for its port."
    } else {
      Write-StartupLog 'Starting XAMPP MySQL.'
      try {
        Start-Process -FilePath $mysqlExecutable `
          -ArgumentList @("--defaults-file=$mysqlConfig", '--standalone') `
          -WindowStyle Hidden | Out-Null
      } catch {
        Write-StartupLog "Could not start XAMPP MySQL: $($_.Exception.Message)"
        [System.Threading.Thread]::Sleep(15000)
        continue
      }
    }

    $deadline = [DateTime]::UtcNow.AddSeconds(180)
    do {
      $mysqlReady = Test-MySqlReady
      if (-not $mysqlReady) {
        [System.Threading.Thread]::Sleep(1000)
      }
    } while (-not $mysqlReady -and [DateTime]::UtcNow -lt $deadline)

    if (-not $mysqlReady) {
      Write-StartupLog 'XAMPP MySQL did not become ready within 180 seconds; retrying in 15 seconds.'
      $mysqlErrorLog = 'C:\xampp\mysql\data\mysql_error.log'
      if (Test-Path $mysqlErrorLog) {
        Get-Content -LiteralPath $mysqlErrorLog -Tail 10 | ForEach-Object { Write-StartupLog "MySQL: $_" }
      }
      [System.Threading.Thread]::Sleep(15000)
      continue
    }
  }

  Write-StartupLog 'MySQL is ready; starting npm run dev.'
  & npm.cmd run dev
  $exitCode = $LASTEXITCODE
  Write-StartupLog "npm run dev exited with code $exitCode; restarting in 5 seconds."
  [System.Threading.Thread]::Sleep(5000)
}
