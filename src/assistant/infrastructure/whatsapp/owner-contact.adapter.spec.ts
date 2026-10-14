import { WhatsAppMessage } from 'src/notifications/domain/ports/whatsapp-sender.port';
import { WhatsAppOwnerContactAdapter } from './owner-contact.adapter';

const DUENA = '573208977471';

function montar(
  config = { ownerPhone: DUENA, templateName: 'contacto_duena' },
) {
  const enviados: WhatsAppMessage[] = [];
  const adapter = new WhatsAppOwnerContactAdapter(
    { send: async (m) => void enviados.push(m) },
    config,
  );
  return { adapter, enviados };
}

describe('WhatsAppOwnerContactAdapter (plan 06, F6)', () => {
  it('envía la plantilla a la dueña con nombre, número legible y motivo', async () => {
    const { adapter, enviados } = montar();
    const r = await adapter.avisar({
      nombre: 'Ana',
      telefonoE164: '573001112233',
      motivo: 'Quiere un peinado de novia',
    });
    expect(r).toBe('enviado');
    expect(enviados).toEqual([
      {
        kind: 'template',
        to: DUENA,
        templateName: 'contacto_duena',
        bodyParams: ['Ana', '+57 300 111 2233', 'Quiere un peinado de novia'],
      },
    ]);
  });

  it('sin nombre, la plantilla dice que no lo indicó (D16)', async () => {
    const { adapter, enviados } = montar();
    await adapter.avisar({
      nombre: null,
      telefonoE164: '573001112233',
      motivo: 'Duda',
    });
    expect(enviados[0].kind === 'template' && enviados[0].bodyParams[0]).toBe(
      'No lo indicó',
    );
  });

  it('limpia lo que Meta rechazaría: saltos, tabuladores, espacios repetidos y largos', async () => {
    const { adapter, enviados } = montar();
    await adapter.avisar({
      nombre: '  Ana\n\tMaría     López  ',
      telefonoE164: '573001112233',
      motivo: 'x'.repeat(500),
    });
    const params =
      enviados[0].kind === 'template' ? enviados[0].bodyParams : [];
    expect(params[0]).toBe('Ana María López');
    expect(params[2].length).toBeLessThanOrEqual(200);
    expect(params[2].endsWith('…')).toBe(true);
  });

  it('un motivo en blanco no viaja vacío', async () => {
    const { adapter, enviados } = montar();
    await adapter.avisar({
      nombre: 'Ana',
      telefonoE164: '573001112233',
      motivo: ' \n ',
    });
    expect(enviados[0].kind === 'template' && enviados[0].bodyParams[2]).toBe(
      'No lo indicó',
    );
  });

  it.each([
    [
      'sin número de la dueña',
      { ownerPhone: '', templateName: 'contacto_duena' },
    ],
    ['sin plantilla', { ownerPhone: DUENA, templateName: '' }],
  ])('%s: no envía y lo dice', async (_caso, config) => {
    const { adapter, enviados } = montar(config);
    const r = await adapter.avisar({
      nombre: 'Ana',
      telefonoE164: '573001112233',
      motivo: 'x',
    });
    expect(r).toBe('sin_configurar');
    expect(enviados).toHaveLength(0);
  });

  it('un fallo del envío se propaga (la herramienta lo traduce)', async () => {
    const adapter = new WhatsAppOwnerContactAdapter(
      {
        send: async () => {
          throw new Error('Meta 400');
        },
      },
      { ownerPhone: DUENA, templateName: 'contacto_duena' },
    );
    await expect(
      adapter.avisar({
        nombre: 'Ana',
        telefonoE164: '573001112233',
        motivo: 'x',
      }),
    ).rejects.toThrow('Meta 400');
  });
});
