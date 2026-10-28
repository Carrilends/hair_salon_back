import { AssistantContext, AssistantTool } from './assistant-tool';
import { LlmToolDefinition } from '../../domain/ports/llm.port';
import { fechaDelSalon, fechaYHoraEnPalabras } from '../salon-day';
import { AssistantPresentation } from './assistant-presentation';
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
  /** Nombre de la cuenta, para las citas hechas con sesión (sin contacto). */
  accountName?: string | null;
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
 * Citas que el tope dejó fuera de un día pedido. Viaja por identidad de objeto,
 * solo para la línea presentada: el modelo no la necesita.
 */
const fueraDelDia = new WeakMap<object, number>();

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

  /**
   * RF59 c1: la agenda sale por el canal presentado, una línea por cita y
   * agrupada por día, para que no dependa de cómo la resuma el modelo. Reusa lo
   * que ya devolvió `execute` (sin teléfonos ni correos).
   */
  async presentar(result: unknown): Promise<AssistantPresentation | null> {
    const r = result as {
      ok?: boolean;
      citas?: CitaDeLaAgenda[];
      hayMas?: boolean;
    };
    if (r?.ok !== true || !Array.isArray(r.citas) || r.citas.length === 0) {
      return null;
    }
    const lineas: string[] = [];
    let dia: string | null = null;
    for (const c of r.citas) {
      if (c.fecha !== dia) {
        dia = c.fecha;
        lineas.push(`*${c.fecha}*`);
      }
      lineas.push(
        `${c.hora} · ${c.clienta} · ${c.servicios.join(', ')} · con ${c.estilista}`,
      );
    }
    const hayMas = r.hayMas === true;
    if (hayMas) {
      const restantes = fueraDelDia.get(result as object);
      lineas.push(restantes === undefined ? HAY_MAS : hayMasEseDia(restantes));
    }
    return { tipo: 'agenda', lineas, hayMas };
  }

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

    const respuesta = {
      ok: true,
      citas: delDia.slice(0, MAX_CITAS).map((r) => ({
        id: r.id,
        // Fecha y hora del salón, no el instante en UTC: el modelo las repite
        // tal cual, y con el ISO le decía a la dueña «15:00» por una cita de
        // las 10:00 (prueba de humo de F5).
        ...fechaYHoraEnPalabras(r.scheduledAt.toISOString()),
        estado: r.status,
        // Filtrado: un nombre con forma de orden no llega al modelo, que en
        // este turno puede cancelar y mover cualquier cita (revisión de F3b).
        clienta: nombreParaElModelo(r.contact?.name || r.accountName),
        servicios: r.services.map((s) => s.name),
        estilista: r.worker.name,
      })),
      ...(delDia.length > MAX_CITAS ? { hayMas: true } : {}),
    };
    // Con un día ya pedido, «pídeme un día» no lleva a ninguna parte: el tope
    // se queda (RF59) y la línea manda a la bandeja del portal, que las lista
    // todas.
    if (fecha && delDia.length > MAX_CITAS) {
      fueraDelDia.set(respuesta, delDia.length - MAX_CITAS);
    }
    return respuesta;
  }
}

/** Línea final cuando el tope dejó citas fuera y no se pidió un día. */
const HAY_MAS = 'Hay más citas: pídeme un día concreto.';

/** Línea final cuando el tope dejó fuera citas del día pedido. */
function hayMasEseDia(n: number): string {
  return n === 1
    ? 'Ese día hay 1 cita más; la ves en la bandeja del portal.'
    : `Ese día hay ${n} citas más; las ves todas en la bandeja del portal.`;
}

/**
 * Cita tal como la devuelve `execute`, para presentarla.
 */
interface CitaDeLaAgenda {
  fecha: string;
  hora: string;
  clienta: string;
  servicios: string[];
  estilista: string;
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
