import { Inject, Injectable } from '@nestjs/common';
import { LlmMessage, LlmPort } from '../domain/ports/llm.port';
import { ConversationRepositoryPort } from '../domain/ports/conversation-repository.port';
import { ClockPort } from '../domain/ports/clock.port';
import { Conversation } from '../domain/conversation';
import { Message } from '../domain/message';
import { TokenUsage } from '../domain/token-usage';
import {
  BudgetExceededError,
  ConversationAccessError,
  DAILY_CEILING_REPLY,
} from '../domain/errors';
import { AssistantContext, AssistantTool } from './tools/assistant-tool';
import { SYSTEM_PROMPT } from './system-prompt';
import { fechaDelSalon, inicioDelDiaDelSalon } from './salon-day';
import { AssistantBudget } from './assistant-budget';
import { ConversationSummarizer } from './summarize-conversation.use-case';
import { DailyTokenLedger } from './daily-token-ledger';
import {
  ASSISTANT_BUDGET,
  ASSISTANT_CLOCK,
  ASSISTANT_DAILY_LEDGER,
  ASSISTANT_SUMMARIZER,
  ASSISTANT_TOOLS,
  CONVERSATION_REPOSITORY,
  LLM,
} from './tokens';

const WINDOW_SIZE = 8;
const SUMMARY_EVERY = 10;
const MAX_TOOL_ITERATIONS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;
const COURTESY_REPLY =
  'Disculpa, no logré completar la solicitud. ¿Quieres intentarlo de otra forma o reservar por el flujo web de siempre?';

export interface SendMessageInput {
  conversationId?: string;
  message: string;
  userId: string | null;
  /**
   * Rol admin del solicitante, derivado del JWT en el borde HTTP. Opcional en la
   * entrada (ausente ⇒ `false`, mínimo privilegio); el contexto siempre lo lleva.
   */
  isAdmin?: boolean;
}

export interface SendMessageResult {
  conversationId?: string;
  reply: string;
  /**
   * Dato estructurado que una herramienta "presentable" produjo en el turno (una
   * propuesta de paquete, T7). El borde HTTP lo devuelve junto al texto para que
   * el widget lo pinte; ausente si no hubo ninguno.
   */
  propuesta?: unknown;
}

/**
 * El bucle de un turno: carga la conversación, comprueba el presupuesto, arma el
 * contexto acotado (system + resumen + ventana + mensaje nuevo) y alterna
 * modelo↔herramientas hasta la respuesta final o el tope de vueltas. Construido
 * entero para probarse con un LLM falso, sin gastar un token (A1).
 */
@Injectable()
export class SendMessageUseCase {
  private readonly toolsByName: Map<string, AssistantTool>;
  /** Siembra de la cuenta del día en curso, para no lanzar varias a la vez. */
  private siembraEnVuelo: Promise<void> | null = null;

  constructor(
    @Inject(LLM) private readonly llm: LlmPort,
    @Inject(CONVERSATION_REPOSITORY)
    private readonly repository: ConversationRepositoryPort,
    @Inject(ASSISTANT_TOOLS) private readonly tools: AssistantTool[],
    @Inject(ASSISTANT_CLOCK) private readonly clock: ClockPort,
    @Inject(ASSISTANT_BUDGET) private readonly budget: AssistantBudget,
    @Inject(ASSISTANT_SUMMARIZER)
    private readonly summarizer: ConversationSummarizer,
    @Inject(ASSISTANT_DAILY_LEDGER)
    private readonly ledger: DailyTokenLedger,
  ) {
    this.toolsByName = new Map(this.tools.map((t) => [t.name, t]));
  }

  async execute(input: SendMessageInput): Promise<SendMessageResult> {
    const ahora = this.clock.now();
    const dia = fechaDelSalon(ahora);

    // (0) Techo de la instalación, lo PRIMERO y para todo el mundo
    // —administración incluida—: quien pone tope a una factura no hace
    // excepciones. Va antes incluso de cargar la conversación para que una
    // petición condenada no cueste tres consultas a la base.
    const reservado = await this.reservarEnElTecho(dia, ahora);
    // Consumo de ESTE turno, declarado aquí porque el `finally` lo necesita
    // para liquidar la reserva con lo que de verdad se gastó, también cuando el
    // turno termina mal.
    let usoDelTurno = TokenUsage.zero();

    try {
      return await this.turno(input, ahora, (u) => (usoDelTurno = u));
    } finally {
      if (reservado) this.ledger.liquidar(dia, usoDelTurno.total);
    }
  }

  private async turno(
    input: SendMessageInput,
    ahora: Date,
    anotarUso: (uso: TokenUsage) => void,
  ): Promise<SendMessageResult> {
    const conversation = await this.loadOrStart(input);

    // A7: los dos límites duros se comprueban ANTES de la primera llamada, para no
    // pagar por rechazar. (1) tope por conversación.
    conversation.assertWithinBudget(this.budget.maxMessagesPerConversation);
    // (2) tope diario por usuario: sin él, el tope por conversación se eludiría
    // abriendo conversaciones nuevas. Solo aplica a usuarios con sesión (los
    // anónimos se acotan por IP en el borde HTTP, T7). La consulta real la
    // implementa el repositorio TypeORM (T7); el punto de control vive aquí.
    if (input.userId) {
      const since = new Date(ahora.getTime() - DAY_MS);
      const dailyCount = await this.repository.countMessagesOfUserSince(
        input.userId,
        since,
      );
      if (dailyCount >= this.budget.maxMessagesPerUserPerDay) {
        throw new BudgetExceededError();
      }
    }

    // El contexto de las herramientas sale del solicitante autenticado
    // (`input.userId`), no del dueño persistido: así un anónimo que inicia sesión
    // puede reservar en su conversación. La verificación de que este usuario puede
    // reanudar esta conversación (propiedad) es del borde HTTP (T7).
    const context: AssistantContext = {
      userId: input.userId,
      now: ahora,
      // El rol admin viaja desde el borde HTTP (JWT), nunca desde el chat. Ausente
      // ⇒ false: una omisión nunca concede privilegios.
      isAdmin: input.isAdmin ?? false,
    };
    const messages = this.buildContext(
      conversation,
      input.message,
      context.now,
    );
    const toolDefinitions = this.tools.map((t) => t.definition);

    let reply = '';
    let propuesta: unknown;
    // Consumo de ESTE turno, aparte del acumulado de la conversación: es lo que
    // se imputa al mensaje de respuesta para que la auditoría por mensaje
    // (`assistant_messages.prompt_tokens`) diga algo. Sin él, un abuso no se
    // puede reconstruir: solo se vería el total de la conversación. Se va
    // publicando hacia fuera para que la reserva del techo se liquide con la
    // cifra real aunque el turno acabe lanzando.
    let usoDelTurno = TokenUsage.zero();
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const completion = await this.llm.complete({
        messages,
        tools: toolDefinitions,
      });
      // Acumular el consumo en CADA vuelta, no solo en la última.
      conversation.recordUsage(completion.usage);
      usoDelTurno = usoDelTurno.plus(completion.usage);
      anotarUso(usoDelTurno);

      const toolCalls = completion.message.toolCalls ?? [];
      if (toolCalls.length === 0) {
        reply = completion.message.content;
        break;
      }

      // No ejecutar herramientas en la última vuelta permitida: no habría una
      // llamada posterior que consuma su resultado, y ejecutarlas causaría un
      // efecto (p. ej. una reserva real) sin poder informar a la clienta. Se
      // corta con cortesía sin ejecutar.
      if (i === MAX_TOOL_ITERATIONS - 1) break;

      // La respuesta con llamadas de herramienta y sus resultados viven solo en
      // el contexto del turno (no se persisten): así la ventana rehidratada no
      // arrastra referencias de herramienta colgantes y se ahorran tokens.
      messages.push(completion.message);
      for (const call of toolCalls) {
        const tool = this.toolsByName.get(call.name);
        const result = tool
          ? await tool.execute(call.arguments, context)
          : { ok: false, motivo: 'herramienta_desconocida' };
        // T7: si la herramienta es "presentable" y no devolvió un error, se
        // guarda su resultado para surfacearlo como dato estructurado (la última
        // gana, si hubiera varias en el turno).
        if (tool?.presentable && isPresentableResult(result)) {
          propuesta = result;
        }
        messages.push({
          role: 'tool',
          content: JSON.stringify(result),
          toolCallId: call.id,
        });
      }
    }

    // Al agotar las vueltas sin respuesta final, se responde con cortesía en vez
    // de seguir facturando. En ese caso NO se surfacea la propuesta: la tarjeta
    // del paquete junto a un texto de fracaso sería contradictoria.
    if (!reply) {
      reply = COURTESY_REPLY;
      propuesta = undefined;
    }

    // Historia durable: el mensaje de la clienta y la respuesta final. El
    // consumo se imputa a la respuesta, que es la fila que lo causó; el mensaje
    // de la clienta se guarda sin nada que cobrar.
    conversation.append(Message.user(input.message));
    conversation.append(Message.assistant(reply, { usage: usoDelTurno }));

    if (conversation.needsSummary(SUMMARY_EVERY)) {
      const { summary, usage } = await this.summarizer.execute(conversation);
      conversation.setSummary(summary);
      conversation.recordUsage(usage);
      // El resumen lo provocó este turno, así que su coste es de este turno.
      conversation.imputarAlUltimoMensaje(usage);
      usoDelTurno = usoDelTurno.plus(usage);
      anotarUso(usoDelTurno);
    }

    const saved = await this.repository.save(conversation);
    return {
      conversationId: saved.id,
      reply,
      ...(propuesta !== undefined ? { propuesta } : {}),
    };
  }

  /**
   * Techo diario de tokens de toda la instalación.
   *
   * La cuenta vive en memoria y se **reserva por adelantado** (ver
   * `DailyTokenLedger`): sin reserva, N peticiones simultáneas leerían todas la
   * misma cifra por debajo del techo y las N llamarían al proveedor. La base
   * solo se consulta para sembrar la cuenta, una vez por día y por arranque.
   *
   * Se falla **cerrado**: si la siembra no responde, se rechaza. Un contador
   * caído no puede convertirse en barra libre — es el mismo criterio que rige
   * el tope por origen, y lo contrario del que rige la telemetría, donde perder
   * una métrica nunca tumba un turno.
   *
   * @returns `true` si quedó una reserva que hay que liquidar.
   */
  private async reservarEnElTecho(dia: string, ahora: Date): Promise<boolean> {
    const techo = this.budget.maxTokensPerDay;
    if (techo <= 0) return false;

    if (this.ledger.necesitaSiembra(dia)) {
      try {
        await this.sembrarUnaSolaVez(dia, ahora);
      } catch {
        throw new BudgetExceededError(DAILY_CEILING_REPLY);
      }
    }

    if (!this.ledger.reservar(dia, techo)) {
      throw new BudgetExceededError(DAILY_CEILING_REPLY);
    }
    return true;
  }

  /**
   * Siembra compartida: si varias peticiones llegan con la cuenta fría, todas
   * esperan a la MISMA consulta en vez de disparar una cada una. Sin esto, un
   * arranque con tráfico convierte la red de seguridad en una tormenta de
   * agregaciones sobre `assistant_messages`.
   */
  private async sembrarUnaSolaVez(dia: string, ahora: Date): Promise<void> {
    this.siembraEnVuelo ??= (async () => {
      try {
        const total = await this.repository.sumTokensSince(
          inicioDelDiaDelSalon(ahora),
        );
        this.ledger.sembrar(dia, total);
      } finally {
        this.siembraEnVuelo = null;
      }
    })();
    await this.siembraEnVuelo;
  }

  private async loadOrStart(input: SendMessageInput): Promise<Conversation> {
    if (input.conversationId) {
      const existing = await this.repository.findById(input.conversationId);
      if (existing) {
        // Propiedad: una conversación con dueño solo la reanuda su dueño (cierra
        // la fuga de historial ajeno). Una conversación anónima (userId null) la
        // puede continuar cualquiera, incluido el mismo visitante tras iniciar
        // sesión —así puede reservar en la conversación que empezó sin sesión—.
        if (existing.userId && existing.userId !== input.userId) {
          throw new ConversationAccessError();
        }
        // Quien la reanuda ya identificada se queda con ella: si no, la
        // conversación seguiría sin dueño y sus mensajes no contarían contra
        // ningún tope (ver `Conversation.claimBy`).
        if (input.userId) existing.claimBy(input.userId);
        return existing;
      }
    }
    return Conversation.start({ userId: input.userId });
  }

  private buildContext(
    conversation: Conversation,
    message: string,
    now: Date,
  ): LlmMessage[] {
    const messages: LlmMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }];
    // La fecha va DESPUÉS del prefijo constante, nunca dentro: así el prefijo
    // sigue siendo cacheable (§6.2) y el modelo puede resolver "mañana" o "el
    // viernes". Sin ella no entiende ninguna fecha relativa.
    messages.push({
      role: 'system',
      content: `Hoy es ${fechaDelSalon(now)} (hora de Colombia).`,
    });
    if (conversation.summary) {
      messages.push({
        role: 'system',
        content: `Resumen de la conversación anterior: ${conversation.summary}`,
      });
    }
    for (const m of conversation.window(WINDOW_SIZE)) {
      messages.push({ role: toLlmRole(m.role), content: m.content });
    }
    messages.push({ role: 'user', content: message });
    return messages;
  }
}

function toLlmRole(role: string): 'system' | 'user' | 'assistant' | 'tool' {
  if (role === 'assistant' || role === 'system' || role === 'tool') return role;
  return 'user';
}

/** Un resultado surfaceable: objeto que no es un error (`ok: false`). */
function isPresentableResult(result: unknown): boolean {
  return (
    typeof result === 'object' &&
    result !== null &&
    (result as { ok?: unknown }).ok !== false
  );
}
