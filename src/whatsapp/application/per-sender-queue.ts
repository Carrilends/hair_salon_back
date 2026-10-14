/**
 * Cola en memoria **por remitente** (plan 06, F2).
 *
 * El webhook responde a Meta y procesa después, sin `await`. Sin cola, dos
 * mensajes seguidos de la misma clienta se procesarían a la vez: hoy eso solo
 * desordena las respuestas, pero cuando el asistente se conecte (F5) serían dos
 * turnos de IA en paralelo sobre la misma conversación, cada uno sin ver al
 * otro. Aquí los de un mismo número esperan su turno; los de números distintos
 * siguen en paralelo.
 *
 * En memoria porque la API corre en **una sola instancia** (D11). Con varias
 * réplicas, dos mensajes del mismo número podrían caer en máquinas distintas y
 * esto no los ordenaría: habría que llevarlo a Postgres.
 */
export class PerSenderQueue {
  private readonly colas = new Map<string, Promise<void>>();

  /** Números con trabajo en curso o en espera. Para pruebas y diagnóstico. */
  get pendientes(): number {
    return this.colas.size;
  }

  /**
   * Encadena `tarea` detrás de lo que ya tenga ese remitente. Devuelve su
   * propia promesa, con su propio resultado: el fallo de una tarea le llega a
   * quien la lanzó y **no** bloquea a la siguiente.
   */
  run(remitente: string, tarea: () => Promise<void>): Promise<void> {
    const anterior = this.colas.get(remitente) ?? Promise.resolve();
    const actual = anterior.then(tarea);
    // Lo que queda en el mapa nunca rechaza: así la siguiente tarea del mismo
    // número corre aunque esta falle.
    const eslabon = actual.catch(() => undefined);
    this.colas.set(remitente, eslabon);
    void eslabon.then(() => {
      // Solo si nadie se encoló detrás: si no, se borraría la cola de otro.
      if (this.colas.get(remitente) === eslabon) this.colas.delete(remitente);
    });
    return actual;
  }
}
