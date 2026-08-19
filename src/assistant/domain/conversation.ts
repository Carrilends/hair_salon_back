import { Message } from './message';
import { TokenUsage } from './token-usage';
import { BudgetExceededError } from './errors';

export interface ConversationProps {
  id?: string;
  userId?: string | null;
  summary?: string | null;
  messages?: Message[];
  usage?: TokenUsage;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Raíz de agregado del asistente. Guarda el historial completo y encapsula las
 * dos reglas que protegen el bolsillo (§6.2, D4): la **ventana** de mensajes que
 * viaja al modelo y el **presupuesto** de mensajes por conversación (A7). Puro:
 * sin dependencias de framework, base de datos ni proveedor de IA.
 */
export class Conversation {
  readonly id?: string;
  readonly userId: string | null;
  private _summary: string | null;
  private readonly _messages: Message[];
  private _usage: TokenUsage;
  readonly createdAt?: Date;
  updatedAt?: Date;

  private constructor(props: ConversationProps) {
    this.id = props.id;
    this.userId = props.userId ?? null;
    this._summary = props.summary ?? null;
    this._messages = props.messages ?? [];
    this._usage = props.usage ?? TokenUsage.zero();
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /** Inicia una conversación nueva. `userId` null ⇒ anónima: solo consulta (A3). */
  static start(props: { userId?: string | null }): Conversation {
    return new Conversation({ userId: props.userId ?? null });
  }

  /** Rehidrata una conversación persistida (usado por el repositorio). */
  static fromPersistence(props: ConversationProps): Conversation {
    return new Conversation(props);
  }

  get summary(): string | null {
    return this._summary;
  }

  /** Copia defensiva: el historial no se muta desde fuera. */
  get messages(): Message[] {
    return [...this._messages];
  }

  get messageCount(): number {
    return this._messages.length;
  }

  get usage(): TokenUsage {
    return this._usage;
  }

  append(message: Message): void {
    this._messages.push(message);
  }

  setSummary(summary: string): void {
    this._summary = summary;
  }

  /**
   * Últimos `n` mensajes que se envían al modelo. **Calcula**, no muta: el
   * historial completo se conserva para la trazabilidad; lo que se recorta es lo
   * que viaja como contexto (§6.2).
   */
  window(n: number): Message[] {
    if (n <= 0) return [];
    return this._messages.slice(-n);
  }

  /** ¿Toca regenerar el resumen? Aritmética pura sobre el conteo de mensajes. */
  needsSummary(every: number): boolean {
    return this._messages.length > 0 && this._messages.length % every === 0;
  }

  /**
   * Límite duro de mensajes por conversación (A7). Se comprueba **antes** de
   * llamar al proveedor, para no pagar por rechazar.
   */
  assertWithinBudget(maxMessages: number): void {
    if (this._messages.length >= maxMessages) {
      throw new BudgetExceededError();
    }
  }

  /** Acumula el consumo de tokens de un turno en el total de la conversación. */
  recordUsage(usage: TokenUsage): void {
    this._usage = this._usage.plus(usage);
  }
}
