import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('informa del origen tal como lo resolvió el servidor', () => {
    // No es telemetría: es el único modo de medir `TRUST_PROXY_HOPS` contra el
    // despliegue real. Sin ver qué dirección resuelve el servidor, el tope por
    // origen del asistente se configura a ciegas. Lo que se devuelve es la
    // dirección de quien pregunta, así que no revela nada de terceros.
    const ctrl = new HealthController();

    expect(ctrl.health({ ip: '190.24.1.5' })).toEqual({
      ok: true,
      ip: '190.24.1.5',
    });
  });

  it('sin origen resoluble lo dice en vez de omitirlo', () => {
    const ctrl = new HealthController();

    expect(ctrl.health({})).toEqual({ ok: true, ip: null });
  });
});
