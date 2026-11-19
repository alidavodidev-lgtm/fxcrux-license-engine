import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const settings = {
  DB_USER: 'fxcrux_demo',
  DB_NAME: 'fxcrux_demo',
  DB_PASSWORD: randomBytes(24).toString('hex'),
  JWT_SECRET: randomBytes(32).toString('hex'),
  BOOTSTRAP_ADMIN_USERNAME: 'demo-admin',
  BOOTSTRAP_ADMIN_PASSWORD: randomBytes(24).toString('hex'),
  DEMO_CUSTOMER_PASSWORD: randomBytes(24).toString('hex'),
  DEMO_REQUIRE_HARDWARE_BINDING: 'false',
};

try {
  const contents = Object.entries(settings).map(([key, value]) => `${key}=${value}`).join('\n');
  writeFileSync(new URL('../.env.demo', import.meta.url), contents + '\n', { flag: 'wx', mode: 0o600 });
  console.log('Created .env.demo with local demo credentials.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('Using the existing .env.demo.');
}
