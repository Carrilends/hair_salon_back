import { Logger } from '@nestjs/common';
import {
  JudgmentPort,
  JudgmentResult,
  fallo,
} from '../../domain/ports/judgment.port';
import { PeticionDeJuicio } from './turn-screen';

const logger = new Logger('ProveedorDeJuicios');

/**
 * Pregunta al proveedor de juicios **sin que una excepción pueda salir de
 * aquí**. Todas las colocaciones pasan por esta puerta.
 *
 * El adaptador de hoy no lanza: traduce cada fallo a uno de los cinco estados
 * del puerto. Pero el fail-open no puede depender de que el adaptador se porte
 * bien, y ese es justo el punto: un adaptador futuro, un envoltorio de
 * métricas, un `AbortController` que no exista en algún runtime o un estado con
 * un ciclo que rompa `JSON.stringify` lanzarían, y la excepción subiría por el
 * caso de uso hasta el borde HTTP. En el bucle del asistente eso significa un
 * 500 **después** de que la clienta haya pagado su mensaje: se pierde su
 * respuesta y la fila de auditoría que el caso de uso se esfuerza en llevar.
 *
 * Un juicio que revienta se trata como un juicio que no llegó, que es lo que
 * es.
 */
export async function preguntarConSeguridad(
  judge: JudgmentPort,
  peticion: PeticionDeJuicio,
  opciones: { timeoutMs?: number } = {},
): Promise<JudgmentResult> {
  try {
    return await judge.ask({
      state: peticion.state,
      questions: peticion.questions,
      ...(opciones.timeoutMs ? { timeoutMs: opciones.timeoutMs } : {}),
    });
  } catch (error) {
    logger.warn(
      `El proveedor de juicios lanzó en vez de contestar: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return fallo('network');
  }
}
