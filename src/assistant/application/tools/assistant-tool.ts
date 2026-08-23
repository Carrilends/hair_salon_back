import { LlmToolDefinition } from '../../domain/ports/llm.port';

/** Contexto de ejecución que el bucle inyecta a cada herramienta en cada turno. */
export interface AssistantContext {
  /** Null si la conversación es anónima: `crearReserva` lo rechazará (A3). */
  userId: string | null;
  now: Date;
  /**
   * Rol de administración del solicitante autenticado. Sale SIEMPRE del JWT en el
   * borde HTTP, nunca de la conversación: ninguna instrucción escrita en el chat
   * puede fijarlo. Habilita la cancelación de administración de §6.4 (Fase 6).
   */
  isAdmin: boolean;
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
   * Si es true, el bucle surfacea el resultado (no de error) de esta herramienta
   * como dato estructurado en la respuesta, para que el widget lo pinte (una
   * propuesta de paquete, T7). Mantiene el bucle desacoplado del nombre concreto.
   */
  readonly presentable?: boolean;
  /**
   * Devuelve datos ya compactados: lo que retorne aquí se convierte en tokens de
   * entrada de la siguiente llamada. Cada campo de más se paga (§6.2).
   */
  execute(
    args: Record<string, unknown>,
    context: AssistantContext,
  ): Promise<unknown>;
}
