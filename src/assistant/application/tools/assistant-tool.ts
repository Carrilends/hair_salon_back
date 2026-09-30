import { LlmToolDefinition } from '../../domain/ports/llm.port';
import { MensajeReciente } from '../screening/turn-screen';
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
  /**
   * `true` **solo** cuando quien ejecuta la herramienta es el bucle del
   * asistente. Los otros adaptadores primarios —servidor MCP, webhook de
   * WhatsApp, tarea programada— lo dejan sin poner.
   *
   * Es lo que autoriza las salvaguardas del canal conversacional (plan 04:
   * verificación previa a reservar y reordenación por relevancia). Se marca
   * explícitamente y no se deduce de que `recientes` venga vacío: el día que
   * otro adaptador rellene ese campo, la salvaguarda del chat se le impondría
   * también a él, y el caso de uso de Reservas lo comparten cinco adaptadores.
   */
  canalConversacional?: boolean;
  /**
   * Últimos mensajes de la conversación, los más viejos primero. Lo rellena
   * **solo** el bucle del asistente; los otros adaptadores primarios —MCP,
   * webhook de WhatsApp, cron— no tienen conversación y lo dejan sin poner.
   *
   * Existe para la verificación de correspondencia previa a crear una reserva
   * (plan 04, T5): sin historial no hay con qué comparar lo que se va a
   * reservar, y esa salvaguarda es del canal conversacional, no una regla que
   * se le imponga a los demás.
   */
  recientes?: MensajeReciente[];
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
