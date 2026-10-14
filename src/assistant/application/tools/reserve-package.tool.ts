import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AssistantContext, AssistantTool } from './assistant-tool';
import { LlmToolDefinition } from '../../domain/ports/llm.port';
import { CreateReservationArgsDto } from './create-reservation-args.dto';
import {
  CreateReservationExecutor,
  identidadParaCrear,
  mapDomainErrorToReason,
} from './create-reservation.tool';

/**
 * `reservarPaquete`: **escritura**. Recibe la lista explícita `serviciosIds` (la
 * que devolvió `componerPaquete`) y la fecha, y crea **UNA** reserva con varias
 * líneas de una vez (P4), delegando en el caso de uso real de Reservas (A6): todas
 * las validaciones —sesión, horario, solapamiento— son las de siempre. Exigir
 * `serviciosIds` explícitos es la garantía real de los dos pasos: el modelo no
 * puede reservar un paquete que no haya compuesto y enumerado antes.
 */
export class ReservePackageTool implements AssistantTool {
  readonly name = 'reservarPaquete';

  readonly definition: LlmToolDefinition = {
    name: this.name,
    description:
      'Reserva un paquete ya compuesto: crea UNA reserva con todos sus servicios.',
    parameters: {
      type: 'object',
      properties: {
        serviciosIds: {
          type: 'array',
          items: { type: 'string' },
          description:
            'IDs de los servicios del paquete (los de componerPaquete)',
        },
        fechaHoraIso: {
          type: 'string',
          description: 'Fecha y hora de inicio en ISO 8601',
        },
      },
      required: ['serviciosIds', 'fechaHoraIso'],
      additionalProperties: false,
    },
  };

  constructor(private readonly createReservation: CreateReservationExecutor) {}

  async execute(
    args: Record<string, unknown>,
    context: AssistantContext,
  ): Promise<unknown> {
    // En WhatsApp el modelo no escribe (plan 06, D4): allí esta herramienta
    // se sustituye por una que propone y deja la escritura a un botón. Si
    // algún día se cablease por error, se niega igual.
    if (context.canal === 'whatsapp') {
      return { ok: false, motivo: 'requiere_boton' };
    }

    // Misma identidad que `crearReserva` (plan 06, F3b).
    const identidad = identidadParaCrear(args, context);
    if ('motivo' in identidad) return { ok: false, ...identidad };

    // Misma validación de formato que `crearReserva` (fecha ISO, IDs UUID, al
    // menos uno): rechaza argumentos malformados con un motivo limpio y barato,
    // antes de tocar el caso de uso.
    const dto = plainToInstance(CreateReservationArgsDto, identidad.resto);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length > 0) {
      return { ok: false, motivo: 'argumentos_invalidos' };
    }

    try {
      // A6: el paquete es UNA reserva con varias líneas. El asistente no es una vía
      // privilegiada; el caso de uso valida horario y solapamiento sobre el total.
      const reservation = await this.createReservation.execute({
        scheduledAt: dto.fechaHoraIso,
        serviceIds: dto.serviciosIds,
        ...identidad.quien,
      });
      return {
        ok: true,
        reservaId: reservation.id,
        estado: reservation.status,
      };
    } catch (error) {
      return { ok: false, motivo: mapDomainErrorToReason(error) };
    }
  }
}
