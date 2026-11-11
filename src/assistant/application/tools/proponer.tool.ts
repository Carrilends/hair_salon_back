import { Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AssistantContext, AssistantTool } from './assistant-tool';
import { LlmToolDefinition } from '../../domain/ports/llm.port';
import { CreateReservationArgsDto } from './create-reservation-args.dto';
import {
  identidadParaCrear,
  mapDomainErrorToReason,
} from './create-reservation.tool';
import {
  CitaAConfirmar,
  ConfirmBookingPresentation,
  ConfirmCancelPresentation,
  ConfirmReschedulePresentation,
} from './assistant-presentation';
import { actorDelContexto, nombreParaElModelo } from './identidad';
import { mapRescheduleErrorToReason } from './reschedule-reservation.tool';
import { ReservationActor } from 'src/reservations/domain/reservation-actor';
import { Reservation } from 'src/reservations/domain/reservation';
import { assertCanActOn } from 'src/reservations/domain/reservation-authorization';
import { fechaYHoraEnPalabras, instanteDelSalon } from '../salon-day';
import { ServiceCatalogQueryPort } from '../../domain/ports/service-catalog-query.port';
import { PendingBookingRepositoryPort } from '../../domain/ports/pending-booking-repository.port';
import { PENDING_BOOKING_TTL_MINUTES } from '../../domain/pending-booking';
import { getDatePartsInTz } from 'src/reservations/salon-time';
import { horarioDelDia } from 'src/reservations/horario-en-palabras';
import { CitaPedida, esLaCitaPedida, leerCitaPedida } from './cita-pedida';
import { esUnaHoraNoDicha, HORA_NO_DICHA } from './hora-dicha';

/**
 * Las herramientas de WhatsApp que **proponen** en vez de escribir (plan 06,
 * F4, D4). Tienen el mismo nombre y la misma definición que las de la web,
 * porque para el modelo es la misma intención; lo que cambia es el efecto:
 * nada se escribe hasta que la persona pulsa el botón, y el botón lo atiende el
 * manejador del webhook, sin modelo de por medio.
 *
 * Fuera de WhatsApp no hacen nada: ese no es su canal.
 */

const SOLO_WHATSAPP = { ok: false, motivo: 'solo_whatsapp' } as const;

const zonaDelSalon = () => process.env.SALON_TZ ?? 'America/Bogota';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function idDeReserva(args: Record<string, unknown>): string | null {
  const id = typeof args.reservaId === 'string' ? args.reservaId.trim() : '';
  return UUID.test(id) ? id : null;
}

/** Lectura de una cita por id (`GetReservationUseCase`). */
export interface CitaPorId {
  execute(id: string): Promise<Reservation | null>;
}

/**
 * Carga la cita y comprueba que quien escribe puede actuar sobre ella (revisión
 * de F4): el id lo escribió el modelo, así que antes de enseñar un botón se
 * mira qué cita es de verdad y de quién. El dominio lo vuelve a comprobar al
 * pulsar; esto evita enseñar un botón —y datos— que no le corresponden.
 *
 * Después, la guardia de la cita pedida (TC-RF54-02), como en la web: si el día
 * o la hora que se nombraron no son los de esa cita, no se propone nada. Va
 * **después** de la propiedad a propósito: con una cita de otro número la
 * respuesta es `no_es_tu_reserva` acierte o no el día y la hora, así que no
 * sirve para averiguarlos.
 */
async function citaParaConfirmar(
  citas: CitaPorId,
  id: string,
  pedida: CitaPedida,
  context: AssistantContext,
): Promise<{ cita: CitaAConfirmar } | { motivo: string }> {
  const actor = actorDelContexto(context);
  if (!actor) return { motivo: 'sesion_requerida' };
  // Si la base no responde, un motivo y no una excepción: la excepción subiría
  // por el bucle del asistente y el turno entero se perdería (revisión final).
  let reserva: Reservation | null;
  try {
    reserva = await citas.execute(id);
  } catch {
    return { motivo: 'error_desconocido' };
  }
  if (!reserva) return { motivo: 'reserva_no_encontrada' };
  try {
    assertCanActOn(reserva, actor);
  } catch {
    return { motivo: 'no_es_tu_reserva' };
  }
  if (!esLaCitaPedida(reserva, pedida)) {
    return { motivo: 'no_coincide_con_lo_pedido' };
  }
  const { fecha, hora } = fechaYHoraEnPalabras(
    reserva.scheduledAt.toISOString(),
  );
  return {
    cita: {
      fecha,
      hora,
      servicios: reserva.lines.map((l) => l.name),
      ...(context.isAdmin
        ? { clienta: nombreParaElModelo(reserva.contact?.name) }
        : {}),
    },
  };
}

/**
 * Las reglas de agenda de la creación, sin crear
 * (`CreateReservationUseCase.comprobar`). Se tipa como interfaz por la misma
 * razón que `CreateReservationExecutor`: no arrastrar el caso de uso de Nest a
 * la capa de aplicación del asistente.
 */
export interface AgendaParaProponer {
  comprobar(command: {
    scheduledAt: string;
    serviceIds: string[];
    userId: null;
    contact: { name: string; phone: string };
  }): Promise<void>;
}

/**
 * Las reglas de agenda de la reprogramación, sin mover
 * (`RescheduleReservationUseCase.comprobar`), con la misma firma que su
 * `execute`.
 */
export interface AgendaParaMover {
  comprobar(
    id: string,
    scheduledAtIso: string,
    actor: ReservationActor,
  ): Promise<void>;
}

const NADA_GUARDADO = 'No se guardó nada y no hay botones que pulsar.';
const NADA_MOVIDO = 'La cita no se movió y no hay botones que pulsar.';

/**
 * Qué hacer con cada motivo de agenda: lo lee el modelo, no la clienta.
 * `base` dice qué NO pasó (no se guardó la propuesta, no se movió la cita).
 */
function instruccionDeAgenda(motivo: string, base: string): string {
  switch (motivo) {
    case 'fuera_de_horario':
      return `${base} Dile que a esa hora el salón está cerrado, con el horario de ese día (horarioDelDia), y ofrécele otra hora dentro de ese horario.`;
    case 'fecha_pasada':
      return `${base} Dile que esa hora ya pasó y pregúntale qué otra hora o día le sirve.`;
    case 'hora_ocupada':
      return `${base} Dile que esa hora ya está ocupada, consulta consultarDisponibilidad para ese día y ofrécele otra hora libre.`;
    case 'estilista_ocupada':
      return `${base} Dile que su estilista no tiene libre esa hora, consulta consultarDisponibilidad para ese día y ofrécele otra hora.`;
    case 'fuera_de_plazo':
      return `${base} Dile que esa cita ya no se puede cambiar desde aquí porque su hora ya pasó o está muy cerca.`;
    case 'estado_no_movible':
      return `${base} Dile que esa cita ya está cerrada (cumplida o cancelada) y no se puede mover.`;
    case 'servicios_duplicados':
      return `${base} Repetiste un servicio en serviciosIds: quita el repetido y vuelve a llamar con la misma hora; no se lo menciones a la clienta.`;
    case 'no_disponible':
      return `${base} Dile que esa hora no se puede agendar y ofrécele otra; no inventes la razón.`;
    default:
      return `${base} Dile que no pudiste prepararla y ofrécele otra hora.`;
  }
}

/** `crearReserva` y `reservarPaquete` en WhatsApp. */
export class ProposeBookingTool implements AssistantTool {
  private readonly logger = new Logger(ProposeBookingTool.name);

  constructor(
    readonly name: string,
    readonly definition: LlmToolDefinition,
    private readonly deps: {
      pendientes: Pick<
        PendingBookingRepositoryPort,
        'save' | 'supersedeActiveFor'
      >;
      catalog: Pick<ServiceCatalogQueryPort, 'findNamesByIds'>;
      agenda: AgendaParaProponer;
    },
  ) {}

  async execute(
    args: Record<string, unknown>,
    context: AssistantContext,
  ): Promise<unknown> {
    if (context.canal !== 'whatsapp') return SOLO_WHATSAPP;

    // Quién y a nombre de quién: la misma regla que en F3b (solo la clienta,
    // número colombiano, nombre con forma de nombre).
    const identidad = identidadParaCrear(args, context);
    if ('motivo' in identidad) return { ok: false, ...identidad };
    if (!('contact' in identidad.quien)) return SOLO_WHATSAPP;
    const contacto = identidad.quien.contact;

    const dto = plainToInstance(CreateReservationArgsDto, identidad.resto);
    const errores = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errores.length > 0)
      return { ok: false, motivo: 'argumentos_invalidos' };
    // La hora que escribe el modelo, pasada a instante: sin zona es la del salón
    // (`instanteDelSalon`). De aquí en adelante `fechaHoraIso` va en UTC.
    const inicio = instanteDelSalon(dto.fechaHoraIso);
    if (!inicio) return { ok: false, motivo: 'argumentos_invalidos' };
    dto.fechaHoraIso = inicio.toISOString();

    // Prueba con móvil del 2026-11-10: «el viernes 10» acabó en una propuesta
    // a las 8:00. Si ella escribió alguna hora y esta no es ninguna de ellas,
    // no se guarda ni se anula nada: se le pregunta la hora.
    if (esUnaHoraNoDicha(inicio, context.recientes)) return HORA_NO_DICHA;

    // Servicios que no existen se rechazan ya: el resumen que verá la clienta
    // tiene que nombrar lo que de verdad se va a reservar.
    const nombres = await this.deps.catalog.findNamesByIds(dto.serviciosIds);
    const servicios = dto.serviciosIds.map((id) => nombres.get(id));
    if (servicios.some((n) => !n)) {
      return { ok: false, motivo: 'servicio_invalido' };
    }

    // Prueba con móvil del 2026-11-10: una propuesta para un sábado a las 8:00
    // (abre a las 9:00) se guardó con sus botones y «Confirmar» falló sin decir
    // por qué. Antes de guardar, las MISMAS reglas que la creación —horario,
    // pasado, estilista libre—, con el caso de uso real: ninguna se copia aquí.
    // Si no cabe, no se guarda ni se anula nada.
    try {
      await this.deps.agenda.comprobar({
        scheduledAt: dto.fechaHoraIso,
        serviceIds: dto.serviciosIds,
        userId: null,
        contact: contacto,
      });
    } catch (error) {
      const motivo = mapDomainErrorToReason(error);
      if (motivo === 'error_desconocido') {
        this.logger.error(
          'No se pudo comprobar la hora de una propuesta',
          error as Error,
        );
      }
      return {
        ok: false,
        motivo,
        ...(motivo === 'fuera_de_horario'
          ? { horarioDelDia: horarioDelDia(inicio, zonaDelSalon()) }
          : {}),
        instruccion: instruccionDeAgenda(motivo, NADA_GUARDADO),
      };
    }

    // Una sola propuesta viva por número: la nueva anula las anteriores, así
    // que «Confirmar» en un mensaje viejo ya no crea una segunda reserva.
    await this.deps.pendientes.supersedeActiveFor(contacto.phone, context.now);
    const propuesta = await this.deps.pendientes.save({
      phoneE164: contacto.phone,
      customerName: contacto.name,
      serviceIds: dto.serviciosIds,
      scheduledAt: inicio,
      expiresAt: new Date(
        context.now.getTime() + PENDING_BOOKING_TTL_MINUTES * 60_000,
      ),
    });
    const { fecha, hora } = fechaYHoraEnPalabras(dto.fechaHoraIso);

    return {
      ok: true,
      estado: 'pendiente_de_confirmar',
      propuestaId: propuesta.id,
      resumen: {
        nombre: contacto.name,
        servicios: servicios as string[],
        fecha,
        hora,
      },
      instruccion:
        'La reserva TODAVÍA NO existe. Dile en una frase que revise el resumen y pulse «Confirmar» en el mensaje con botones, o «Cambiar» si quiere otra cosa. No digas que ya quedó reservada.',
    };
  }

  presentar(result: unknown): ConfirmBookingPresentation | null {
    const r = result as {
      ok?: boolean;
      propuestaId?: string;
      resumen?: Omit<ConfirmBookingPresentation, 'tipo' | 'propuestaId'>;
    };
    if (r?.ok !== true || !r.propuestaId || !r.resumen) return null;
    return {
      tipo: 'confirmar-reserva',
      propuestaId: r.propuestaId,
      ...r.resumen,
    };
  }
}

/** `cancelarReserva` en WhatsApp: el botón será `CANCEL_OK|<cita>`. */
export class ProposeCancelTool implements AssistantTool {
  readonly name: string;

  constructor(
    readonly definition: LlmToolDefinition,
    private readonly deps: { citas: CitaPorId },
  ) {
    this.name = definition.name;
  }

  async execute(
    args: Record<string, unknown>,
    context: AssistantContext,
  ): Promise<unknown> {
    if (context.canal !== 'whatsapp') return SOLO_WHATSAPP;
    const reservaId = idDeReserva(args);
    const pedida = leerCitaPedida(args);
    if (!reservaId || !pedida) {
      return { ok: false, motivo: 'argumentos_invalidos' };
    }

    const r = await citaParaConfirmar(
      this.deps.citas,
      reservaId,
      pedida,
      context,
    );
    if ('motivo' in r) return { ok: false, motivo: r.motivo };
    return {
      ok: true,
      estado: 'requiere_boton',
      reservaId,
      cita: r.cita,
      instruccion:
        'Todavía NO se canceló. Dile en una frase que confirme con el botón «Sí, cancelar».',
    };
  }

  presentar(result: unknown): ConfirmCancelPresentation | null {
    const r = result as {
      ok?: boolean;
      reservaId?: string;
      cita?: CitaAConfirmar;
    };
    if (r?.ok !== true || !r.reservaId || !r.cita) return null;
    return {
      tipo: 'confirmar-cancelacion',
      reservaId: r.reservaId,
      cita: r.cita,
    };
  }
}

/** `reprogramarReserva` en WhatsApp: el botón será `RSAT|<cita>|<hora local>`. */
export class ProposeRescheduleTool implements AssistantTool {
  readonly name: string;

  private readonly logger = new Logger(ProposeRescheduleTool.name);

  constructor(
    readonly definition: LlmToolDefinition,
    private readonly deps: { citas: CitaPorId; agenda: AgendaParaMover },
  ) {
    this.name = definition.name;
  }

  async execute(
    args: Record<string, unknown>,
    context: AssistantContext,
  ): Promise<unknown> {
    if (context.canal !== 'whatsapp') return SOLO_WHATSAPP;
    const reservaId = idDeReserva(args);
    const nueva =
      typeof args.nuevaFecha === 'string'
        ? instanteDelSalon(args.nuevaFecha)
        : null;
    const pedida = leerCitaPedida(args);
    if (!reservaId || !nueva || !pedida) {
      return { ok: false, motivo: 'argumentos_invalidos' };
    }

    const actual = await citaParaConfirmar(
      this.deps.citas,
      reservaId,
      pedida,
      context,
    );
    if ('motivo' in actual) return { ok: false, motivo: actual.motivo };

    // 2026-11-10, como la propuesta de reservar: antes de enseñar el botón, la
    // hora nueva pasa por las MISMAS reglas que la reprogramación —estado y
    // plazo, horario, pasado, estilista libre—, con el caso de uso real. Si no
    // cabe, no hay botón y la cita no se toca.
    const actor = actorDelContexto(context);
    if (!actor) return { ok: false, motivo: 'sesion_requerida' };
    try {
      await this.deps.agenda.comprobar(reservaId, nueva.toISOString(), actor);
    } catch (error) {
      const motivo = mapRescheduleErrorToReason(error);
      if (motivo === 'error_desconocido') {
        this.logger.error(
          'No se pudo comprobar la hora nueva de una cita',
          error as Error,
        );
      }
      return {
        ok: false,
        motivo,
        ...(motivo === 'fuera_de_horario'
          ? { horarioDelDia: horarioDelDia(nueva, zonaDelSalon()) }
          : {}),
        instruccion: instruccionDeAgenda(motivo, NADA_MOVIDO),
      };
    }

    // El botón `RSAT` lleva la hora del salón (`YYYY-MM-DDTHH:mm`), como el
    // flujo de mover que ya existía: el manejador la vuelve a pasar a UTC.
    const p = getDatePartsInTz(nueva, zonaDelSalon());
    const dos = (n: number) => String(n).padStart(2, '0');
    const cuandoLocal = `${p.year}-${dos(p.month)}-${dos(p.day)}T${dos(p.hour)}:${dos(p.minute)}`;
    const { fecha, hora } = fechaYHoraEnPalabras(nueva.toISOString());

    return {
      ok: true,
      estado: 'requiere_boton',
      reservaId,
      cuandoLocal,
      fecha,
      hora,
      cita: actual.cita,
      instruccion:
        'Todavía NO se movió. Dile en una frase que confirme con el botón «Sí, cambiar».',
    };
  }

  presentar(result: unknown): ConfirmReschedulePresentation | null {
    const r = result as {
      ok?: boolean;
      reservaId?: string;
      cuandoLocal?: string;
      fecha?: string;
      hora?: string;
      cita?: CitaAConfirmar;
    };
    if (r?.ok !== true || !r.reservaId || !r.cuandoLocal || !r.cita) {
      return null;
    }
    return {
      tipo: 'confirmar-cambio',
      reservaId: r.reservaId,
      cuandoLocal: r.cuandoLocal,
      fecha: r.fecha ?? '',
      hora: r.hora ?? '',
      cita: r.cita,
    };
  }
}
