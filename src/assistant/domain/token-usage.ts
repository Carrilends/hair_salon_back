/**
 * Consumo de tokens de una llamada al modelo, como objeto de valor inmutable.
 * Es la unidad de la telemetría de §6.2: se acumula por conversación (T1) y se
 * imputa por mensaje (T5). `cachedTokens` refleja el ahorro del prompt caching
 * cuando el proveedor lo informa.
 */
export class TokenUsage {
  private constructor(
    readonly promptTokens: number,
    readonly completionTokens: number,
    readonly cachedTokens: number,
  ) {}

  static zero(): TokenUsage {
    return new TokenUsage(0, 0, 0);
  }

  static of(prompt: number, completion: number, cached = 0): TokenUsage {
    return new TokenUsage(sano(prompt), sano(completion), sano(cached));
  }

  plus(other: TokenUsage): TokenUsage {
    return new TokenUsage(
      this.promptTokens + other.promptTokens,
      this.completionTokens + other.completionTokens,
      this.cachedTokens + other.cachedTokens,
    );
  }

  /** Tokens facturables totales (entrada + salida). */
  get total(): number {
    return this.promptTokens + this.completionTokens;
  }
}

/**
 * Un contador que se pueda escribir en una columna `int`.
 *
 * El consumo lo informa el proveedor y aquí solo se transporta. Si algún día
 * llega un `NaN`, un infinito o un decimal, el INSERT de `assistant_messages`
 * fallaría y con él se perdería la conversación entera: la clienta pagaría con
 * su turno un contador que solo sirve para auditar. La telemetría se degrada a
 * cero y el turno sigue —mismo criterio que NF11 con los avisos—.
 */
function sano(valor: number): number {
  return Number.isFinite(valor) && valor > 0 ? Math.floor(valor) : 0;
}
