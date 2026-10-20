import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  hkdfSync,
} from 'crypto';

@Injectable()
export class PushCryptoService {
  private key(purpose = 'encryption'): Buffer {
    const secret = process.env.TOKEN_HMAC_SECRET ?? '';
    if (secret.length < 32)
      throw new ServiceUnavailableException('PUSH_ENCRYPTION_NOT_CONFIGURED');
    // Separate derived keys; never encrypt with the authentication secret directly.
    return Buffer.from(
      hkdfSync('sha256', secret, 'lerniqo/push/v1', purpose, 32),
    );
  }
  encrypt(value: string): string {
    const iv = randomBytes(12),
      cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    return [iv, cipher.getAuthTag(), encrypted]
      .map((b) => b.toString('base64url'))
      .join('.');
  }
  decrypt(value: string): string {
    const [iv, tag, encrypted] = value
      .split('.')
      .map((s) => Buffer.from(s, 'base64url'));
    const decipher = createDecipheriv('aes-256-gcm', this.key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8');
  }
  hash(value: string): string {
    return createHmac('sha256', this.key('lookup')).update(value).digest('hex');
  }
}
