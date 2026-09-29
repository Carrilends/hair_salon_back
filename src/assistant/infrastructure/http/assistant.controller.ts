import {
  Body,
  Controller,
  Get,
  Inject,
  Logger,
  NotFoundException,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { OptionalJwtAuthGuard } from 'src/reservations/infrastructure/http/optional-jwt-auth.guard';
import { User } from 'src/auth/entities/user.entity';
import { ValidRoles } from 'src/auth/interfaces/valid-roles';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { SlidingWindowRateLimiter } from 'src/common/rate-limit/sliding-window-rate-limiter';
import { SendMessageDto } from './dto/send-message.dto';
import { clavePorIp } from './client-ip';
import { SendMessageUseCase } from '../../application/send-message.use-case';
import {
  AssistantUsageReport,
  GetAssistantUsageUseCase,
} from '../../application/get-usage.use-case';
import { ASSISTANT_IP_LIMITER } from '../../application/tokens';
import {
  BudgetExceededError,
  ConversationAccessError,
  LlmUnavailableError,
} from '../../domain/errors';

/**
 * Aviso de tratamiento automatizado (§6.5 / RF59). Se envía en la primera
 * respuesta de cada conversación; el widget también puede mostrarlo fijo.
 */
export const LEGAL_NOTICE =
  'Este es un asistente automático. Tu mensaje se procesa con un proveedor de inteligencia artificial ubicado fuera de Colombia.';

@Controller('assistant')
export class AssistantController {
  private readonly logger = new Logger(AssistantController.name);

  constructor(
    private readonly sendMessage: SendMessageUseCase,
    private readonly getUsage: GetAssistantUsageUseCase,
    // El tope por origen es de este borde, no del caso de uso: la IP es un dato
    // del transporte y el asistente por MCP o por WhatsApp no tiene ninguna.
    @Inject(ASSISTANT_IP_LIMITER)
    private readonly ipLimiter: SlidingWindowRateLimiter,
  ) {}

  /**
   * Gasto del día, solo para la peluquería. Sin esta lectura el techo diario
   * sería un interruptor a ciegas: no habría manera de saber si está cerca de
   * saltar ni de calibrarlo con datos.
   *
   * Solo administración: el consumo agregado dice cuánta actividad tiene el
   * negocio, y eso no es de nadie más.
   */
  @Auth(ValidRoles.admin)
  @Get('usage')
  usage(): Promise<AssistantUsageReport> {
    return this.getUsage.execute();
  }

  // Auth OPCIONAL: consultar es público (A3); crear reserva exige sesión, y eso
  // lo decide la herramienta según `userId`. El id sale del JWT, no del chat, así
  // no viaja PII al modelo (§6.5).
  @UseGuards(OptionalJwtAuthGuard)
  @Post('messages')
  async messages(
    @Body() dto: SendMessageDto,
    @Req() req: { user?: User | null; ip?: string },
  ) {
    const userId = req.user?.id ?? null;

    // Tope por origen, solo para quien no tiene sesión. Quien la tiene ya está
    // acotado por el tope diario por usuario, y limitar además por IP echaría a
    // dos clientas que comparten la red de casa o de la oficina.
    //
    // Va ANTES del caso de uso a propósito: rechazar tiene que ser gratis. Un
    // turno cuesta hasta seis llamadas al proveedor, y el prompt del sistema
    // más las nueve definiciones de herramientas viajan antes de que el modelo
    // decida siquiera que la pregunta no es del salón.
    //
    // Cierra además la evasión del tope por conversación: omitir
    // `conversationId` abre una conversación nueva en cada POST, así que el
    // tope de 20 mensajes por conversación nunca se alcanzaba. El origen sí se
    // acota, venga o no con conversación.
    if (userId === null && !this.ipLimiter.allow(clavePorIp(req))) {
      // Mismo trato que el presupuesto agotado: 200 con texto cortés, no un 429
      // crudo que el widget tendría que traducir.
      return {
        conversationId: dto.conversationId ?? null,
        reply: new BudgetExceededError().message,
      };
    }
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
        ...(result.propuesta !== undefined
          ? { propuesta: result.propuesta }
          : {}),
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
      // Proveedor caído, sin credencial o sin cuota: 503 con mensaje seguro. El
      // diagnóstico se registra aquí porque es el único sitio que lo ve antes
      // de que se pierda.
      if (error instanceof LlmUnavailableError) {
        this.logger.error(
          `El proveedor de IA rechazó la petición: ${error.causa.message}`,
          error.causa.stack,
        );
        throw new ServiceUnavailableException(error.message);
      }
      throw error;
    }
  }
}
