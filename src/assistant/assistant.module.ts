import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { WorkersModule } from 'src/workers/workers.module';
import { ReservationsModule } from 'src/reservations/reservations.module';
import { CreateReservationUseCase } from 'src/reservations/application/create-reservation.use-case';
import { Service } from 'src/service/entities/service.entity';

import { ConversationOrmEntity } from './infrastructure/persistence/conversation.orm-entity';
import { AssistantMessageOrmEntity } from './infrastructure/persistence/assistant-message.orm-entity';
import { TypeOrmConversationRepository } from './infrastructure/persistence/typeorm-conversation.repository';
import { SystemClock } from './infrastructure/time/system-clock.adapter';
import { ServiceCatalogQueryAdapter } from './infrastructure/catalog/service-catalog-query.adapter';
import { AvailabilityQueryAdapter } from './infrastructure/availability/availability-query.adapter';
import { GeminiLlmAdapter } from './infrastructure/llm/gemini-llm.adapter';
import { AssistantController } from './infrastructure/http/assistant.controller';

import { SendMessageUseCase } from './application/send-message.use-case';
import { SummarizeConversationUseCase } from './application/summarize-conversation.use-case';
import { ListServicesTool } from './application/tools/list-services.tool';
import { CheckAvailabilityTool } from './application/tools/check-availability.tool';
import { CreateReservationTool } from './application/tools/create-reservation.tool';
import {
  ASSISTANT_BUDGET,
  ASSISTANT_CLOCK,
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
      provide: ASSISTANT_TOOLS,
      useFactory: (
        catalog: ServiceCatalogQueryAdapter,
        availability: AvailabilityQueryAdapter,
        createReservation: CreateReservationUseCase,
      ) => [
        new ListServicesTool(catalog),
        new CheckAvailabilityTool(availability),
        new CreateReservationTool(createReservation),
      ],
      inject: [
        ServiceCatalogQueryAdapter,
        AvailabilityQueryAdapter,
        CreateReservationUseCase,
      ],
    },
  ],
})
export class AssistantModule {}
