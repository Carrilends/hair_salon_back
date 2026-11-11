import { Logger } from '@nestjs/common';
import {
  AgendaParaProponer,
  ProposeBookingTool,
  ProposeCancelTool,
  ProposeRescheduleTool,
} from './proponer.tool';
import { CreateReservationTool } from './create-reservation.tool';
import { ReservePackageTool } from './reserve-package.tool';
import { CancelReservationTool } from './cancel-reservation.tool';
import { RescheduleReservationTool } from './reschedule-reservation.tool';
import { AssistantContext } from './assistant-tool';
import { PendingBooking } from '../../domain/pending-booking';
import { Reservation } from 'src/reservations/domain/reservation';
import { ReservationStatus } from 'src/reservations/domain/reservation-status';
import { CreateReservationUseCase } from 'src/reservations/application/create-reservation.use-case';
import { WorkerAssigner } from 'src/reservations/application/worker-assigner';
import { RescheduleReservationUseCase } from 'src/reservations/application/reschedule-reservation.use-case';
import {
  DomainError,
  DuplicateServicesError,
} from 'src/reservations/domain/errors';

/**
 * Plan 06, F4 (D4): en WhatsApp el modelo no escribe en la agenda. Propone, y
 * escribe un botón.
 */
const ahora = new Date('2026-10-14T15:00:00Z');
const NUMERO = '573001112233';
const clienta: AssistantContext = {
  userId: null,
  isAdmin: false,
  now: ahora,
  canal: 'whatsapp',
  phoneE164: NUMERO,
};
const duena: AssistantContext = {
  ...clienta,
  phoneE164: '573208977471',
  isAdmin: true,
};
const web: AssistantContext = {
  userId: 'u-1',
  isAdmin: false,
  now: ahora,
  canal: 'web',
};
const S1 = '11111111-1111-4111-8111-111111111111';
const S2 = '22222222-2222-4222-8222-222222222222';
const RID = '4d2f0e4e-6f1b-4a3e-9a2f-2b1c3d4e5f60';
const DEF = {
  name: 'crearReserva',
  description: 'x',
  parameters: { type: 'object', properties: {} },
};

function proponerReserva(
  nombres = new Map([
    [S1, 'Corte'],
    [S2, 'Tinte'],
  ]),
  agenda: AgendaParaProponer = { comprobar: async () => undefined },
) {
  const guardadas: Omit<PendingBooking, 'id'>[] = [];
  const reemplazos: string[] = [];
  const tool = new ProposeBookingTool('crearReserva', DEF, {
    pendientes: {
      save: async (b) => {
        guardadas.push(b);
        return { ...b, id: 'p-1' };
      },
      supersedeActiveFor: async (phone) => {
        reemplazos.push(phone);
      },
    },
    catalog: { findNamesByIds: async () => nombres },
    agenda,
  });
  return { tool, guardadas, reemplazos };
}

const argsValidos = {
  fechaHoraIso: '2026-10-20T10:00:00-05:00',
  serviciosIds: [S1, S2],
  nombre: 'Ana',
};

describe('crearReserva / reservarPaquete en WhatsApp: proponen, no reservan', () => {
  it('guarda una propuesta a nombre del número firmado, que vence en 15 min', async () => {
    const { tool, guardadas } = proponerReserva();

    const r = await tool.execute(argsValidos, clienta);

    expect(guardadas).toEqual([
      {
        phoneE164: NUMERO,
        customerName: 'Ana',
        serviceIds: [S1, S2],
        scheduledAt: new Date('2026-10-20T15:00:00Z'),
        expiresAt: new Date('2026-10-14T15:15:00Z'),
      },
    ]);
    expect(r).toMatchObject({
      ok: true,
      estado: 'pendiente_de_confirmar',
      propuestaId: 'p-1',
    });
  });

  it('una hora sin zona es hora del salón aunque el servidor corra en UTC (E2E 2026-10-20)', async () => {
    const { tool, guardadas } = proponerReserva();

    const r = await tool.execute(
      { ...argsValidos, fechaHoraIso: '2026-10-23T08:00:00' },
      clienta,
    );

    expect(guardadas[0].scheduledAt).toEqual(new Date('2026-10-23T13:00:00Z'));
    expect(r).toMatchObject({ resumen: { hora: '8:00 a. m.' } });
  });

  it('una propuesta nueva anula las anteriores del mismo número (revisión de F4)', async () => {
    const { tool, reemplazos } = proponerReserva();

    await tool.execute(argsValidos, clienta);

    expect(reemplazos).toEqual([NUMERO]);
  });

  it('presenta el resumen con el id de la propuesta, para los botones', async () => {
    const { tool } = proponerReserva();

    const r = await tool.execute(argsValidos, clienta);

    expect(tool.presentar(r)).toEqual({
      tipo: 'confirmar-reserva',
      propuestaId: 'p-1',
      nombre: 'Ana',
      servicios: ['Corte', 'Tinte'],
      fecha: expect.any(String),
      hora: expect.any(String),
    });
  });

  it.each([
    [
      'sin nombre',
      { ...argsValidos, nombre: undefined },
      clienta,
      'nombre_requerido',
    ],
    [
      'un número extranjero',
      argsValidos,
      { ...clienta, phoneE164: '584121234567' },
      'numero_no_soportado',
    ],
    ['la dueña', argsValidos, duena, 'solo_clientas'],
    [
      'la web',
      { fechaHoraIso: argsValidos.fechaHoraIso, serviciosIds: [S1] },
      web,
      'solo_whatsapp',
    ],
    [
      'una fecha que no es ISO',
      { ...argsValidos, fechaHoraIso: 'mañana' },
      clienta,
      'argumentos_invalidos',
    ],
  ])('rechaza %s sin guardar nada', async (_c, args, ctx, motivo) => {
    const { tool, guardadas } = proponerReserva();

    const r = await tool.execute(args as never, ctx);

    expect(r).toMatchObject({ ok: false, motivo });
    expect(guardadas).toHaveLength(0);
    expect(tool.presentar(r)).toBeNull();
  });

  it('rechaza servicios que no existen en el catálogo', async () => {
    const { tool, guardadas } = proponerReserva(new Map([[S1, 'Corte']]));

    const r = await tool.execute(argsValidos, clienta);

    expect(r).toMatchObject({ ok: false, motivo: 'servicio_invalido' });
    expect(guardadas).toHaveLength(0);
  });
});

/**
 * Prueba con móvil del 2026-11-10: una propuesta para un sábado a las 8:00 (el
 * salón abre a las 9:00) se guardó con sus botones y «Confirmar» falló sin
 * decir por qué. Ahora la propuesta pasa antes por las MISMAS reglas que la
 * creación (`CreateReservationUseCase.comprobar`, aquí el real con dobles): si
 * no caben, no se guarda nada y el modelo recibe el motivo y qué hacer.
 */
describe('crearReserva en WhatsApp: valida la hora antes de guardar la propuesta', () => {
  const SABADO = '2026-10-17'; // `ahora` es el miércoles 14 de octubre de 2026

  function conAgendaReal(opts: { ocupada?: boolean } = {}) {
    const repositorio = {
      countOverlaps: async () => (opts.ocupada ? 1 : 0),
      save: async () => {
        throw new Error('comprobar no guarda');
      },
    };
    const workers = {
      getDefaultWorkerId: async () => 'default-w',
      listAssignableWorkloads: async () => [],
    };
    const agenda = new CreateReservationUseCase(
      repositorio as never,
      new WorkerAssigner(repositorio as never, workers as never),
      {
        getSnapshots: async (ids: string[]) =>
          ids.map((id) => ({
            id,
            name: 'Corte',
            price: 1,
            durationMinutes: 30,
          })),
      } as never,
      { now: () => ahora },
      {
        reservationCreated: async () => {
          throw new Error('comprobar no avisa');
        },
      } as never,
    );
    return proponerReserva(undefined, agenda);
  }

  it('sábado 8:00: fuera_de_horario, sin guardar ni anular nada, con el horario de ese día', async () => {
    const { tool, guardadas, reemplazos } = conAgendaReal();

    const r = await tool.execute(
      { ...argsValidos, fechaHoraIso: `${SABADO}T08:00:00` },
      clienta,
    );

    expect(r).toMatchObject({
      ok: false,
      motivo: 'fuera_de_horario',
      horarioDelDia: { abre: '9:00 a. m.', cierra: '7:00 p. m.' },
    });
    expect((r as { instruccion: string }).instruccion).toMatch(
      /no se guardó nada/i,
    );
    expect((r as { instruccion: string }).instruccion).toMatch(/otra hora/i);
    expect(guardadas).toHaveLength(0);
    expect(reemplazos).toHaveLength(0);
    expect(tool.presentar(r)).toBeNull();
  });

  it('sábado 9:00: se acepta y se guarda la propuesta', async () => {
    const { tool, guardadas } = conAgendaReal();

    const r = await tool.execute(
      { ...argsValidos, fechaHoraIso: `${SABADO}T09:00:00` },
      clienta,
    );

    expect(r).toMatchObject({ ok: true, estado: 'pendiente_de_confirmar' });
    expect(guardadas).toHaveLength(1);
    expect(guardadas[0].scheduledAt).toEqual(new Date(`${SABADO}T14:00:00Z`));
  });

  it('una hora que ya pasó: fecha_pasada, sin guardar', async () => {
    const { tool, guardadas } = conAgendaReal();

    const r = await tool.execute(
      { ...argsValidos, fechaHoraIso: '2026-10-14T08:00:00' },
      clienta,
    );

    expect(r).toMatchObject({ ok: false, motivo: 'fecha_pasada' });
    expect((r as { instruccion: string }).instruccion).toMatch(/otra hora/i);
    expect(guardadas).toHaveLength(0);
  });

  it('una franja ocupada: hora_ocupada, sin guardar, y le manda consultar la disponibilidad', async () => {
    const { tool, guardadas } = conAgendaReal({ ocupada: true });

    const r = await tool.execute(argsValidos, clienta);

    expect(r).toMatchObject({ ok: false, motivo: 'hora_ocupada' });
    expect((r as { instruccion: string }).instruccion).toMatch(
      /consultarDisponibilidad/,
    );
    expect(guardadas).toHaveLength(0);
  });

  it('si la comprobación falla por algo ajeno a la agenda, tampoco guarda', async () => {
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const { tool, guardadas } = proponerReserva(undefined, {
      comprobar: async () => {
        throw new Error('base caída');
      },
    });

    const r = await tool.execute(argsValidos, clienta);

    expect(r).toMatchObject({ ok: false, motivo: 'error_desconocido' });
    expect(guardadas).toHaveLength(0);
    expect(error).toHaveBeenCalledWith(
      'No se pudo comprobar la hora de una propuesta',
      expect.any(Error),
    );
    error.mockRestore();
  });
});

/** Citas de prueba: una de la clienta y una de otro número. */
function cita(id: string, telefono: string, nombre = 'Ana') {
  return Reservation.fromPersistence({
    id,
    userId: null,
    contact: { name: nombre, phone: telefono, email: null },
    // 15:00Z = 10:00 en Bogotá
    scheduledAt: new Date('2026-10-20T15:00:00Z'),
    endedAt: new Date('2026-10-20T15:30:00Z'),
    workerId: 'w-1',
    status: ReservationStatus.Pendiente,
    lines: [{ serviceId: S1, name: 'Corte', price: 1, durationMinutes: 30 }],
  });
}
const OTRA = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
/** Día y hora de `cita`: 15:00Z = 10:00 en Bogotá. */
const LA_CITA = { fechaDeLaCita: '2026-10-20', horaDeLaCita: '10:00' };
const OTRA_HORA = { fechaDeLaCita: '2026-10-20', horaDeLaCita: '11:00' };
const OTRO_DIA = { fechaDeLaCita: '2026-10-21', horaDeLaCita: '10:00' };
const citas = {
  execute: async (id: string) =>
    id === RID
      ? cita(RID, '3001112233')
      : id === OTRA
        ? cita(OTRA, '3009998888', 'Lucía')
        : null,
};

describe('cancelarReserva en WhatsApp: propone el botón de cancelar', () => {
  const tool = new ProposeCancelTool(
    { ...DEF, name: 'cancelarReserva' },
    { citas },
  );

  it('la clienta, sobre SU cita: propuesta con los datos de la base, no del modelo', async () => {
    const r = await tool.execute({ reservaId: RID, ...LA_CITA }, clienta);

    expect(r).toMatchObject({ ok: true, estado: 'requiere_boton' });
    expect(tool.presentar(r)).toEqual({
      tipo: 'confirmar-cancelacion',
      reservaId: RID,
      cita: {
        fecha: expect.any(String),
        hora: expect.any(String),
        servicios: ['Corte'],
      },
    });
  });

  it('la clienta, sobre la cita de OTRO número: ni botón ni datos', async () => {
    const r = await tool.execute({ reservaId: OTRA, ...LA_CITA }, clienta);

    expect(r).toEqual({ ok: false, motivo: 'no_es_tu_reserva' });
    expect(JSON.stringify(r)).not.toContain('Lucía');
  });

  it('la cita de OTRO número responde igual acierte o no su día y hora (no es un oráculo)', async () => {
    for (const pedida of [LA_CITA, OTRA_HORA, OTRO_DIA]) {
      await expect(
        tool.execute({ reservaId: OTRA, ...pedida }, clienta),
      ).resolves.toEqual({ ok: false, motivo: 'no_es_tu_reserva' });
    }
  });

  it.each([OTRA_HORA, OTRO_DIA])(
    'sobre SU cita, con otro día u hora (%p): no propone nada',
    async (pedida) => {
      const r = await tool.execute({ reservaId: RID, ...pedida }, clienta);
      expect(r).toEqual({ ok: false, motivo: 'no_coincide_con_lo_pedido' });
      expect(tool.presentar(r)).toBeNull();
    },
  );

  it('la dueña también nombra la cita: con otra hora no propone cancelarla', async () => {
    await expect(
      tool.execute({ reservaId: OTRA, ...OTRA_HORA }, duena),
    ).resolves.toEqual({ ok: false, motivo: 'no_coincide_con_lo_pedido' });
  });

  it('la dueña ve también de quién es la cita que va a cancelar', async () => {
    const r = await tool.execute({ reservaId: OTRA, ...LA_CITA }, duena);

    expect(tool.presentar(r)).toMatchObject({
      cita: { clienta: 'Lucía', servicios: ['Corte'] },
    });
  });

  it.each([
    [{}, 'argumentos_invalidos'],
    [{ reservaId: 'no-es-uuid', ...LA_CITA }, 'argumentos_invalidos'],
    [{ reservaId: RID }, 'argumentos_invalidos'],
    [
      { reservaId: RID, ...LA_CITA, horaDeLaCita: '25:00' },
      'argumentos_invalidos',
    ],
    [
      { reservaId: '5e4f9a8b-7c6d-4a3b-8c2d-1e0f9a8b7c6d', ...LA_CITA },
      'reserva_no_encontrada',
    ],
  ])('%p → %s', async (args, motivo) => {
    await expect(tool.execute(args, clienta)).resolves.toMatchObject({
      ok: false,
      motivo,
    });
  });

  it('fuera de WhatsApp, nada', async () => {
    await expect(
      tool.execute({ reservaId: RID, ...LA_CITA }, web),
    ).resolves.toMatchObject({
      motivo: 'solo_whatsapp',
    });
  });
});

describe('si la lectura de la cita falla, no se pierde el turno (revisión final)', () => {
  const caida = {
    execute: async () => {
      throw new Error('conexión perdida');
    },
  };

  it('cancelar responde un motivo en vez de lanzar', async () => {
    const tool = new ProposeCancelTool(
      { ...DEF, name: 'cancelarReserva' },
      { citas: caida },
    );
    await expect(
      tool.execute({ reservaId: RID, ...LA_CITA }, clienta),
    ).resolves.toEqual({ ok: false, motivo: 'error_desconocido' });
  });

  it('mover responde un motivo en vez de lanzar', async () => {
    const tool = new ProposeRescheduleTool(
      { ...DEF, name: 'reprogramarReserva' },
      { citas: caida, agenda: { comprobar: async () => undefined } },
    );
    await expect(
      tool.execute(
        { reservaId: RID, nuevaFecha: '2026-10-21T10:00:00', ...LA_CITA },
        clienta,
      ),
    ).resolves.toEqual({ ok: false, motivo: 'error_desconocido' });
  });
});

describe('reprogramarReserva en WhatsApp: propone el botón de mover', () => {
  const tool = new ProposeRescheduleTool(
    { ...DEF, name: 'reprogramarReserva' },
    { citas, agenda: { comprobar: async () => undefined } },
  );

  it('pasa la hora nueva a la del salón y muestra también la cita actual', async () => {
    const r = await tool.execute(
      { reservaId: RID, nuevaFecha: '2026-10-20T20:30:00.000Z', ...LA_CITA },
      clienta,
    );

    expect(r).toMatchObject({ ok: true, estado: 'requiere_boton' });
    expect(tool.presentar(r)).toEqual({
      tipo: 'confirmar-cambio',
      reservaId: RID,
      cuandoLocal: '2026-10-20T15:30',
      fecha: expect.any(String),
      hora: expect.any(String),
      cita: {
        fecha: expect.any(String),
        hora: expect.any(String),
        servicios: ['Corte'],
      },
    });
  });

  it('una hora nueva sin zona es hora del salón aunque el servidor corra en UTC', async () => {
    const r = await tool.execute(
      { reservaId: RID, nuevaFecha: '2026-10-20T15:30:00', ...LA_CITA },
      clienta,
    );

    expect(tool.presentar(r)).toMatchObject({
      cuandoLocal: '2026-10-20T15:30',
      hora: '3:30 p. m.',
    });
  });

  it('no propone mover la cita de otro número, acierte o no su día y hora', async () => {
    for (const pedida of [LA_CITA, OTRA_HORA, OTRO_DIA]) {
      await expect(
        tool.execute(
          {
            reservaId: OTRA,
            nuevaFecha: '2026-10-20T20:30:00.000Z',
            ...pedida,
          },
          clienta,
        ),
      ).resolves.toEqual({ ok: false, motivo: 'no_es_tu_reserva' });
    }
  });

  it('sobre SU cita, con otra hora que la nombrada: no propone moverla', async () => {
    const r = await tool.execute(
      { reservaId: RID, nuevaFecha: '2026-10-20T20:30:00.000Z', ...OTRA_HORA },
      clienta,
    );
    expect(r).toEqual({ ok: false, motivo: 'no_coincide_con_lo_pedido' });
    expect(tool.presentar(r)).toBeNull();
  });

  it('rechaza una fecha que no se entiende', async () => {
    await expect(
      tool.execute(
        { reservaId: RID, nuevaFecha: 'el lunes', ...LA_CITA },
        clienta,
      ),
    ).resolves.toMatchObject({ ok: false, motivo: 'argumentos_invalidos' });
  });

  it('exige el día y la hora de la cita actual', async () => {
    await expect(
      tool.execute(
        { reservaId: RID, nuevaFecha: '2026-10-20T20:30:00.000Z' },
        clienta,
      ),
    ).resolves.toEqual({ ok: false, motivo: 'argumentos_invalidos' });
  });
});

describe('las herramientas que escriben se niegan en WhatsApp (segunda barrera)', () => {
  const nunca = {
    execute: async () => {
      throw new Error('no debe escribir');
    },
  };

  it.each([
    ['crearReserva', new CreateReservationTool(nunca as never), argsValidos],
    ['reservarPaquete', new ReservePackageTool(nunca as never), argsValidos],
    [
      'cancelarReserva',
      new CancelReservationTool(nunca as never),
      { reservaId: RID },
    ],
    [
      'reprogramarReserva',
      new RescheduleReservationTool(nunca as never),
      { reservaId: RID, nuevaFecha: '2026-10-20T10:00:00-05:00' },
    ],
  ])('%s', async (_n, tool, args) => {
    for (const ctx of [clienta, duena]) {
      await expect(tool.execute(args, ctx)).resolves.toEqual({
        ok: false,
        motivo: 'requiere_boton',
      });
    }
  });
});

/**
 * Lo mismo que la propuesta de reservar, para mover (2026-11-10): antes de
 * enseñar el botón `RSAT`, la hora nueva pasa por las MISMAS reglas que la
 * reprogramación (`RescheduleReservationUseCase.comprobar`, aquí el real con
 * dobles). Si no cabe, no hay botón ni se mueve nada.
 */
describe('reprogramarReserva en WhatsApp: valida la hora nueva antes de proponer', () => {
  const SABADO = '2026-10-17'; // `ahora` es el miércoles 14 de octubre de 2026

  function conAgendaReal(opts: { ocupada?: boolean } = {}) {
    const guardadas: unknown[] = [];
    const avisos: unknown[] = [];
    const repositorio = {
      findById: async () => cita(RID, NUMERO),
      countOverlaps: async () => (opts.ocupada ? 1 : 0),
      save: async (r: unknown) => {
        guardadas.push(r);
        return r;
      },
    };
    const workers = {
      getDefaultWorkerId: async () => 'default-w',
      listAssignableWorkloads: async () => [{ id: 'w-1', usedMinutes: 0 }],
    };
    const agenda = new RescheduleReservationUseCase(
      repositorio as never,
      { now: () => ahora },
      {
        reservationRescheduled: async (...a: unknown[]) => void avisos.push(a),
      } as never,
      new WorkerAssigner(repositorio as never, workers as never),
    );
    const tool = new ProposeRescheduleTool(
      { ...DEF, name: 'reprogramarReserva' },
      { citas, agenda },
    );
    return { tool, guardadas, avisos };
  }

  const mover = (hhmm: string, dia = SABADO) => ({
    reservaId: RID,
    nuevaFecha: `${dia}T${hhmm}:00`,
    ...LA_CITA,
  });

  it('sábado 8:00: fuera_de_horario con el horario de ese día, sin botón ni cambios', async () => {
    const { tool, guardadas, avisos } = conAgendaReal();

    const r = await tool.execute(mover('08:00'), clienta);

    expect(r).toMatchObject({
      ok: false,
      motivo: 'fuera_de_horario',
      horarioDelDia: { abre: '9:00 a. m.', cierra: '7:00 p. m.' },
    });
    expect((r as { instruccion: string }).instruccion).toMatch(/no se movió/i);
    expect((r as { instruccion: string }).instruccion).toMatch(/otra hora/i);
    expect(tool.presentar(r)).toBeNull();
    expect(guardadas).toHaveLength(0);
    expect(avisos).toHaveLength(0);
  });

  it('sábado 9:00: se propone con su botón, sin mover nada todavía', async () => {
    const { tool, guardadas, avisos } = conAgendaReal();

    const r = await tool.execute(mover('09:00'), clienta);

    expect(r).toMatchObject({ ok: true, estado: 'requiere_boton' });
    expect(tool.presentar(r)).toMatchObject({
      cuandoLocal: `${SABADO}T09:00`,
    });
    expect(guardadas).toHaveLength(0);
    expect(avisos).toHaveLength(0);
  });

  it('una hora que ya pasó: fecha_pasada, sin botón', async () => {
    const { tool } = conAgendaReal();

    const r = await tool.execute(mover('08:00', '2026-10-14'), clienta);

    expect(r).toMatchObject({ ok: false, motivo: 'fecha_pasada' });
    expect(tool.presentar(r)).toBeNull();
  });

  it('una franja ocupada: hora_ocupada, y le manda consultar la disponibilidad', async () => {
    const { tool } = conAgendaReal({ ocupada: true });

    const r = await tool.execute(mover('10:00'), clienta);

    expect(r).toMatchObject({ ok: false, motivo: 'hora_ocupada' });
    expect((r as { instruccion: string }).instruccion).toMatch(
      /consultarDisponibilidad/,
    );
    expect(tool.presentar(r)).toBeNull();
  });

  it('si la comprobación falla por algo ajeno a la agenda, tampoco hay botón', async () => {
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const tool = new ProposeRescheduleTool(
      { ...DEF, name: 'reprogramarReserva' },
      {
        citas,
        agenda: {
          comprobar: async () => {
            throw new Error('base caída');
          },
        },
      },
    );

    const r = await tool.execute(mover('10:00'), clienta);

    expect(r).toMatchObject({ ok: false, motivo: 'error_desconocido' });
    expect(tool.presentar(r)).toBeNull();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe('instrucciones de agenda: cada motivo dice qué hacer', () => {
  it.each(['no_disponible', 'servicios_duplicados'])(
    '%s tiene su propia línea, no la genérica',
    async (motivo) => {
      const { tool } = proponerReserva(undefined, {
        comprobar: async () => {
          throw motivo === 'no_disponible'
            ? new DomainError('regla')
            : new DuplicateServicesError();
        },
      });

      const r = (await tool.execute(argsValidos, clienta)) as {
        motivo: string;
        instruccion: string;
      };

      expect(r.motivo).toBe(motivo);
      expect(r.instruccion).not.toMatch(/no pudiste prepararla/);
    },
  );
});
