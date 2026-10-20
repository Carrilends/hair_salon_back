import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AssistantContext, AssistantTool } from './assistant-tool';
import { LlmToolDefinition } from '../../domain/ports/llm.port';
import { CreateReservationArgsDto } from './create-reservation-args.dto';
import { identidadParaCrear } from './create-reservation.tool';
import {
  CitaAConfirmar,
  ConfirmBookingPresentation,
  ConfirmCancelPresentation,
  ConfirmReschedulePresentation,
} from './assistant-presentation';
import { actorDelContexto, nombreParaElModelo } from './identidad';
import { Reservation } from 'src/reservations/domain/reservation';
import { assertCanActOn } from 'src/reservations/domain/reservation-authorization';
import { fechaYHoraEnPalabras, instanteDelSalon } from '../salon-day';
import { ServiceCatalogQueryPort } from '../../domain/ports/service-catalog-query.port';
import { PendingBookingRepositoryPort } from '../../domain/ports/pending-booking-repository.port';
import { PENDING_BOOKING_TTL_MINUTES } from '../../domain/pending-booking';
import { getDatePartsInTz } from 'src/reservations/salon-time';

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
 */
async function citaParaConfirmar(
  citas: CitaPorId,
  id: string,
  context: AssistantContext,
): Promise<{ cita: CitaAConfirmar } | { motivo: string }> {
  const actor = actorDelContexto(context);
  if (!actor) return { motivo: 'sesion_requerida' };
  const reserva = await citas.execute(id);
  if (!reserva) return { motivo: 'reserva_no_encontrada' };
  try {
    assertCanActOn(reserva, actor);
  } catch {
    return { motivo: 'no_es_tu_reserva' };
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

/** `crearReserva` y `reservarPaquete` en WhatsApp. */
export class ProposeBookingTool implements AssistantTool {
  constructor(
    readonly name: string,
    readonly definition: LlmToolDefinition,
    private readonly deps: {
      pendientes: Pick<
        PendingBookingRepositoryPort,
        'save' | 'supersedeActiveFor'
      >;
      catalog: Pick<ServiceCatalogQueryPort, 'findNamesByIds'>;
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

    // Servicios que no existen se rechazan ya: el resumen que verá la clienta
    // tiene que nombrar lo que de verdad se va a reservar.
    const nombres = await this.deps.catalog.findNamesByIds(dto.serviciosIds);
    const servicios = dto.serviciosIds.map((id) => nombres.get(id));
    if (servicios.some((n) => !n)) {
      return { ok: false, motivo: 'servicio_invalido' };
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
    if (!reservaId) return { ok: false, motivo: 'argumentos_invalidos' };

    const r = await citaParaConfirmar(this.deps.citas, reservaId, context);
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
    const nueva =
      typeof args.nuevaFecha === 'string'
        ? instanteDelSalon(args.nuevaFecha)
        : null;
    if (!reservaId || !nueva) {
      return { ok: false, motivo: 'argumentos_invalidos' };
    }

    const actual = await citaParaConfirmar(this.deps.citas, reservaId, context);
    if ('motivo' in actual) return { ok: false, motivo: actual.motivo };

    // El botón `RSAT` lleva la hora del salón (`YYYY-MM-DDTHH:mm`), como el
    // flujo de mover que ya existía: el manejador la vuelve a pasar a UTC.
    const p = getDatePartsInTz(nueva, process.env.SALON_TZ ?? 'America/Bogota');
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
