import { Reservation } from 'src/reservations/domain/reservation';
import { ReservationActor } from 'src/reservations/domain/reservation-actor';
import { canActOn } from 'src/reservations/domain/reservation-authorization';
import { fechaYHoraEnPalabras, fechaDelSalon } from '../salon-day';

/** Lee la cita por id (`GetReservationUseCase`, que no autoriza nada). */
export type LectorDeCita = (id: string) => Promise<Reservation | null>;

export const ARGUMENTOS_DE_LA_CITA = {
  fechaDeLaCita: {
    type: 'string',
    description:
      'Día de la cita tal como la clienta lo nombró, YYYY-MM-DD (hora de Colombia)',
  },
  horaDeLaCita: {
    type: 'string',
    description:
      'Hora de la cita tal como la clienta la nombró, HH:mm de 24 horas (hora de Colombia)',
  },
} as const;

/** Día y hora que la clienta nombró, ya normalizados (`YYYY-MM-DD`, `HH:mm`). */
export interface CitaPedida {
  fecha: string;
  hora: string;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
// «09:00», «9:00» o «9»: el modelo suele escribir la hora como la dijo la
// clienta, y rechazar «9:00» solo le costaría otra vuelta.
const HORA = /^(\d{1,2})(?::(\d{2}))?$/;

/**
 * Lee `fechaDeLaCita` y `horaDeLaCita` de los argumentos. `null` si faltan o no
 * se entienden (la herramienta responde `argumentos_invalidos`). No mira
 * ninguna reserva.
 */
export function leerCitaPedida(
  args: Record<string, unknown>,
): CitaPedida | null {
  const fecha = args.fechaDeLaCita;
  const hora = args.horaDeLaCita;
  if (typeof fecha !== 'string' || !FECHA.test(fecha)) return null;
  if (typeof hora !== 'string') return null;
  const m = HORA.exec(hora.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] === undefined ? 0 : Number(m[2]);
  if (h > 23 || min > 59) return null;
  const dos = (n: number) => String(n).padStart(2, '0');
  return { fecha, hora: `${dos(h)}:${dos(min)}` };
}

/** ¿Es esta la cita que se nombró? Compara en hora del salón. */
export function esLaCitaPedida(
  cita: { scheduledAt: Date },
  pedida: CitaPedida,
): boolean {
  return (
    fechaDelSalon(cita.scheduledAt) === pedida.fecha &&
    fechaYHoraEnPalabras(cita.scheduledAt.toISOString()).hora === pedida.hora
  );
}

/** Forma de los ids de reserva (la columna es `uuid`). */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lo que la guardia responde en lugar de dejar escribir. */
export type RechazoDeLaCita =
  | { ok: false; motivo: 'argumentos_invalidos' | 'reserva_no_encontrada' }
  | {
      ok: false;
      motivo: 'no_coincide_con_lo_pedido';
      /** La cita que tiene ese id, para preguntarle a la clienta si es esa. */
      laCitaConEseId: { fecha: string; hora: string };
      queHacer: string;
    }
  | { ok: false; motivo: 'confirmar_con_la_clienta'; queHacer: string };

/** Qué iba a hacerse con la cita: cambia solo la indicación al modelo. */
export type AccionSobreLaCita = 'cancelar' | 'mover';

/**
 * Guardia de conversación (TC-RF54-02, M-197): cancelar o mover solo procede
 * sobre la cita que la clienta nombró. Si el día o la hora que dijo no son los
 * de la cita con ese id, no se escribe nada y el modelo recibe un motivo claro,
 * la cita que tiene ese id y la indicación de preguntarle a la clienta.
 * No es una regla de dominio (la propiedad y los plazos los sigue decidiendo el
 * caso de uso): evita que el modelo sustituya una cita por otra «parecida».
 *
 * Solo se compara una cita sobre la que el actor puede actuar (la suya, o
 * cualquiera si es la administración). Con una ajena no se compara nada: el
 * caso de uso responde `no_es_tu_reserva` igual acierte o no el día y la hora;
 * si se comparase antes, la diferencia entre las dos respuestas revelaría el
 * día y la hora exactos de reservas de otras personas (sobre todo por MCP).
 * Por la misma razón, el día y la hora de la cita solo viajan en el rechazo de
 * una cita propia (o de administración).
 *
 * Un id que no existe tampoco se juzga aquí: el caso de uso responde por él.
 *
 * Revisión final:
 * - Si la lectura falla, la guardia no tumba el turno. Con un id sin forma de
 *   UUID (el modelo escribió «3», el número de la línea) la respuesta es
 *   `reserva_no_encontrada`: ninguna reserva puede tener ese id. Con uno válido
 *   (la base no respondió) deja que el caso de uso responda.
 * - Con `citasQueNoCoincidieron` (solo el bucle del asistente lo pone), una
 *   cita que ya fue rechazada en este turno no se cancela ni se mueve otra vez
 *   en el mismo turno, aunque ahora el día y la hora sean los suyos (M-203):
 *   el modelo los acaba de leer en el rechazo, no de la clienta.
 */
export async function comprobarCitaPedida(
  args: Record<string, unknown>,
  id: string,
  leer: LectorDeCita,
  actor: ReservationActor,
  accion: AccionSobreLaCita,
  rechazadasEnElTurno?: Set<string>,
): Promise<RechazoDeLaCita | null> {
  if (rechazadasEnElTurno?.has(id)) {
    return {
      ok: false,
      motivo: 'confirmar_con_la_clienta',
      queHacer:
        `No ${accion === 'cancelar' ? 'canceles' : 'muevas'} esta cita en este turno: ` +
        'pregúntale a la clienta si es esa la cita y espera su respuesta.',
    };
  }
  const pedida = leerCitaPedida(args);
  if (!pedida) return { ok: false, motivo: 'argumentos_invalidos' };
  let cita: Reservation | null;
  try {
    cita = await leer(id);
  } catch {
    return UUID.test(id)
      ? null
      : { ok: false, motivo: 'reserva_no_encontrada' };
  }
  if (!cita || !canActOn(cita, actor)) return null;
  if (esLaCitaPedida(cita, pedida)) return null;

  rechazadasEnElTurno?.add(id);
  const { fecha, hora } = fechaYHoraEnPalabras(cita.scheduledAt.toISOString());
  return {
    ok: false,
    motivo: 'no_coincide_con_lo_pedido',
    laCitaConEseId: { fecha, hora },
    queHacer:
      accion === 'cancelar'
        ? 'No se canceló nada. Pregúntale a la clienta cuál de sus citas quiere cancelar (por ejemplo, si es esta); no la canceles en este turno.'
        : 'No se movió nada. Pregúntale a la clienta cuál de sus citas quiere mover (por ejemplo, si es esta), y repite en la pregunta la hora nueva que pidió; no la muevas en este turno.',
  };
}
