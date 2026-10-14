import { Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AssistantContext, AssistantTool } from './assistant-tool';
import { LlmToolDefinition } from '../../domain/ports/llm.port';
import { JudgmentPort } from '../../domain/ports/judgment.port';
import { ServiceCatalogQueryPort } from '../../domain/ports/service-catalog-query.port';
import { CreateReservationArgsDto } from './create-reservation-args.dto';
import { ModoDeJuicio } from '../judgment-settings';
import { fechaYHoraEnPalabras } from '../salon-day';
import { verificarReservaPropuesta } from '../screening/verify-reservation';
import { contactoDeWhatsApp, numeroReservable } from './identidad';
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
    /** Solo desde WhatsApp (plan 06, D3): nombre dado + número firmado. */
    contact?: { name: string; phone: string } | null;
  }): Promise<{ id?: string; status: string }>;
}

/**
 * Lo que hace falta para verificar la correspondencia antes de crear (plan 04,
 * T5). Es **opcional** en el constructor: sin ella la herramienta se comporta
 * exactamente como antes, que es lo que necesitan el servidor MCP y las pruebas
 * que no miran esto.
 */
export interface VerificacionDeReserva {
  judge: JudgmentPort;
  modo: ModoDeJuicio;
  catalog: Pick<ServiceCatalogQueryPort, 'findNamesByIds'>;
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

  private readonly logger = new Logger(CreateReservationTool.name);

  constructor(
    private readonly createReservation: CreateReservationExecutor,
    private readonly verificacion?: VerificacionDeReserva,
  ) {}

  async execute(
    args: Record<string, unknown>,
    context: AssistantContext,
  ): Promise<unknown> {
    // A3: sin sesión no se reserva. Se devuelve como resultado (no excepción)
    // para que el modelo lo explique con sus palabras e invite a iniciar sesión.
    // Identidad: en la web, la sesión; en WhatsApp, el número firmado más el
    // nombre que dio la clienta (plan 06, D3/D5). `nombre` se aparta antes de
    // validar: solo existe en la definición de WhatsApp, y en la web sigue
    // siendo un argumento que sobra.
    const identidad = identidadParaCrear(args, context);
    if ('motivo' in identidad) return { ok: false, ...identidad };

    const dto = plainToInstance(CreateReservationArgsDto, identidad.resto);
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

    // Verificación de correspondencia (plan 04, T5), DESPUÉS de los dos
    // rechazos que el código resuelve solo: no se paga un juicio —ni la
    // consulta de nombres que lo prepara— por una petición ya rechazada.
    const verificacion = this.verificacion;
    // Las cuatro condiciones se comprueban ANTES de preparar la pregunta,
    // porque prepararla cuesta una consulta a la base: que la colocación
    // exista, que no esté apagada, que quien ejecuta sea el canal
    // conversacional —esta salvaguarda es suya y no se le impone al servidor
    // MCP ni al webhook— y que haya conversación con la que comparar.
    if (
      verificacion &&
      verificacion.modo !== 'off' &&
      context.canalConversacional === true &&
      (context.recientes?.length ?? 0) > 0
    ) {
      const propuesta = await this.propuestaEnPalabras(
        dto,
        verificacion.catalog,
      );
      const veredicto = await verificarReservaPropuesta({
        judge: verificacion.judge,
        modo: verificacion.modo,
        servicios: propuesta.servicios,
        fecha: propuesta.fecha,
        hora: propuesta.hora,
        recientes: context.recientes,
      });
      if (veredicto.prob !== null) {
        // Queda registrado siempre, también en sombra: el registro es
        // justamente lo que permite calibrar el umbral con turnos reales.
        this.logger.log(
          `Juicio previo a reservar: ${veredicto.prob} (${verificacion.modo}, ${veredicto.ms} ms)` +
            `${veredicto.habriaFrenado ? ' — habría pedido confirmación' : ''}`,
        );
      }
      if (!veredicto.permitir) {
        // No cancela nada: convierte la duda en una pregunta. La propuesta
        // viaja para que el modelo la lea tal cual en vez de inventarla, y la
        // instrucción va en el resultado —y no en el prefijo de sistema—
        // porque así la pagan solo los turnos que la necesitan.
        //
        // La instrucción PROHÍBE expresamente reintentar en el mismo turno: si
        // el modelo vuelve a llamar, la caché del bucle le devuelve esto mismo,
        // la vuelta no trae novedad y el turno se cortaría. Y `pregunta` es la
        // red para cuando lo haga de todos modos: el bucle la usa como
        // respuesta antes que disculparse (ver `preguntaPendiente`).
        return {
          ok: false,
          motivo: 'confirmacion_requerida',
          propuesta,
          pregunta: preguntaDeConfirmacion(propuesta),
          instruccion:
            'Lee la propuesta a la clienta y espera su respuesta. NO vuelvas a llamar crearReserva en este mismo turno; hazlo solo cuando ella confirme en su próximo mensaje.',
        };
      }
    }

    try {
      // A6: el caso de uso real. El asistente no es una vía privilegiada.
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

  /**
   * La reserva propuesta **en palabras**: los nombres de los servicios y el día
   * y la hora del salón como se dirían en voz alta. La clienta habla de «un
   * corte el viernes», nunca de un UUID en UTC.
   *
   * Si el catálogo no contesta se devuelven los nombres que se tengan (o
   * ninguno) y el juicio se queda sin preguntar: fail-open también aquí, porque
   * una consulta de nombres que revienta no puede costarle la reserva a la
   * clienta.
   */
  private async propuestaEnPalabras(
    dto: CreateReservationArgsDto,
    catalog: VerificacionDeReserva['catalog'],
  ): Promise<{ servicios: string[]; fecha: string; hora: string }> {
    const { fecha, hora } = fechaYHoraEnPalabras(dto.fechaHoraIso);
    let servicios: string[] = [];
    try {
      const nombres = await catalog.findNamesByIds(dto.serviciosIds);
      servicios = dto.serviciosIds
        .map((id) => nombres.get(id))
        .filter((nombre): nombre is string => Boolean(nombre));
    } catch (error) {
      this.logger.warn(
        `No se pudieron leer los nombres de los servicios: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    return { servicios, fecha, hora };
  }
}

/**
 * La frase que hay que decirle a la clienta cuando la verificación duda. La
 * escribe la herramienta porque es la única que conoce el dato; el bucle solo
 * decide cuándo hace falta.
 */
function preguntaDeConfirmacion({
  servicios,
  fecha,
  hora,
}: {
  servicios: string[];
  fecha: string;
  hora: string;
}): string {
  const lista = servicios.length ? servicios.join(' y ') : 'el servicio';
  const cuando = [fecha && `el ${fecha}`, hora && `a las ${hora}`]
    .filter(Boolean)
    .join(' ');
  return `Antes de reservar, confírmame: ¿te agendo ${lista}${
    cuando ? ` ${cuando}` : ''
  }?`;
}

/**
 * Quién crea y con qué argumentos se valida (plan 06, F3b). Compartido por
 * `crearReserva` y `reservarPaquete`.
 *
 * - Web: hace falta sesión; `nombre` no es un argumento (la validación lo
 *   rechazará como sobrante, como siempre).
 * - WhatsApp: solo la clienta (la dueña no crea, D6), con `nombre` obligatorio;
 *   la reserva nace sin usuario y con contacto `{nombre, número firmado}`.
 */
export function identidadParaCrear(
  args: Record<string, unknown>,
  context: AssistantContext,
):
  | {
      quien:
        | { userId: string }
        | { userId: null; contact: { name: string; phone: string } };
      resto: Record<string, unknown>;
    }
  | { motivo: string; pregunta?: string } {
  if (context.canal !== 'whatsapp') {
    if (!context.userId) return { motivo: 'sesion_requerida' };
    return { quien: { userId: context.userId }, resto: args };
  }
  if (context.isAdmin) return { motivo: 'solo_clientas' };
  if (!numeroReservable(context)) return { motivo: 'numero_no_soportado' };
  const { nombre, ...resto } = args;
  const contacto = contactoDeWhatsApp(context, nombre);
  if (!contacto) {
    return {
      motivo: 'nombre_requerido',
      pregunta:
        '¿A nombre de quién dejo la reserva? Solo el nombre, sin números ni signos.',
    };
  }
  return { quien: { userId: null, contact: contacto }, resto };
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
