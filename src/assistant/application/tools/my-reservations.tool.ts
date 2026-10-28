import { AssistantContext, AssistantTool } from './assistant-tool';
import { LlmToolDefinition } from '../../domain/ports/llm.port';
import { fechaDelSalon, fechaYHoraEnPalabras } from '../salon-day';
import { AssistantPresentation } from './assistant-presentation';

interface MiLinea {
  fecha: string;
  hora: string;
  servicios: string[];
}
const estilistas = new WeakMap<object, string>();
const totales = new WeakMap<object, number>();
const porWhatsApp = new WeakSet<object>();
/** Listas de un día pedido (`fecha`): el modelo las recibe enteras. */
const deUnDia = new WeakSet<object>();
/** RF54 c1: la clienta lee como mucho diez líneas, se pida un día o no. */
const MAX_LINEAS = 10;

/**
 * Forma mínima de reserva que la herramienta proyecta. El read model real de
 * Reservas (`ReservationView`) la cumple estructuralmente: expone `services`,
 * `status` y `totalDurationMinutes`.
 */
export interface MyReservationView {
  id?: string;
  scheduledAt: Date;
  /** Fin de la cita; si falta, se toma su inicio. */
  endedAt?: Date;
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
    description:
      'Devuelve las diez próximas reservas de la clienta que está conversando. ' +
      'Si la clienta nombra una cita que no está en esa lista, vuelve a llamarla con fecha (el día de esa cita) para ver todas las de ese día.',
    parameters: {
      type: 'object',
      // La identidad no se expresa por argumento; solo se puede acotar el día.
      properties: {
        fecha: {
          type: 'string',
          description:
            'Día en formato YYYY-MM-DD (hora de Colombia). Sin él, las diez más próximas.',
        },
      },
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
    // Con día pedido el modelo tiene todas las del día (para encontrar la que
    // la clienta nombra), pero lo que ella lee sigue acotado a diez.
    const visibles = lista.slice(0, MAX_LINEAS);
    const lineas = visibles.map((r, i) => {
      const estilista = estilistas.get(r);
      return (
        `${i + 1}. ${r.fecha} · ${r.hora} · ${r.servicios.join(', ')}` +
        (estilista ? ` · con ${estilista}` : '')
      );
    });
    if (enTotal > visibles.length && deUnDia.has(lista)) {
      const mas = enTotal - visibles.length;
      lineas.push(
        `Ese día tienes ${mas} ${mas === 1 ? 'reserva más' : 'reservas más'}` +
          // Lo que existe: en la web, «Mis reservas» las lista todas; por
          // WhatsApp no hay portal para un número, pero el modelo recibió las
          // de ese día enteras y puede responder por la que busca.
          (porWhatsApp.has(lista)
            ? '; pregúntame por la que buscas.'
            : '; puedes verlas todas en «Mis reservas» del portal.'),
      );
    } else if (enTotal > visibles.length) {
      const mas = enTotal - visibles.length;
      lineas.push(
        `Tienes ${mas} ${mas === 1 ? 'reserva más' : 'reservas más'}` +
          // Solo lo que existe: la web lista todas en «Mis reservas»; por
          // WhatsApp no hay portal para un número, pero esta misma consulta
          // acepta `fecha` y da todas las de ese día.
          (porWhatsApp.has(lista)
            ? '; pídeme un día concreto y te las muestro.'
            : '; puedes verlas todas en «Mis reservas» del portal.'),
      );
    }
    return { tipo: 'texto', lineas, clase: 'lista' };
  }

  async execute(
    args: Record<string, unknown>,
    context: AssistantContext,
  ): Promise<unknown> {
    const dia = args.fecha;
    if (
      dia !== undefined &&
      (typeof dia !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dia))
    ) {
      return { ok: false, motivo: 'argumentos_invalidos' };
    }
    const reservations = await this.lasDeQuienConversa(context);
    if (!reservations) return { ok: false, motivo: 'sesion_requerida' };

    // Solo las próximas y vigentes, de la más cercana a la más lejana: `findByUser`
    // las trae de la más lejana a la más cercana y con las ya terminadas, y
    // cortar a diez sobre eso enseñaba las diez más lejanas (TC-RF54-01).
    const proximas = reservations
      .filter(
        (r) =>
          (r.status === 'pendiente' || r.status === 'confirmada') &&
          (r.endedAt ?? r.scheduledAt).getTime() > context.now.getTime(),
      )
      .filter((r) => dia === undefined || fechaDelSalon(r.scheduledAt) === dia)
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
    // Con día: todas las de ese día, sin tope (la presentación sí lo tiene).
    // Sin día: las diez más próximas.
    const tope = dia === undefined ? 10 : proximas.length;

    // Proyección compacta (§6.2): solo lo que hace falta para conversar. Se limita
    // a 10 para acotar los tokens de la siguiente llamada.
    const proyectadas = proximas.slice(0, tope).map((r) => ({
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
      // asignación, no una identidad. El nombre de la estilista, cuando se
      // conoce, viaja solo en la presentación (no en lo que ve el modelo).
      estilistaElegida: r.workerPinned,
    }));
    // Lo que solo ve la clienta (no el modelo) viaja aparte, por identidad de
    // objeto, para no engordar lo que se paga en tokens ni tocar su forma.
    proximas.slice(0, tope).forEach((r, i) => {
      if (r.worker?.name) estilistas.set(proyectadas[i], r.worker.name);
    });
    totales.set(proyectadas, proximas.length);
    if (dia !== undefined) deUnDia.add(proyectadas);
    if (context.canal === 'whatsapp') porWhatsApp.add(proyectadas);
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
