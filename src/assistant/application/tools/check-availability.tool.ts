import { AssistantContext, AssistantTool } from './assistant-tool';
import { LlmToolDefinition } from '../../domain/ports/llm.port';
import {
  AvailabilityQueryPort,
  DayAvailability,
} from '../../domain/ports/availability-query.port';
import { getDatePartsInTz } from 'src/reservations/salon-time';

const SLOT_MINUTES = 30;
const HORIZON_DAYS = 90;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `consultarDisponibilidad`: envuelve la disponibilidad del día y **compacta**
 * su salida a las franjas libres, que es lo único que el modelo necesita para
 * proponer una hora. La validación de que una hora concreta es válida sigue
 * siendo de `CreateReservationUseCase` (A6); aquí solo se descartan de antemano
 * las fechas absurdas (mal formadas, pasadas o más allá del horizonte).
 */
export class CheckAvailabilityTool implements AssistantTool {
  readonly name = 'consultarDisponibilidad';

  readonly definition: LlmToolDefinition = {
    name: this.name,
    description:
      'Consulta las franjas libres del salón para una fecha en formato YYYY-MM-DD.',
    parameters: {
      type: 'object',
      properties: {
        fecha: {
          type: 'string',
          description: 'Fecha en formato YYYY-MM-DD (hora de Colombia)',
        },
      },
      required: ['fecha'],
      additionalProperties: false,
    },
  };

  constructor(private readonly availability: AvailabilityQueryPort) {}

  async execute(
    args: Record<string, unknown>,
    context: AssistantContext,
  ): Promise<unknown> {
    const fecha = typeof args.fecha === 'string' ? args.fecha.trim() : '';
    if (!DATE_RE.test(fecha) || !isRealDate(fecha)) {
      return { ok: false, motivo: 'fecha_invalida' };
    }

    const tz = process.env.SALON_TZ ?? 'America/Bogota';
    const today = salonYmd(context.now, tz);
    if (fecha < today) return { ok: false, motivo: 'fecha_pasada' };
    if (daysBetween(today, fecha) > HORIZON_DAYS) {
      return { ok: false, motivo: 'fecha_muy_lejana' };
    }

    const day = await this.availability.getDayAvailability(fecha);
    return {
      fecha,
      estilistas: day.assignableWorkers,
      libres: freeSlots(day),
    };
  }
}

function isRealDate(ymd: string): boolean {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

function salonYmd(now: Date, tz: string): string {
  const p = getDatePartsInTz(now, tz);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const [ay, am, ad] = fromYmd.split('-').map(Number);
  const [by, bm, bd] = toYmd.split('-').map(Number);
  return Math.round(
    (Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000,
  );
}

/** Franjas de 30 min con hueco libre en el día. Advisory: A6 es la autoridad. */
function freeSlots(day: DayAvailability): string[] {
  const start = ceilToSlot(day.effectiveStartMin);
  const slots: string[] = [];
  for (let t = start; t + SLOT_MINUTES <= day.closeMin; t += SLOT_MINUTES) {
    const busy = day.busyBlocks.some(
      (b) => t < b.endMin && t + SLOT_MINUTES > b.startMin,
    );
    if (!busy) slots.push(fmtHHmm(t));
  }
  return slots;
}

function ceilToSlot(min: number): number {
  return Math.ceil(min / SLOT_MINUTES) * SLOT_MINUTES;
}

function fmtHHmm(min: number): string {
  return `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
