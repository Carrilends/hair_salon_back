import { TokenUsage } from './token-usage';

/** Rol de un mensaje del historial, en el lenguaje del dominio (no del proveedor). */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface MessageProps {
  role: MessageRole;
  content: string;
  /** Nombre de la herramienta, si `role = 'tool'`. */
  toolName?: string | null;
  /** Correlación con la llamada de herramienta del modelo. */
  toolCallId?: string | null;
  /** Consumo imputado a este mensaje (si se conoce). */
  usage?: TokenUsage | null;
}

/**
 * Mensaje del historial de una conversación. Objeto de valor: se conserva
 * completo para la trazabilidad y la tesis; la ventana que se envía al modelo se
 * calcula, no se recorta al guardar (ver `Conversation.window`).
 */
export class Message {
  readonly role: MessageRole;
  readonly content: string;
  readonly toolName: string | null;
  readonly toolCallId: string | null;
  readonly usage: TokenUsage | null;

  private constructor(props: MessageProps) {
    this.role = props.role;
    this.content = props.content;
    this.toolName = props.toolName ?? null;
    this.toolCallId = props.toolCallId ?? null;
    this.usage = props.usage ?? null;
  }

  static user(content: string): Message {
    return new Message({ role: 'user', content });
  }

  static assistant(
    content: string,
    opts?: { usage?: TokenUsage | null },
  ): Message {
    return new Message({
      role: 'assistant',
      content,
      usage: opts?.usage ?? null,
    });
  }

  static tool(
    content: string,
    opts: { toolName: string; toolCallId?: string | null },
  ): Message {
    return new Message({
      role: 'tool',
      content,
      toolName: opts.toolName,
      toolCallId: opts.toolCallId ?? null,
    });
  }

  static system(content: string): Message {
    return new Message({ role: 'system', content });
  }

  /** Rehidrata un mensaje persistido (usado por la infraestructura). */
  static fromPersistence(props: MessageProps): Message {
    return new Message(props);
  }
}
