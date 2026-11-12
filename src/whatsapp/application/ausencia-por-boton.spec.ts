import { WhatsAppMessage } from 'src/notifications/domain/ports/whatsapp-sender.port';
import {
  MAX_PAYLOAD_BYTES,
  encodeButtonPayload,
  parseButtonPayload,
} from '../domain/button-payload';
import { HandleInboundMessageUseCase } from './handle-inbound-message.use-case';
import { mensajeDeConfirmacion } from './mensaje-de-confirmacion';
import { mensajesDeLaRespuesta } from './respuesta-del-asistente';
import { ConfirmAbsencePresentation } from 'src/assistant/application/tools/assistant-presentation';
import { PendingAbsenceActionsPort } from '../domain/ports/pending-absence-actions.port';

/**
 * Ausencias por WhatsApp (2026-11-11): los botones «Confirmar» y «Descartar»
 * de una propuesta de ausencia. Lo que aplica la ausencia es el botón, nunca el
 * modelo, y solo desde el número de la dueña.
 */
const PID = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
const OTRO = '1b2c3d4e-5f60-4a3e-9a2f-2b1c3d4e5f60';
const CLIENTA = '573001112233';
const DUENA = '573208977471';

describe('ABS_OK / ABS_NO', () => {
  it('codificar y decodificar ABS_OK|uuid y ABS_NO|uuid', () => {
    for (const action of ['abs_ok', 'abs_no'] as const) {
      const codificado = encodeButtonPayload({ action, proposalId: PID });
      expect(codificado).toBe(
        `${action === 'abs_ok' ? 'ABS_OK' : 'ABS_NO'}|${PID}`,
      );
      expect(Buffer.byteLength(codificado)).toBeLessThanOrEqual(
        MAX_PAYLOAD_BYTES,
      );
      expect(parseButtonPayload(codificado)).toEqual({
        action,
        proposalId: PID,
      });
    }
  });

  it('no aceptan algo que no sea un uuid ni partes de más', () => {
    expect(parseButtonPayload('ABS_OK|no-es-uuid')).toBeNull();
    expect(parseButtonPayload('ABS_NO')).toBeNull();
    expect(parseButtonPayload(`ABS_OK|${PID}|x`)).toBeNull();
  });
});

describe('HandleInboundMessage · botones de la ausencia', () => {
  function montar(
    confirmado:
      | Awaited<ReturnType<PendingAbsenceActionsPort['confirm']>>
      | undefined = {
      ok: true,
      estilista: 'Lucía Ejemplo',
      fecha: 'jueves, 12 de noviembre de 2026',
      franja: 'de 8:00 a. m. a 12:00 p. m.',
      lineas: [
        '10:00 a. m. · Clienta Uno · pasa a Ana Prueba',
        '11:00 a. m. · Clienta Dos · cancelada, avísale',
      ],
    },
    descartado: { ok: true } | { ok: false; motivo: string } = { ok: true },
  ) {
    const enviados: WhatsAppMessage[] = [];
    const llamadas: unknown[][] = [];
    const ausencias: PendingAbsenceActionsPort = {
      confirm: async (id, phone) => {
        llamadas.push(['confirm', id, phone]);
        return confirmado!;
      },
      discard: async (id, phone) => {
        llamadas.push(['discard', id, phone]);
        return descartado;
      },
    };
    const sut = new HandleInboundMessageUseCase(
      {} as never,
      { send: async (m: WhatsAppMessage) => void enviados.push(m) } as never,
      { ownerPhone: DUENA, timeZone: 'America/Bogota' },
      { now: () => new Date('2026-11-12T12:05:00Z') } as never,
      undefined,
      undefined,
      undefined,
      ausencias,
    );
    return { sut, enviados, llamadas };
  }

  const texto = (m: WhatsAppMessage) => (m.kind === 'text' ? m.body : '');
  const pulsar = (action: 'abs_ok' | 'abs_no', from = DUENA) => ({
    messageId: 'wamid.A',
    from,
    kind: 'button' as const,
    payload: encodeButtonPayload({ action, proposalId: PID }),
    text: null,
  });

  it('ABS_OK del número de la dueña aplica la ausencia y responde una línea por cita', async () => {
    const { sut, enviados, llamadas } = montar();

    await sut.handle(pulsar('abs_ok'));

    expect(llamadas).toEqual([['confirm', PID, DUENA]]);
    expect(enviados).toHaveLength(1);
    expect(texto(enviados[0])).toBe(
      'Listo: Lucía Ejemplo queda ausente el jueves, 12 de noviembre de 2026, de 8:00 a. m. a 12:00 p. m.\n' +
        '10:00 a. m. · Clienta Uno · pasa a Ana Prueba\n' +
        '11:00 a. m. · Clienta Dos · cancelada, avísale',
    );
  });

  it('sin citas afectadas también lo dice', async () => {
    const { sut, enviados } = montar({
      ok: true,
      estilista: 'Lucía Ejemplo',
      fecha: 'jueves, 12 de noviembre de 2026',
      franja: 'todo el día',
      lineas: [],
    });

    await sut.handle(pulsar('abs_ok'));

    expect(texto(enviados[0])).toBe(
      'Listo: Lucía Ejemplo queda ausente el jueves, 12 de noviembre de 2026, todo el día. No tenía citas en esas horas.',
    );
  });

  it.each([
    ['vencida', /caducó/],
    ['usada', /ya se usó/],
    ['otro_numero', /No encuentro esa propuesta/],
    ['no_encontrada', /No encuentro esa propuesta/],
    ['ausencia_cruzada', /ya tiene una ausencia que se cruza/],
    ['ausencia_invalida', /ya pasó o no es válida/],
    ['error_desconocido', /No pude aplicar la ausencia/],
  ])(
    'ABS_OK que falla por %s → no aplica y lo explica',
    async (motivo, esperado) => {
      const { sut, enviados } = montar({ ok: false, motivo });

      await sut.handle(pulsar('abs_ok'));

      expect(texto(enviados[0])).toMatch(esperado);
      expect(texto(enviados[0])).not.toMatch(/^Listo/);
    },
  );

  it('ABS_OK desde otro número: ni se intenta', async () => {
    const { sut, enviados, llamadas } = montar();

    await sut.handle(pulsar('abs_ok', CLIENTA));

    expect(llamadas).toEqual([]);
    expect(texto(enviados[0])).toMatch(/No encuentro esa propuesta/);
  });

  it('ABS_NO descarta', async () => {
    const { sut, enviados, llamadas } = montar();

    await sut.handle(pulsar('abs_no'));

    expect(llamadas).toEqual([['discard', PID, DUENA]]);
    expect(texto(enviados[0])).toMatch(/no la marco/i);
  });

  it('ABS_NO ya usado lo explica', async () => {
    const { sut, enviados } = montar(undefined, {
      ok: false,
      motivo: 'usada',
    });

    await sut.handle(pulsar('abs_no'));

    expect(texto(enviados[0])).toMatch(/ya se usó/);
  });

  it('sin el puerto cableado, el botón no se reconoce', async () => {
    const enviados: WhatsAppMessage[] = [];
    const sut = new HandleInboundMessageUseCase(
      {} as never,
      { send: async (m: WhatsAppMessage) => void enviados.push(m) } as never,
      { ownerPhone: DUENA, timeZone: 'America/Bogota' },
      { now: () => new Date() } as never,
    );

    await sut.handle(pulsar('abs_ok'));

    expect(texto(enviados[0])).toMatch(/ya no está disponible/);
  });
});

describe('confirmar-ausencia en WhatsApp', () => {
  const presentacion = (
    over: Partial<ConfirmAbsencePresentation> = {},
  ): ConfirmAbsencePresentation => ({
    tipo: 'confirmar-ausencia',
    propuestaId: PID,
    estilista: 'Lucía Ejemplo',
    fecha: 'jueves, 12 de noviembre de 2026',
    franja: 'de 8:00 a. m. a 12:00 p. m.',
    resumen: '1 cita pasa a otra estilista y 1 se cancela',
    lineas: [
      '9:00 a. m. · Clienta Uno · pasa a Ana Prueba',
      '10:00 a. m. · Clienta Dos · se cancela',
    ],
    ...over,
  });

  it('vista previa con los botones Confirmar y Descartar', () => {
    const m = mensajeDeConfirmacion(presentacion(), DUENA);

    expect(m).toMatchObject({ kind: 'interactive-buttons', to: DUENA });
    if (m?.kind !== 'interactive-buttons') throw new Error('sin botones');
    expect(m.body).toContain('Lucía Ejemplo');
    expect(m.body).toContain('de 8:00 a. m. a 12:00 p. m.');
    expect(m.body).toContain('1 cita pasa a otra estilista y 1 se cancela');
    expect(m.body).toContain('10:00 a. m. · Clienta Dos · se cancela');
    expect(m.body).toMatch(/No se aplica hasta que pulses «Confirmar»/);
    expect(m.buttons.map((b) => b.title)).toEqual(['Confirmar', 'Descartar']);
    expect(m.buttons.map((b) => parseButtonPayload(b.id))).toEqual([
      { action: 'abs_ok', proposalId: PID },
      { action: 'abs_no', proposalId: PID },
    ]);
  });

  it('solo la última propuesta de ausencia del turno lleva botones', () => {
    const mensajes = mensajesDeLaRespuesta(
      {
        reply: 'Revisa la ausencia y pulsa Confirmar.',
        presentaciones: [presentacion({ propuestaId: OTRO }), presentacion()],
      },
      DUENA,
      null,
    );

    const conBotones = mensajes.filter((m) => m.kind === 'interactive-buttons');
    expect(conBotones).toHaveLength(1);
    if (conBotones[0].kind !== 'interactive-buttons') throw new Error();
    expect(parseButtonPayload(conBotones[0].buttons[0].id)).toEqual({
      action: 'abs_ok',
      proposalId: PID,
    });
  });
});
