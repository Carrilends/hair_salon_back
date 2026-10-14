import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { WorkersModule } from 'src/workers/workers.module';
import { ReservationsModule } from 'src/reservations/reservations.module';
import { CreateReservationUseCase } from 'src/reservations/application/create-reservation.use-case';
import { GetMyReservationsUseCase } from 'src/reservations/application/get-my-reservations.use-case';
import { CancelReservationUseCase } from 'src/reservations/application/cancel-reservation.use-case';
import { RescheduleReservationUseCase } from 'src/reservations/application/reschedule-reservation.use-case';
import { FindActionableReservationsUseCase } from 'src/reservations/application/find-actionable-reservations.use-case';
import { ListActiveReservationsUseCase } from 'src/reservations/application/list-active-reservations.use-case';
import { ConfirmReservationUseCase } from 'src/reservations/application/confirm-reservation.use-case';
import { GetReservationUseCase } from 'src/reservations/application/get-reservation.use-case';
import { Service } from 'src/service/entities/service.entity';

import { ConversationOrmEntity } from './infrastructure/persistence/conversation.orm-entity';
import { AssistantMessageOrmEntity } from './infrastructure/persistence/assistant-message.orm-entity';
import { TypeOrmConversationRepository } from './infrastructure/persistence/typeorm-conversation.repository';
import { SystemClock } from './infrastructure/time/system-clock.adapter';
import { ServiceCatalogQueryAdapter } from './infrastructure/catalog/service-catalog-query.adapter';
import { AvailabilityQueryAdapter } from './infrastructure/availability/availability-query.adapter';
import { GeminiLlmAdapter } from './infrastructure/llm/gemini-llm.adapter';
import { JudgmentPort } from './domain/ports/judgment.port';
import { TypeSafeJudgeAdapter } from './infrastructure/judgment/typesafe-judge.adapter';
import { NoopJudgeAdapter } from './infrastructure/judgment/noop-judge.adapter';
import { AssistantController } from './infrastructure/http/assistant.controller';
import { IpLimiterPruneScheduler } from './infrastructure/scheduling/ip-limiter-prune.scheduler';
import { PendingBookingPurgeScheduler } from './infrastructure/scheduling/pending-booking-purge.scheduler';
import { PendingBookingOrmEntity } from './infrastructure/pending/pending-booking.orm-entity';
import { TypeOrmPendingBookingRepository } from './infrastructure/pending/typeorm-pending-booking.repository';
import { ConfirmPendingBookingUseCase } from './application/confirm-pending-booking.use-case';
import { SlidingWindowRateLimiter } from 'src/common/rate-limit/sliding-window-rate-limiter';
import { enteroDeEntorno } from 'src/common/config/entero-de-entorno';

import { SendMessageUseCase } from './application/send-message.use-case';
import { GetAssistantUsageUseCase } from './application/get-usage.use-case';
import { DailyTokenLedger } from './application/daily-token-ledger';
import { SummarizeConversationUseCase } from './application/summarize-conversation.use-case';
import { buildAssistantTools } from './build-assistant-tools';
import { buildWhatsAppTools } from './build-whatsapp-tools';
import {
  ASSISTANT_BUDGET,
  ASSISTANT_CLOCK,
  ASSISTANT_DAILY_LEDGER,
  ASSISTANT_IP_LIMITER,
  ASSISTANT_JUDGMENT_TELEMETRY,
  ASSISTANT_SUMMARIZER,
  ASSISTANT_TOOLS,
  ASSISTANT_WHATSAPP_TOOLS,
  ASSISTANT_OWNER_WHATSAPP,
  CONVERSATION_PHONE_REPOSITORY,
  CONVERSATION_REPOSITORY,
  JUDGMENT,
  JUDGMENT_SETTINGS,
  LLM,
  PENDING_BOOKINGS,
} from './application/tokens';
import { ajustesDeJuicioDeEntorno } from './application/judgment-settings';
import { TelemetriaDeJuicios } from './application/judgment-telemetry';

// Dos modelos, no uno: es lo que hace real el enrutamiento por coste de §6.2 (D4).
// El `router` atiende la conversación normal y debe ser el barato; el `main` queda
// reservado a las tareas complejas de la Fase 6 y hoy no se usa. Los ids exactos los
// confirma Luis vía GEMINI_MODEL_ROUTER/_MAIN (A2, decisión de catálogo).
const DEFAULT_ROUTER_MODEL = 'gemini-3.5-flash-lite';
const DEFAULT_MAIN_MODEL = 'gemini-3.8-flash';

// Ventana del tope por origen. Una hora, y no un minuto, porque lo que se
// quiere acotar es el gasto sostenido, no la ráfaga: una ráfaga de veinte
// mensajes en un minuto cuesta lo mismo que veinte repartidos en la hora.
const IP_WINDOW_MS = 60 * 60 * 1000;
// Veinte por hora y origen (decisión de Luis, 2026-09-29): una clienta real
// rara vez pasa de diez turnos para cerrar una cita, así que sobra margen.
const DEFAULT_MAX_MESSAGES_PER_IP_PER_HOUR = 20;
// Techo diario de la instalación, en tokens facturables. Se calibra con
// `GET /api/assistant/usage` una vez haya tráfico real; hasta entonces es una
// red de seguridad holgada, no un presupuesto ajustado.
const DEFAULT_MAX_TOKENS_PER_DAY = 200_000;
// Tokens que la cuenta del día aparta mientras un turno está en vuelo. Medido
// el 2026-09-29: una pregunta trivial costó 1.419 de entrada y 60 de salida, y
// el prefijo de sistema con las nueve herramientas es el grueso de eso. Se
// redondea al alza porque pasarse solo adelanta el corte unos turnos, mientras
// que quedarse corto reabre la carrera que la reserva viene a cerrar.
const RESERVA_POR_TURNO = 2_000;

// Proveedor de juicios (plan 04). Versión FIJA y no `jev-latest`: los umbrales
// del banco de calibración se midieron contra esta, y un modelo que cambia sin
// avisar mueve los umbrales sin que nadie lo sepa.
const DEFAULT_JUDGMENT_MODEL = 'jev-1.13.0';
// Tope de espera en banda. Medido contra la API con estado pequeño, 82 juicios
// del 2026-09-30: mediana 245 ms, p95 entre 330 y 400 ms según el juicio, y un
// máximo de 846 ms. Con 1.200 ms queda un 40 % de margen sobre el peor caso
// observado, que es lo que pedía el plan (800–1.200 ms). Aquí hay una clienta
// esperando su turno, así que no hay reintento: si no llega, el turno sigue por
// el camino de hoy. El juicio diferido pide su propio tope, más generoso,
// porque cuando corre ya nadie lo espera.
const DEFAULT_JUDGMENT_TIMEOUT_MS = 1_200;
/**
 * Suelo del tope de espera. `enteroDeEntorno` acepta un `0` explícito —es como
 * se desactiva el techo diario—, pero aquí un cero abortaría **todas** las
 * llamadas en el tick siguiente y apagaría las cuatro colocaciones en silencio,
 * que es justo el fallo que nadie relacionaría con haber escrito un cero.
 */
const MIN_JUDGMENT_TIMEOUT_MS = 200;

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ConversationOrmEntity,
      AssistantMessageOrmEntity,
      Service,
      // Propuestas de reserva de WhatsApp (plan 06, F4).
      PendingBookingOrmEntity,
    ]),
    AuthModule, // estrategia JWT para el guard de auth opcional
    WorkersModule, // WorkersService (disponibilidad)
    ReservationsModule, // CreateReservationUseCase (A6)
  ],
  controllers: [AssistantController],
  providers: [
    SendMessageUseCase,
    GetAssistantUsageUseCase,
    IpLimiterPruneScheduler,
    // Plan 06, F4: propuestas de reserva de WhatsApp y su botón «Confirmar».
    PendingBookingPurgeScheduler,
    ConfirmPendingBookingUseCase,
    { provide: PENDING_BOOKINGS, useClass: TypeOrmPendingBookingRepository },
    SummarizeConversationUseCase,
    ServiceCatalogQueryAdapter,
    AvailabilityQueryAdapter,
    {
      provide: CONVERSATION_REPOSITORY,
      useClass: TypeOrmConversationRepository,
    },
    {
      // Plan 06, F3a: el MISMO repositorio, visto por su puerto de teléfono.
      // `useExisting` y no `useClass`, para no tener dos instancias.
      provide: CONVERSATION_PHONE_REPOSITORY,
      useExisting: CONVERSATION_REPOSITORY,
    },
    { provide: ASSISTANT_CLOCK, useClass: SystemClock },
    {
      provide: ASSISTANT_SUMMARIZER,
      useExisting: SummarizeConversationUseCase,
    },
    {
      // Único punto que construye el proveedor real. Arranque perezoso: la app
      // arranca sin GEMINI_API_KEY; solo una conversación real falla si falta.
      provide: LLM,
      useFactory: () =>
        new GeminiLlmAdapter({
          apiKey: process.env.GEMINI_API_KEY,
          routerModel: process.env.GEMINI_MODEL_ROUTER ?? DEFAULT_ROUTER_MODEL,
          mainModel: process.env.GEMINI_MODEL_MAIN ?? DEFAULT_MAIN_MODEL,
        }),
    },
    {
      // Único punto que construye el proveedor de juicios. Sin
      // TYPESAFE_API_KEY se inyecta el adaptador nulo: la aplicación arranca
      // igual, todo pasa como hoy y el asistente no lo menciona en ninguna
      // parte.
      provide: JUDGMENT,
      useFactory: () =>
        process.env.TYPESAFE_API_KEY
          ? new TypeSafeJudgeAdapter({
              apiKey: process.env.TYPESAFE_API_KEY,
              model: process.env.TYPESAFE_MODEL ?? DEFAULT_JUDGMENT_MODEL,
              timeoutMs: Math.max(
                MIN_JUDGMENT_TIMEOUT_MS,
                enteroDeEntorno(
                  'TYPESAFE_TIMEOUT_MS',
                  DEFAULT_JUDGMENT_TIMEOUT_MS,
                ),
              ),
            })
          : new NoopJudgeAdapter(),
    },
    {
      // Qué colocaciones del juicio están encendidas. Todas en `off` por
      // defecto: una colocación que actúa entra primero en sombra, y eso se
      // decide en el entorno, no en el código.
      // Las colocaciones se leen del entorno, pero solo se encienden si hay
      // proveedor de verdad: por eso este proveedor depende de aquel.
      provide: JUDGMENT_SETTINGS,
      useFactory: (judge: JudgmentPort) =>
        ajustesDeJuicioDeEntorno(judge.disponible),
      inject: [JUDGMENT],
    },
    {
      // Telemetría del juicio diferido y del bucle. Una sola instancia para
      // toda la aplicación, como el libro del gasto: con más de una, cada copia
      // contaría lo suyo y el informe no significaría nada.
      provide: ASSISTANT_JUDGMENT_TELEMETRY,
      useFactory: () => new TelemetriaDeJuicios(),
    },
    {
      provide: ASSISTANT_BUDGET,
      useFactory: () => ({
        maxMessagesPerConversation: enteroDeEntorno(
          'ASSISTANT_MAX_MESSAGES_PER_CONVERSATION',
          20,
        ),
        maxMessagesPerUserPerDay: enteroDeEntorno(
          'ASSISTANT_MAX_MESSAGES_PER_USER_PER_DAY',
          50,
        ),
        // Lo mismo por número de WhatsApp (plan 06, D7).
        maxMessagesPerPhonePerDay: enteroDeEntorno(
          'ASSISTANT_MAX_MESSAGES_PER_PHONE_PER_DAY',
          50,
        ),
        // Techo de la instalación, en tokens facturables del día del salón.
        // En tokens y no en mensajes porque un turno son hasta seis llamadas al
        // modelo: contar mensajes no acota la factura. 0 = sin techo.
        maxTokensPerDay: enteroDeEntorno(
          'ASSISTANT_MAX_TOKENS_PER_DAY',
          DEFAULT_MAX_TOKENS_PER_DAY,
        ),
      }),
    },
    {
      // Cuenta del gasto del día. Una sola instancia para toda la aplicación:
      // con más de una, cada copia llevaría su cuenta y el techo valdría por
      // el número de copias.
      provide: ASSISTANT_DAILY_LEDGER,
      useFactory: () => new DailyTokenLedger(RESERVA_POR_TURNO),
    },
    {
      // Tope por origen del borde HTTP, para quien conversa sin sesión. En
      // memoria porque la API corre en una sola instancia; si algún día son
      // varias, esto hay que sustituirlo por un almacén compartido, no
      // multiplicarlo.
      provide: ASSISTANT_IP_LIMITER,
      useFactory: () =>
        new SlidingWindowRateLimiter(
          enteroDeEntorno(
            'ASSISTANT_MAX_MESSAGES_PER_IP_PER_HOUR',
            DEFAULT_MAX_MESSAGES_PER_IP_PER_HOUR,
          ),
          IP_WINDOW_MS,
        ),
    },
    {
      // El orden del `inject` DEBE coincidir con los parámetros de
      // `buildAssistantTools` (Nest resuelve por posición).
      provide: ASSISTANT_TOOLS,
      useFactory: buildAssistantTools,
      inject: [
        ServiceCatalogQueryAdapter,
        AvailabilityQueryAdapter,
        CreateReservationUseCase,
        GetMyReservationsUseCase,
        CancelReservationUseCase,
        RescheduleReservationUseCase,
        JUDGMENT,
        JUDGMENT_SETTINGS,
      ],
    },
    {
      // Número de la dueña, para la segunda comprobación de `isAdmin` en
      // WhatsApp (revisión de seguridad de F3b). El mismo que lee el canal.
      provide: ASSISTANT_OWNER_WHATSAPP,
      useFactory: () => process.env.SALON_OWNER_WHATSAPP ?? '',
    },
    {
      // Plan 06, F3b: los juegos de WhatsApp, clienta y dueña. Parten de
      // ASSISTANT_TOOLS sin modificarlo (MCP lo publica tal cual). El orden del
      // `inject` DEBE coincidir con los parámetros de `buildWhatsAppTools`.
      provide: ASSISTANT_WHATSAPP_TOOLS,
      useFactory: buildWhatsAppTools,
      inject: [
        ASSISTANT_TOOLS,
        GetMyReservationsUseCase,
        FindActionableReservationsUseCase,
        ListActiveReservationsUseCase,
        ConfirmReservationUseCase,
        PENDING_BOOKINGS,
        ServiceCatalogQueryAdapter,
        GetReservationUseCase,
      ],
    },
  ],
  // El arreglo de herramientas se exporta para que la superficie MCP publique
  // **los mismos objetos**, no copias (Fase 7, M8). El bucle sale desde el plan
  // 06 (F3a) para que el webhook de WhatsApp converse con el MISMO asistente
  // (F5); el presupuesto y la telemetria siguen siendo asunto de este modulo.
  // El botón «Confirmar» de las propuestas (F4) lo atiende el webhook, así que
  // su caso de uso sale también.
  exports: [ASSISTANT_TOOLS, SendMessageUseCase, ConfirmPendingBookingUseCase],
})
export class AssistantModule {}
