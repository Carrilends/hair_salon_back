/**
 * Cuenta confirmaciones **fallidas** por clave dentro de una ventana
 * deslizante, en memoria.
 *
 * Por qué no `SlidingWindowRateLimiter` (`src/common/rate-limit`): aquel anota
 * cada petición atendida, y aquí solo cuentan los fallos; un intento correcto
 * no debe gastar cupo. El inicio de sesión no tiene límite propio que
 * reutilizar (comprobado el 2026-10-28), así que este es el de la eliminación
 * de cuenta: 5 fallos en 15 minutos por cuenta.
 *
 * En memoria por la misma razón que el limitador común: la API corre en una
 * sola instancia. Se reinicia con el proceso; para un freno contra adivinar la
 * contraseña desde una sesión ya abierta es aceptable.
 */
export class FailedAttemptLimiter {
  private readonly fallos = new Map<string, number[]>();

  constructor(
    private readonly maxFallos: number,
    private readonly ventanaMs: number,
  ) {}

  isBlocked(clave: string, now: Date): boolean {
    return this.vivos(clave, now).length >= this.maxFallos;
  }

  /**
   * Reserva un intento **antes** de comprobar la credencial, de forma atómica
   * (síncrona: nada se intercala entre mirar y anotar). Se anota como fallo y,
   * si la credencial resulta buena, se devuelve con `release`. Así N peticiones
   * en paralelo no consiguen N intentos mientras la comparación (asíncrona) está
   * en vuelo. Devuelve `false` si la cuenta ya agotó su cupo.
   */
  tryAcquire(clave: string, now: Date): boolean {
    const vivos = this.vivos(clave, now);
    if (vivos.length >= this.maxFallos) return false;
    vivos.push(now.getTime());
    this.fallos.set(clave, vivos);
    return true;
  }

  /** Devuelve un intento reservado con `tryAcquire(clave, at)`. */
  release(clave: string, at: Date): void {
    const marcas = this.fallos.get(clave);
    if (!marcas) return;
    const i = marcas.indexOf(at.getTime());
    if (i !== -1) marcas.splice(i, 1);
    if (marcas.length === 0) this.fallos.delete(clave);
  }

  recordFailure(clave: string, now: Date): void {
    const vivos = this.vivos(clave, now);
    vivos.push(now.getTime());
    this.fallos.set(clave, vivos);
  }

  clear(clave: string): void {
    this.fallos.delete(clave);
  }

  private vivos(clave: string, now: Date): number[] {
    const desde = now.getTime() - this.ventanaMs;
    const vivos = (this.fallos.get(clave) ?? []).filter((t) => t > desde);
    if (vivos.length === 0) this.fallos.delete(clave);
    else this.fallos.set(clave, vivos);
    return vivos;
  }
}
