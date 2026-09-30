/**
 * El **proveedor de juicios**: quien contesta preguntas tipadas sobre un
 * estado. El dominio solo conoce este contrato; qué servicio lo implementa —hoy
 * uno de modelos System One, mañana otro, o ninguno— queda en infraestructura.
 *
 * Se llama así, y no `TypeSafePort` ni `JevPort`, a propósito: es la convención
 * de la casa y protege de atarse al proveedor.
 *
 * **No es otro `LlmPort` ni un adaptador suyo.** El contrato es distinto:
 * `complete()` devuelve texto y llamadas a herramienta; esto devuelve
 * veredictos tipados con su probabilidad. Forzarlo dentro del otro puerto
 * rompería los dos.
 */

/**
 * Los cinco fallos posibles, y **ninguno rompe la aplicación**: quien pregunta
 * sigue por el camino de hoy (fail-open). Un fallo que no esté en la lista se
 * trata como de red.
 */
export type JudgmentError = 'auth' | 'rate' | 'network' | 'timeout' | 'invalid';

export const JUDGMENT_ERRORS: readonly JudgmentError[] = Object.freeze([
  'auth',
  'rate',
  'network',
  'timeout',
  'invalid',
]);

/** Fallo normalizado. Un error desconocido se trata como de red. */
export const fallo = (
  error: string,
  ms = 0,
): { ok: false; error: JudgmentError; ms: number } => ({
  ok: false,
  error: JUDGMENT_ERRORS.includes(error as JudgmentError)
    ? (error as JudgmentError)
    : 'network',
  ms,
});

export interface JudgmentRequest {
  /** Estado con campos nombrados. Solo lo mínimo para decidir (minimización). */
  state: Record<string, unknown>;
  /** Preguntas por id. Las de una misma petición corren en paralelo. */
  questions: Record<string, unknown>;
  /**
   * Tope de espera de ESTA pregunta, si difiere del que traiga configurado el
   * adaptador. Existe porque las colocaciones no esperan igual: en el camino
   * crítico hay una clienta mirando la pantalla y el tope es corto, mientras
   * que el juicio diferido corre cuando el turno ya se entregó y puede
   * permitirse esperar. Un solo adaptador con un tope por petición evita tener
   * dos proveedores montados para lo mismo.
   */
  timeoutMs?: number;
}

export type JudgmentResult =
  | {
      ok: true;
      /** Veredictos por id de pregunta, tal como los devolvió el proveedor. */
      answers: Record<string, unknown>;
      model: string;
      inputTokens: number;
      ms: number;
    }
  | { ok: false; error: JudgmentError; ms: number };

export interface JudgmentPort {
  /**
   * ¿Hay proveedor de verdad detrás? El adaptador nulo dice `false`, y el real
   * dice `false` si no tiene credencial.
   *
   * Lo necesita quien decide si una colocación se enciende. Sin esto, un
   * interruptor en `on` con la clave sin aprovisionar preparaba la pregunta
   * —una consulta a la base por turno que reservara—, la mandaba a un
   * adaptador que siempre falla y no dejaba ni una línea en el log: el fallo
   * que nadie relacionaría con la causa.
   */
  readonly disponible: boolean;

  ask(request: JudgmentRequest): Promise<JudgmentResult>;
}
