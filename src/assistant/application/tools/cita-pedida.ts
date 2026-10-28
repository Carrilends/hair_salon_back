import { fechaYHoraEnPalabras, fechaDelSalon } from '../salon-day';

/** Lee la cita por id para comparar su día y hora (sin autorizar nada). */
export type LectorDeCita = (
  id: string,
) => Promise<{ scheduledAt: Date } | null>;

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

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^\d{2}:\d{2}$/;

/**
 * Guardia de conversación (TC-RF54-02, M-197): cancelar o mover solo procede
 * sobre la cita que la clienta nombró. Si el día o la hora que dijo no son los
 * de la cita con ese id, no se escribe nada y el modelo recibe un motivo claro.
 * No es una regla de dominio (la propiedad y los plazos los sigue decidiendo el
 * caso de uso): evita que el modelo sustituya una cita por otra «parecida».
 *
 * Un id que no existe no se juzga aquí: el caso de uso responde por él.
 */
export async function citaNoCoincide(
  args: Record<string, unknown>,
  id: string,
  leer: LectorDeCita,
): Promise<'argumentos_invalidos' | 'no_coincide_con_lo_pedido' | null> {
  const fecha = args.fechaDeLaCita;
  const hora = args.horaDeLaCita;
  if (
    typeof fecha !== 'string' ||
    typeof hora !== 'string' ||
    !FECHA.test(fecha) ||
    !HORA.test(hora)
  ) {
    return 'argumentos_invalidos';
  }
  const cita = await leer(id);
  if (!cita) return null;
  const real = fechaYHoraEnPalabras(cita.scheduledAt.toISOString()).hora;
  return fechaDelSalon(cita.scheduledAt) === fecha && real === hora
    ? null
    : 'no_coincide_con_lo_pedido';
}
