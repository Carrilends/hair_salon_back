import { Logger } from '@nestjs/common';
import { AssistantContext, AssistantTool } from './assistant-tool';
import { LlmToolDefinition } from '../../domain/ports/llm.port';
import { ConfirmAbsencePresentation } from './assistant-presentation';
import { esLaDuenaPorWhatsApp } from './view-agenda.tool';
import {
  fechaYFranja,
  lineaDeVistaPrevia,
  resumenDeImpactos,
} from './ausencia-en-palabras';
import { PendingAbsenceRepositoryPort } from '../../domain/ports/pending-absence-repository.port';
import { PENDING_BOOKING_TTL_MINUTES } from '../../domain/pending-booking';
import { AbsencePlan } from 'src/reservations/application/absences/absence-planner';
import { AbsenceCommand } from 'src/reservations/application/absences/preview-absence.use-case';
import {
  AbsenceOverlapError,
  DefaultWorkerAbsenceError,
  InvalidAbsenceError,
  WorkerNotFoundError,
} from 'src/reservations/domain/errors';

/** Lo mínimo de una estilista para encontrarla por nombre (`WorkersService.findAll`). */
export interface EstilistaPorNombre {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface EstilistasDelSalon {
  findAll(): Promise<EstilistaPorNombre[]>;
}

/** `PreviewAbsenceUseCase`: qué pasaría con cada cita, sin guardar nada. */
export interface VistaPreviaDeAusencia {
  execute(cmd: AbsenceCommand): Promise<AbsencePlan>;
}

const SOLO_DUENA = { ok: false, motivo: 'solo_duena' } as const;
const ARGUMENTOS_INVALIDOS = {
  ok: false,
  motivo: 'argumentos_invalidos',
} as const;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^\d{2}:\d{2}$/;
/** Un nombre de estilista no es un párrafo: lo que pase de aquí no es un nombre. */
const MAX_NOMBRE = 60;

/**
 * Las líneas de la vista previa viajan por identidad de objeto, solo para la
 * presentación: llevan nombres de clientas y el modelo no las necesita (cada
 * campo que vuelve al modelo se paga en tokens, §6.2).
 */
const lineasDe = new WeakMap<object, string[]>();

/** Sin mayúsculas, sin tildes y con los espacios juntos. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * La estilista que la dueña nombró: exacta o, si no, por prefijo único. La de
 * por defecto no cuenta (no se puede ausentar). Con varias, se devuelven para
 * que el modelo pregunte; nunca se elige una al azar.
 */
function resolverEstilista(
  nombre: string,
  todas: EstilistaPorNombre[],
):
  | { estilista: EstilistaPorNombre }
  | { motivo: 'estilista_ambigua'; opciones: string[] }
  | { motivo: 'estilista_no_encontrada'; estilistas: string[] } {
  const candidatas = todas.filter((w) => !w.isDefault);
  const buscado = normalizar(nombre);
  const exactas = candidatas.filter((w) => normalizar(w.name) === buscado);
  if (exactas.length === 1) return { estilista: exactas[0] };
  const porPrefijo = exactas.length
    ? exactas
    : candidatas.filter((w) => normalizar(w.name).startsWith(buscado));
  if (porPrefijo.length === 1) return { estilista: porPrefijo[0] };
  if (porPrefijo.length > 1) {
    return {
      motivo: 'estilista_ambigua',
      opciones: porPrefijo.map((w) => w.name),
    };
  }
  return {
    motivo: 'estilista_no_encontrada',
    estilistas: candidatas.map((w) => w.name),
  };
}

/** Los errores del dominio, en motivos que el modelo sabe explicar. */
export function motivoDeAusencia(error: unknown): string {
  if (error instanceof AbsenceOverlapError) return 'ausencia_cruzada';
  if (error instanceof InvalidAbsenceError) return 'ausencia_invalida';
  // La de por defecto no se le ofrece a la dueña: para ella es «no existe».
  if (
    error instanceof WorkerNotFoundError ||
    error instanceof DefaultWorkerAbsenceError
  ) {
    return 'estilista_no_encontrada';
  }
  return 'error_desconocido';
}

/** «Ausencia no válida: esa franja ya pasó» → «esa franja ya pasó». */
function detalleDe(error: InvalidAbsenceError): string {
  return error.message.replace(/^Ausencia no válida:\s*/, '');
}

const INSTRUCCION_DE_MOTIVO: Record<string, string> = {
  ausencia_cruzada:
    'No se preparó nada. Dile que esa estilista ya tiene una ausencia que se cruza con esa franja (verAusencias la muestra).',
  ausencia_invalida:
    'No se preparó nada. Explícale el detalle en palabras simples y pregúntale el día o las horas otra vez.',
  estilista_no_encontrada:
    'No se preparó nada. Dile que no encuentras esa estilista y pregúntale cuál es, con los nombres de estilistas.',
  estilista_ambigua: 'No se preparó nada. Pregúntale cuál de las opciones es.',
  error_desconocido:
    'No se preparó nada. Dile que no pudiste prepararla y que lo intente de nuevo o la marque desde el portal.',
};

/**
 * `marcarAusencia` (2026-11-11): la dueña dice por WhatsApp que una estilista
 * no viene y el asistente **prepara** la ausencia. Hace la vista previa con el
 * mismo caso de uso que el panel, guarda la propuesta y la presenta con los
 * botones «Confirmar» y «Descartar». **No aplica nada**: aplicar puede cancelar
 * citas, así que lo hace el botón (`ABS_OK`), nunca el modelo.
 *
 * Solo existe en el juego de la dueña de WhatsApp y además exige serlo: si
 * algún día se le ofreciera a otro rol por error, no prepararía nada.
 */
export class MarkAbsenceTool implements AssistantTool {
  readonly name = 'marcarAusencia';

  private readonly logger = new Logger(MarkAbsenceTool.name);

  readonly definition: LlmToolDefinition = {
    name: this.name,
    description:
      'Prepara la ausencia de una estilista (no viene todo el día o unas horas) y enseña qué pasará con sus citas: pasan a otra estilista libre o se cancelan. NO la aplica: la dueña la confirma con un botón. Sin desde y hasta, es todo el día.',
    parameters: {
      type: 'object',
      properties: {
        estilista: {
          type: 'string',
          description: 'Nombre de la estilista, como lo dijo la dueña.',
        },
        fecha: {
          type: 'string',
          description: 'Día de la ausencia, YYYY-MM-DD (hora de Colombia).',
        },
        desde: {
          type: 'string',
          description:
            'Hora de inicio, HH:mm en punto o y media. Solo si no es todo el día, y siempre con hasta.',
        },
        hasta: {
          type: 'string',
          description:
            'Hora de fin, HH:mm en punto o y media. Solo si no es todo el día, y siempre con desde.',
        },
      },
      required: ['estilista', 'fecha'],
      additionalProperties: false,
    },
  };

  constructor(
    private readonly deps: {
      estilistas: EstilistasDelSalon;
      vistaPrevia: VistaPreviaDeAusencia;
      pendientes: Pick<
        PendingAbsenceRepositoryPort,
        'save' | 'supersedeActiveFor'
      >;
    },
  ) {}

  async execute(
    args: Record<string, unknown>,
    context: AssistantContext,
  ): Promise<unknown> {
    if (!esLaDuenaPorWhatsApp(context)) return SOLO_DUENA;

    const { estilista, fecha, desde, hasta } = args;
    if (
      typeof estilista !== 'string' ||
      !estilista.trim() ||
      estilista.length > MAX_NOMBRE ||
      typeof fecha !== 'string' ||
      !FECHA.test(fecha) ||
      (desde !== undefined &&
        (typeof desde !== 'string' || !HORA.test(desde))) ||
      (hasta !== undefined && (typeof hasta !== 'string' || !HORA.test(hasta)))
    ) {
      return ARGUMENTOS_INVALIDOS;
    }

    try {
      const elegida = resolverEstilista(
        estilista,
        await this.deps.estilistas.findAll(),
      );
      if ('motivo' in elegida) {
        return {
          ok: false,
          ...elegida,
          instruccion: INSTRUCCION_DE_MOTIVO[elegida.motivo],
        };
      }

      const plan = await this.deps.vistaPrevia.execute({
        workerId: elegida.estilista.id,
        dateYmd: fecha,
        ...(desde !== undefined ? { from: desde as string } : {}),
        ...(hasta !== undefined ? { to: hasta as string } : {}),
      });

      // Una sola propuesta viva por número: la nueva anula las anteriores, así
      // que «Confirmar» en un mensaje viejo ya no aplica otra ausencia.
      await this.deps.pendientes.supersedeActiveFor(
        context.phoneE164!,
        context.now,
      );
      const propuesta = await this.deps.pendientes.save({
        phoneE164: context.phoneE164!,
        workerId: plan.workerId,
        startsAt: plan.startsAt,
        endsAt: plan.endsAt,
        expiresAt: new Date(
          context.now.getTime() + PENDING_BOOKING_TTL_MINUTES * 60_000,
        ),
      });

      const resultado = {
        ok: true,
        estado: 'requiere_boton',
        propuestaId: propuesta.id,
        estilista: plan.workerName,
        ...fechaYFranja(plan.startsAt, plan.endsAt),
        resumen: resumenDeImpactos(plan.impacts),
        instruccion:
          'La ausencia TODAVÍA NO está marcada y ninguna cita se ha movido ni cancelado. Dile en una frase que revise el resumen y pulse «Confirmar» en el mensaje con botones, o «Descartar». No digas que ya quedó hecho.',
      };
      lineasDe.set(resultado, plan.impacts.map(lineaDeVistaPrevia));
      return resultado;
    } catch (error) {
      const motivo = motivoDeAusencia(error);
      if (motivo === 'error_desconocido') {
        this.logger.error(
          'No se pudo preparar una ausencia por WhatsApp',
          error as Error,
        );
      }
      return {
        ok: false,
        motivo,
        ...(error instanceof InvalidAbsenceError
          ? { detalle: detalleDe(error) }
          : {}),
        instruccion: INSTRUCCION_DE_MOTIVO[motivo],
      };
    }
  }

  presentar(result: unknown): ConfirmAbsencePresentation | null {
    const r = result as {
      ok?: boolean;
      propuestaId?: string;
      estilista?: string;
      fecha?: string;
      franja?: string;
      resumen?: string;
    };
    if (r?.ok !== true || !r.propuestaId) return null;
    return {
      tipo: 'confirmar-ausencia',
      propuestaId: r.propuestaId,
      estilista: r.estilista ?? '',
      fecha: r.fecha ?? '',
      franja: r.franja ?? '',
      resumen: r.resumen ?? '',
      lineas: lineasDe.get(result as object) ?? [],
    };
  }
}
