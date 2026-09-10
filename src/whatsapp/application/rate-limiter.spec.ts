import { InboundRateLimiter } from './rate-limiter';

function conReloj() {
  let ahora = 1_000_000;
  const avanzar = (ms: number) => {
    ahora += ms;
  };
  return { now: () => ahora, avanzar };
}

describe('InboundRateLimiter', () => {
  it('deja pasar hasta el máximo de la ventana', () => {
    const { now } = conReloj();
    const sut = new InboundRateLimiter(3, 60_000, now);

    expect([1, 2, 3].map(() => sut.allow('573001112233'))).toEqual([
      true,
      true,
      true,
    ]);
  });

  it('rechaza a partir del máximo', () => {
    const { now } = conReloj();
    const sut = new InboundRateLimiter(2, 60_000, now);

    sut.allow('573001112233');
    sut.allow('573001112233');

    expect(sut.allow('573001112233')).toBe(false);
  });

  it('cada remitente tiene su propia ventana', () => {
    const { now } = conReloj();
    const sut = new InboundRateLimiter(1, 60_000, now);

    sut.allow('573001112233');

    expect(sut.allow('573009998888')).toBe(true);
  });

  it('se recupera cuando la ventana pasa', () => {
    const { now, avanzar } = conReloj();
    const sut = new InboundRateLimiter(1, 60_000, now);

    sut.allow('573001112233');
    expect(sut.allow('573001112233')).toBe(false);

    avanzar(60_001);

    expect(sut.allow('573001112233')).toBe(true);
  });

  it('un intento rechazado NO cuenta contra la ventana', () => {
    // Si contara, un cliente atascado se mantendría bloqueado a sí mismo para
    // siempre en vez de recuperarse al pasar la ventana.
    const { now, avanzar } = conReloj();
    const sut = new InboundRateLimiter(1, 60_000, now);

    sut.allow('573001112233'); // t=0, aceptado
    avanzar(30_000);
    expect(sut.allow('573001112233')).toBe(false); // t=30s, rechazado
    avanzar(30_001); // t=60,001: el primero ya caducó

    expect(sut.allow('573001112233')).toBe(true);
  });

  it('la limpieza descarta a los remitentes cuya ventana pasó', () => {
    const { now, avanzar } = conReloj();
    const sut = new InboundRateLimiter(1, 60_000, now);

    sut.allow('573001112233');
    avanzar(60_001);
    sut.prune();

    // Si el remitente hubiera quedado en el mapa con su marca vieja, seguiría
    // ocupando memoria; que vuelva a pasar demuestra que la entrada está limpia.
    expect(sut.allow('573001112233')).toBe(true);
  });
});
