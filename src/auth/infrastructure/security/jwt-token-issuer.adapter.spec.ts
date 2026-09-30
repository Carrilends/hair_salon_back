import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';
import { JwtTokenIssuerAdapter } from './jwt-token-issuer.adapter';

function build(ttlSeconds = 900) {
  return new JwtTokenIssuerAdapter(
    new JwtService({ secret: 'test-secret' }),
    ttlSeconds,
  );
}

describe('JwtTokenIssuerAdapter (refresh)', () => {
  it('expone la vigencia del access token que recibe', () => {
    expect(build(900).accessTokenTtlSeconds()).toBe(900);
  });

  it('hashRefreshToken es SHA-256 determinista', () => {
    const adapter = build();
    const expected = createHash('sha256').update('valor').digest('hex');
    expect(adapter.hashRefreshToken('valor')).toBe(expected);
    expect(adapter.hashRefreshToken('otro')).not.toBe(
      adapter.hashRefreshToken('valor'),
    );
  });

  it('issueRefreshToken entrega un valor opaco cuyo hash coincide, con familia propia', () => {
    const adapter = build();
    const a = adapter.issueRefreshToken();
    const b = adapter.issueRefreshToken();
    expect(a.hash).toBe(adapter.hashRefreshToken(a.raw));
    expect(a.familyId).toBeTruthy();
    expect(a.raw).not.toBe(b.raw); // aleatorio: dos emisiones difieren
    expect(a.familyId).not.toBe(b.familyId);
  });
});
