/**
 * Cuándo se puede volver a avisar a la dueña por un mismo número (plan 06, F6,
 * D8). Separa consultar de anotar a propósito: se anota solo cuando el aviso
 * salió, para que un envío fallido no deje a la clienta seis horas sin poder
 * pedirlo.
 *
 * En memoria, como los demás límites del canal (D11): la API corre en una sola
 * instancia y un reinicio, como mucho, permite un aviso de más.
 */
export class EnfriamientoPorNumero {
  private readonly ultimos = new Map<string, number>();

  constructor(private readonly ventanaMs: number) {}

  puede(numero: string, ahora: Date): boolean {
    const ultimo = this.ultimos.get(numero);
    return ultimo === undefined || ahora.getTime() - ultimo >= this.ventanaMs;
  }

  anotar(numero: string, ahora: Date): void {
    const t = ahora.getTime();
    // Limpieza perezosa: el mapa solo crece con números distintos.
    for (const [n, u] of this.ultimos) {
      if (t - u >= this.ventanaMs) this.ultimos.delete(n);
    }
    this.ultimos.set(numero, t);
  }
}
