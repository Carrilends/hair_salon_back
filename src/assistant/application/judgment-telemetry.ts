/**
 * Telemetría del juicio diferido (plan 04, T8) y del bucle.
 *
 * **En memoria, como `DailyTokenLedger`**, y por la misma razón y con la misma
 * advertencia: la API corre en una sola instancia y esto se reinicia con cada
 * despliegue. No es contabilidad, es telemetría; si algún día hace falta una
 * serie histórica, su sitio natural es la fila de auditoría por mensaje, donde
 * ya viven los tokens.
 *
 * Lo que se guarda son **agregados y recuentos**, nunca una muestra por turno:
 * un arreglo que crece con cada mensaje es una fuga de memoria con nombre de
 * telemetría. Y nunca texto de conversación: los veredictos se cuentan, las
 * conversaciones no se guardan aquí.
 *
 * Su lector es `GET /api/assistant/usage`, la consulta de administración que ya
 * se usa para calibrar el techo diario. Una telemetría sin lector es coste
 * puro, así que sale por donde alguien ya mira.
 */
export interface InformeDeJuicios {
  /** Turnos atendidos desde el arranque. */
  turnos: number;
  /**
   * Turnos que encadenaron tres vueltas de herramienta o más. Es la cifra que
   * dirá si el corte semántico valió la pena, y hoy no la sabe nadie. No
   * necesita proveedor: es un contador.
   */
  turnosConTresVueltas: number;
  /** Juicios diferidos pedidos. */
  juicios: number;
  /** De esos, los que no volvieron (proveedor caído, timeout, sin clave). */
  sinVeredicto: number;
  /** Qué le preguntan al asistente, por intención. */
  intenciones: Record<string, number>;
  /** `null` mientras no haya ningún juicio con latencia medida. */
  latenciaMs: { media: number; maxima: number; n: number } | null;
  /** Media de la probabilidad de «la petición quedó resuelta». */
  resueltaMedia: number | null;
}

export class TelemetriaDeJuicios {
  private turnos = 0;
  private turnosConTresVueltas = 0;
  private juicios = 0;
  private sinVeredicto = 0;
  private readonly intenciones = new Map<string, number>();
  private msTotal = 0;
  private msMaximo = 0;
  private msN = 0;
  private resueltaTotal = 0;
  private resueltaN = 0;

  anotarTurno({ llegoALaVuelta3 }: { llegoALaVuelta3: boolean }): void {
    this.turnos++;
    if (llegoALaVuelta3) this.turnosConTresVueltas++;
  }

  anotarJuicio({
    intencion,
    resuelta,
    ms,
  }: {
    intencion: string | null;
    resuelta: number | null;
    ms: number | null;
  }): void {
    this.juicios++;
    if (intencion === null && resuelta === null) this.sinVeredicto++;
    if (intencion) {
      this.intenciones.set(
        intencion,
        (this.intenciones.get(intencion) ?? 0) + 1,
      );
    }
    if (resuelta !== null) {
      this.resueltaTotal += resuelta;
      this.resueltaN++;
    }
    if (ms !== null) {
      this.msTotal += ms;
      this.msMaximo = Math.max(this.msMaximo, ms);
      this.msN++;
    }
  }

  informe(): InformeDeJuicios {
    return {
      turnos: this.turnos,
      turnosConTresVueltas: this.turnosConTresVueltas,
      juicios: this.juicios,
      sinVeredicto: this.sinVeredicto,
      intenciones: Object.fromEntries(this.intenciones),
      latenciaMs: this.msN
        ? {
            media: this.msTotal / this.msN,
            maxima: this.msMaximo,
            n: this.msN,
          }
        : null,
      resueltaMedia: this.resueltaN
        ? this.resueltaTotal / this.resueltaN
        : null,
    };
  }
}
