# Product integrations

For a new integration, call the [HTTP validation endpoint](../docs/INTEGRATION.md) from your application. The [PowerShell client](../examples/powershell/check-license.ps1) works for Windows tools and automation. The [Node.js client](../examples/node/check-license.mjs) works across operating systems.

## Legacy integrations

The Windows engine and WPF shell are under `windows/`. MetaTrader 4, MetaTrader 5, and NinjaTrader source is under `trading/`. They are included as integration references. The Windows projects still target .NET 7, which the installed SDK reports as out of support. Use the main HTTP API for new integrations.

Use an isolated test installation to exercise the original desktop protocol:

1. From `apps/api`, run `npm run keys:generate-signing` to create local transport and signing key pairs.
2. Set `ENABLE_LEGACY_ENGINE=true` for the API. Its key paths are in `.env.example`.
3. Set `FXCRUX_BACKEND_URL` for the Windows engine. Set `FXCRUX_TRANSPORT_PUBLIC_KEY_PATH` to the generated transport public key. A legacy installation can set `FXCRUX_DEVICE_NAMESPACE` to its previous hardware ID namespace before testing compatibility.
4. Enable `FXCRUX_ENABLE_TRADING_GATEWAY=true` on the Windows engine only for local trading adapters. Configure the per-account pairing secret through the client. The NinjaTrader adapter additionally reads `FXCRUX_SIGNING_PUBLIC_KEY_PATH` from its process environment.

Private keys belong on the API host. Desktop and trading clients receive only the appropriate public key. Use a controlled test deployment until the legacy runtime and platform-specific checks are complete.
