import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AssistantContext, AssistantTool } from './assistant-tool';
import { LlmToolDefinition } from '../../domain/ports/llm.port';
import { CreateReservationArgsDto } from './create-reservation-args.dto';
import { identidadParaCrear } from './create-reservation.tool';
import {
  ConfirmBookingPresentation,
  ConfirmCancelPresentation,
  ConfirmReschedulePresentation,
} from './assistant-presentation';
import { fechaYHoraEnPalabras } from '../salon-day';
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

function idDeReserva(args: Record<string, unknown>): string | null {
  return typeof args.reservaId === 'string' && args.reservaId.trim()
    ? args.reservaId.trim()
    : null;
}

/** `crearReserva` y `reservarPaquete` en WhatsApp. */
export class ProposeBookingTool implements AssistantTool {
  constructor(
    readonly name: string,
    readonly definition: LlmToolDefinition,
    private readonly deps: {
      pendientes: Pick<PendingBookingRepositoryPort, 'save'>;
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

    // Servicios que no existen se rechazan ya: el resumen que verá la clienta
    // tiene que nombrar lo que de verdad se va a reservar.
    const nombres = await this.deps.catalog.findNamesByIds(dto.serviciosIds);
    const servicios = dto.serviciosIds.map((id) => nombres.get(id));
    if (servicios.some((n) => !n)) {
      return { ok: false, motivo: 'servicio_invalido' };
    }

    const propuesta = await this.deps.pendientes.save({
      phoneE164: contacto.phone,
      customerName: contacto.name,
      serviceIds: dto.serviciosIds,
      scheduledAt: new Date(dto.fechaHoraIso),
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

  constructor(readonly definition: LlmToolDefinition) {
    this.name = definition.name;
  }

  async execute(
    args: Record<string, unknown>,
    context: AssistantContext,
  ): Promise<unknown> {
    if (context.canal !== 'whatsapp') return SOLO_WHATSAPP;
    const reservaId = idDeReserva(args);
    if (!reservaId) return { ok: false, motivo: 'argumentos_invalidos' };
    // Quién puede cancelar qué lo decide el dominio al pulsar el botón, con
    // el número firmado del que pulsa: aquí no se cancela nada.
    return {
      ok: true,
      estado: 'requiere_boton',
      reservaId,
      instruccion:
        'Todavía NO se canceló. Dile en una frase que confirme con el botón «Sí, cancelar».',
    };
  }

  presentar(result: unknown): ConfirmCancelPresentation | null {
    const r = result as { ok?: boolean; reservaId?: string };
    if (r?.ok !== true || !r.reservaId) return null;
    return { tipo: 'confirmar-cancelacion', reservaId: r.reservaId };
  }
}

/** `reprogramarReserva` en WhatsApp: el botón será `RSAT|<cita>|<hora local>`. */
export class ProposeRescheduleTool implements AssistantTool {
  readonly name: string;

  constructor(readonly definition: LlmToolDefinition) {
    this.name = definition.name;
  }

  async execute(
    args: Record<string, unknown>,
    context: AssistantContext,
  ): Promise<unknown> {
    if (context.canal !== 'whatsapp') return SOLO_WHATSAPP;
    const reservaId = idDeReserva(args);
    const nueva =
      typeof args.nuevaFecha === 'string' ? new Date(args.nuevaFecha) : null;
    if (!reservaId || !nueva || Number.isNaN(nueva.getTime())) {
      return { ok: false, motivo: 'argumentos_invalidos' };
    }

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
    };
    if (r?.ok !== true || !r.reservaId || !r.cuandoLocal) return null;
    return {
      tipo: 'confirmar-cambio',
      reservaId: r.reservaId,
      cuandoLocal: r.cuandoLocal,
      fecha: r.fecha ?? '',
      hora: r.hora ?? '',
    };
  }
}
