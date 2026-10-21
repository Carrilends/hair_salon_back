import { WhatsAppMessage } from 'src/notifications/domain/ports/whatsapp-sender.port';
import { ReservationActor } from 'src/reservations/domain/reservation-actor';
import {
  RescheduleTooLateError,
  ReservationOwnershipError,
  WorkerOverlapError,
  ChosenWorkerBusyError,
  InvalidStatusTransitionError,
} from 'src/reservations/domain/errors';
import { HandleInboundMessageUseCase } from './handle-inbound-message.use-case';
import { ReservationSummary } from '../domain/ports/reservation-actions.port';
import { InboundMessage } from '../domain/inbound-message';

const RID = '4d2f0e4e-6f1b-4a3e-9a2f-2b1c3d4e5f60';
const AJENA = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const CLIENTA = '573001112233';
const DUENA = '573208977471';
const AHORA = new Date('2026-09-10T15:00:00.000Z');

function cita(over: Partial<ReservationSummary> = {}): ReservationSummary {
  return {
    id: RID,
    scheduledAt: new Date('2026-09-12T20:00:00.000Z'), // 3:00 p. m. Bogotá
    status: 'pendiente',
    workerId: 'w-1',
    workerName: 'Marlene',
    // Sin marcar por defecto: es el caso mayoritario («Sin preferencia» en el
    // portal, o el chat, que nunca manda estilista). Las pruebas del aviso
    // construyen las suyas con el valor que necesitan.
    workerPinned: false,
    totalDurationMinutes: 60,
    serviceNames: ['Corte'],
    ...over,
  };
}

interface Escenario {
  citas?: ReservationSummary[];
  /** Las que `findActionableByPhone` da como del remitente; por defecto, todas. */
  suyas?: ReservationSummary[];
  dias?: string[];
  horas?: string[];
  alCancelar?: () => never;
  alMover?: () => never;
  alConfirmar?: () => never;
}

function montar(escenario: Escenario = {}) {
  const enviados: WhatsAppMessage[] = [];
  const llamadas: { accion: string; args: unknown[] }[] = [];
  const citas = escenario.citas ?? [cita()];

  const reservas = {
    findActionableByPhone: async (phone: string) => {
      llamadas.push({ accion: 'findActionableByPhone', args: [phone] });
      return escenario.suyas ?? citas;
    },
    findById: async (id: string) => citas.find((c) => c.id === id) ?? null,
    cancel: async (id: string, actor: ReservationActor) => {
      llamadas.push({ accion: 'cancel', args: [id, actor] });
      if (escenario.alCancelar) escenario.alCancelar();
    },
    reschedule: async (id: string, iso: string, actor: ReservationActor) => {
      llamadas.push({ accion: 'reschedule', args: [id, iso, actor] });
      if (escenario.alMover) escenario.alMover();
    },
    confirm: async (id: string) => {
      llamadas.push({ accion: 'confirm', args: [id] });
      if (escenario.alConfirmar) escenario.alConfirmar();
    },
    daysWithAvailability: async () => escenario.dias ?? ['2026-09-12'],
    slotsFor: async () => escenario.horas ?? ['09:00', '15:30'],
  };

  const sender = {
    send: async (m: WhatsAppMessage) => {
      enviados.push(m);
    },
  };

  const sut = new HandleInboundMessageUseCase(
    reservas as never,
    sender as never,
    { ownerPhone: DUENA, timeZone: 'America/Bogota' },
    { now: () => AHORA } as never,
  );

  return { sut, enviados, llamadas };
}

function mensaje(over: Partial<InboundMessage> = {}): InboundMessage {
  return {
    messageId: 'wamid.A',
    from: CLIENTA,
    payload: null,
    text: null,
    ...over,
  };
}

/** Estrecha la unión para poder leer las filas de una lista. */
function comoLista(m: WhatsAppMessage) {
  if (m.kind !== 'interactive-list') throw new Error(`no es lista: ${m.kind}`);
  return m;
}
function comoBotones(m: WhatsAppMessage) {
  if (m.kind !== 'interactive-buttons')
    throw new Error(`no son botones: ${m.kind}`);
  return m;
}
function comoTexto(m: WhatsAppMessage) {
  if (m.kind !== 'text') throw new Error(`no es texto: ${m.kind}`);
  return m;
}

describe('HandleInboundMessage · identidad', () => {
  it('un número cualquiera actúa como actor phone, NUNCA como usuario con sesión', async () => {
    // Es la regla dura del canal: la identidad es el `wa_id` que Meta verifica,
    // y este borde no fabrica un `userId` a partir de un teléfono.
    const { sut, llamadas } = montar();

    await sut.handle(mensaje({ payload: `CANCEL_OK|${RID}` }));

    const cancel = llamadas.find((l) => l.accion === 'cancel');
    expect(cancel?.args[1]).toEqual({ kind: 'phone', phoneE164: CLIENTA });
  });

  it('el número de la peluquería actúa como administración', async () => {
    const { sut, llamadas } = montar();

    await sut.handle(mensaje({ from: DUENA, payload: `CANCEL_OK|${RID}` }));

    expect(llamadas.find((l) => l.accion === 'cancel')?.args[1]).toEqual({
      kind: 'admin',
    });
  });

  it('normaliza el remitente antes de compararlo con el de la peluquería', async () => {
    const { sut, llamadas } = montar();

    await sut.handle(
      mensaje({ from: '+57 320 897 7471', payload: `CANCEL_OK|${RID}` }),
    );

    expect(llamadas.find((l) => l.accion === 'cancel')?.args[1]).toEqual({
      kind: 'admin',
    });
  });

  it('ignora un remitente que no es un móvil colombiano', async () => {
    const { sut, enviados, llamadas } = montar();

    await sut.handle(mensaje({ from: '12345', payload: `CANCEL_OK|${RID}` }));

    expect(enviados).toHaveLength(0);
    expect(llamadas).toHaveLength(0);
  });
});

describe('HandleInboundMessage · cancelar', () => {
  it('el primer toque pide confirmación y NO cancela nada', async () => {
    // Dos pulsaciones a propósito: un toque accidental no borra una cita.
    const { sut, enviados, llamadas } = montar();

    await sut.handle(mensaje({ payload: `CANCEL|${RID}` }));

    expect(llamadas.some((l) => l.accion === 'cancel')).toBe(false);
    const botones = comoBotones(enviados[0]);
    expect(botones.buttons.map((b) => b.id)).toEqual([
      `CANCEL_OK|${RID}`,
      'NOOP',
    ]);
  });

  it('el segundo toque cancela y lo confirma', async () => {
    const { sut, enviados, llamadas } = montar();

    await sut.handle(mensaje({ payload: `CANCEL_OK|${RID}` }));

    expect(llamadas.some((l) => l.accion === 'cancel')).toBe(true);
    expect(comoTexto(enviados[0]).body).toContain('cancelada');
  });

  it('«No, dejarla» no hace nada ni responde', async () => {
    const { sut, enviados, llamadas } = montar();

    await sut.handle(mensaje({ payload: 'NOOP' }));

    expect(enviados).toHaveLength(0);
    expect(llamadas).toHaveLength(0);
  });

  it('un número ajeno recibe un rechazo legible y la cita no cambia', async () => {
    const { sut, enviados } = montar({
      alCancelar: () => {
        throw new ReservationOwnershipError();
      },
    });

    await sut.handle(mensaje({ payload: `CANCEL_OK|${RID}` }));

    expect(comoTexto(enviados[0]).body).toContain('no está a nombre');
  });

  it('fuera de plazo se explica en vez de fallar en silencio', async () => {
    const { sut, enviados } = montar({
      alCancelar: () => {
        throw new RescheduleTooLateError();
      },
    });

    await sut.handle(mensaje({ payload: `CANCEL_OK|${RID}` }));

    expect(comoTexto(enviados[0]).body).toContain('Ya pasó la hora');
  });
});

describe('HandleInboundMessage · confirmar (solo la peluquería)', () => {
  it('la peluquería confirma', async () => {
    const { sut, llamadas } = montar();

    await sut.handle(mensaje({ from: DUENA, payload: `CONFIRM|${RID}` }));

    expect(llamadas.some((l) => l.accion === 'confirm')).toBe(true);
  });

  it('confirmar una cita que ya estaba confirmada lo dice, sin error (E2E 2026-10-20)', async () => {
    // El aviso de «hora cambiada por la clienta» vuelve a ofrecer «Confirmar»,
    // pero la cita sigue confirmada: el dominio rechaza confirmada → confirmada.
    const { sut, enviados } = montar({
      citas: [cita({ status: 'confirmada' })],
      alConfirmar: () => {
        throw new InvalidStatusTransitionError('confirmada', 'confirmada');
      },
    });

    await sut.handle(mensaje({ from: DUENA, payload: `CONFIRM|${RID}` }));

    expect(comoTexto(enviados[0]).body).toBe('Esa cita ya estaba confirmada.');
  });

  it('confirmar una cita cancelada dice que ya no se puede', async () => {
    const { sut, enviados } = montar({
      citas: [cita({ status: 'cancelada' })],
      alConfirmar: () => {
        throw new InvalidStatusTransitionError('cancelada', 'confirmada');
      },
    });

    await sut.handle(mensaje({ from: DUENA, payload: `CONFIRM|${RID}` }));

    expect(comoTexto(enviados[0]).body).toBe(
      'Esa cita ya no se puede confirmar.',
    );
  });

  it('una clienta NO puede confirmar aunque fabrique el payload', async () => {
    // `ConfirmReservationUseCase` no comprueba actor —su autorización vive en el
    // borde HTTP—, así que la guarda tiene que estar aquí.
    const { sut, enviados, llamadas } = montar();

    await sut.handle(mensaje({ payload: `CONFIRM|${RID}` }));

    expect(llamadas.some((l) => l.accion === 'confirm')).toBe(false);
    expect(comoTexto(enviados[0]).body).toContain('la peluquería');
  });
});

describe('HandleInboundMessage · reprogramar', () => {
  it('ofrece primero los días con hueco', async () => {
    const { sut, enviados } = montar({ dias: ['2026-09-12', '2026-09-13'] });

    await sut.handle(mensaje({ payload: `RESCHED|${RID}` }));

    const lista = comoLista(enviados[0]);
    expect(lista.rows.map((r) => r.id)).toEqual([
      `RSDAY|${RID}|2026-09-12`,
      `RSDAY|${RID}|2026-09-13`,
    ]);
  });

  it('avisa si no hay ningún día con hueco', async () => {
    const { sut, enviados } = montar({ dias: [] });

    await sut.handle(mensaje({ payload: `RESCHED|${RID}` }));

    expect(comoTexto(enviados[0]).body).toContain('No veo días con hueco');
  });

  it('elegido el día, ofrece las horas', async () => {
    const { sut, enviados } = montar({ horas: ['09:00', '15:30'] });

    await sut.handle(mensaje({ payload: `RSDAY|${RID}|2026-09-12` }));

    const lista = comoLista(enviados[0]);
    expect(lista.rows.map((r) => r.id)).toEqual([
      `RSAT|${RID}|2026-09-12T09:00`,
      `RSAT|${RID}|2026-09-12T15:30`,
    ]);
    expect(lista.rows[1].title).toBe('3:30 p. m.');
  });

  it('con más de diez horas, la décima fila lleva al siguiente tramo', async () => {
    // Diez filas es el tope de la plataforma, no una decisión de diseño.
    const muchas = Array.from(
      { length: 14 },
      (_, i) => `${String(8 + i).padStart(2, '0')}:00`,
    );
    const { sut, enviados } = montar({ horas: muchas });

    await sut.handle(mensaje({ payload: `RSDAY|${RID}|2026-09-12` }));

    const lista = comoLista(enviados[0]);
    expect(lista.rows).toHaveLength(10);
    expect(lista.rows[9]).toMatchObject({
      id: `RSDAY|${RID}|2026-09-12|9`,
      title: 'Ver más horas',
    });
  });

  it('el segundo tramo continúa donde acabó el primero', async () => {
    const muchas = Array.from(
      { length: 14 },
      (_, i) => `${String(8 + i).padStart(2, '0')}:00`,
    );
    const { sut, enviados } = montar({ horas: muchas });

    await sut.handle(mensaje({ payload: `RSDAY|${RID}|2026-09-12|9` }));

    const lista = comoLista(enviados[0]);
    expect(lista.rows).toHaveLength(5); // 14 - 9
    expect(lista.rows[0].id).toBe(`RSAT|${RID}|2026-09-12T17:00`);
  });

  it('NINGUNA lista supera nunca las diez filas', async () => {
    const muchisimas = Array.from(
      { length: 40 },
      (_, i) => `${String(i % 24).padStart(2, '0')}:00`,
    );
    const { sut, enviados } = montar({
      horas: muchisimas,
      dias: Array.from(
        { length: 40 },
        (_, i) => `2026-10-${String((i % 28) + 1).padStart(2, '0')}`,
      ),
    });

    await sut.handle(mensaje({ payload: `RESCHED|${RID}` }));
    await sut.handle(mensaje({ payload: `RSDAY|${RID}|2026-09-12` }));

    for (const m of enviados) {
      if (m.kind === 'interactive-list') {
        expect(m.rows.length).toBeLessThanOrEqual(10);
      }
    }
  });

  it('elegida la hora, mueve la cita convirtiendo a UTC desde la zona del salón', async () => {
    const { sut, enviados, llamadas } = montar();

    await sut.handle(mensaje({ payload: `RSAT|${RID}|2026-09-12T15:30` }));

    const mover = llamadas.find((l) => l.accion === 'reschedule');
    // 15:30 en Bogotá = 20:30 UTC. Si se hubiera interpretado en la zona del
    // servidor, la cita saldría cinco horas corrida.
    expect(mover?.args[1]).toBe('2026-09-12T20:30:00.000Z');
    expect(comoTexto(enviados[0]).body).toContain('3:30 p. m.');
  });

  it('si la franja se ocupó entre medias, lo dice y vuelve a ofrecer el día', async () => {
    // Es el único fallo que la clienta puede resolver sola: dejarla en un
    // callejón sin salida sería lo peor que podría pasar en este flujo.
    const { sut, enviados } = montar({
      horas: ['09:00'],
      alMover: () => {
        throw new WorkerOverlapError();
      },
    });

    await sut.handle(mensaje({ payload: `RSAT|${RID}|2026-09-12T15:30` }));

    expect(comoTexto(enviados[0]).body).toContain('acaba de ocuparse');
    expect(comoLista(enviados[1]).rows[0].id).toBe(
      `RSAT|${RID}|2026-09-12T09:00`,
    );
  });

  it('si la ocupada es la estilista que ella eligió, lo dice y NO la deja atascada', async () => {
    // `ChosenWorkerBusyError` hereda de `WorkerOverlapError`, así que lo que hay
    // que comprobar es doble: que el bucle de «vuelve a ofrecer el día» sigue
    // entrando (si el `instanceof` se rompiera, la clienta acabaría en un
    // callejón sin salida) y que el texto no le miente diciéndole que la hora se
    // acaba de ocupar, cuando lo que pasa es que su estilista no la tiene libre.
    const { sut, enviados } = montar({
      horas: ['09:00'],
      alMover: () => {
        throw new ChosenWorkerBusyError();
      },
    });

    await sut.handle(mensaje({ payload: `RSAT|${RID}|2026-09-12T15:30` }));

    expect(comoTexto(enviados[0]).body).toContain('estilista');
    expect(comoLista(enviados[1]).rows[0].id).toBe(
      `RSAT|${RID}|2026-09-12T09:00`,
    );
  });

  it('avisa si ese día ya no queda hueco', async () => {
    const { sut, enviados } = montar({ horas: [] });

    await sut.handle(mensaje({ payload: `RSDAY|${RID}|2026-09-12` }));

    expect(comoTexto(enviados[0]).body).toContain('ya no queda hueco');
  });
});

describe('HandleInboundMessage · texto libre', () => {
  it('sin citas, lo dice claro', async () => {
    const { sut, enviados } = montar({ citas: [] });

    await sut.handle(mensaje({ text: 'hola' }));

    expect(comoTexto(enviados[0]).body).toContain('No encuentro citas');
  });

  it('con una sola cita, ofrece directamente sus acciones', async () => {
    const { sut, enviados } = montar();

    await sut.handle(mensaje({ text: 'quiero cambiar mi cita' }));

    const botones = comoBotones(enviados[0]);
    expect(botones.buttons.map((b) => b.id)).toEqual([
      `CANCEL|${RID}`,
      `RESCHED|${RID}`,
    ]);
  });

  it('a la clienta no se le ofrece el botón de confirmar', async () => {
    const { sut, enviados } = montar();

    await sut.handle(mensaje({ text: 'hola' }));

    expect(
      comoBotones(enviados[0]).buttons.some((b) => b.id.startsWith('CONFIRM')),
    ).toBe(false);
  });

  it('a la peluquería sí', async () => {
    const { sut, enviados } = montar();

    await sut.handle(mensaje({ from: DUENA, payload: `RESV|${RID}` }));

    expect(
      comoBotones(enviados[0]).buttons.some((b) => b.id.startsWith('CONFIRM')),
    ).toBe(true);
  });

  it('con varias citas, ofrece la lista para elegir', async () => {
    const { sut, enviados } = montar({
      citas: [cita(), cita({ id: AJENA, serviceNames: ['Tinte'] })],
    });

    await sut.handle(mensaje({ text: 'hola' }));

    const lista = comoLista(enviados[0]);
    expect(lista.rows.map((r) => r.id)).toEqual([
      `RESV|${RID}`,
      `RESV|${AJENA}`,
    ]);
  });

  it('un payload corrupto se trata como texto libre, no revienta', async () => {
    const { sut, enviados } = montar();

    await sut.handle(mensaje({ payload: 'EXPLOTA|no-es-uuid' }));

    expect(enviados).toHaveLength(1);
  });
});

describe('HandleInboundMessage · no filtra citas ajenas', () => {
  it('no muestra los datos de una cita que no es de ese número', async () => {
    // El payload es un puntero, no una credencial: alguien podría fabricar uno
    // con el id de otra cita. Los datos no salen antes de comprobar la propiedad.
    const { sut, enviados } = montar({
      citas: [
        cita({ id: AJENA, workerName: 'Otra', serviceNames: ['Secreto'] }),
      ],
    });

    await sut.handle(mensaje({ payload: `RESV|${RID}` }));

    expect(comoTexto(enviados[0]).body).toContain('No encuentro esa cita');
  });
});

describe('HandleInboundMessage · cancelar y cambiar fecha no enseñan citas ajenas', () => {
  // La cita existe (findById la encuentra), pero no está entre las del número.
  // Sin comprobar la propiedad, «Cancelar» mostraba su fecha y «Cambiar fecha»
  // sus servicios, su duración y los huecos del día (hallazgo de la F4).
  const ajena = () =>
    montar({
      citas: [cita({ serviceNames: ['Secreto'] })],
      suyas: [],
    });

  it.each([
    ['Cancelar', `CANCEL|${RID}`],
    ['Cambiar fecha', `RESCHED|${RID}`],
    ['elegir día', `RSDAY|${RID}|2026-09-12`],
  ])(
    '%s con una cita de otro número solo dice que no la encuentra',
    async (_, payload) => {
      const { sut, enviados } = ajena();

      await sut.handle(mensaje({ payload }));

      expect(enviados).toHaveLength(1);
      expect(comoTexto(enviados[0]).body).toBe('No encuentro esa cita.');
    },
  );

  it.each([
    ['Cancelar', `CANCEL|${RID}`, 'interactive-buttons'],
    ['Cambiar fecha', `RESCHED|${RID}`, 'interactive-list'],
    ['elegir día', `RSDAY|${RID}|2026-09-12`, 'interactive-list'],
  ])(
    '%s sigue funcionando para la peluquería con cualquier cita',
    async (_, payload, kind) => {
      const { sut, enviados } = ajena();

      await sut.handle(mensaje({ from: DUENA, payload }));

      expect(enviados[0].kind).toBe(kind);
    },
  );
});

describe('HandleInboundMessage · nunca lanza', () => {
  it('un fallo del transporte se registra y se traga', async () => {
    // Propagarlo solo conseguiría que Meta reintentara el mismo mensaje una y
    // otra vez.
    const reservas = {
      findActionableByPhone: async () => [cita()],
      findById: async () => cita(),
    };
    const sender = {
      send: async () => {
        throw new Error('Graph caído');
      },
    };
    const sut = new HandleInboundMessageUseCase(
      reservas as never,
      sender as never,
      { ownerPhone: DUENA, timeZone: 'America/Bogota' },
      { now: () => AHORA } as never,
    );

    await expect(
      sut.handle(mensaje({ text: 'hola' })),
    ).resolves.toBeUndefined();
  });
});

/**
 * El aviso previo en WhatsApp.
 *
 * Pulsar una hora de la lista **es** la confirmación: no hay un paso más. Así
 * que el último momento en que se le puede advertir es el mensaje que lleva las
 * horas. El aviso es **genérico** a propósito —«puede significar»— porque nadie
 * sabe si habrá cambio hasta intentarlo: quién queda libre a la hora nueva solo
 * se resuelve al reprogramar.
 *
 * Y no se le muestra a todo el mundo: si la clienta eligió estilista, mover la
 * cita **nunca** se la cambia (o la conserva, o da 409). Advertirla sería
 * preocuparla por algo que no puede pasarle.
 */
describe('HandleInboundMessage · aviso previo de cambio de estilista', () => {
  it('al ofrecer las horas avisa de que puede cambiar la estilista', async () => {
    const { sut, enviados } = montar({
      citas: [cita({ workerPinned: false })],
    });

    await sut.handle(mensaje({ payload: `RSDAY|${RID}|2026-09-12` }));

    expect(comoLista(enviados[0]).body).toMatch(/otra estilista/i);
  });

  it('NO la avisa si ella eligió estilista: a esa cita no puede pasarle', async () => {
    const { sut, enviados } = montar({
      citas: [cita({ workerPinned: true })],
    });

    await sut.handle(mensaje({ payload: `RSDAY|${RID}|2026-09-12` }));

    expect(comoLista(enviados[0]).body).not.toMatch(/estilista/i);
  });

  it('el aviso no promete un cambio: dice que puede pasar', async () => {
    // Honestidad: hasta que no se intenta mover, nadie sabe si habrá cambio.
    const { sut, enviados } = montar({
      citas: [cita({ workerPinned: false })],
    });

    await sut.handle(mensaje({ payload: `RSDAY|${RID}|2026-09-12` }));

    expect(comoLista(enviados[0]).body).toMatch(/puede/i);
  });
});
