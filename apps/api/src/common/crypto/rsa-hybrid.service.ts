import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Shared RSA+AES hybrid envelope used by every Engine-to-backend channel
// (matches the C# client's SecurityEngine.EncryptData/DecryptServerResponse).
@Injectable()
export class RsaHybridService {
  private readonly privateKey?: string;

  constructor(private readonly configService: ConfigService) {
    if (this.configService.get<string>('ENABLE_LEGACY_ENGINE') !== 'true') return;
    const keyPath = path.resolve(
      process.cwd(),
      this.configService.get<string>('RSA_PRIVATE_KEY_PATH', 'keys/rsa_private.pem'),
    );
    this.privateKey = fs.readFileSync(keyPath, 'utf8');
  }

  decryptPayload(encryptedPayload: string, encryptedAesKey: string, ivBase64: string): { data: any; rawAesKey: Buffer } {
    if (!this.privateKey) throw new NotFoundException('Legacy engine is disabled');
    const rawAesKey = crypto.privateDecrypt(
      {
        key: this.privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      },
      Buffer.from(encryptedAesKey, 'base64'),
    );

    const decipher = crypto.createDecipheriv('aes-256-cbc', rawAesKey, Buffer.from(ivBase64, 'base64'));
    let decrypted = decipher.update(encryptedPayload, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return { data: JSON.parse(decrypted), rawAesKey };
  }

  encryptResponse(data: any, rawAesKey: Buffer): { payload: string; iv: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', rawAesKey, iv);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'base64');
    encrypted += cipher.final('base64');

    return { payload: encrypted, iv: iv.toString('base64') };
  }

  // Limit clock drift to 30 seconds. This is a freshness check.
  validateTimestamp(clientTimestamp: number) {
    const diff = Math.abs(Date.now() - clientTimestamp);
    if (!Number.isFinite(clientTimestamp) || diff > 30000) {
      throw new UnauthorizedException('Invalid or expired request timestamp');
    }
  }
}
