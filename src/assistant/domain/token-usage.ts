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
    return new TokenUsage(prompt, completion, cached);
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
