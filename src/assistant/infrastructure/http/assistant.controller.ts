import {
  Body,
  Controller,
  NotFoundException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { OptionalJwtAuthGuard } from 'src/reservations/infrastructure/http/optional-jwt-auth.guard';
import { User } from 'src/auth/entities/user.entity';
import { ValidRoles } from 'src/auth/interfaces/valid-roles';
import { SendMessageDto } from './dto/send-message.dto';
import { SendMessageUseCase } from '../../application/send-message.use-case';
import {
  BudgetExceededError,
  ConversationAccessError,
} from '../../domain/errors';

/**
 * Aviso de tratamiento automatizado (§6.5 / RF59). Se envía en la primera
 * respuesta de cada conversación; el widget también puede mostrarlo fijo.
 */
export const LEGAL_NOTICE =
  'Este es un asistente automático. Tu mensaje se procesa con un proveedor de inteligencia artificial ubicado fuera de Colombia.';

@Controller('assistant')
export class AssistantController {
  constructor(private readonly sendMessage: SendMessageUseCase) {}

  // Auth OPCIONAL: consultar es público (A3); crear reserva exige sesión, y eso
  // lo decide la herramienta según `userId`. El id sale del JWT, no del chat, así
  // no viaja PII al modelo (§6.5).
  @UseGuards(OptionalJwtAuthGuard)
  @Post('messages')
  async messages(
    @Body() dto: SendMessageDto,
    @Req() req: { user?: User | null },
  ) {
    const userId = req.user?.id ?? null;
    // El rol admin sale del JWT, nunca de la conversación (regla de seguridad F6).
    // Mismo criterio que el borde de Reservas: solo el rol `admin` habilita la
    // cancelación de administración de §6.4.
    const isAdmin = req.user?.roles?.includes(ValidRoles.admin) ?? false;
    const esNueva = !dto.conversationId;
    try {
      const result = await this.sendMessage.execute({
        conversationId: dto.conversationId,
        message: dto.message,
        userId,
        isAdmin,
      });
      return {
        conversationId: result.conversationId,
        reply: result.reply,
        ...(esNueva ? { aviso: LEGAL_NOTICE } : {}),
      };
    } catch (error) {
      // Presupuesto agotado: no es un error para la clienta; se le comunica como
      // respuesta normal y el widget ofrece el flujo web.
      if (error instanceof BudgetExceededError) {
        return {
          conversationId: dto.conversationId ?? null,
          reply: error.message,
        };
      }
      // Conversación ajena: 404 (no se revela que existe).
      if (error instanceof ConversationAccessError) {
        throw new NotFoundException('Conversación no encontrada');
      }
      throw error;
    }
  }
}
