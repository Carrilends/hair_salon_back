import { LlmToolDefinition } from '../../domain/ports/llm.port';

/** Contexto de ejecución que el bucle inyecta a cada herramienta en cada turno. */
export interface AssistantContext {
  /** Null si la conversación es anónima: `crearReserva` lo rechazará (A3). */
  userId: string | null;
  now: Date;
}

/**
 * Contrato común de herramienta. Las implementaciones son **fachadas delgadas**
 * sobre los casos de uso ya existentes de Reservas (A6): si una herramienta
 * contiene lógica de negocio, algo se hizo mal.
 */
export interface AssistantTool {
  readonly name: string;
  readonly definition: LlmToolDefinition;
  /**
   * Devuelve datos ya compactados: lo que retorne aquí se convierte en tokens de
   * entrada de la siguiente llamada. Cada campo de más se paga (§6.2).
   */
  execute(
    args: Record<string, unknown>,
    context: AssistantContext,
  ): Promise<unknown>;
}
