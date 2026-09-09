import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import {
  EmailMessage,
  EmailSenderPort,
} from '../../domain/ports/email-sender.port';

/** Cuerpo que se manda a `resend.emails.send`. Se envía SIEMPRE `text`, y `html`
 * cuando la plantilla lo produce: el cliente de correo elige cuál mostrar. */
export interface ResendSendPayload {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string[];
}

/** Forma del `error` que devuelve el SDK. No es una excepción: es un valor. */
export interface ResendSendError {
  statusCode?: number;
  name?: string;
  message?: string;
}

/**
 * Superficie mínima del cliente de Resend que este adaptador usa. Declararla
 * aquí permite probar el adaptador con un doble, sin red ni clave real, y deja
 * el acoplamiento al SDK en un único punto (la factoría por defecto).
 */
export interface ResendLikeClient {
  emails: {
    send(payload: ResendSendPayload): Promise<{
      data: { id: string } | null;
      error: ResendSendError | null;
    }>;
  };
}

export type ResendClientFactory = (apiKey: string) => ResendLikeClient;

/**
 * Adaptador de correo real sobre Resend. El `useFactory` del módulo solo lo
 * activa cuando `EMAIL_PROVIDER` tiene valor; sin él se usa el de consola.
 *
 * **Arranque perezoso** (mismo criterio que `CloudApiWhatsAppSender`): el
 * constructor no valida credenciales ni construye el cliente, así que la app
 * arranca aunque falte `EMAIL_API_KEY`. Solo un envío real falla, con un mensaje
 * que dice qué variable falta.
 *
 * **El SDK no lanza:** `emails.send` devuelve `{ data, error }`. Este adaptador
 * inspecciona `error` y lo convierte en excepción; si no lo hiciera, un fallo de
 * entrega pasaría por éxito. Quien llama (registro, reset, aviso de reserva) ya
 * captura y registra, de modo que un fallo de correo nunca aborta el negocio.
 */
@Injectable()
export class ProviderEmailSenderAdapter implements EmailSenderPort {
  private readonly logger = new Logger('EmailSender:resend');
  private client: ResendLikeClient | null = null;

  constructor(
    private readonly createClient: ResendClientFactory = (apiKey) =>
      new Resend(apiKey) as unknown as ResendLikeClient,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const apiKey = (process.env.EMAIL_API_KEY ?? '').trim();
    if (apiKey.length === 0) {
      throw new Error(
        'EMAIL_API_KEY no está configurado: no se puede enviar el correo.',
      );
    }

    const from = (process.env.EMAIL_FROM ?? '').trim();
    if (from.length === 0) {
      throw new Error(
        'EMAIL_FROM no está configurado: no se puede enviar el correo.',
      );
    }

    // Buzón real al que van a parar las respuestas: el remitente pertenece al
    // subdominio de envío y nadie lo lee, así que sin esto responder a un
    // correo de la peluquería se pierde.
    const replyTo = (process.env.EMAIL_REPLY_TO ?? '').trim();

    this.client ??= this.createClient(apiKey);

    const { data, error } = await this.client.emails.send({
      from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      ...(message.html !== undefined ? { html: message.html } : {}),
      ...(replyTo.length > 0 ? { replyTo: [replyTo] } : {}),
    });

    if (error) {
      throw new Error(
        `Resend rechazó el envío a ${message.to}: ${JSON.stringify(error)}`,
      );
    }

    // El id permite rastrear el envío en el panel de Resend (Logs).
    this.logger.log(
      `Correo enviado a ${message.to} (id ${data?.id ?? 'sin id'}).`,
    );
  }
}
