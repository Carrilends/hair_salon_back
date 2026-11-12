import { AssistantContext, AssistantTool } from './assistant-tool';
import { LlmToolDefinition } from '../../domain/ports/llm.port';
import { esLaDuenaPorWhatsApp } from './view-agenda.tool';
import { fechaYFranja } from './ausencia-en-palabras';

/** Lo mínimo de `ListAbsencesUseCase` (ausencias en curso o futuras). */
export interface AusenciasProximas {
  execute(): Promise<{ workerName: string; startsAt: Date; endsAt: Date }[]>;
}

/** Tope de ausencias por respuesta: lo que se devuelve se paga en tokens (§6.2). */
const MAX_AUSENCIAS = 15;

/**
 * `verAusencias` (2026-11-11): las ausencias de hoy en adelante, para la dueña
 * por WhatsApp. Devuelve texto ya escrito («Ana: jueves, 12 de noviembre de
 * 2026, todo el día») y sin ids: quitar una ausencia se hace solo desde el
 * panel, así que el modelo no los necesita.
 */
export class ViewAbsencesTool implements AssistantTool {
  readonly name = 'verAusencias';

  readonly definition: LlmToolDefinition = {
    name: this.name,
    description:
      'Devuelve las ausencias de las estilistas de hoy en adelante: quién, qué día y si es todo el día o unas horas. Quitar una ausencia se hace solo desde el portal.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
  };

  constructor(private readonly listar: AusenciasProximas) {}

  async execute(
    _args: Record<string, unknown>,
    context: AssistantContext,
  ): Promise<unknown> {
    if (!esLaDuenaPorWhatsApp(context)) {
      return { ok: false, motivo: 'solo_duena' };
    }
    const todas = await this.listar.execute();
    if (todas.length === 0) {
      return {
        ok: true,
        ausencias: [],
        nota: 'No hay ausencias registradas de hoy en adelante.',
      };
    }
    return {
      ok: true,
      ausencias: todas.slice(0, MAX_AUSENCIAS).map((a) => {
        const { fecha, franja } = fechaYFranja(a.startsAt, a.endsAt);
        return `${a.workerName}: ${fecha}, ${franja}`;
      }),
      ...(todas.length > MAX_AUSENCIAS ? { hayMas: true } : {}),
    };
  }
}
