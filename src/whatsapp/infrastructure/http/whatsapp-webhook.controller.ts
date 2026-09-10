import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Logger,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { HandleInboundMessageUseCase } from '../../application/handle-inbound-message.use-case';
import { parseInboundWebhook } from '../../application/parse-inbound-webhook';
import { InboundRateLimiter } from '../../application/rate-limiter';
import { InboundMessageLogPort } from '../../domain/ports/inbound-message-log.port';
import { INBOUND_MESSAGE_LOG, RATE_LIMITER } from '../../application/tokens';
import { MetaSignatureGuard } from './meta-signature.guard';

/**
 * El webhook de la Cloud API. Dos rutas: el apretón de manos con el que Meta
 * comprueba que la URL es nuestra, y la entrega de mensajes.
 *
 * **Sobre la `ValidationPipe` global.** Ninguna de las dos declara un `@Body()`
 * ni un `@Query()` con clase DTO. Con `whitelist` + `forbidNonWhitelisted`, un
 * DTO cerrado rechazaría con 400 cualquier campo que Meta añadiera al sobre —y
 * los añade sin avisar—. Tomando `@Req()` y `@Query('nombre')` el pipe no llega
 * a verlos. Es el mismo razonamiento ya documentado en el controlador de MCP.
 */
@Controller('whatsapp')
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  constructor(
    private readonly handler: HandleInboundMessageUseCase,
    @Inject(INBOUND_MESSAGE_LOG)
    private readonly log: InboundMessageLogPort,
    @Inject(RATE_LIMITER)
    private readonly limiter: InboundRateLimiter,
  ) {}

  /**
   * Verificación de la URL. Meta llama una vez, al registrarla en el panel, con
   * el token que nosotros mismos elegimos, y espera el `challenge` **en texto
   * plano** (no JSON).
   */
  @Get('webhook')
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: { status: (n: number) => { send: (b?: string) => void } },
  ): void {
    const esperado = process.env.WHATSAPP_VERIFY_TOKEN;
    if (!esperado || mode !== 'subscribe' || token !== esperado) {
      res.status(403).send();
      return;
    }
    res.status(200).send(challenge);
  }

  /**
   * Entrega de mensajes.
   *
   * **Responde 200 de inmediato y procesa después.** Meta reintenta con backoff
   * durante días ante cualquier respuesta que no sea 2xx o que tarde demasiado,
   * así que tardar aquí convierte un mensaje en una avalancha. El compromiso,
   * que conviene tener presente: si el proceso muere entre el 200 y el trabajo,
   * ese mensaje se pierde. La alternativa —una cola durable— queda fuera de
   * alcance para el volumen de una peluquería.
   */
  @UseGuards(MetaSignatureGuard)
  @Post('webhook')
  @HttpCode(200)
  receive(@Req() req: { body: unknown }): { ok: true } {
    const mensajes = parseInboundWebhook(req.body);

    for (const mensaje of mensajes) {
      // El trabajo se lanza sin `await` a propósito: la respuesta se cierra al
      // retornar. Cada mensaje lleva su propio `catch` para que uno que falle no
      // se lleve por delante a los demás.
      void this.procesar(mensaje).catch((error) => {
        this.logger.error(
          `Fallo procesando ${mensaje.messageId}`,
          error as Error,
        );
      });
    }

    return { ok: true };
  }

  private async procesar(mensaje: {
    messageId: string;
    from: string;
    payload: string | null;
    text: string | null;
  }): Promise<void> {
    // Idempotencia primero: una reentrega no debe volver a responderle a la
    // clienta, aunque el dominio absorbiera la acción repetida.
    const esNuevo = await this.log.markProcessedIfNew(
      mensaje.messageId,
      mensaje.from,
    );
    if (!esNuevo) return;

    // El límite se aplica descartando el trabajo, no devolviendo 429: a Meta un
    // 429 le parece un fallo y reintentaría, empeorando justo lo que se quería
    // contener.
    if (!this.limiter.allow(mensaje.from)) {
      this.logger.warn(`Descartado por límite de tasa: ${mensaje.from}`);
      return;
    }

    await this.handler.handle(mensaje);
  }
}
