/**
 * Cuenta del gasto del día, en memoria, con reserva por adelantado.
 *
 * ── Por qué no basta con preguntarle a la base ──────────────────────────────
 *
 * El consumo de un turno solo se escribe **al terminar** el turno. Sumar la
 * tabla antes de llamar al modelo, que es lo que hacía la primera versión de
 * este techo, deja una ventana enorme: N peticiones simultáneas leen todas la
 * misma cifra por debajo del techo y las N llaman al proveedor. Con turnos de
 * unos 1.400 tokens y un techo de 200.000, una ráfaga de 500 peticiones a la
 * vez gastaría 700.000 —tres veces y media la «última red»—.
 *
 * Reservando por adelantado, la segunda petición ya ve ocupado lo que la
 * primera se dispone a gastar. La reserva es una estimación conservadora que se
 * **liquida** en cuanto se conoce el coste real, así que el error nunca se
 * acumula: dura lo que dura un turno.
 *
 * ── Por qué en memoria ──────────────────────────────────────────────────────
 *
 * Misma razón que el limitador por origen: la API corre en **una sola
 * instancia**, y con un solo proceso el contador es la verdad completa. Se
 * siembra de la base una vez al día (y tras cada reinicio), de modo que un
 * reinicio no regala el presupuesto ya gastado. Con varias instancias esto
 * habría que sustituirlo por un contador compartido, no multiplicarlo.
 *
 * ── Y de paso ───────────────────────────────────────────────────────────────
 *
 * Quita del camino crítico de cada turno una agregación sobre
 * `assistant_messages`. Antes, una vez alcanzado el techo, cada petición
 * rechazada seguía pagando esa consulta: la red de seguridad se convertía en un
 * amplificador contra Postgres justo durante la ráfaga que la activó.
 */
export class DailyTokenLedger {
  private dia: string | null = null;
  private gastado = 0;

  /**
   * @param reservaPorTurno Tokens que se apartan mientras un turno está en
   * vuelo. Conservador a propósito: pasarse solo adelanta el corte unos turnos,
   * quedarse corto reabre la carrera. Se liquida al acabar el turno.
   */
  constructor(private readonly reservaPorTurno: number) {}

  /** ¿Hay que releer el gasto de la base? Cierto al arrancar y al cambiar de día. */
  necesitaSiembra(dia: string): boolean {
    return this.dia !== dia;
  }

  /**
   * Fija el gasto ya registrado en la base para ese día.
   *
   * Sembrar un día **ya sembrado no hace nada**. Dos peticiones que llegan a la
   * vez con la cuenta fría consultan las dos la base; si la segunda escribiera
   * su lectura encima, borraría la reserva que la primera acaba de apartar y
   * las dos pasarían. Una siembra tardía no puede pisar lo que ya se contó.
   */
  sembrar(dia: string, yaGastado: number): void {
    if (this.dia === dia) return;
    this.dia = dia;
    this.gastado = Math.max(0, yaGastado);
  }

  /**
   * ¿Cabe un turno más? Si cabe, aparta la reserva antes de devolver.
   *
   * Un día sin sembrar **no** autoriza: sin saber lo que ya se gastó, dejar
   * pasar sería fallar abierto justo en el límite.
   */
  reservar(dia: string, techo: number): boolean {
    if (this.dia !== dia) return false;
    if (this.gastado >= techo) return false;
    this.gastado += this.reservaPorTurno;
    return true;
  }

  /**
   * Cambia la reserva por lo que de verdad costó el turno.
   *
   * Si el día cambió mientras el turno estaba en vuelo, la liquidación se
   * descarta: el gasto pertenecía al presupuesto de ayer, que ya no se está
   * contando. Es un turno de desajuste como mucho, una vez al día.
   */
  liquidar(dia: string, real: number): void {
    if (this.dia !== dia) return;
    this.gastado = Math.max(
      0,
      this.gastado - this.reservaPorTurno + Math.max(0, real),
    );
  }

  /** Gasto del día según esta cuenta, reservas en vuelo incluidas. */
  get gastoConocido(): number {
    return this.gastado;
  }
}
