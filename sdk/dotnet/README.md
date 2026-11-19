# FXCRUX .NET SDK

Reference [Fxcrux.Licensing.csproj](Fxcrux.Licensing/Fxcrux.Licensing.csproj) from a .NET 8 or later app. The Windows example uses the same project reference.

```csharp
using Fxcrux.Licensing;

using var http = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false })
{
    Timeout = TimeSpan.FromSeconds(10),
};
var client = new LicenseClient(http, new Uri("http://localhost:3000"), productId);
var result = await client.ValidateAsync(licenseKey, savedInstallationId, cancellationToken);
bool enablePremium = result.Status == LicenseStatus.Valid;
```

Obtain the product UUID from the FXCRUX dashboard. Pass the key supplied by the customer and a stable installation ID stored by your application. Reuse your application's HTTP client and use HTTPS for remote deployments. The SDK returns the acceptance status and expiry and leaves feature gating, local ID storage and recheck timing to your application. A rejected or unavailable result cannot confirm an entitlement. Caller cancellation propagates.

See the [API contract](../../docs/INTEGRATION.md) and [local demo walkthrough](../../docs/DEMO.md).
