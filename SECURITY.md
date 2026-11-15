# Security policy

## Report a vulnerability

Email the maintainer at alidavodi.dev@gmail.com. Include the affected version or commit, the impact, and relevant reproduction details using a disposable account or instance. Keep real credentials, customer information, and production data out of the report. Use public issues for general bugs and feature requests.

## Security model

- Treat product clients and device IDs as untrusted. An installation ID binds a license to a recorded device value. It does not attest to hardware or establish control of a customer machine.
- Make entitlement decisions on the server. The account, product, expiry, revocation status, and device binding are evaluated by the API. Keep unreleased features and proprietary computations on infrastructure you control.
- Use HTTPS for remote API traffic. Keep JWT secrets and database credentials in deployment secret storage. Generate separate transport and signing key pairs for legacy integrations.
- Restrict protected downloads to authenticated and authorized routes. Store deliverables separately from publicly served assets.
- Leave legacy engine endpoints disabled unless a deployment explicitly needs and reviews them. Review dependency advisories, database migrations, retention, proxy settings, and upload controls before hosting this repository publicly as a service.

Public source lets operators review these controls. Each installation keeps its own keys, credentials, and customer records.
