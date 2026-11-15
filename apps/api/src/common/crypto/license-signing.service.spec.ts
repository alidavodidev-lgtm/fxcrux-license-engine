import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { tmpdir } from 'os';
import { ConfigService } from '@nestjs/config';
import { LicenseSigningService } from './license-signing.service';

describe('LicenseSigningService', () => {
  let service: LicenseSigningService;
  let publicKey: string;

  beforeAll(() => {
    const directory = fs.mkdtempSync(path.join(tmpdir(), 'fxcrux-signing-test-'));
    const privatePath = path.join(directory, 'signing.pem');
    try {
      const keys = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        publicKeyEncoding: { type: 'spki', format: 'pem' },
      });
      publicKey = keys.publicKey;
      fs.writeFileSync(privatePath, keys.privateKey, { mode: 0o600 });
      service = new LicenseSigningService(new ConfigService({
        ENABLE_LEGACY_ENGINE: 'true',
        LICENSE_SIGNING_PRIVATE_KEY_PATH: privatePath,
      }));
    } finally {
      fs.rmSync(privatePath, { force: true });
      fs.rmdirSync(directory);
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('produces a signature the dedicated public key can verify', () => {
    const { canonical, signature } = service.sign('user-123', 'SampleEditor', '2026-07-16T00:00:00.000Z', '2026-08-15T00:00:00.000Z');

    expect(canonical).toBe('v1|user-123|SampleEditor|2026-07-16T00:00:00.000Z|2026-08-15T00:00:00.000Z');

    const isValid = crypto.verify(
      'sha256',
      Buffer.from(canonical, 'utf8'),
      { key: publicKey, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST },
      Buffer.from(signature, 'base64'),
    );
    expect(isValid).toBe(true);
  });

  it('fails verification if the canonical string is tampered with', () => {
    const { signature } = service.sign('user-123', 'SampleEditor', '2026-07-16T00:00:00.000Z', '2026-08-15T00:00:00.000Z');
    const tamperedCanonical = 'v1|user-123|SampleEditor|2026-07-16T00:00:00.000Z|2099-01-01T00:00:00.000Z';

    const isValid = crypto.verify(
      'sha256',
      Buffer.from(tamperedCanonical, 'utf8'),
      { key: publicKey, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST },
      Buffer.from(signature, 'base64'),
    );
    expect(isValid).toBe(false);
  });
});
