# Builds the real, distributable fxcrux.Engine.exe: a self-contained Native
# AOT binary (native machine code, not IL) instead of the Debug/`dotnet build`
# output that has been used for testing so far. Native AOT is the actual
# decompilation protection this project relies on for the Engine - a plain
# `dotnet build` (or a framework-dependent publish) produces ordinary IL that
# ILSpy/dnSpy open in seconds regardless of PublishAot being set in the
# .csproj, since that flag only takes effect on `dotnet publish`.
#
# Usage: pwsh ./publish.ps1
# Output: fxcrux.Engine\bin\Release\net7.0\win-x64\publish\fxcrux.Engine.exe

$ErrorActionPreference = "Stop"

Push-Location "$PSScriptRoot\fxcrux.Engine"
try {
    dotnet publish -c Release -r win-x64 --self-contained true -p:PublishAot=true
    if ($LASTEXITCODE -ne 0) {
        throw "dotnet publish failed with exit code $LASTEXITCODE"
    }

    $publishDir = Get-ChildItem -Path "bin\Release" -Recurse -Filter "fxcrux.Engine.exe" -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -like "*\publish\*" } | Select-Object -First 1

    if (-not $publishDir) {
        throw "Publish succeeded but fxcrux.Engine.exe was not found under bin\Release\...\publish\ - check the output above."
    }

    Write-Host ""
    Write-Host "Published: $($publishDir.FullName)" -ForegroundColor Green
    Write-Host "This is the ONLY build that should ever be distributed to a customer." -ForegroundColor Yellow
}
finally {
    Pop-Location
}
