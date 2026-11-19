import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const settings = parseEnv(readFileSync(new URL('../../.env.demo', import.meta.url), 'utf8'));
const api = 'http://127.0.0.1:3000';
const portal = 'http://127.0.0.1:3001';
const admin = 'http://127.0.0.1:3002';
const probe = fileURLToPath(new URL('./DemoLicenseProbe/bin/Release/net8.0/DemoLicenseProbe.dll', import.meta.url));

async function request(origin, path, { cookie, body } = {}) {
  const response = await fetch(origin + path, {
    method: body ? 'POST' : 'GET',
    headers: {
      ...(cookie && { Cookie: cookie }),
      ...(body && { 'Content-Type': 'application/json' }),
    },
    body: body && JSON.stringify(body),
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  });
  assert.ok(response.ok, `${path} returned HTTP ${response.status}`);
  return response;
}

async function login(origin, path, name, credentials) {
  const response = await request(origin, path, { body: credentials });
  const session = response.headers.getSetCookie().find((value) => value.startsWith(name + '='));
  assert.ok(session, `${path} did not set its session cookie`);
  return session.split(';', 1)[0];
}

function validate(license, machineCode) {
  return execFileSync('dotnet', [probe], {
    input: JSON.stringify({
      ApiUrl: api,
      ProductId: license.product.id,
      LicenseKey: license.license_key,
      MachineCode: machineCode,
    }),
    encoding: 'utf8',
    timeout: 20000,
  }).trim();
}

const customer = {
  username: 'demo-customer',
  password: settings.DEMO_CUSTOMER_PASSWORD,
};
// The test revokes the seeded license. Run it against a fresh disposable demo only.
const cookie = await login(portal, '/api/auth/login', 'fxcrux_user_session', customer);
const licenses = await (await request(portal, '/api/user/licenses', { cookie })).json();
assert.equal(licenses.length, 1, 'Expected one seeded license after both seed runs');
const [license] = licenses;
assert.ok(license.product?.id && license.license_key && license.is_active, 'Expected an active demo entitlement');
const before = await (await request(portal, '/api/auth/status', { cookie })).json();
assert.equal(before.is_bound, false, 'Expected an unbound demo customer');

const machineCode = randomUUID();
assert.equal(validate(license, machineCode), 'Valid', 'SDK activation should succeed');
const bound = await (await request(portal, '/api/auth/status', { cookie })).json();
assert.equal(bound.is_bound, true, 'Portal should report a device binding');
const profile = await (await request(portal, '/api/user/profile', { cookie })).json();
assert.ok(profile.machine_id === machineCode, 'Portal should show the installation ID used by the SDK');
assert.equal(validate(license, randomUUID()), 'Rejected', 'SDK should reject a different installation');

const adminCookie = await login(admin, '/api/admin/login', 'fxcrux_admin_session', {
  username: settings.BOOTSTRAP_ADMIN_USERNAME,
  password: settings.BOOTSTRAP_ADMIN_PASSWORD,
});
const revoked = await (await request(admin, '/api/licenses/toggle-status', {
  cookie: adminCookie,
  body: { licenseId: license.id },
})).json();
assert.equal(revoked.is_active, false, 'Admin dashboard should revoke the license');
assert.equal(validate(license, machineCode), 'Rejected', 'SDK should reject the revoked license');
const after = await (await request(portal, '/api/user/licenses', { cookie })).json();
assert.equal(after.find((item) => item.id === license.id)?.status, 'revoked', 'Portal should show the revocation');
console.log('Demo passed SDK activation, installation binding, admin revocation and portal state checks.');
