import { MyReservationsTool } from './my-reservations.tool';
import { ViewAgendaTool } from './view-agenda.tool';
import { CreateReservationTool } from './create-reservation.tool';
import { AssistantContext } from './assistant-tool';

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
const RID = '4d2f0e4e-6f1b-4a3e-9a2f-2b1c3d4e5f60';
const SID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

/**
 * Plan 06, F4 (D4): cancelar, mover y crear por WhatsApp ya no escriben desde
 * estas herramientas; proponen y escribe el botón. Sus pruebas viven en
 * `proponer.spec.ts`, y la propiedad de la cita la comprueba el dominio al
 * pulsar (`handle-inbound-message.use-case.spec.ts`).
 */
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
        // Hora del salón, no UTC (hallazgo de la prueba de humo de F5).
        fecha: 'martes, 20 de octubre de 2026',
        hora: '10:00 a. m.',
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

describe('crearReserva en la web', () => {
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

/** RF59 c1: la agenda de la dueña llega cita por cita, sin pasar por el resumen del modelo. */
describe('verAgenda · presentar', () => {
  const duena: AssistantContext = {
    userId: null,
    isAdmin: true,
    now: ahora,
    canal: 'whatsapp',
    phoneE164: '573208977471',
  };
  const cita = (i: number) => ({
    id: `r-${i}`,
    scheduledAt: new Date(
      `2026-10-15T${String(13 + (i % 8)).padStart(2, '0')}:00:00Z`,
    ),
    status: 'pendiente',
    contact: {
      name: `Clienta ${'abcdefghijklmnopqrs'[i]}`,
      phone: '3001112233',
      email: 'x@y.co',
    },
    worker: { name: 'Monica' },
    services: [{ name: 'Corte' }, { name: 'Tinte' }],
  });

  it('presentar entrega una línea por cita con clienta, servicios y estilista, sin teléfono ni correo', async () => {
    const tool = new ViewAgendaTool({
      execute: async () =>
        Array.from({ length: 19 }, (_, i) => cita(i)) as never,
    });
    const r = await tool.execute({}, duena);
    const p = await tool.presentar(r);

    expect(p?.tipo).toBe('agenda');
    if (p?.tipo !== 'agenda') throw new Error('no es agenda');
    const deCita = p.lineas.filter((l) => l.includes(' · '));
    expect(deCita).toHaveLength(15);
    expect(deCita[0]).toBe(
      '8:00 a. m. · Clienta a · Corte, Tinte · con Monica',
    );
    expect(p.hayMas).toBe(true);
    expect(p.lineas[p.lineas.length - 1]).toBe(
      'Hay más citas: pídeme un día concreto.',
    );
    const todo = p.lineas.join('\n');
    expect(todo).not.toMatch(/3001112233|x@y\.co/);
  });

  it('una cita con cuenta lleva el nombre de la cuenta, no «Cliente registrado»', async () => {
    const tool = new ViewAgendaTool({
      execute: async () =>
        [
          {
            ...cita(1),
            contact: null,
            userId: 'u-1',
            accountName: 'Ana Pérez',
          },
        ] as never,
    });
    const p = await tool.presentar(await tool.execute({}, duena));
    if (p?.tipo !== 'agenda') throw new Error('no es agenda');
    expect(p.lineas.join('\n')).toContain('Ana Pérez');
    expect(p.lineas.join('\n')).not.toContain('Cliente registrado');
  });

  it('no presenta nada si la herramienta falló o no hay citas', async () => {
    const tool = new ViewAgendaTool({ execute: async () => [] });
    expect(
      await tool.presentar({ ok: false, motivo: 'solo_administracion' }),
    ).toBeNull();
    expect(await tool.presentar(await tool.execute({}, duena))).toBeNull();
  });
});
