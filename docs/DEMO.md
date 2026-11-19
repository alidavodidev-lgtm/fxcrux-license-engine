# Local FXCRUX demo

Install Docker with Compose v2 and Node.js 24. From the repository root, run:

```sh
node scripts/setup-demo.mjs
docker compose --env-file .env.demo -f compose.demo.yaml up -d --build --wait
node scripts/seed-demo.mjs
```

Open the [customer portal](http://localhost:3001) and the [admin dashboard](http://localhost:3002/admin-login). The API is available at `http://localhost:3000`. Use `localhost` in the browser so the login cookies work with the local setup. The Compose ports bind to loopback and PostgreSQL stays on the Compose network. Use this configuration with synthetic data on your own machine.

The setup script creates an ignored `.env.demo` file containing generated credentials. Sign in to the portal as `demo-customer` with `DEMO_CUSTOMER_PASSWORD`. The admin credentials are `BOOTSTRAP_ADMIN_USERNAME` and `BOOTSTRAP_ADMIN_PASSWORD`. The seed script prints the product UUID and preserves the current status and expiry of an existing license. Keep the env file and license key private.

## Validate a license from Windows

Use the Windows demo ZIP from the corresponding release, or build it from source with the .NET 8 SDK:

```powershell
dotnet run --project examples/dotnet/FxcruxLicenseDemo
```

1. Sign in to the portal and copy the demo key from **My Licenses**. Use the product UUID printed by the seed script.
2. Start the Windows app. Enter the product UUID and license key, then select **Activate / Check License**. A valid response enables the Premium button.
3. Compare **Machine Code** in the app with **Machine ID** in the portal profile. Restart the app and check that the code stays the same.
4. Disable the license in the admin dashboard. Select **Activate / Check License** again. The API should reject the request and the Premium button should be disabled. The customer account still has its registered Machine ID. Allow for the API's validation limit of five requests per minute.

The demo generates a random UUID on first launch and persists it in `%LOCALAPPDATA%\FXCRUX\LicenseDemo\machine-code.txt`. The app sends that same ID, the product UUID and the key to `POST /licenses/validate`. The API records the ID on the first accepted request and rejects a different ID for the same customer until an administrator resets the binding. This identifier represents the app installation for that Windows user and can be copied. It does not attest to physical hardware.

## Optional portal access gate

The portal opens without a registered device in the default setup. To exercise the optional gate:

1. Change `DEMO_REQUIRE_HARDWARE_BINDING` to `true` in `.env.demo`, then run the Compose up command again to rebuild the portal.
2. Use a fresh customer with an issued license, or reset the demo customer's device binding and ensure its license is active.
3. Sign in to the portal and verify that protected pages show **Hardware Lock**. Retrieve the initial key through the admin dashboard.
4. Validate the key from the Windows demo and refresh the protected page. The portal now sees the registered installation.
5. Set the flag back to `false` and rebuild to restore the default demo flow.

The gate checks whether the account has a registered ID. It belongs to the portal UI. Server-side entitlement decisions still come from the API. To exercise a mismatch, validate the same key and product from a separate Windows user profile or a second Windows machine, which will have a different installation ID.

Stop the services with `docker compose --env-file .env.demo -f compose.demo.yaml down`. This keeps the demo database volume. If you want a disposable clean database, use a separate Compose project or explicitly remove the demo volume after stopping the stack.

## Package a Windows prerelease

Build from the release commit and test against a fresh local demo database. Publish the Windows example with:

```powershell
dotnet publish examples/dotnet/FxcruxLicenseDemo -c Release -r win-x64 --self-contained true -o out/demo-win-x64
Compress-Archive -Path out/demo-win-x64/* -DestinationPath out/FxcruxLicenseDemo-win-x64.zip
Get-FileHash out/FxcruxLicenseDemo-win-x64.zip -Algorithm SHA256
```

Attach the ZIP to a GitHub prerelease with the SHA-256 checksum, the link to this guide at the release tag and the checks actually run. Use a new tag for the demo release. Keep local settings and database contents out of the release assets.
