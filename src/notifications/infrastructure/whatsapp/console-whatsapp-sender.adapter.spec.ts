import { Logger } from '@nestjs/common';
import { ConsoleWhatsAppSender } from './console-whatsapp-sender.adapter';

/**
 * Adaptador de desarrollo: no envía nada, imprime el mensaje. Es el transporte
 * por defecto cuando no hay `WHATSAPP_TOKEN`, igual que el de correo (E3): deja
 * ejercitar el flujo completo sin credenciales ni red.
 */
describe('ConsoleWhatsAppSender', () => {
  it('registra el envío simulado con el destinatario y los parámetros, sin lanzar', async () => {
    const log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const sender = new ConsoleWhatsAppSender();

    await expect(
      sender.send({
        to: '573001234567',
        bodyParams: ['sábado', 'Ana', 'Corte'],
      }),
    ).resolves.toBeUndefined();

    expect(log).toHaveBeenCalledTimes(1);
    const printed = String(log.mock.calls[0][0]);
    expect(printed).toContain('573001234567');
    expect(printed).toContain('sábado');
    expect(printed).toContain('Corte');

    log.mockRestore();
  });
});
