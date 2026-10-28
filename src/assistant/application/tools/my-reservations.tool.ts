import { AssistantContext, AssistantTool } from './assistant-tool';
import { LlmToolDefinition } from '../../domain/ports/llm.port';
import { fechaYHoraEnPalabras } from '../salon-day';
import { AssistantPresentation } from './assistant-presentation';

interface MiLinea {
  fecha: string;
  hora: string;
  servicios: string[];
}
const estilistas = new WeakMap<object, string>();
const totales = new WeakMap<object, number>();

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
  /** Solo para mostrarla: no viaja al modelo. */
  worker?: { name: string };
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

  /**
   * TC-RF54-01: la lista que la clienta lee sale de aquí, no del resumen del
   * modelo (que contaba mal o decía «varias»). Hasta diez, de la más próxima a
   * la más lejana, una línea cada una; si quedan más, una línea lo dice. La
   * estilista solo aparece si el origen la trae (la web); nunca teléfono ni
   * correo.
   */
  async presentar(result: unknown): Promise<AssistantPresentation | null> {
    const lista = result as Array<MiLinea> | { ok?: boolean };
    if (!Array.isArray(lista) || lista.length === 0) return null;
    const enTotal = totales.get(lista) ?? lista.length;
    const lineas = lista.map((r, i) => {
      const estilista = estilistas.get(r);
      return (
        `${i + 1}. ${r.fecha} · ${r.hora} · ${r.servicios.join(', ')}` +
        (estilista ? ` · con ${estilista}` : '')
      );
    });
    if (enTotal > lista.length) {
      const mas = enTotal - lista.length;
      lineas.push(
        `Tienes ${mas} ${mas === 1 ? 'reserva más' : 'reservas más'}: pídeme un día concreto.`,
      );
    }
    return { tipo: 'texto', lineas };
  }

  async execute(
    _args: Record<string, unknown>,
    context: AssistantContext,
  ): Promise<unknown> {
    const reservations = await this.lasDeQuienConversa(context);
    if (!reservations) return { ok: false, motivo: 'sesion_requerida' };

    // Solo las próximas y vigentes, de la más cercana a la más lejana: `findByUser`
    // las trae de la más lejana a la más cercana y con las ya terminadas, y
    // cortar a diez sobre eso enseñaba las diez más lejanas (TC-RF54-01).
    const proximas = reservations
      .filter(
        (r) =>
          (r.status === 'pendiente' || r.status === 'confirmada') &&
          r.scheduledAt.getTime() >= context.now.getTime(),
      )
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

    // Proyección compacta (§6.2): solo lo que hace falta para conversar. Se limita
    // a 10 para acotar los tokens de la siguiente llamada.
    const proyectadas = proximas.slice(0, 10).map((r) => ({
      id: r.id,
      // Fecha y hora del salón en todos los canales: el modelo las repite tal
      // cual. Con el instante en UTC la convertía mal y actuaba sobre la cita
      // equivocada (TC-RF54-01; antes, la prueba de humo de F5 en WhatsApp).
      ...fechaYHoraEnPalabras(r.scheduledAt.toISOString()),
      estado: r.status,
      servicios: r.services.map((s) => s.name),
      minutos: r.totalDurationMinutes,
      // La condición del aviso previo al reprogramar: si la eligió la clienta,
      // mover la cita no se la cambia nunca, así que advertirla sería
      // preocuparla por algo imposible. Es un sí/no sobre el **origen** de la
      // asignación, no una identidad: el chat sigue sin nombrar estilistas.
      estilistaElegida: r.workerPinned,
    }));
    // Lo que solo ve la clienta (no el modelo) viaja aparte, por identidad de
    // objeto, para no engordar lo que se paga en tokens ni tocar su forma.
    proximas.slice(0, 10).forEach((r, i) => {
      if (r.worker?.name) estilistas.set(proyectadas[i], r.worker.name);
    });
    totales.set(proyectadas, proximas.length);
    return proyectadas;
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
