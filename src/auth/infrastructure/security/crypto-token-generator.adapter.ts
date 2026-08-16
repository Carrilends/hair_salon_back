import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import {
  GeneratedToken,
  SecureTokenGeneratorPort,
} from '../../domain/ports/secure-token-generator.port';

@Injectable()
export class CryptoTokenGeneratorAdapter implements SecureTokenGeneratorPort {
  generate(): GeneratedToken {
    // 32 bytes de entropía criptográfica en base64url: apto para viajar en URL.
    const raw = randomBytes(32).toString('base64url');
    return { raw, hash: this.hash(raw) };
  }

  hash(raw: string): string {
    // SHA-256 basta: el token es de alta entropía y de un solo uso, así que no
    // aplica el razonamiento de fuerza bruta que exige bcrypt en contraseñas.
    return createHash('sha256').update(raw).digest('hex');
  }
}
