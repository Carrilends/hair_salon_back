import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from 'src/auth/entities/user.entity';
import { NOTIFIERS, WHATSAPP_SENDER } from './application/tokens';
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
