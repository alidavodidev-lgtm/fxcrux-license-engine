$ErrorActionPreference = 'Stop'

if (!$env:FXCRUX_API_URL -or !$env:FXCRUX_PRODUCT_ID -or !$env:FXCRUX_LICENSE_KEY -or !$env:FXCRUX_DEVICE_ID) {
    Write-Error 'Set FXCRUX_API_URL, FXCRUX_PRODUCT_ID, FXCRUX_LICENSE_KEY, and FXCRUX_DEVICE_ID.' -ErrorAction Continue
    exit 2
}

try {
    $base = [uri]$env:FXCRUX_API_URL
    if ($base.UserInfo) {
        Write-Error 'Keep credentials out of the API URL.' -ErrorAction Continue
        exit 2
    }
    if (!$base.IsAbsoluteUri -or ($base.Scheme -ne 'https' -and !($base.IsLoopback -and $base.Scheme -eq 'http'))) {
        Write-Error 'Use HTTPS for a remote licensing API.' -ErrorAction Continue
        exit 2
    }
    $body = @{
        productId = $env:FXCRUX_PRODUCT_ID
        licenseKey = $env:FXCRUX_LICENSE_KEY
        machineId = $env:FXCRUX_DEVICE_ID
    } | ConvertTo-Json -Compress
    $request = @{
        Method = 'Post'
        Uri = [uri]::new($base, '/licenses/validate')
        ContentType = 'application/json'
        Body = $body
        MaximumRedirection = 0
        TimeoutSec = 5
        UseBasicParsing = $true
    }

    $result = Invoke-RestMethod @request
    if ($result.status -ne 'success') {
        throw 'Unexpected license response.'
    }
    Write-Output "License accepted. Expires at $($result.expires_at)."
} catch {
    if ($_.Exception.Response) {
        $status = [int]$_.Exception.Response.StatusCode
        Write-Error "License check failed (HTTP $status)." -ErrorAction Continue
    } else {
        Write-Error 'Could not confirm the license with the configured server.' -ErrorAction Continue
    }
    exit 1
}
