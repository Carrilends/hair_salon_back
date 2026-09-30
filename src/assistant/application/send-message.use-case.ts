import { Inject, Injectable, Logger } from '@nestjs/common';
import { LlmMessage, LlmPort, LlmToolCall } from '../domain/ports/llm.port';
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
import { AssistantPresentation } from './tools/assistant-presentation';
import { SYSTEM_PROMPT } from './system-prompt';
import { RECIENTES_EN_EL_ESTADO } from './screening/turn-screen';
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
  ASSISTANT_JUDGMENT_TELEMETRY,
  CONVERSATION_REPOSITORY,
  JUDGMENT,
  JUDGMENT_SETTINGS,
  LLM,
} from './tokens';
import { JudgmentPort } from '../domain/ports/judgment.port';
import { JudgmentSettings } from './judgment-settings';
import {
  LlamadaDeLaTraza,
  construirBalance,
  construirProgreso,
  leerBalance,
  leerProgreso,
} from './screening/turn-screen';
import { TelemetriaDeJuicios } from './judgment-telemetry';

const WINDOW_SIZE = 8;
const SUMMARY_EVERY = 10;
const MAX_TOOL_ITERATIONS = 5;
/**
 * Vueltas consecutivas sin una sola llamada nueva que se toleran antes de cortar.
 * Una sola se perdona: el modelo reincide con los mismos argumentos también en
 * turnos que acaban bien, y cortar en la primera repetición convertiría esos
 * turnos en una disculpa. Dos seguidas ya no son un tropiezo, son un bucle, y
 * seguir hasta `MAX_TOOL_ITERATIONS` solo añade factura.
 */
const MAX_VUELTAS_SIN_NOVEDAD = 2;
/**
 * Vuelta a partir de la cual se pregunta si el turno avanza (plan 04, T6).
 * Antes de la tercera no se pregunta: encadenar dos herramientas es lo más
 * normal que hace el asistente (`listarServicios` → `consultarDisponibilidad`),
 * y preguntar ahí le cobraría el juicio a casi todos los turnos.
 */
const PRIMERA_VUELTA_QUE_SE_JUZGA = 3;
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
   * Datos tipados que las herramientas produjeron en el turno, en el orden en
   * que se llamaron, para que el widget los pinte junto al texto. Ausente si no
   * hubo ninguno.
   *
   * Es una lista y no un solo dato desde el plan 03: antes ganaba el último y un
   * turno que componía un paquete y además listaba servicios solo podía enseñar
   * una cosa.
   */
  presentaciones?: AssistantPresentation[];
}

/**
 * El bucle de un turno: carga la conversación, comprueba el presupuesto, arma el
 * contexto acotado (system + resumen + ventana + mensaje nuevo) y alterna
 * modelo↔herramientas hasta la respuesta final o el tope de vueltas. Construido
 * entero para probarse con un LLM falso, sin gastar un token (A1).
 */
@Injectable()
export class SendMessageUseCase {
  private readonly logger = new Logger(SendMessageUseCase.name);
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
    // Proveedor de juicios y qué colocaciones están encendidas (plan 04).
    // Opcionales de verdad: sin ellos el bucle es exactamente el de antes.
    @Inject(JUDGMENT) private readonly judge?: JudgmentPort,
    @Inject(JUDGMENT_SETTINGS) private readonly ajustes?: JudgmentSettings,
    @Inject(ASSISTANT_JUDGMENT_TELEMETRY)
    private readonly telemetria?: TelemetriaDeJuicios,
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
      // Los últimos mensajes, el nuevo incluido y los viejos primero. Lo pide
      // la verificación previa a reservar (plan 04, T5): sin historial no hay
      // con qué comparar la reserva que se va a crear. Se manda un mensaje más
      // de los que caben en el estado a propósito: quien arma la pregunta es
      // quien decide cuántos entran, y el nuevo es el que nunca puede faltar.
      recientes: [
        ...conversation.window(RECIENTES_EN_EL_ESTADO).map((m) => ({
          rol:
            m.role === 'assistant'
              ? ('asistente' as const)
              : ('clienta' as const),
          texto: m.content,
        })),
        { rol: 'clienta' as const, texto: input.message },
      ],
    };
    const messages = this.buildContext(
      conversation,
      input.message,
      context.now,
    );
    const toolDefinitions = this.tools.map((t) => t.definition);

    let reply = '';
    let presentaciones: AssistantPresentation[] = [];
    // Consumo de ESTE turno, aparte del acumulado de la conversación: es lo que
    // se imputa al mensaje de respuesta para que la auditoría por mensaje
    // (`assistant_messages.prompt_tokens`) diga algo. Sin él, un abuso no se
    // puede reconstruir: solo se vería el total de la conversación. Se va
    // publicando hacia fuera para que la reserva del techo se liquide con la
    // cifra real aunque el turno acabe lanzando.
    let usoDelTurno = TokenUsage.zero();
    // Lo que cada llamada a herramienta ya devolvió en ESTE turno, por firma
    // (ver `firmaDeLlamada`). Sirve para dos cosas: cortar el bucle cuando el
    // modelo no pide nada nuevo, y no volver a ejecutar lo que ya se ejecutó
    // —así una llamada repetida a `crearReserva` no puede duplicar el efecto—.
    const resultadosDelTurno = new Map<string, unknown>();
    let vueltasSinNovedad = 0;
    // Traza del turno para el corte semántico (T6): qué se pidió, con qué
    // argumentos y cómo salió, en orden.
    const traza: LlamadaDeLaTraza[] = [];
    // Vueltas gastadas de verdad. Alimenta el contador de turnos que llegan a
    // la tercera, que es la cifra que dirá si el corte semántico valió la pena
    // y que hoy no sabe nadie. No cuesta nada: es aritmética.
    let vueltas = 0;
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      vueltas = i + 1;
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

      // Corte por repetición literal (plan 04, T1). Si NINGUNA de las llamadas
      // de esta vuelta es nueva, el modelo está pidiendo lo que ya tiene en el
      // contexto y la vuelta no puede acercar la respuesta. La primera vez se le
      // devuelve lo que ya tenía y se le da otra oportunidad; a la segunda
      // seguida se corta con cortesía, sin esperar a la quinta vuelta.
      const hayNovedad = toolCalls.some(
        (c) => !resultadosDelTurno.has(firmaDeLlamada(c)),
      );
      vueltasSinNovedad = hayNovedad ? 0 : vueltasSinNovedad + 1;
      if (vueltasSinNovedad >= MAX_VUELTAS_SIN_NOVEDAD) break;

      // Corte semántico (plan 04, T6): desde la tercera vuelta se pregunta si
      // estas llamadas van a alguna parte. Solo llega aquí la minoría de turnos
      // que encadena tres vueltas, así que la mayoría no paga ningún juicio.
      if (
        i + 1 >= PRIMERA_VUELTA_QUE_SE_JUZGA &&
        !(await this.turnoAvanza(input.message, traza, toolCalls))
      ) {
        break;
      }

      // La respuesta con llamadas de herramienta y sus resultados viven solo en
      // el contexto del turno (no se persisten): así la ventana rehidratada no
      // arrastra referencias de herramienta colgantes y se ahorran tokens.
      messages.push(completion.message);
      for (const call of toolCalls) {
        const firma = firmaDeLlamada(call);
        let result: unknown;
        if (resultadosDelTurno.has(firma)) {
          // Repetición exacta: se le devuelve lo que ya devolvió, sin ejecutar.
          // El modelo recibe el mismo dato y el efecto no se duplica.
          result = resultadosDelTurno.get(firma);
        } else {
          const tool = this.toolsByName.get(call.name);
          result = tool
            ? await tool.execute(call.arguments, context)
            : { ok: false, motivo: 'herramienta_desconocida' };
          resultadosDelTurno.set(firma, result);
          // Si la herramienta sabe presentar, se le pide el dato tipado para el
          // widget. Quien decide que un resultado no se presenta es la propia
          // herramienta (devolviendo `null`), no el bucle: solo ella sabe qué es
          // un error suyo. Solo se pide en la ejecución de verdad: la repetición
          // daría la misma tarjeta —que `yaPresentada` descartaría— pagando otra
          // consulta de imágenes.
          //
          // Va dentro de un `try` porque `presentar` dejó de ser gratis el día
          // que pasó a consultar imágenes: ahora puede fallar. Una tarjeta que no
          // se puede construir tiene que degradar a «sin tarjeta» y nunca a «sin
          // turno»: el mensaje de la clienta y la respuesta ya se pagaron, y si
          // la excepción subiera se perderían —`save` viene después del bucle—
          // junto con la fila de auditoría que este caso de uso se esfuerza en
          // llevar.
          try {
            const presentacion = await tool?.presentar?.(result);
            if (presentacion && !yaPresentada(presentaciones, presentacion)) {
              presentaciones.push(presentacion);
            }
          } catch (error) {
            this.logger.warn(
              `No se pudo construir la presentación de ${call.name}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }
        }
        traza.push({
          herramienta: call.name,
          argumentos: call.arguments,
          resultado:
            (result as { ok?: unknown })?.ok === false ? 'error' : 'ok',
        });
        messages.push({
          role: 'tool',
          content: JSON.stringify(result),
          toolCallId: call.id,
        });
      }
    }

    // Al agotar las vueltas sin respuesta final, se responde con cortesía en vez
    // de seguir facturando. En ese caso NO se surfacea nada: una tarjeta junto a
    // un texto de fracaso sería contradictoria.
    if (!reply) {
      reply = COURTESY_REPLY;
      presentaciones = [];
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

    this.telemetria?.anotarTurno({
      llegoALaVuelta3: vueltas >= PRIMERA_VUELTA_QUE_SE_JUZGA,
    });
    // (T8) El juicio diferido va DESPUÉS de todo, sin esperarlo: si falla,
    // nadie se entera; si tarda, nadie espera. Cero latencia en el camino
    // crítico, que es su única razón de ser.
    this.dispararJuicioDiferido(input.message, reply, traza);

    return {
      conversationId: saved.id,
      reply,
      ...(presentaciones.length > 0 ? { presentaciones } : {}),
    };
  }

  /**
   * ¿Este turno va a alguna parte? (plan 04, T6.)
   *
   * Se pregunta por la **relación** entre las llamadas y la petición, nunca por
   * cuántas son: el modelo cuenta mal, y peor cuanto más largo el estado. El
   * tope por conteo ya existe y se llama `MAX_TOOL_ITERATIONS`.
   *
   * **Fail-open aquí significa seguir**: sin colocación, sin veredicto o con el
   * proveedor caído devuelve `true` y el turno continúa. En modo sombra
   * pregunta, registra y devuelve `true` igual.
   */
  private async turnoAvanza(
    peticion: string,
    traza: LlamadaDeLaTraza[],
    pedidas: LlmToolCall[],
  ): Promise<boolean> {
    const modo = this.ajustes?.bucle ?? 'off';
    if (!this.judge || modo === 'off') return true;

    const juicio = construirProgreso({
      peticion,
      traza: [
        ...traza,
        ...pedidas.map((c) => ({
          herramienta: c.name,
          argumentos: c.arguments,
          resultado: 'pendiente' as const,
        })),
      ],
    });
    if (!juicio) return true;

    const respuesta = await this.judge.ask({
      state: juicio.state,
      questions: juicio.questions,
    });
    if (respuesta.ok === false) return true;

    const { avanza, prob } = leerProgreso(respuesta.answers, juicio.asked);
    if (prob !== null) {
      this.logger.log(
        `Juicio de progreso del turno: ${prob} (${modo}, ${respuesta.ms} ms)` +
          `${avanza ? '' : ' — habría cortado el bucle'}`,
      );
    }
    // En sombra se pregunta, se anota y NO se actúa.
    return modo === 'shadow' ? true : avanza;
  }

  /**
   * Juicio diferido del turno (plan 04, T8): qué le preguntaron y si la
   * respuesta resolvió la petición, anotado en la telemetría que lee la
   * consulta de administración.
   *
   * No devuelve promesa **a propósito**: quien lo llama ya entregó la
   * respuesta. Los fallos se comen aquí; una telemetría perdida no es un
   * problema, y una excepción suelta en un `Promise` sí lo sería.
   *
   * Reutiliza el mismo adaptador que las colocaciones en banda, con su timeout
   * corto. El plan admitía uno más generoso aquí por estar fuera de banda, pero
   * con un p95 medido de 420 ms el segundo de margen sobra, y un segundo
   * proveedor solo para esto sería una pieza más que mantener.
   */
  private dispararJuicioDiferido(
    peticion: string,
    respuesta: string,
    traza: LlamadaDeLaTraza[],
  ): void {
    const judge = this.judge;
    if (!judge || !this.ajustes?.diferido) return;
    const juicio = construirBalance({ peticion, respuesta, traza });
    if (!juicio) return;

    void (async () => {
      try {
        const r = await judge.ask({
          state: juicio.state,
          questions: juicio.questions,
        });
        if (r.ok === false) {
          this.telemetria?.anotarJuicio({
            intencion: null,
            resuelta: null,
            ms: r.ms,
          });
          return;
        }
        const { intencion, resuelta } = leerBalance(r.answers);
        this.telemetria?.anotarJuicio({ intencion, resuelta, ms: r.ms });
      } catch (error) {
        this.logger.warn(
          `El juicio diferido no llegó a anotarse: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    })();
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

/**
 * Identidad de una llamada a herramienta dentro de un turno: nombre y
 * argumentos. Es la clave del corte por repetición literal, y por eso tiene que
 * ser exacta: se usa la cadena canónica completa y no un hash, porque dos
 * llamadas distintas con el mismo hash cortarían un turno que iba bien.
 */
function firmaDeLlamada(call: LlmToolCall): string {
  return `${call.name}\u0000${jsonCanonico(call.arguments)}`;
}

/**
 * Serialización estable: las claves de objeto van ordenadas. Los argumentos
 * llegan del proveedor y su orden no está garantizado; con `JSON.stringify` a
 * secas, `{dia, servicio}` y `{servicio, dia}` serían llamadas distintas y el
 * detector se apagaría justo cuando el modelo reordena las claves al repetirse.
 */
function jsonCanonico(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(jsonCanonico).join(',')}]`;
  if (valor !== null && typeof valor === 'object') {
    const campos = Object.entries(valor as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${jsonCanonico(v)}`);
    return `{${campos.join(',')}}`;
  }
  return JSON.stringify(valor) ?? 'null';
}

/**
 * ¿Ya se recogió esta misma presentación en el turno? El modelo repite la misma
 * llamada con los mismos argumentos más a menudo de lo que parece, y dos
 * tarjetas idénticas seguidas se leen como un fallo. La comparación es por
 * contenido serializado: los datos presentados son pequeños y planos, así que
 * sale más barato que llevar cuenta de las llamadas.
 */
function yaPresentada(
  recogidas: AssistantPresentation[],
  candidata: AssistantPresentation,
): boolean {
  const serializada = JSON.stringify(candidata);
  return recogidas.some((p) => JSON.stringify(p) === serializada);
}
