# Integrating a software product

Register the product in the admin app. Its UUID identifies it across all versions and clients. Groups and version platform labels are free-form metadata, so use labels such as Linux, Windows, macOS, or your own plugin target.

Create a test customer and issue a license for that product. Use the same saved installation identifier on later checks. For a new integration, generate a random identifier per installation and persist it in the application's local configuration. Licenses for the same customer share the existing account-level device binding.

Send `POST /licenses/validate` with a JSON body:

```json
{
  "productId": "5ced743c-6bfb-4a1a-bd46-94d9f02e079c",
  "licenseKey": "REPLACE_WITH_TEST_LICENSE",
  "machineId": "example-installation-01"
}
```

The API returns HTTP 200 with `status: "success"` and `expires_at` when it accepts the entitlement. A different product is rejected before any device binding. Unknown keys return 404. Disabled, expired, or mismatched entitlements return 403. Treat timeouts, rate limits, and unexpected responses as an inability to confirm the entitlement. Protect the license key like a credential and keep it out of logs.

The Node.js and PowerShell examples read `FXCRUX_API_URL`, `FXCRUX_PRODUCT_ID`, `FXCRUX_LICENSE_KEY`, and `FXCRUX_DEVICE_ID` from the environment. Run either example from the repository root:

```sh
node examples/node/check-license.mjs
pwsh -NoProfile -File examples/powershell/check-license.ps1
```

Existing clients may omit `productId` for compatibility. New clients should always send it. Existing license key strings still validate. Newly issued keys contain 128 random bits.

See [optional integrations](../integrations/README.md) for the original desktop and trading clients.
