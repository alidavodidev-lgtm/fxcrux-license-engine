const { randomBytes } = require('node:crypto');
const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const api = join(__dirname, '..');
const settings = {
  DB_USER: `le_${randomBytes(8).toString('hex')}`,
  DB_NAME: `le_${randomBytes(8).toString('hex')}`,
  DB_PASSWORD: randomBytes(24).toString('base64url'),
  DB_SYNCHRONIZE: 'true',
  JWT_SECRET: randomBytes(32).toString('base64url'),
  BOOTSTRAP_ADMIN_USERNAME: `admin_${randomBytes(8).toString('hex')}`,
  BOOTSTRAP_ADMIN_PASSWORD: randomBytes(24).toString('base64url'),
};
const example = readFileSync(join(api, '.env.example'), 'utf8');
const env = example.replace(/^(\w+)=.*$/gm, (line, key) => (
  Object.hasOwn(settings, key) ? `${key}=${settings[key]}` : line
));

try {
  writeFileSync(join(api, '.env'), env, { flag: 'wx', mode: 0o600 });
  console.log('Created apps/api/.env. Read the bootstrap login there and keep the file private.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.error('apps/api/.env already exists. Its settings are still in place.');
  process.exitCode = 1;
}
