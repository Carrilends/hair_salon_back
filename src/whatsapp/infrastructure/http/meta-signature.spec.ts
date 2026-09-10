import { createHmac } from 'node:crypto';
import { verifyMetaSignature } from './meta-signature';

const SECRETO = 'app-secret-de-prueba';
const CUERPO = Buffer.from('{"object":"whatsapp_business_account"}', 'utf8');

function firmar(body: Buffer, secreto = SECRETO): string {
  return `sha256=${createHmac('sha256', secreto).update(body).digest('hex')}`;
}

describe('verifyMetaSignature', () => {
  it('acepta una firma correcta', () => {
    expect(verifyMetaSignature(CUERPO, firmar(CUERPO), SECRETO)).toBe(true);
  });

  it('rechaza si el cuerpo se alteró aunque sea un byte', () => {
    const alterado = Buffer.from(
      '{"object":"whatsapp_business_accounT"}',
      'utf8',
    );
    expect(verifyMetaSignature(alterado, firmar(CUERPO), SECRETO)).toBe(false);
  });

  it('rechaza una firma hecha con otro secreto', () => {
    expect(
      verifyMetaSignature(CUERPO, firmar(CUERPO, 'otro-secreto'), SECRETO),
    ).toBe(false);
  });

  it('rechaza si falta la cabecera', () => {
    expect(verifyMetaSignature(CUERPO, undefined, SECRETO)).toBe(false);
  });

  it('rechaza si la cabecera no trae el prefijo sha256=', () => {
    const sinPrefijo = firmar(CUERPO).slice('sha256='.length);
    expect(verifyMetaSignature(CUERPO, sinPrefijo, SECRETO)).toBe(false);
  });

  it('rechaza una firma de longitud distinta sin lanzar', () => {
    // `timingSafeEqual` lanza si las longitudes difieren: la guarda previa es lo
    // que impide que una firma corta tumbe el proceso en vez de ser rechazada.
    expect(() =>
      verifyMetaSignature(CUERPO, 'sha256=abcd', SECRETO),
    ).not.toThrow();
    expect(verifyMetaSignature(CUERPO, 'sha256=abcd', SECRETO)).toBe(false);
  });

  it('rechaza una cabecera que no es hexadecimal', () => {
    expect(verifyMetaSignature(CUERPO, 'sha256=zzzz', SECRETO)).toBe(false);
  });

  it('FALLA CERRADO sin secreto configurado', () => {
    // No existe ninguna variable que desactive la comprobación: una puerta así
    // siempre acaba abierta en producción.
    expect(verifyMetaSignature(CUERPO, firmar(CUERPO), undefined)).toBe(false);
    expect(verifyMetaSignature(CUERPO, firmar(CUERPO), '')).toBe(false);
  });

  it('FALLA CERRADO sin cuerpo crudo', () => {
    // Si algún día `rawBody: true` desapareciera de `main.ts`, el canal se cierra
    // en vez de aceptar cualquier cosa.
    expect(verifyMetaSignature(undefined, firmar(CUERPO), SECRETO)).toBe(false);
    expect(verifyMetaSignature(Buffer.alloc(0), firmar(CUERPO), SECRETO)).toBe(
      false,
    );
  });
});
