import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from 'crypto';

@Injectable()
export class PushCryptoService {
  private key(): Buffer {
    const raw = process.env.PUSH_TOKEN_ENCRYPTION_KEY ?? '';
    if (!/^[a-f0-9]{64}$/i.test(raw))
      throw new ServiceUnavailableException('PUSH_ENCRYPTION_NOT_CONFIGURED');
    return Buffer.from(raw, 'hex');
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
    return createHmac('sha256', this.key()).update(value).digest('hex');
  }
}
