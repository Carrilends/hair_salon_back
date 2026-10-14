import { Injectable, Logger } from '@nestjs/common';
import { SendMessageUseCase } from 'src/assistant/application/send-message.use-case';
import {
  BudgetExceededError,
  DAILY_CEILING_REPLY,
  LlmUnavailableError,
} from 'src/assistant/domain/errors';
import {
  AssistantChatPort,
  AssistantChatResult,
} from '../../domain/ports/assistant-chat.port';

/**
 * Puente entre el canal y el bucle del asistente (plan 06, F5). Es el único
 * sitio del canal que conoce los errores del asistente: los traduce a tres
 * motivos y **nunca lanza**, para que el manejador siempre pueda contestar.
 */
@Injectable()
export class AssistantChatAdapter implements AssistantChatPort {
  private readonly logger = new Logger(AssistantChatAdapter.name);

  constructor(private readonly useCase: SendMessageUseCase) {}

  async conversar(entrada: {
    phoneE164: string;
    esDuena: boolean;
    texto: string;
  }): Promise<AssistantChatResult> {
    try {
      const r = await this.useCase.execute({
        canal: 'whatsapp',
        phoneE164: entrada.phoneE164,
        userId: null,
        isAdmin: entrada.esDuena,
        message: entrada.texto,
      });
      return {
        ok: true,
        reply: r.reply,
        presentaciones: r.presentaciones ?? [],
        conversacionNueva: r.conversacionNueva === true,
      };
    } catch (error) {
      // El techo de la instalación no es culpa de quien escribe: se le dice
      // que el asistente no está disponible, no que llegó a su límite.
      if (error instanceof BudgetExceededError) {
        return {
          ok: false,
          motivo:
            error.message === DAILY_CEILING_REPLY ? 'no_disponible' : 'limite',
        };
      }
      if (error instanceof LlmUnavailableError) {
        this.logger.error(
          `El proveedor de IA no atendió a ${entrada.phoneE164}: ${error.causa.message}`,
        );
        return { ok: false, motivo: 'no_disponible' };
      }
      this.logger.error(
        `Fallo inesperado del asistente con ${entrada.phoneE164}`,
        error as Error,
      );
      return { ok: false, motivo: 'error' };
    }
  }
}
