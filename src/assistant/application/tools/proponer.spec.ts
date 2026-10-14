import {
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
) {
  const guardadas: Omit<PendingBooking, 'id'>[] = [];
  const tool = new ProposeBookingTool('crearReserva', DEF, {
    pendientes: {
      save: async (b) => {
        guardadas.push(b);
        return { ...b, id: 'p-1' };
      },
    },
    catalog: { findNamesByIds: async () => nombres },
  });
  return { tool, guardadas };
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

describe('cancelarReserva en WhatsApp: propone el botón de cancelar', () => {
  const tool = new ProposeCancelTool({ ...DEF, name: 'cancelarReserva' });

  it.each([
    ['la clienta', clienta],
    ['la dueña', duena],
  ])('%s recibe la propuesta, no la cancelación', async (_n, ctx) => {
    const r = await tool.execute({ reservaId: RID }, ctx);

    expect(r).toMatchObject({ ok: true, estado: 'requiere_boton' });
    expect(tool.presentar(r)).toEqual({
      tipo: 'confirmar-cancelacion',
      reservaId: RID,
    });
  });

  it('sin id, argumentos inválidos; fuera de WhatsApp, nada', async () => {
    await expect(tool.execute({}, clienta)).resolves.toMatchObject({
      motivo: 'argumentos_invalidos',
    });
    await expect(tool.execute({ reservaId: RID }, web)).resolves.toMatchObject({
      motivo: 'solo_whatsapp',
    });
  });
});

describe('reprogramarReserva en WhatsApp: propone el botón de mover', () => {
  const tool = new ProposeRescheduleTool({
    ...DEF,
    name: 'reprogramarReserva',
  });

  it('pasa la hora nueva a la del salón, que es lo que lleva el botón RSAT', async () => {
    const r = await tool.execute(
      { reservaId: RID, nuevaFecha: '2026-10-20T20:30:00.000Z' },
      clienta,
    );

    expect(r).toMatchObject({ ok: true, estado: 'requiere_boton' });
    expect(tool.presentar(r)).toEqual({
      tipo: 'confirmar-cambio',
      reservaId: RID,
      cuandoLocal: '2026-10-20T15:30',
      fecha: expect.any(String),
      hora: expect.any(String),
    });
  });

  it('rechaza una fecha que no se entiende', async () => {
    await expect(
      tool.execute({ reservaId: RID, nuevaFecha: 'el lunes' }, clienta),
    ).resolves.toMatchObject({ ok: false, motivo: 'argumentos_invalidos' });
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
