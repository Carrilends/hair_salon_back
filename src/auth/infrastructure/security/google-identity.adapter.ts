import { Injectable, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import {
  GoogleIdentityPort,
  GoogleProfile,
} from '../../domain/ports/google-identity.port';

@Injectable()
export class GoogleIdentityAdapter implements GoogleIdentityPort {
  private readonly client: OAuth2Client;

  constructor(private readonly clientId: string) {
    this.client = new OAuth2Client(clientId);
  }

  async verifyIdToken(idToken: string): Promise<GoogleProfile> {
    // verifyIdToken comprueba la firma contra las claves públicas de Google
    // (con caché interna), el emisor, la vigencia y —por `audience`— que el
    // token fue emitido para ESTA aplicación. Sin esa última comprobación, un
    // ID token válido de cualquier otra app serviría para entrar.
    const ticket = await this.client.verifyIdToken({
      idToken,
      audience: this.clientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedException('Token de Google inválido');
    }

    return {
      googleId: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified === true,
      fullName: payload.name ?? payload.email.split('@')[0],
    };
  }
}
