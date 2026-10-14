import { AssistantContext, AssistantTool } from './assistant-tool';
import { LlmToolDefinition } from '../../domain/ports/llm.port';

/**
 * Forma mínima de reserva que la herramienta proyecta. El read model real de
 * Reservas (`ReservationView`) la cumple estructuralmente: expone `services`,
 * `status` y `totalDurationMinutes`.
 */
export interface MyReservationView {
  id?: string;
  scheduledAt: Date;
  status: string;
  totalDurationMinutes: number;
  services: { name: string }[];
  /** ¿La estilista la eligió la clienta, o la repartió el sistema? */
  workerPinned: boolean;
}

/**
 * Contrato mínimo del caso de uso real (A6): las reservas de un usuario. Se tipa
 * como interfaz para no arrastrar las dependencias de Nest a la capa de aplicación.
 */
export interface GetMyReservationsExecutor {
  execute(userId: string): Promise<MyReservationView[]>;
}

/**
 * Las citas de un número de WhatsApp (plan 06, F3b): las activas y no vencidas
 * a nombre de ese teléfono. La compone el juego de herramientas de WhatsApp
 * sobre `FindActionableReservationsUseCase`.
 */
export interface GetReservationsByPhoneExecutor {
  execute(phoneE164: string): Promise<MyReservationView[]>;
}

/**
 * `misReservas`: consulta de solo lectura de las reservas de la clienta que
 * conversa. Fíjate en el esquema: **no tiene ningún parámetro de identidad**. La
 * identidad SIEMPRE sale del contexto de sesión (JWT), nunca de los argumentos:
 * ninguna instrucción escrita en el chat puede pedir las reservas de otra persona
 * porque ese parámetro no existe (defensa estructural frente a la inyección).
 */
export class MyReservationsTool implements AssistantTool {
  readonly name = 'misReservas';

  readonly definition: LlmToolDefinition = {
    name: this.name,
    description: 'Devuelve las reservas de la clienta que está conversando.',
    parameters: {
      type: 'object',
      // Vacío a propósito: la identidad no se expresa por argumento.
      properties: {},
      required: [],
      additionalProperties: false,
    },
  };

  constructor(
    private readonly getMine: GetMyReservationsExecutor,
    // Solo en el juego de WhatsApp. Sin él, un contexto de WhatsApp no cae a
    // la consulta por usuario: responde como si no hubiera sesión.
    private readonly porTelefono?: GetReservationsByPhoneExecutor,
  ) {}

  async execute(
    _args: Record<string, unknown>,
    context: AssistantContext,
  ): Promise<unknown> {
    const reservations = await this.lasDeQuienConversa(context);
    if (!reservations) return { ok: false, motivo: 'sesion_requerida' };

    // Proyección compacta (§6.2): solo lo que hace falta para conversar. Se limita
    // a 10 para acotar los tokens de la siguiente llamada.
    return reservations.slice(0, 10).map((r) => ({
      id: r.id,
      cuando: r.scheduledAt,
      estado: r.status,
      servicios: r.services.map((s) => s.name),
      minutos: r.totalDurationMinutes,
      // La condición del aviso previo al reprogramar: si la eligió la clienta,
      // mover la cita no se la cambia nunca, así que advertirla sería
      // preocuparla por algo imposible. Es un sí/no sobre el **origen** de la
      // asignación, no una identidad: el chat sigue sin nombrar estilistas.
      estilistaElegida: r.workerPinned,
    }));
  }

  /**
   * Por número en WhatsApp (el firmado, nunca uno escrito en el chat); por
   * usuario en la web. `null` = no hay identidad con la que consultar.
   */
  private async lasDeQuienConversa(
    context: AssistantContext,
  ): Promise<MyReservationView[] | null> {
    if (context.canal === 'whatsapp') {
      if (!context.phoneE164 || !this.porTelefono) return null;
      return this.porTelefono.execute(context.phoneE164);
    }
    if (!context.userId) return null;
    return this.getMine.execute(context.userId);
  }
}
