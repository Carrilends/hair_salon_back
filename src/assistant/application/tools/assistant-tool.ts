import { LlmToolDefinition } from '../../domain/ports/llm.port';
import { AssistantPresentation } from './assistant-presentation';

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
   * Traduce el resultado de `execute` al dato tipado que el widget pinta, o
   * `null` si este resultado no se presenta (un error, o simplemente nada que
   * enseñar). Opcional: la mayoría de las herramientas no pintan nada.
   *
   * Es un método aparte y no un campo del retorno de `execute` por una razón
   * concreta: estas mismas nueve herramientas las ejecuta también el servidor
   * MCP, que no sabe nada de tarjetas. Cambiar el tipo de retorno de `execute`
   * le habría llegado a él; añadir un método que solo llama el bucle del
   * asistente, no.
   *
   * Puede consultar lo que necesite para enriquecer la tarjeta (imágenes, por
   * ejemplo): lo que devuelva NO viaja al modelo, así que no cuesta tokens.
   */
  presentar?(
    result: unknown,
  ): AssistantPresentation | null | Promise<AssistantPresentation | null>;
  /**
   * Devuelve datos ya compactados: lo que retorne aquí se convierte en tokens de
   * entrada de la siguiente llamada. Cada campo de más se paga (§6.2).
   */
  execute(
    args: Record<string, unknown>,
    context: AssistantContext,
  ): Promise<unknown>;
}
