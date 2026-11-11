import {
  AVISO_LEGAL_CADA_MS,
  POLITICA_DE_DATOS_VERSION,
  tocaElAvisoLegal,
} from './aviso-legal';

/**
 * Decisión de Luis (2026-11-10): el aviso de tratamiento de datos se envía si
 * el número no lo recibió nunca, si pasaron 15 días o más desde el último, o
 * si la versión de la política cambió.
 */
const AHORA = new Date('2026-11-10T15:00:00Z');
const DIA = 24 * 60 * 60 * 1000;
const hace = (ms: number) => new Date(AHORA.getTime() - ms);

describe('tocaElAvisoLegal', () => {
  it('la versión es la de la política del portal (1.5)', () => {
    expect(POLITICA_DE_DATOS_VERSION).toBe('1.5');
    expect(AVISO_LEGAL_CADA_MS).toBe(15 * DIA);
  });

  it('sin registro, toca', () => {
    expect(tocaElAvisoLegal(null, AHORA)).toBe(true);
  });

  it('con la misma versión y menos de 15 días, no toca', () => {
    expect(
      tocaElAvisoLegal(
        {
          sentAt: hace(15 * DIA - 1),
          policyVersion: POLITICA_DE_DATOS_VERSION,
        },
        AHORA,
      ),
    ).toBe(false);
  });

  it('a los 15 días justos, toca', () => {
    expect(
      tocaElAvisoLegal(
        { sentAt: hace(15 * DIA), policyVersion: POLITICA_DE_DATOS_VERSION },
        AHORA,
      ),
    ).toBe(true);
  });

  it('con otra versión, toca aunque sea de ayer', () => {
    expect(
      tocaElAvisoLegal({ sentAt: hace(DIA), policyVersion: '1.4' }, AHORA),
    ).toBe(true);
  });
});
