import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Lets legacy clients verify license certificates with the deployment's
// signing public key. Use a key pair dedicated to signing.
@Injectable()
export class LicenseSigningService {
  private readonly privateKey?: string;

  constructor(private readonly configService: ConfigService) {
    if (this.configService.get<string>('ENABLE_LEGACY_ENGINE') !== 'true') return;
    const keyPath = path.resolve(
      process.cwd(),
      this.configService.get<string>('LICENSE_SIGNING_PRIVATE_KEY_PATH', 'keys/license_signing_private.pem'),
    );
    this.privateKey = fs.readFileSync(keyPath, 'utf8');
  }

  // Fixed-order, pipe-delimited - not JSON - so the exact signed bytes are
  // trivially reproducible byte-for-byte on the C# verifying side without
  // relying on both languages agreeing on JSON key ordering/escaping.
  buildCanonical(userId: string, product: string, issuedAt: string, expiresAt: string): string {
    return `v1|${userId}|${product}|${issuedAt}|${expiresAt}`;
  }

  sign(userId: string, product: string, issuedAt: string, expiresAt: string): { canonical: string; signature: string } {
    if (!this.privateKey) throw new ServiceUnavailableException('License signing is disabled');
    const canonical = this.buildCanonical(userId, product, issuedAt, expiresAt);
    const signature = crypto
      .sign('sha256', Buffer.from(canonical, 'utf8'), {
        key: this.privateKey,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
      })
      .toString('base64');

    return { canonical, signature };
  }
}
