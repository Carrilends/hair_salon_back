import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from 'src/auth/entities/user.entity';
import {
  CLIENT_WHATSAPP_CONFIG,
  NOTIFIERS,
  WHATSAPP_SENDER,
} from './application/tokens';
import { ClientWhatsAppConfig } from './infrastructure/whatsapp/client-whatsapp-notifier.adapter';
import { NotifierPort } from './domain/ports/notifier.port';
import { NotificationsModule } from './notifications.module';
import { ConsoleWhatsAppSender } from './infrastructure/whatsapp/console-whatsapp-sender.adapter';
import { CloudApiWhatsAppSender } from './infrastructure/whatsapp/cloud-api-whatsapp-sender.adapter';

/**
 * Verifica el cableado del módulo (arranque perezoso + degradación elegante): la
 * app arranca sin credenciales de WhatsApp y el canal queda en el fan-out. Es la
 * red que sustituye al smoke en vivo mientras falta la config de Marlene.
 */
async function compileModule() {
  return (
    Test.createTestingModule({ imports: [NotificationsModule] })
      // El repositorio de User solo lo usa el gateway para verificar el JWT; aquí
      // no hay base de datos, así que se sustituye por un doble vacío.
      .overrideProvider(getRepositoryToken(User))
      .useValue({})
      .compile()
  );
}

describe('NotificationsModule (cableado)', () => {
  const original = process.env.WHATSAPP_TOKEN;
  afterEach(() => {
    if (original === undefined) delete process.env.WHATSAPP_TOKEN;
    else process.env.WHATSAPP_TOKEN = original;
  });

  it('arranca sin WHATSAPP_TOKEN y usa el adaptador de consola', async () => {
    delete process.env.WHATSAPP_TOKEN;
    const moduleRef = await compileModule();

    expect(moduleRef.get(WHATSAPP_SENDER)).toBeInstanceOf(
      ConsoleWhatsAppSender,
    );
  });

  it('registra los cuatro canales, incluidos los dos de WhatsApp', async () => {
    // El arreglo `NOTIFIERS` es el ÚNICO sitio del sistema que enumera canales:
    // esta prueba es lo que impide que uno se quede sin cablear en silencio.
    delete process.env.WHATSAPP_TOKEN;
    const moduleRef = await compileModule();

    const notifiers = moduleRef.get<NotifierPort[]>(NOTIFIERS);
    expect(notifiers.map((n) => n.channel).sort()).toEqual([
      'correo',
      'websocket',
      'whatsapp',
      'whatsapp-dueña',
    ]);
  });

  it('usa la Cloud API cuando WHATSAPP_TOKEN está presente', async () => {
    process.env.WHATSAPP_TOKEN = 'TOK';
    const moduleRef = await compileModule();

    expect(moduleRef.get(WHATSAPP_SENDER)).toBeInstanceOf(
      CloudApiWhatsAppSender,
    );
  });
});

/**
 * Plan 06, F1: la variable es el interruptor de la cabecera de imagen. Un valor
 * en blanco (p. ej. `WHATSAPP_FALLBACK_IMAGE_URL= ` en Railway) tiene que
 * apagarla, no mandar a Meta una URL vacía.
 */
describe('NotificationsModule · WHATSAPP_FALLBACK_IMAGE_URL', () => {
  const original = process.env.WHATSAPP_FALLBACK_IMAGE_URL;
  afterEach(() => {
    if (original === undefined) delete process.env.WHATSAPP_FALLBACK_IMAGE_URL;
    else process.env.WHATSAPP_FALLBACK_IMAGE_URL = original;
  });

  it('en blanco deja el aviso sin cabecera', async () => {
    process.env.WHATSAPP_FALLBACK_IMAGE_URL = '   ';
    const moduleRef = await compileModule();

    expect(
      moduleRef.get<ClientWhatsAppConfig>(CLIENT_WHATSAPP_CONFIG)
        .fallbackImageUrl,
    ).toBeUndefined();
  });

  it('con valor llega a la config de la clienta', async () => {
    process.env.WHATSAPP_FALLBACK_IMAGE_URL =
      ' https://res.cloudinary.com/demo/image/upload/f_jpg,w_800/v1/r.jpg ';
    const moduleRef = await compileModule();

    expect(
      moduleRef.get<ClientWhatsAppConfig>(CLIENT_WHATSAPP_CONFIG)
        .fallbackImageUrl,
    ).toBe('https://res.cloudinary.com/demo/image/upload/f_jpg,w_800/v1/r.jpg');
  });
});
