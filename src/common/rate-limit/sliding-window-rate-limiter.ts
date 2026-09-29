/**
 * Ventana deslizante en memoria, por clave.
 *
 * En memoria y no en Postgres ni Redis porque la API corre en **una sola
 * instancia** (decisión de despliegue, 2026-09-29): con un solo proceso el mapa
 * es la verdad completa. Con varias instancias dejaría de serlo y cada una
 * aplicaría su propio tope, así que ese día hay que sustituir esta clase por un
 * almacén compartido — no ampliarla.
 *
 * El contador se reinicia cuando el contenedor reinicia. Para un tope
 * anti-abuso de ventana corta es aceptable: la ráfaga que sobreviviría a un
 * reinicio tendría que estar sincronizada con él.
 *
 * El reloj se inyecta para poder probar la caducidad sin esperar.
 */
export class SlidingWindowRateLimiter {
  private readonly ventanas = new Map<string, number[]>();

  constructor(
    private readonly maxPorVentana: number,
    private readonly ventanaMs: number,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** ¿Se atiende esta petición? Anota el intento si la respuesta es que sí. */
  allow(clave: string): boolean {
    const ahora = this.now();
    const desde = ahora - this.ventanaMs;

    const previos = (this.ventanas.get(clave) ?? []).filter((t) => t > desde);

    if (previos.length >= this.maxPorVentana) {
      // No se anota el intento rechazado: si se anotara, quien se pasa de la
      // raya se mantendría bloqueado a sí mismo indefinidamente en vez de
      // recuperarse cuando la ventana pasa.
      this.ventanas.set(clave, previos);
      return false;
    }

    previos.push(ahora);
    this.ventanas.set(clave, previos);
    return true;
  }

  /**
   * Descarta las claves cuya ventana ya pasó. El mapa solo crece con claves
   * distintas, pero un proceso de larga vida acabaría acumulándolas.
   */
  prune(): void {
    const desde = this.now() - this.ventanaMs;
    for (const [clave, marcas] of this.ventanas) {
      const vivas = marcas.filter((t) => t > desde);
      if (vivas.length === 0) this.ventanas.delete(clave);
      else this.ventanas.set(clave, vivas);
    }
  }
}
