import { parseFailedStatuses } from './parse-failed-statuses';

/**
 * Plan 06, F2. Meta acepta un envío con 200 y, si luego no puede entregarlo
 * (p. ej. no descarga la imagen de la cabecera), solo lo cuenta en el acuse de
 * estado `failed`. Sin leerlo, un aviso que nunca llegó es invisible.
 */
function sobreConEstados(statuses: unknown[]) {
  return {
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ field: 'messages', value: { statuses } }] }],
  };
}

describe('parseFailedStatuses', () => {
  it('devuelve los envíos fallidos con su destinatario y el error de Meta', () => {
    const fallos = parseFailedStatuses(
      sobreConEstados([
        { id: 'wamid.OK', status: 'delivered', recipient_id: '573001112233' },
        {
          id: 'wamid.MAL',
          status: 'failed',
          recipient_id: '573001112233',
          errors: [
            {
              code: 131053,
              title: 'Media upload error',
              error_data: { details: 'Unable to download the media' },
            },
          ],
        },
      ]),
    );

    expect(fallos).toEqual([
      {
        messageId: 'wamid.MAL',
        recipient: '573001112233',
        errors: ['131053 Media upload error: Unable to download the media'],
      },
    ]);
  });

  it('un fallo sin detalle sigue contando', () => {
    expect(
      parseFailedStatuses(
        sobreConEstados([{ id: 'wamid.X', status: 'failed' }]),
      ),
    ).toEqual([{ messageId: 'wamid.X', recipient: null, errors: [] }]);
  });

  it('nunca lanza ante un sobre raro', () => {
    expect(parseFailedStatuses(null)).toEqual([]);
    expect(parseFailedStatuses({ entry: 'no' })).toEqual([]);
    expect(
      parseFailedStatuses(sobreConEstados([null, 3, { status: 'failed' }])),
    ).toEqual([]);
  });
});
