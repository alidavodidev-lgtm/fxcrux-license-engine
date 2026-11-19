import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

const settings = parseEnv(readFileSync(new URL('../.env.demo', import.meta.url), 'utf8'));
const username = 'demo-customer';
const email = 'demo-customer@example.com';
const productName = 'FXCRUX Windows Demo';
const { BOOTSTRAP_ADMIN_USERNAME, BOOTSTRAP_ADMIN_PASSWORD, DEMO_CUSTOMER_PASSWORD } = settings;
if (!BOOTSTRAP_ADMIN_USERNAME || !BOOTSTRAP_ADMIN_PASSWORD || !DEMO_CUSTOMER_PASSWORD) {
  throw new Error('Run setup-demo.mjs to create the local demo settings.');
}

async function request(path, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const response = await fetch(`http://127.0.0.1:3000${path}`, {
    method: body ? 'POST' : 'GET',
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}.`);
  return response.json();
}

const { access_token: token } = await request('/admin/login', {
  body: { username: BOOTSTRAP_ADMIN_USERNAME, password: BOOTSTRAP_ADMIN_PASSWORD },
});
const users = await request('/users/list', { token });
const existingUser = users.find((user) => user.username === username);
if (existingUser && existingUser.email !== email) {
  throw new Error('The demo username belongs to a different customer.');
}
const customer = existingUser ?? (await request('/users/register', {
  token,
  body: { username, email, password: DEMO_CUSTOMER_PASSWORD },
})).user;

const products = await request('/products/list');
const product = products.find((item) => item.name === productName) ??
  await request('/products/create', { token, body: { name: productName } });

const licenses = await request('/licenses/list', { token });
const existingLicense = licenses.find((license) =>
  license.user?.id === customer.id && license.product?.id === product.id);
if (!existingLicense) {
  await request('/licenses/issue', {
    token,
    body: { userId: customer.id, productId: product.id, daysValid: 30 },
  });
}

console.log(`Demo customer: ${username}. See DEMO_CUSTOMER_PASSWORD in .env.demo.`);
console.log(`Product ID: ${product.id}`);
console.log('Read the license in My Licenses or in the demo admin dashboard. Existing licenses keep their current status and expiry.');
