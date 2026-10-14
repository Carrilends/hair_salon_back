import { Message } from './message';
import { TokenUsage } from './token-usage';
import { BudgetExceededError } from './errors';

export interface ConversationProps {
  id?: string;
  userId?: string | null;
  /** Remitente de WhatsApp en E.164 (plan 06, F3a). Null en la web. */
  phoneE164?: string | null;
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
  private _userId: string | null;
  private readonly _phoneE164: string | null;
  private _summary: string | null;
  private readonly _messages: Message[];
  private _usage: TokenUsage;
  readonly createdAt?: Date;
  updatedAt?: Date;

  private constructor(props: ConversationProps) {
    this.id = props.id;
    this._userId = props.userId ?? null;
    this._phoneE164 = props.phoneE164 ?? null;
    this._summary = props.summary ?? null;
    this._messages = props.messages ?? [];
    this._usage = props.usage ?? TokenUsage.zero();
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /**
   * Inicia una conversación nueva. `userId` null ⇒ anónima: solo consulta (A3).
   *
   * `phoneE164` ⇒ conversación de WhatsApp (plan 06, F3a): su identidad es el
   * número que firma Meta. Usuario y teléfono **no se mezclan** (D1, D3): unir
   * una cuenta web con un número queda fuera de alcance, y una conversación con
   * los dos sería de dos dueños a la vez.
   */
  static start(props: {
    userId?: string | null;
    phoneE164?: string | null;
  }): Conversation {
    if (props.userId && props.phoneE164) {
      throw new Error(
        'Una conversación es de un usuario web o de un número de WhatsApp, no de los dos.',
      );
    }
    return new Conversation({
      userId: props.userId ?? null,
      phoneE164: props.phoneE164 ?? null,
    });
  }

  /** Rehidrata una conversación persistida (usado por el repositorio). */
  static fromPersistence(props: ConversationProps): Conversation {
    return new Conversation(props);
  }

  get userId(): string | null {
    return this._userId;
  }

  /**
   * Una conversación que empezó sin sesión pasa a ser de quien la reanuda ya
   * identificada.
   *
   * No es cosmética: el tope diario de mensajes se cuenta **por dueño de la
   * conversación**, y el tope por origen no se aplica a quien tiene sesión. Una
   * conversación que se quedara sin dueño para siempre sería, por tanto, una
   * zona sin ningún tope —la vía más barata para saltarse los dos—. Reclamarla
   * también cierra la puerta a que otra visitante anónima siga leyendo el
   * historial de alguien que ya se identificó.
   *
   * Solo se reclama lo que no tiene dueño: la propiedad, una vez establecida,
   * no cambia de manos.
   */
  claimBy(userId: string): void {
    // Una conversación de WhatsApp ya tiene dueño: su número (D1, D3).
    if (this._phoneE164 !== null) return;
    if (this._userId === null) this._userId = userId;
  }

  /**
   * Número de WhatsApp dueño de la conversación, o `null` en la web. Inmutable:
   * se fija al nacer y es lo que impide retomarla desde la web (D2).
   */
  get phoneE164(): string | null {
    return this._phoneE164;
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

  /**
   * Suma un consumo adicional al que ya lleva imputado el último mensaje.
   *
   * Existe por el resumidor: su llamada manda al modelo el historial entero, así
   * que es la más cara de la conversación, y sucede **después** de anexar la
   * respuesta del turno. Sin imputársela a esa respuesta, su coste viviría solo
   * en el total de la conversación, y ni el techo diario ni la consulta de
   * gasto —que agregan sobre los mensajes— lo verían: la factura real sería
   * mayor que la medida justo en las conversaciones largas.
   *
   * El último mensaje es siempre uno recién anexado en este turno, de modo que
   * la fila aún no existe en la base y la imputación viaja con el INSERT.
   */
  imputarAlUltimoMensaje(extra: TokenUsage): void {
    const ultimo = this._messages[this._messages.length - 1];
    if (!ultimo) return;
    this._messages[this._messages.length - 1] = Message.fromPersistence({
      id: ultimo.id,
      role: ultimo.role,
      content: ultimo.content,
      toolName: ultimo.toolName,
      toolCallId: ultimo.toolCallId,
      usage: (ultimo.usage ?? TokenUsage.zero()).plus(extra),
    });
  }

  /** Acumula el consumo de tokens de un turno en el total de la conversación. */
  recordUsage(usage: TokenUsage): void {
    this._usage = this._usage.plus(usage);
  }
}
