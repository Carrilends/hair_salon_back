import { JudgmentError, JudgmentPort } from '../../domain/ports/judgment.port';
import { ModoDeJuicio } from '../judgment-settings';
import {
  MensajeReciente,
  construirCorrespondencia,
  leerCorrespondencia,
} from './turn-screen';

export interface VeredictoDeReserva {
  /** `false` solo cuando el modo es `on` y el juicio dijo que no se corresponde. */
  permitir: boolean;
  /** La probabilidad del veredicto, o `null` si no hubo veredicto. */
  prob: number | null;
  /** Lo que habría hecho el modo `on`. En sombra es el dato que se calibra. */
  habriaFrenado: boolean;
  /** Ida y vuelta al proveedor, en ms, cuando hubo llamada. */
  ms: number | null;
  /** Por qué no hubo veredicto, cuando el proveedor falló. */
  error?: JudgmentError;
}

const sinJuicio = (): VeredictoDeReserva => ({
  permitir: true,
  prob: null,
  habriaFrenado: false,
  ms: null,
});

/**
 * Verificación de correspondencia **antes** de crear una reserva (plan 04, T5):
 * ¿la reserva que se va a crear es la que la clienta pidió en esta
 * conversación?
 *
 * Es la única operación **irreversible** del asistente, y esta comprobación se
 * paga **solo en los turnos que reservan**. Vive en la capa de aplicación del
 * asistente y la llama su fachada de herramienta, **nunca** el caso de uso de
 * Reservas: ese lo comparten cinco adaptadores primarios —HTTP, cron,
 * asistente, MCP y WhatsApp— y meter aquí un juicio del canal conversacional
 * se lo impondría también al cron y al webhook. La regla de dominio sigue en el
 * caso de uso; esto es una salvaguarda del adaptador.
 *
 * **No se le pregunta** si la hora es válida, si cae en horario o si hay
 * solape: eso ya lo resuelven `salon-schedule.ts` y `countOverlaps`, y son
 * justo las preguntas que el modelo contesta mal.
 *
 * **Fail-open sin excepciones.** Sin modo, sin conversación previa, sin
 * veredicto o con el proveedor caído, la reserva se crea como hoy. Es una
 * optimización, no un control de seguridad: bloquear convertiría la caída de un
 * tercero en la caída del asistente (mismo criterio que NF11).
 */
export async function verificarReservaPropuesta({
  judge,
  modo,
  servicios,
  fecha,
  hora,
  recientes,
}: {
  judge: JudgmentPort;
  modo: ModoDeJuicio;
  servicios: string[];
  fecha: string;
  hora: string;
  recientes?: MensajeReciente[];
}): Promise<VeredictoDeReserva> {
  if (modo === 'off') return sinJuicio();

  const peticion = construirCorrespondencia({
    servicios,
    fecha,
    hora,
    recientes,
  });
  // `null` aquí es el caso de los adaptadores que no traen historial: la
  // salvaguarda es del canal conversacional y no se le impone a los demás.
  if (!peticion) return sinJuicio();

  const respuesta = await judge.ask({
    state: peticion.state,
    questions: peticion.questions,
  });
  if (respuesta.ok === false) {
    return { ...sinJuicio(), ms: respuesta.ms, error: respuesta.error };
  }

  const { corresponde, prob } = leerCorrespondencia(
    respuesta.answers,
    peticion.asked,
  );
  const habriaFrenado = !corresponde;
  return {
    // En sombra se pregunta, se anota y NO se actúa.
    permitir: modo === 'shadow' ? true : corresponde,
    prob,
    habriaFrenado,
    ms: respuesta.ms,
  };
}
