const { generateKeyPairSync } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const directory = path.resolve(__dirname, '..', 'keys');
const pairs = ['rsa', 'license_signing'].map((name) => ({
  privatePath: path.join(directory, `${name}_private.pem`),
  publicPath: path.join(directory, `${name}_public.pem`),
}));

const paths = pairs.flatMap(({ privatePath, publicPath }) => [privatePath, publicPath]);
if (paths.some((file) => fs.existsSync(file))) {
  console.error('Keys already exist. Set aside the existing key set before generating a new one.');
  process.exit(1);
}

fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
const created = [];
try {
  for (const pair of pairs) {
    const keys = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    for (const [file, key, mode] of [
      [pair.privatePath, keys.privateKey, 0o600],
      [pair.publicPath, keys.publicKey, 0o644],
    ]) {
      const descriptor = fs.openSync(file, 'wx', mode);
      created.push(file);
      try {
        fs.writeFileSync(descriptor, key);
      } finally {
        fs.closeSync(descriptor);
      }
    }
  }
} catch (error) {
  for (const file of created) fs.rmSync(file, { force: true });
  throw error;
}

console.log('Generated separate transport and signing key pairs under keys/.');
