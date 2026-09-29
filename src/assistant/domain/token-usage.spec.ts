import { TokenUsage } from './token-usage';

describe('TokenUsage', () => {
  it('suma los tres contadores', () => {
    const suma = TokenUsage.of(100, 20, 5).plus(TokenUsage.of(50, 10, 5));
    expect(suma.promptTokens).toBe(150);
    expect(suma.completionTokens).toBe(30);
    expect(suma.cachedTokens).toBe(10);
    expect(suma.total).toBe(180);
  });

  it('el total no cuenta lo cacheado: son tokens de entrada ya contados', () => {
    expect(TokenUsage.of(100, 20, 90).total).toBe(120);
  });

  describe('la telemetría no puede tumbar un turno', () => {
    // El consumo se escribe en columnas `int`. Un `NaN` o un infinito llegando
    // desde el proveedor reventaría el INSERT, y con él se perdería la
    // conversación entera: la clienta pagaría con su turno un contador que solo
    // sirve para auditar. Se degrada a cero y se sigue.
    it('un contador que no es un número finito cuenta como cero', () => {
      const uso = TokenUsage.of(Number.NaN, Number.POSITIVE_INFINITY, -1);
      expect(uso.promptTokens).toBe(0);
      expect(uso.completionTokens).toBe(0);
      expect(uso.cachedTokens).toBe(0);
    });

    it('trunca los decimales que algún proveedor pudiera informar', () => {
      expect(TokenUsage.of(120.7, 20.2).promptTokens).toBe(120);
      expect(TokenUsage.of(120.7, 20.2).completionTokens).toBe(20);
    });

    it('un contador corrupto no contamina la suma del turno', () => {
      const suma = TokenUsage.of(100, 20).plus(TokenUsage.of(Number.NaN, 10));
      expect(suma.promptTokens).toBe(100);
      expect(suma.completionTokens).toBe(30);
    });
  });
});
