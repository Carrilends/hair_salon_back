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
}

/**
 * Contrato mínimo del caso de uso real (A6): las reservas de un usuario. Se tipa
 * como interfaz para no arrastrar las dependencias de Nest a la capa de aplicación.
 */
export interface GetMyReservationsExecutor {
  execute(userId: string): Promise<MyReservationView[]>;
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

  constructor(private readonly getMine: GetMyReservationsExecutor) {}

  async execute(
    _args: Record<string, unknown>,
    context: AssistantContext,
  ): Promise<unknown> {
    if (!context.userId) return { ok: false, motivo: 'sesion_requerida' };

    const reservations = await this.getMine.execute(context.userId);

    // Proyección compacta (§6.2): solo lo que hace falta para conversar. Se limita
    // a 10 para acotar los tokens de la siguiente llamada.
    return reservations.slice(0, 10).map((r) => ({
      id: r.id,
      cuando: r.scheduledAt,
      estado: r.status,
      servicios: r.services.map((s) => s.name),
      minutos: r.totalDurationMinutes,
    }));
  }
}
