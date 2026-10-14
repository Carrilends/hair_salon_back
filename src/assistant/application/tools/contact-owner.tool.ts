import { Logger } from '@nestjs/common';
import { AssistantContext, AssistantTool } from './assistant-tool';
import { LlmToolDefinition } from '../../domain/ports/llm.port';
import { OwnerContactPort } from '../../domain/ports/owner-contact.port';
import { EnfriamientoPorNumero } from '../enfriamiento-por-numero';

/** Un aviso por número cada seis horas (D8). */
export const ENFRIAMIENTO_CONTACTO_MS = 6 * 60 * 60 * 1000;

/** Lo que se le dice cuando no se pudo avisar (D15): sin inventar datos. */
const SIN_AVISO = {
  ok: false,
  motivo: 'sin_aviso',
  pregunta:
    'Ahora mismo no pude avisarle a la dueña. ¿Te ayudo yo con lo que necesitas, o prefieres intentarlo más tarde?',
} as const;

/**
 * `hablarConLaDuena` (plan 06, F6): la clienta pide hablar con una persona y la
 * dueña recibe un aviso con su nombre, su número y el motivo, y la contacta
 * desde su móvil (vía (a)). No toca la agenda.
 *
 * Solo para la clienta por WhatsApp: el número que viaja es el del contexto
 * (firmado por Meta), nunca uno que escriba el modelo, y la dueña no se avisa
 * a sí misma. Fuera de `ASSISTANT_TOOLS`, así que ni la web ni MCP la ven.
 */
export class ContactOwnerTool implements AssistantTool {
  readonly name = 'hablarConLaDuena';
  private readonly logger = new Logger(ContactOwnerTool.name);

  readonly definition: LlmToolDefinition = {
    name: this.name,
    description:
      'Avisa a la dueña del salón de que esta clienta quiere hablar con una persona: le llegan su nombre, su número de WhatsApp y el motivo, y ella le escribe desde su móvil. Úsala cuando la clienta lo pida o cuando no puedas resolver lo que necesita.',
    parameters: {
      type: 'object',
      properties: {
        motivo: {
          type: 'string',
          description: 'En una frase, qué necesita la clienta.',
        },
        nombre: {
          type: 'string',
          description: 'Nombre de la clienta, si lo dijo. No lo inventes.',
        },
      },
      required: ['motivo'],
      additionalProperties: false,
    },
  };

  constructor(
    private readonly contacto: OwnerContactPort,
    private readonly enfriamiento: EnfriamientoPorNumero,
  ) {}

  async execute(
    args: Record<string, unknown>,
    context: AssistantContext,
  ): Promise<unknown> {
    const numero = context.phoneE164;
    if (context.canal !== 'whatsapp' || context.isAdmin || !numero) {
      return { ok: false, motivo: 'solo_clientas_whatsapp' };
    }
    const motivo = typeof args.motivo === 'string' ? args.motivo.trim() : '';
    if (!motivo) {
      return {
        ok: false,
        motivo: 'argumentos_invalidos',
        pregunta: '¿Qué le digo a la dueña que necesitas?',
      };
    }
    const nombre =
      typeof args.nombre === 'string' && args.nombre.trim()
        ? args.nombre.trim()
        : null;

    if (!this.enfriamiento.puede(numero, context.now)) {
      return { ok: true, yaAvisada: true };
    }

    try {
      const r = await this.contacto.avisar({
        nombre,
        telefonoE164: numero,
        motivo,
      });
      if (r === 'sin_configurar') return SIN_AVISO;
      // Solo se anota lo que salió: un fallo no la deja seis horas esperando.
      this.enfriamiento.anotar(numero, context.now);
      return { ok: true, avisada: true };
    } catch (error) {
      this.logger.error(
        `No se pudo avisar a la dueña por ${numero}`,
        error as Error,
      );
      return SIN_AVISO;
    }
  }
}
