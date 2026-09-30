import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'crypto';
import {
  IssuedRefresh,
  TokenIssuerPort,
} from '../../domain/ports/token-issuer.port';

/**
 * Envuelve el `JwtService` que configura `auth.module.ts` (secreto y vigencia
 * derivada de `JWT_EXPIRES_IN`) y añade la emisión del refresh token opaco
 * (Fase 3b): valor aleatorio de alta entropía, hasheado con SHA-256 antes de
 * persistirse, y con un identificador de familia para la detección de reuso.
 */
@Injectable()
export class JwtTokenIssuerAdapter implements TokenIssuerPort {
  constructor(
    private readonly jwtService: JwtService,
    private readonly accessTtlSeconds: number,
  ) {}

  issueAccessToken(payload: { id: string }): string {
    return this.jwtService.sign(payload);
  }

  accessTokenTtlSeconds(): number {
    return this.accessTtlSeconds;
  }

  issueRefreshToken(): IssuedRefresh {
    const raw = randomBytes(32).toString('base64url');
    return { raw, hash: this.hashRefreshToken(raw), familyId: randomUUID() };
  }

  hashRefreshToken(raw: string): string {
    // SHA-256, mismo razonamiento que en los tokens de la Fase 3a: alta entropía,
    // no es una contraseña elegida por una persona.
    return createHash('sha256').update(raw).digest('hex');
  }
}
