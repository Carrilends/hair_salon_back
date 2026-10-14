import { WhatsAppMessage } from 'src/notifications/domain/ports/whatsapp-sender.port';
import {
  encodeButtonPayload,
  parseButtonPayload,
} from '../domain/button-payload';
import { HandleInboundMessageUseCase } from './handle-inbound-message.use-case';
import { mensajeDeConfirmacion } from './mensaje-de-confirmacion';

/**
 * Plan 06, F4 (D4): los botones que escriben en la agenda en lugar del modelo.
 */
const PID = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
const RID = '4d2f0e4e-6f1b-4a3e-9a2f-2b1c3d4e5f60';
const CLIENTA = '573001112233';
const DUENA = '573208977471';
const CITA = {
  fecha: 'martes, 20 de octubre de 2026',
  hora: '10:00 a. m.',
  servicios: ['Corte'],
};

describe('BOOK_OK / BOOK_NO', () => {
  it('ida y vuelta con el id de la propuesta', () => {
    for (const action of ['book_ok', 'book_no'] as const) {
      const codificado = encodeButtonPayload({ action, bookingId: PID });
      expect(parseButtonPayload(codificado)).toEqual({
        action,
        bookingId: PID,
      });
    }
  });

  it('no aceptan algo que no sea un uuid', () => {
    expect(parseButtonPayload('BOOK_OK|no-es-uuid')).toBeNull();
    expect(parseButtonPayload('BOOK_NO')).toBeNull();
  });

  it('los códigos nuevos no chocan con los existentes', () => {
    const codigos = [
      encodeButtonPayload({ action: 'book_ok', bookingId: PID }),
      encodeButtonPayload({ action: 'book_no', bookingId: PID }),
      encodeButtonPayload({ action: 'cancel', reservationId: RID }),
      encodeButtonPayload({ action: 'cancel_ok', reservationId: RID }),
      encodeButtonPayload({ action: 'confirm', reservationId: RID }),
      encodeButtonPayload({ action: 'reschedule', reservationId: RID }),
      encodeButtonPayload({ action: 'reservation', reservationId: RID }),
      encodeButtonPayload({ action: 'noop' }),
    ].map((c) => c.split('|')[0]);

    expect(new Set(codigos).size).toBe(codigos.length);
  });
});

describe('HandleInboundMessage · botones de la propuesta', () => {
  function montar(resultado: { ok: boolean; motivo?: string }) {
    const enviados: WhatsAppMessage[] = [];
    const llamadas: unknown[][] = [];
    const propuestas = {
      confirm: async (id: string, phone: string) => {
        llamadas.push(['confirm', id, phone]);
        return resultado.ok
          ? { ok: true as const, scheduledAt: new Date('2026-10-20T15:00:00Z') }
          : { ok: false as const, motivo: resultado.motivo! };
      },
      discard: async (id: string, phone: string) => {
        llamadas.push(['discard', id, phone]);
        return resultado.ok
          ? { ok: true as const }
          : { ok: false as const, motivo: resultado.motivo! };
      },
    };
    const sut = new HandleInboundMessageUseCase(
      {} as never,
      { send: async (m: WhatsAppMessage) => void enviados.push(m) } as never,
      { ownerPhone: DUENA, timeZone: 'America/Bogota' },
      { now: () => new Date('2026-10-14T15:00:00Z') } as never,
      propuestas,
    );
    return { sut, enviados, llamadas };
  }

  const texto = (m: WhatsAppMessage) => (m.kind === 'text' ? m.body : '');
  const pulsar = (action: 'book_ok' | 'book_no', from = CLIENTA) => ({
    messageId: 'wamid.X',
    from,
    kind: 'button' as const,
    payload: encodeButtonPayload({ action, bookingId: PID }),
    text: null,
  });

  it('«Confirmar» confirma con el número firmado de quien pulsa', async () => {
    const { sut, enviados, llamadas } = montar({ ok: true });

    await sut.handle(pulsar('book_ok'));

    expect(llamadas).toEqual([['confirm', PID, CLIENTA]]);
    expect(texto(enviados[0])).toMatch(/^¡Listo! Tu reserva quedó registrada/);
  });

  it.each([
    ['hora_ocupada', /se acaba de ocupar/],
    ['vencida', /caducó/],
    ['usada', /ya se usó/],
    ['otro_numero', /No encuentro esa propuesta/],
    ['no_encontrada', /No encuentro esa propuesta/],
    ['fuera_de_horario', /No pude registrar la reserva/],
  ])('si falla por %s, lo explica', async (motivo, esperado) => {
    const { sut, enviados } = montar({ ok: false, motivo });

    await sut.handle(pulsar('book_ok'));

    expect(texto(enviados[0])).toMatch(esperado);
  });

  it('la dueña pulsando el «Confirmar» de una clienta: se confirma con SU número y no pasa', async () => {
    const { sut, enviados, llamadas } = montar({
      ok: false,
      motivo: 'otro_numero',
    });

    await sut.handle(pulsar('book_ok', DUENA));

    expect(llamadas).toEqual([['confirm', PID, DUENA]]);
    expect(texto(enviados[0])).toMatch(/No encuentro esa propuesta/);
  });

  it('«Cambiar» descarta la propuesta y le pregunta qué cambiar', async () => {
    const { sut, enviados, llamadas } = montar({ ok: true });

    await sut.handle(pulsar('book_no'));

    expect(llamadas).toEqual([['discard', PID, CLIENTA]]);
    expect(texto(enviados[0])).toMatch(/no la reservo/i);
  });

  it('sin el puerto cableado, el botón no se reconoce', async () => {
    const enviados: WhatsAppMessage[] = [];
    const sut = new HandleInboundMessageUseCase(
      {} as never,
      { send: async (m: WhatsAppMessage) => void enviados.push(m) } as never,
      { ownerPhone: DUENA, timeZone: 'America/Bogota' },
      { now: () => new Date() } as never,
    );

    await sut.handle(pulsar('book_ok'));

    expect(texto(enviados[0])).toMatch(/ya no está disponible/);
  });
});

describe('mensajeDeConfirmacion (lo que enviará F5)', () => {
  const ids = (m: WhatsAppMessage | null) =>
    m?.kind === 'interactive-buttons' ? m.buttons.map((b) => b.id) : [];

  it('reserva: resumen y botones Confirmar / Cambiar con el id de la propuesta', () => {
    const m = mensajeDeConfirmacion(
      {
        tipo: 'confirmar-reserva',
        propuestaId: PID,
        nombre: 'Ana',
        servicios: ['Corte', 'Tinte'],
        fecha: 'martes, 20 de octubre',
        hora: '10:00 a. m.',
      },
      CLIENTA,
    );

    expect(m).toMatchObject({ kind: 'interactive-buttons', to: CLIENTA });
    expect(m && m.kind === 'interactive-buttons' && m.body).toContain(
      'Corte, Tinte',
    );
    expect(ids(m).map(parseButtonPayload)).toEqual([
      { action: 'book_ok', bookingId: PID },
      { action: 'book_no', bookingId: PID },
    ]);
  });

  it('cancelar: el botón es el CANCEL_OK que ya existía', () => {
    expect(
      ids(
        mensajeDeConfirmacion(
          { tipo: 'confirmar-cancelacion', reservaId: RID, cita: CITA },
          CLIENTA,
        ),
      ).map(parseButtonPayload),
    ).toEqual([
      { action: 'cancel_ok', reservationId: RID },
      { action: 'noop' },
    ]);
  });

  it('mover: el botón es el RSAT que ya existía, con la hora del salón', () => {
    expect(
      ids(
        mensajeDeConfirmacion(
          {
            tipo: 'confirmar-cambio',
            reservaId: RID,
            cuandoLocal: '2026-10-20T15:30',
            fecha: 'martes, 20 de octubre',
            hora: '3:30 p. m.',
            cita: CITA,
          },
          CLIENTA,
        ),
      ).map(parseButtonPayload),
    ).toEqual([
      {
        action: 'reschedule_at',
        reservationId: RID,
        whenYmdHm: '2026-10-20T15:30',
      },
      { action: 'noop' },
    ]);
  });

  it('cancelar y mover dicen QUÉ cita, con los datos de la base (revisión de F4)', () => {
    const cancelar = mensajeDeConfirmacion(
      {
        tipo: 'confirmar-cancelacion',
        reservaId: RID,
        cita: { ...CITA, clienta: 'Lucía' },
      },
      DUENA,
    );
    const mover = mensajeDeConfirmacion(
      {
        tipo: 'confirmar-cambio',
        reservaId: RID,
        cuandoLocal: '2026-10-21T09:00',
        fecha: 'miércoles, 21 de octubre de 2026',
        hora: '9:00 a. m.',
        cita: CITA,
      },
      CLIENTA,
    );

    expect(cancelar?.kind === 'interactive-buttons' && cancelar.body).toBe(
      '¿Cancelo la cita del martes, 20 de octubre de 2026 a las 10:00 a. m. (Corte), de Lucía?',
    );
    expect(mover?.kind === 'interactive-buttons' && mover.body).toBe(
      '¿Cambio la cita del martes, 20 de octubre de 2026 a las 10:00 a. m. (Corte) al miércoles, 21 de octubre de 2026 a las 9:00 a. m.?',
    );
  });

  it('las presentaciones de la web no se convierten en botones', () => {
    expect(
      mensajeDeConfirmacion({ tipo: 'servicios', servicios: [] }, CLIENTA),
    ).toBeNull();
  });

  it('ningún título de botón pasa de 20 caracteres (límite de Meta)', () => {
    const todos = [
      mensajeDeConfirmacion(
        {
          tipo: 'confirmar-reserva',
          propuestaId: PID,
          nombre: 'A',
          servicios: [],
          fecha: '',
          hora: '',
        },
        CLIENTA,
      ),
      mensajeDeConfirmacion(
        { tipo: 'confirmar-cancelacion', reservaId: RID, cita: CITA },
        CLIENTA,
      ),
      mensajeDeConfirmacion(
        {
          tipo: 'confirmar-cambio',
          reservaId: RID,
          cuandoLocal: '2026-10-20T15:30',
          fecha: '',
          hora: '',
          cita: CITA,
        },
        CLIENTA,
      ),
    ];
    for (const m of todos) {
      if (m?.kind !== 'interactive-buttons')
        throw new Error('se esperaban botones');
      for (const b of m.buttons) expect(b.title.length).toBeLessThanOrEqual(20);
    }
  });
});
