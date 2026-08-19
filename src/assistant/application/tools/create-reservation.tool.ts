import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AssistantContext, AssistantTool } from './assistant-tool';
import { LlmToolDefinition } from '../../domain/ports/llm.port';
import { CreateReservationArgsDto } from './create-reservation-args.dto';
import {
  DomainError,
  DuplicateServicesError,
  EmptyServicesError,
  InvalidReservationError,
  MissingContactError,
  OutOfBusinessHoursError,
  ReservationInThePastError,
  WorkerOverlapError,
} from 'src/reservations/domain/errors';

/**
 * Contrato mínimo del caso de uso real de Reservas (A6). Se tipa como interfaz,
 * en vez de importar la clase, para no arrastrar sus dependencias de Nest a la
 * capa de aplicación del asistente ni acoplarse a su firma completa.
 */
export interface CreateReservationExecutor {
  execute(command: {
    scheduledAt: string;
    serviceIds: string[];
    userId?: string | null;
  }): Promise<{ id?: string; status: string }>;
}

/**
 * `crearReserva`: la única herramienta que escribe. Materializa A3 (sin sesión
 * no reserva) y A6 (delega en el caso de uso real, que valida horario,
 * solapamiento y estados). Los fallos previsibles vuelven como **resultado**, no
 * como excepción: así el modelo puede ofrecer una alternativa en vez de que el
 * turno reviente, y `motivo: 'hora_ocupada'` cuesta menos tokens que un error.
 */
export class CreateReservationTool implements AssistantTool {
  readonly name = 'crearReserva';

  readonly definition: LlmToolDefinition = {
    name: this.name,
    description:
      'Crea una reserva para la clienta con sesión iniciada, en la fecha y servicios indicados.',
    parameters: {
      type: 'object',
      properties: {
        fechaHoraIso: {
          type: 'string',
          description: 'Fecha y hora de inicio en ISO 8601',
        },
        serviciosIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs de los servicios a reservar',
        },
      },
      required: ['fechaHoraIso', 'serviciosIds'],
      additionalProperties: false,
    },
  };

  constructor(private readonly createReservation: CreateReservationExecutor) {}

  async execute(
    args: Record<string, unknown>,
    context: AssistantContext,
  ): Promise<unknown> {
    // A3: sin sesión no se reserva. Se devuelve como resultado (no excepción)
    // para que el modelo lo explique con sus palabras e invite a iniciar sesión.
    if (!context.userId) {
      return { ok: false, motivo: 'sesion_requerida' };
    }

    const dto = plainToInstance(CreateReservationArgsDto, args);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length > 0) {
      return {
        ok: false,
        motivo: 'argumentos_invalidos',
        detalle: errors.map((e) => e.property),
      };
    }

    try {
      // A6: el caso de uso real. El asistente no es una vía privilegiada.
      const reservation = await this.createReservation.execute({
        scheduledAt: dto.fechaHoraIso,
        serviceIds: dto.serviciosIds,
        userId: context.userId,
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

/** Traduce los errores de dominio de Reservas a motivos cortos y legibles. */
export function mapDomainErrorToReason(error: unknown): string {
  if (error instanceof WorkerOverlapError) return 'hora_ocupada';
  if (error instanceof OutOfBusinessHoursError) return 'fuera_de_horario';
  if (error instanceof ReservationInThePastError) return 'fecha_pasada';
  if (error instanceof DuplicateServicesError) return 'servicios_duplicados';
  if (error instanceof EmptyServicesError) return 'sin_servicios';
  if (error instanceof MissingContactError) return 'contacto_requerido';
  if (error instanceof InvalidReservationError) return 'servicio_invalido';
  if (error instanceof DomainError) return 'no_disponible';
  return 'error_desconocido';
}
