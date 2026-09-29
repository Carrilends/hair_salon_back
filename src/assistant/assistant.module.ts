import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { WorkersModule } from 'src/workers/workers.module';
import { ReservationsModule } from 'src/reservations/reservations.module';
import { CreateReservationUseCase } from 'src/reservations/application/create-reservation.use-case';
import { GetMyReservationsUseCase } from 'src/reservations/application/get-my-reservations.use-case';
import { CancelReservationUseCase } from 'src/reservations/application/cancel-reservation.use-case';
import { RescheduleReservationUseCase } from 'src/reservations/application/reschedule-reservation.use-case';
import { Service } from 'src/service/entities/service.entity';

import { ConversationOrmEntity } from './infrastructure/persistence/conversation.orm-entity';
import { AssistantMessageOrmEntity } from './infrastructure/persistence/assistant-message.orm-entity';
import { TypeOrmConversationRepository } from './infrastructure/persistence/typeorm-conversation.repository';
import { SystemClock } from './infrastructure/time/system-clock.adapter';
import { ServiceCatalogQueryAdapter } from './infrastructure/catalog/service-catalog-query.adapter';
import { AvailabilityQueryAdapter } from './infrastructure/availability/availability-query.adapter';
import { GeminiLlmAdapter } from './infrastructure/llm/gemini-llm.adapter';
import { AssistantController } from './infrastructure/http/assistant.controller';
import { IpLimiterPruneScheduler } from './infrastructure/scheduling/ip-limiter-prune.scheduler';
import { SlidingWindowRateLimiter } from 'src/common/rate-limit/sliding-window-rate-limiter';

import { SendMessageUseCase } from './application/send-message.use-case';
import { SummarizeConversationUseCase } from './application/summarize-conversation.use-case';
import { buildAssistantTools } from './build-assistant-tools';
import {
  ASSISTANT_BUDGET,
  ASSISTANT_CLOCK,
  ASSISTANT_IP_LIMITER,
  ASSISTANT_SUMMARIZER,
  ASSISTANT_TOOLS,
  CONVERSATION_REPOSITORY,
  LLM,
} from './application/tokens';

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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ConversationOrmEntity,
      AssistantMessageOrmEntity,
      Service,
    ]),
    AuthModule, // estrategia JWT para el guard de auth opcional
    WorkersModule, // WorkersService (disponibilidad)
    ReservationsModule, // CreateReservationUseCase (A6)
  ],
  controllers: [AssistantController],
  providers: [
    SendMessageUseCase,
    IpLimiterPruneScheduler,
    SummarizeConversationUseCase,
    ServiceCatalogQueryAdapter,
    AvailabilityQueryAdapter,
    {
      provide: CONVERSATION_REPOSITORY,
      useClass: TypeOrmConversationRepository,
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
      provide: ASSISTANT_BUDGET,
      useFactory: () => ({
        maxMessagesPerConversation: Number(
          process.env.ASSISTANT_MAX_MESSAGES_PER_CONVERSATION ?? 20,
        ),
        maxMessagesPerUserPerDay: Number(
          process.env.ASSISTANT_MAX_MESSAGES_PER_USER_PER_DAY ?? 50,
        ),
      }),
    },
    {
      // Tope por origen del borde HTTP, para quien conversa sin sesión. En
      // memoria porque la API corre en una sola instancia; si algún día son
      // varias, esto hay que sustituirlo por un almacén compartido, no
      // multiplicarlo.
      provide: ASSISTANT_IP_LIMITER,
      useFactory: () =>
        new SlidingWindowRateLimiter(
          Number(
            process.env.ASSISTANT_MAX_MESSAGES_PER_IP_PER_HOUR ??
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
      ],
    },
  ],
  // El arreglo de herramientas se exporta para que la superficie MCP publique
  // **los mismos objetos**, no copias (Fase 7, M8). Nada mas sale de este modulo:
  // el bucle, el presupuesto y la telemetria siguen siendo asunto suyo.
  exports: [ASSISTANT_TOOLS],
})
export class AssistantModule {}
