import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TokenIssuerPort } from '../../domain/ports/token-issuer.port';

/**
 * Envuelve el `JwtService` que ya configura `auth.module.ts` (secreto y
 * `expiresIn: '1d'`). La Fase 3b extenderá este adaptador con el refresh token.
 */
@Injectable()
export class JwtTokenIssuerAdapter implements TokenIssuerPort {
  constructor(private readonly jwtService: JwtService) {}

  issueAccessToken(payload: { id: string }): string {
    return this.jwtService.sign(payload);
  }
}
