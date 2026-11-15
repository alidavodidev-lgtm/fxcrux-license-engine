# FXCRUX License Engine repository guide

Read [PROJECT_STATUS.md](PROJECT_STATUS.md) for the current state and deferred work. Use [README.md](README.md) for setup and [SECURITY.md](SECURITY.md) for security boundaries. Keep repository prose, comments, examples, and user-facing text in English.

## Repository map

- `apps/api` is the NestJS and TypeORM backend. Keep product and license rules in their existing modules.
- `apps/admin` and `apps/portal` are separate Next.js applications. Follow their local AGENTS.md instructions.
- `examples` contains independent product clients. New examples should exercise the documented API contract.
- `integrations/windows` contains the legacy .NET engine and WPF shell. `integrations/trading` contains its optional platform adapters.
- `docs` contains the integration contract and design rationale.

## Working agreements

- Use product IDs as stable identities. Keep product categories and version platform labels open to operator-defined values.
- Preserve existing API contracts and stored licenses. Verify intentional changes through the normal entry point.
- Apply entitlement and administrator authorization on the server. Keep private keys, deployment configuration, customer information, and payloads out of the repository and logs.
- Keep the web apps and generic integrations usable with legacy machine endpoints disabled. Changes to legacy protocols need separate interoperability verification.
- Use disposable databases for schema synchronization and integration tests. Keep operational archives outside this Git root.
- Run the checks for the affected components. Update project status with exact results and limitations when the release state changes.

See [CONTRIBUTING.md](CONTRIBUTING.md) for reviews, contributor credit, and release ownership.
