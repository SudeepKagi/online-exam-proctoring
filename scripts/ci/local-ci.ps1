# ProctorNet Clean-Room Local Diagnostic Runner (PowerShell)
# Phase C0 & C6 Local Parity Diagnostic Tool

$ErrorActionPreference = "Continue"

$repoRoot = Resolve-Path "$PSScriptRoot\..\.."
Set-Location $repoRoot

$reportDir = "$repoRoot\reports\diagnostics"
if (-not (Test-Path $reportDir)) {
    New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
}

$backendTests = Get-ChildItem -Path "$repoRoot\proctornet\backend\tests" -Filter "*.js" | ForEach-Object { "proctornet/backend/tests/$($_.Name)" }
$rootTests = Get-ChildItem -Path "$repoRoot\tests" -Filter "*.test.js" | ForEach-Object { "tests/$($_.Name)" }
$agentTests = if (Test-Path "$repoRoot\proctornet\device-agent\test") {
    Get-ChildItem -Path "$repoRoot\proctornet\device-agent\test" -Filter "*.test.js" | ForEach-Object { "proctornet/device-agent/test/$($_.Name)" }
} else { @() }

$allTests = @($backendTests) + @($rootTests) + @($agentTests)
Write-Host "Discovered $($allTests.Count) test files across workspaces." -ForegroundColor Cyan

# Hermetic Test Environment Configuration (matching CI services)
$env:NODE_ENV = "test"
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5433/proctornet?schema=public"
$env:DIRECT_URL = "postgresql://postgres:postgres@localhost:5433/proctornet?schema=public"
$env:REDIS_URL = "redis://127.0.0.1:6379"
$env:RABBITMQ_URL = "amqp://guest:guest@localhost:5672"
$env:AWS_REGION = "ap-south-1"
$env:S3_MOCK = "true"
$env:FACE_DRIVER = "off"
$env:VPN_ENABLED = "false"
$env:JWT_SECRET = "dummy_ci_jwt_secret_must_be_at_least_32_bytes_long_12345"
$env:AGENT_PAIRING_PEPPER = "dummy_ci_pepper_test_secret_at_least_32_chars_123"
$env:AGENT_POLICY_SIGNING_KEY = "dummy_ci_signing_test_secret_at_least_32_chars_456"
$env:NODE_PATH = "$repoRoot\proctornet\backend\node_modules;$repoRoot\proctornet\node_modules"

$results = @()
$counter = 0

foreach ($testPath in $allTests) {
    $counter++
    $safeName = $testPath -replace '[/\\:]', '_'
    $logFile = "$reportDir\$safeName.log"
    Write-Host "[$counter/$($allTests.Count)] Running $testPath ..." -NoNewline

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $pinfo = New-Object System.Diagnostics.ProcessStartInfo
    $pinfo.FileName = "node"
    $pinfo.Arguments = "--test --test-force-exit `"$testPath`""
    $pinfo.WorkingDirectory = $repoRoot
    $pinfo.RedirectStandardOutput = $true
    $pinfo.RedirectStandardError = $true
    $pinfo.UseShellExecute = $false
    $pinfo.CreateNoWindow = $true

    $proc = [System.Diagnostics.Process]::Start($pinfo)
    $stdoutTask = $proc.StandardOutput.ReadToEndAsync()
    $stderrTask = $proc.StandardError.ReadToEndAsync()
    
    $finishedInTime = $proc.WaitForExit(45000) # 45-second timeout per test
    $sw.Stop()

    $outContent = ""
    $exitCode = -1
    $firstErr = ""

    if (-not $finishedInTime) {
        try {
            $proc.Kill($true)
        } catch { }
        $status = "TIMEOUT"
        $firstErr = "Timed out after 45s (possible unhandled open handle/hanging promise)"
        Write-Host " TIMEOUT (45s)" -ForegroundColor Magenta
    } else {
        $exitCode = $proc.ExitCode
        try {
            $stdout = $stdoutTask.GetAwaiter().GetResult()
            $stderr = $stderrTask.GetAwaiter().GetResult()
            $outContent = "$stdout`n$stderr"
        } catch {
            $outContent = "Failed to capture output"
        }

        if ($exitCode -eq 0) {
            Write-Host " PASS ($($sw.ElapsedMilliseconds)ms)" -ForegroundColor Green
            $status = "PASS"
        } else {
            Write-Host " FAIL ($exitCode, $($sw.ElapsedMilliseconds)ms)" -ForegroundColor Red
            $status = "FAIL"
            $errLine = ($outContent -split "`n" | Where-Object { $_ -match 'not ok|Error:|AssertionError|Invalid `prisma' } | Select-Object -First 1)
            if ($errLine) {
                $firstErr = $errLine.Trim()
                if ($firstErr.Length -gt 120) { $firstErr = $firstErr.Substring(0, 120) + "..." }
            } else {
                $firstErr = "Exit code $exitCode"
            }
        }
    }

    Set-Content -Path $logFile -Value $outContent

    $results += [PSCustomObject]@{
        File = $testPath
        Status = $status
        ExitCode = $exitCode
        DurationMs = $sw.ElapsedMilliseconds
        FirstError = $firstErr
    }
}

$summaryPath = "$repoRoot\reports\local-ci-summary.json"
$results | ConvertTo-Json -Depth 3 | Set-Content -Path $summaryPath

$passCount = ($results | Where-Object { $_.Status -eq "PASS" }).Count
$failCount = ($results | Where-Object { $_.Status -ne "PASS" }).Count

Write-Host "`n=================================================" -ForegroundColor Cyan
Write-Host "DIAGNOSTIC SCAN COMPLETED: Total: $($results.Count) | Passed: $passCount | Failed/Timeout: $failCount" -ForegroundColor $(if ($failCount -eq 0) { "Green" } else { "Yellow" })
Write-Host "=================================================" -ForegroundColor Cyan
