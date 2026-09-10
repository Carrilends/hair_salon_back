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
        kind: 'template',
        to: '573001234567',
        templateName: 'confirmacion_reserva',
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

  it('imprime los identificadores de los botones y de las filas, no solo su texto', async () => {
    // Son lo que hay que reenviar a mano al webhook para ejercitar el flujo sin
    // Meta: si no se imprimieran, la demostración sin credenciales no existiría.
    const log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const sender = new ConsoleWhatsAppSender();

    await sender.send({
      kind: 'interactive-list',
      to: '573001234567',
      body: 'Elige el día',
      buttonText: 'Ver días',
      rows: [{ id: 'RSDAY|r-1|2026-09-12', title: 'vie 12 sep' }],
    });

    const printed = String(log.mock.calls[0][0]);
    expect(printed).toContain('RSDAY|r-1|2026-09-12');
    expect(printed).toContain('vie 12 sep');

    log.mockRestore();
  });

  it('imprime el payload de los botones de una plantilla', async () => {
    const log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const sender = new ConsoleWhatsAppSender();

    await sender.send({
      kind: 'template',
      to: '573001234567',
      templateName: 'reserva_creada_cliente',
      bodyParams: ['x'],
      buttons: [{ index: 0, payload: 'CANCEL|r-1' }],
    });

    expect(String(log.mock.calls[0][0])).toContain('CANCEL|r-1');

    log.mockRestore();
  });
});
