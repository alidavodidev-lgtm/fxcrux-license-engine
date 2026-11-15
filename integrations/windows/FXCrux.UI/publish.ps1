# Builds the distributable FXCrux.UI: a Release publish, then obfuscated with
# ConfuserEx2 per ConfuserEx.crproj. WPF cannot use Native AOT the way
# fxcrux.Engine does, so obfuscation is this project's mitigation instead -
# raises the cost of opening it in ILSpy/dnSpy, doesn't eliminate IL outright.
#
# One-time setup: download ConfuserEx2 (the maintained ConfuserEx fork -
# search "ConfuserEx2" / "mkaring ConfuserEx" for the current release) and
# place Confuser.CLI.exe somewhere on PATH, or set $env:CONFUSER_CLI to its
# full path before running this script.
#
# Usage: pwsh ./publish.ps1
# Output (obfuscated, the only build that should ever ship to a customer):
#   FXCrux.UI\bin\Release\net7.0-windows\publish-confused\FXCrux.UI.exe

$ErrorActionPreference = "Stop"

Push-Location "$PSScriptRoot\FXCrux.UI"
try {
    dotnet publish -c Release
    if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed with exit code $LASTEXITCODE" }

    $confuserCli = $env:CONFUSER_CLI
    if (-not $confuserCli) {
        $found = Get-Command "Confuser.CLI.exe" -ErrorAction SilentlyContinue
        if ($found) { $confuserCli = $found.Source }
    }

    if (-not $confuserCli -or -not (Test-Path $confuserCli)) {
        Write-Host ""
        Write-Host "ConfuserEx2 not found." -ForegroundColor Yellow
        Write-Host "Download ConfuserEx2 (the maintained ConfuserEx fork) and either:" -ForegroundColor Yellow
        Write-Host "  1) put Confuser.CLI.exe on PATH, or" -ForegroundColor Yellow
        Write-Host "  2) set `$env:CONFUSER_CLI to its full path" -ForegroundColor Yellow
        Write-Host "then re-run this script." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Unobfuscated publish output is at FXCrux.UI\bin\Release\net7.0-windows\publish\ -" -ForegroundColor Yellow
        Write-Host "do NOT ship that build to a customer, it's plain decompilable IL." -ForegroundColor Yellow
        exit 1
    }

    & $confuserCli "$PSScriptRoot\ConfuserEx.crproj"
    if ($LASTEXITCODE -ne 0) { throw "ConfuserEx2 failed with exit code $LASTEXITCODE" }

    Write-Host ""
    Write-Host "Obfuscated build: FXCrux.UI\bin\Release\net7.0-windows\publish-confused\" -ForegroundColor Green
    Write-Host "This is the ONLY build that should ever be distributed to a customer." -ForegroundColor Yellow
}
finally {
    Pop-Location
}
