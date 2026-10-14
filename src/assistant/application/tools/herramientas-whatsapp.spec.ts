import { CancelReservationTool } from './cancel-reservation.tool';
import { RescheduleReservationTool } from './reschedule-reservation.tool';
import { MyReservationsTool } from './my-reservations.tool';
import { CreateReservationTool } from './create-reservation.tool';
import { ReservePackageTool } from './reserve-package.tool';
import { AssistantContext } from './assistant-tool';
import { ReservationOwnershipError } from 'src/reservations/domain/errors';
import { ReservationActor } from 'src/reservations/domain/reservation-actor';

/**
 * Plan 06, F3b: las herramientas que actúan sobre reservas con la identidad de
 * WhatsApp. La web sigue con sus pruebas de siempre, sin tocar.
 */
const NUMERO = '573001112233';
const ahora = new Date('2026-10-14T15:00:00Z');
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
const RID = '4d2f0e4e-6f1b-4a3e-9a2f-2b1c3d4e5f60';
const SID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

describe('cancelarReserva / reprogramarReserva por WhatsApp', () => {
  it('la clienta actúa con su número, nunca como usuario', async () => {
    const actores: ReservationActor[] = [];
    const tool = new CancelReservationTool({
      execute: async (_id, actor) => {
        actores.push(actor);
        return { status: 'cancelada' };
      },
    });

    await expect(tool.execute({ reservaId: RID }, clienta)).resolves.toEqual({
      ok: true,
      estado: 'cancelada',
    });
    expect(actores).toEqual([{ kind: 'phone', phoneE164: NUMERO }]);
  });

  it('una clienta no puede tocar la cita de otro número: lo dice el dominio', async () => {
    const tool = new CancelReservationTool({
      execute: async () => {
        throw new ReservationOwnershipError();
      },
    });

    await expect(tool.execute({ reservaId: RID }, clienta)).resolves.toEqual({
      ok: false,
      motivo: 'no_es_tu_reserva',
    });
  });

  it('la dueña mueve como administración', async () => {
    const actores: ReservationActor[] = [];
    const tool = new RescheduleReservationTool({
      execute: async (_id, _f, actor) => {
        actores.push(actor);
        return { reservation: { status: 'pendiente' }, workerChanged: false };
      },
    });

    await tool.execute(
      { reservaId: RID, nuevaFecha: '2026-10-20T10:00:00-05:00' },
      duena,
    );
    expect(actores).toEqual([{ kind: 'admin' }]);
  });
});

describe('misReservas por WhatsApp', () => {
  it('lista las citas de ESE número, no las de una cuenta', async () => {
    const pedidas: string[] = [];
    const tool = new MyReservationsTool(
      {
        execute: async () => {
          throw new Error('no debe consultar por usuario');
        },
      },
      {
        execute: async (phone: string) => {
          pedidas.push(phone);
          return [
            {
              id: RID,
              scheduledAt: new Date('2026-10-20T15:00:00Z'),
              status: 'pendiente',
              totalDurationMinutes: 30,
              services: [{ name: 'Corte' }],
              workerPinned: false,
            },
          ];
        },
      },
    );

    const r = await tool.execute({}, clienta);

    expect(pedidas).toEqual([NUMERO]);
    expect(r).toEqual([
      {
        id: RID,
        cuando: new Date('2026-10-20T15:00:00Z'),
        estado: 'pendiente',
        servicios: ['Corte'],
        minutos: 30,
        estilistaElegida: false,
      },
    ]);
  });

  it('sin consulta por teléfono cableada, WhatsApp no cae a la de la web', async () => {
    const tool = new MyReservationsTool({
      execute: async () => [],
    });

    await expect(tool.execute({}, clienta)).resolves.toEqual({
      ok: false,
      motivo: 'sesion_requerida',
    });
  });
});

describe('crearReserva / reservarPaquete por WhatsApp (D3, D5)', () => {
  function creador() {
    const comandos: unknown[] = [];
    return {
      comandos,
      exec: {
        execute: async (c: unknown) => {
          comandos.push(c);
          return { id: RID, status: 'pendiente' };
        },
      },
    };
  }

  it.each([
    ['crearReserva', (e: never) => new CreateReservationTool(e)],
    ['reservarPaquete', (e: never) => new ReservePackageTool(e)],
  ])('%s: nace a nombre del número firmado, sin usuario', async (_n, crear) => {
    const { comandos, exec } = creador();
    const tool = crear(exec as never);

    const r = await tool.execute(
      {
        fechaHoraIso: '2026-10-20T10:00:00-05:00',
        serviciosIds: [SID],
        nombre: 'Ana',
      },
      clienta,
    );

    expect(r).toEqual({ ok: true, reservaId: RID, estado: 'pendiente' });
    expect(comandos).toEqual([
      {
        scheduledAt: '2026-10-20T10:00:00-05:00',
        serviceIds: [SID],
        userId: null,
        contact: { name: 'Ana', phone: NUMERO },
      },
    ]);
  });

  it.each([
    ['crearReserva', (e: never) => new CreateReservationTool(e)],
    ['reservarPaquete', (e: never) => new ReservePackageTool(e)],
  ])('%s: sin nombre, lo pide en vez de crear', async (_n, crear) => {
    const { comandos, exec } = creador();
    const tool = crear(exec as never);

    const r = await tool.execute(
      { fechaHoraIso: '2026-10-20T10:00:00-05:00', serviciosIds: [SID] },
      clienta,
    );

    expect(r).toMatchObject({ ok: false, motivo: 'nombre_requerido' });
    expect(comandos).toHaveLength(0);
  });

  it.each([
    ['crearReserva', (e: never) => new CreateReservationTool(e)],
    ['reservarPaquete', (e: never) => new ReservePackageTool(e)],
  ])('%s: la dueña no crea reservas (D6)', async (_n, crear) => {
    const { comandos, exec } = creador();
    const tool = crear(exec as never);

    const r = await tool.execute(
      {
        fechaHoraIso: '2026-10-20T10:00:00-05:00',
        serviciosIds: [SID],
        nombre: 'Ana',
      },
      duena,
    );

    expect(r).toMatchObject({ ok: false, motivo: 'solo_clientas' });
    expect(comandos).toHaveLength(0);
  });

  it('en la web, «nombre» sigue siendo un argumento que sobra', async () => {
    const { comandos, exec } = creador();
    const tool = new CreateReservationTool(exec as never);

    const r = await tool.execute(
      {
        fechaHoraIso: '2026-10-20T10:00:00-05:00',
        serviciosIds: [SID],
        nombre: 'Ana',
      },
      { userId: 'u-1', isAdmin: false, now: ahora, canal: 'web' },
    );

    expect(r).toMatchObject({ ok: false, motivo: 'argumentos_invalidos' });
    expect(comandos).toHaveLength(0);
  });
});
