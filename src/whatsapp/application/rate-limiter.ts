/**
 * Ventana deslizante en memoria, por remitente.
 *
 * Por qué vive **dentro del manejador** y no como un guard que devuelva 429: a
 * Meta un 429 le parece un fallo y **reintenta**, con lo que un pico se
 * convertiría en una tormenta. La ruta responde 200 igualmente y lo que se
 * descarta es el trabajo, no la respuesta.
 *
 * Por qué en memoria y no con `@nestjs/throttler`: la ruta ya está protegida por
 * la firma HMAC —sin el *App Secret* no se pasa—, así que esto no es una defensa
 * contra un atacante, sino contra un bucle o un cliente que se atasca. Para eso,
 * una dependencia nueva cuyo comportamiento por defecto es justo el equivocado
 * no compensa.
 *
 * El reloj se inyecta para poder probar la caducidad sin esperar.
 */
export class InboundRateLimiter {
  private readonly ventanas = new Map<string, number[]>();

  constructor(
    private readonly maxPorVentana: number,
    private readonly ventanaMs: number,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** ¿Se procesa este mensaje? Anota el intento si la respuesta es que sí. */
  allow(from: string): boolean {
    const ahora = this.now();
    const desde = ahora - this.ventanaMs;

    const previos = (this.ventanas.get(from) ?? []).filter((t) => t > desde);

    if (previos.length >= this.maxPorVentana) {
      // No se anota el intento rechazado: si se anotara, un cliente atascado se
      // mantendría bloqueado a sí mismo indefinidamente en vez de recuperarse
      // cuando la ventana pasa.
      this.ventanas.set(from, previos);
      return false;
    }

    previos.push(ahora);
    this.ventanas.set(from, previos);
    return true;
  }

  /**
   * Descarta los remitentes cuya ventana ya pasó. El mapa solo crece con
   * números distintos, pero un proceso de larga vida acabaría acumulándolos.
   */
  prune(): void {
    const desde = this.now() - this.ventanaMs;
    for (const [from, marcas] of this.ventanas) {
      const vivas = marcas.filter((t) => t > desde);
      if (vivas.length === 0) this.ventanas.delete(from);
      else this.ventanas.set(from, vivas);
    }
  }
}
