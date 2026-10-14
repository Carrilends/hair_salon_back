import { AssistantContext, AssistantTool } from './assistant-tool';
import { LlmToolDefinition } from '../../domain/ports/llm.port';
import { fechaDelSalon } from '../salon-day';
import { nombreParaElModelo } from './identidad';

/**
 * Forma mínima de una cita de la agenda. El read model real de Reservas
 * (`ReservationView`) la cumple estructuralmente.
 */
export interface AgendaView {
  id: string;
  scheduledAt: Date;
  status: string;
  contact: { name: string } | null;
  worker: { name: string };
  services: { name: string }[];
}

/** Contrato mínimo de `ListActiveReservationsUseCase` (A6). */
export interface ListActiveReservationsExecutor {
  execute(): Promise<AgendaView[]>;
}

/** Tope de citas por respuesta: lo que se devuelve se paga en tokens (§6.2). */
const MAX_CITAS = 15;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `verAgenda` (plan 06, F3b): la agenda de la peluquería, **solo para la dueña
 * por WhatsApp**. No está en `ASSISTANT_TOOLS`, así que ni la web ni MCP la
 * ven; y aun así exige `isAdmin` en el canal WhatsApp: si algún día se le
 * ofreciera a otro rol por error, no enseñaría nada.
 *
 * **Minimización:** devuelve el nombre de la clienta, no su teléfono ni su
 * correo. Lo que devuelve viaja al proveedor de IA, y para gestionar la agenda
 * basta con el nombre.
 */
export class ViewAgendaTool implements AssistantTool {
  readonly name = 'verAgenda';

  readonly definition: LlmToolDefinition = {
    name: this.name,
    description:
      'Devuelve las próximas citas activas de la peluquería (pendientes y confirmadas), con su id, hora, clienta, servicios y estilista. Opcionalmente, solo las de un día.',
    parameters: {
      type: 'object',
      properties: {
        fecha: {
          type: 'string',
          description:
            'Día en formato YYYY-MM-DD (hora de Colombia). Sin él, las próximas citas.',
        },
      },
      required: [],
      additionalProperties: false,
    },
  };

  constructor(private readonly listActive: ListActiveReservationsExecutor) {}

  async execute(
    args: Record<string, unknown>,
    context: AssistantContext,
  ): Promise<unknown> {
    if (!esLaDuenaPorWhatsApp(context)) {
      return { ok: false, motivo: 'solo_administracion' };
    }
    const fecha = args.fecha;
    if (
      fecha !== undefined &&
      (typeof fecha !== 'string' || !FECHA.test(fecha))
    ) {
      return { ok: false, motivo: 'argumentos_invalidos' };
    }

    const todas = await this.listActive.execute();
    const delDia = fecha
      ? todas.filter((r) => fechaDelSalon(r.scheduledAt) === fecha)
      : todas;

    return {
      ok: true,
      citas: delDia.slice(0, MAX_CITAS).map((r) => ({
        id: r.id,
        cuando: r.scheduledAt,
        estado: r.status,
        // Filtrado: un nombre con forma de orden no llega al modelo, que en
        // este turno puede cancelar y mover cualquier cita (revisión de F3b).
        clienta: nombreParaElModelo(r.contact?.name),
        servicios: r.services.map((s) => s.name),
        estilista: r.worker.name,
      })),
      ...(delDia.length > MAX_CITAS ? { hayMas: true } : {}),
    };
  }
}

/**
 * La dueña escribiendo desde su WhatsApp. `isAdmin` lo fija el webhook por
 * `SALON_OWNER_WHATSAPP`, nunca el chat.
 */
export function esLaDuenaPorWhatsApp(context: AssistantContext): boolean {
  return (
    context.canal === 'whatsapp' &&
    context.isAdmin === true &&
    Boolean(context.phoneE164)
  );
}
