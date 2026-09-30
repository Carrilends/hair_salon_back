import {
  JudgmentPort,
  JudgmentResult,
  fallo,
} from '../../domain/ports/judgment.port';

/**
 * El adaptador **nulo**: no pregunta nada a nadie. Se inyecta cuando no hay
 * clave configurada, que es el estado por defecto.
 *
 * No es un detalle: es lo que mantiene verdes las pruebas sin red y lo que hace
 * que el despliegue **no dependa** de la clave. Espejo de
 * `fake-llm.adapter.ts`. Devuelve `auth` —el mismo fallo que «no hay clave»—
 * para que el fail-open de quien pregunta haga lo que hoy ya ocurre: el bucle
 * sigue, la reserva se crea, el orden no cambia, y el asistente **no menciona
 * al proveedor de juicios en ninguna parte**.
 */
export class NoopJudgeAdapter implements JudgmentPort {
  // Sin parámetros a propósito: no mira la petición porque no la manda a
  // ninguna parte. Cumple el puerto igual (TypeScript admite implementarlo con
  // menos argumentos de los que declara).
  async ask(): Promise<JudgmentResult> {
    return fallo('auth');
  }
}
