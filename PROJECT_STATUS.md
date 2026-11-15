# FXCRUX License Engine status

## Current snapshot

Updated 2026-11-16 (Asia/Tehran). This is a standalone local repository from selected FXCRUX source files. The original workspace contains older deployments and archives. Its files and Git history were kept outside this repository.

| Work | Status | Evidence |
| --- | --- | --- |
| Organize the source and author English project guides | done | API and web apps in `apps/`, independent clients in `examples/`, optional adapters in `integrations/` |
| Validate a generic software product | done | PostgreSQL-backed API tests exercised product mismatch, installation binding, and older request compatibility. The Node.js and PowerShell clients accepted test entitlements. |
| Separate deployment configuration | done | Local setup creates random credentials and preserves existing settings. Legacy key generation creates two separate key pairs and refuses to overwrite them. |
| Prepare contribution and launch materials | done | Apache-2.0 license, attribution, contributor credits, PR template, CI workflow, launch copy, and four screenshots with synthetic data |
| Verify builds and tests | done | API and both Next.js production builds passed. API tests passed with eight unit tests and three end-to-end tests. Both Windows solutions compiled with warnings. |
| Verify the release file set | done | Staged-file Gitleaks scan and Persian-script checks passed. The screenshot review found only synthetic data and English UI text. |
| Verify the initial commit from a fresh clone | done | Setup, license issuance, validation, and revocation passed from `3b3c0fc`. See the verification record below. |
| Keep contributor instructions stable on first startup | done | Both development login pages returned HTTP 200 with `agentRules: false` and preserved their tracked `AGENTS.md` files. |

## Fresh-clone verification

On 2026-11-16 (Asia/Tehran), a fresh local clone of `3b3c0fc` ran the README setup with Node.js 24.12.0 and an empty PostgreSQL 18.6 database. All three `npm ci` installs, development starts, and production builds passed. The API passed eight unit tests and three end-to-end tests. The PostgreSQL driver emitted a deprecation warning during the end-to-end run.

Admin routes created a customer and a generic desktop software product and issued a license. The portal showed the active license. The Node.js and PowerShell examples accepted it for the same installation. After an admin revoked the license, the portal showed the revoked status, and both examples received HTTP 403.

The first verification found that Next.js appended generated rules to the apps' tracked `AGENTS.md` files. Both apps now use `agentRules: false` and preserve the project's written instructions on development startup. Publication and release milestones are tracked in [GitHub Releases](https://github.com/alidavodidev-lgtm/fxcrux-license-engine/releases).

## Before deployment

- Production dependency audits reported no high or critical advisories after compatible updates. The API still had two moderate entries in the Excel export dependency chain (`exceljs` and `uuid`).
- PostgreSQL tests used a disposable local PostgreSQL instance. The Compose configuration parsed as YAML. Docker was unavailable on the test machine.
- The optional Windows clients target .NET 7. Full desktop, MetaTrader, and NinjaTrader interoperability remains to be tested. The legacy engine protocol is opt-in and needs a separate review before deployment.
- Database schema synchronization is for development. Establish a production migration and rollback procedure before deploying against live data.
