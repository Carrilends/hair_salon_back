import { buildAssistantTools } from './build-assistant-tools';
import { AssistantContext } from './application/tools/assistant-tool';

describe('buildAssistantTools', () => {
  it('registra las nueve herramientas del asistente, en orden estable', () => {
    // Las dependencias solo se guardan por referencia en cada herramienta; no se
    // invocan al construir, así que fakes vacíos bastan para verificar el registro.
    const tools = buildAssistantTools(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    expect(tools.map((t) => t.name)).toEqual([
      'listarServicios',
      'consultarDisponibilidad',
      'crearReserva',
      'misReservas',
      'cancelarReserva',
      'reprogramarReserva',
      'recomendarServicios',
      'componerPaquete',
      'reservarPaquete',
    ]);
  });

  it('sin proveedor de juicios, crearReserva se comporta como siempre', async () => {
    // El servidor MCP y el resto del sistema comparten esta misma lista. Si la
    // composición sin juez montara la verificación, se la impondría a ellos.
    let creada = 0;
    const createReservation = {
      execute: async () => {
        creada++;
        return { id: 'r1', status: 'pendiente' };
      },
    };
    const tools = buildAssistantTools(
      {} as never,
      {} as never,
      createReservation as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const crearReserva = tools.find((t) => t.name === 'crearReserva')!;

    const contexto: AssistantContext = {
      userId: 'u1',
      now: new Date('2026-09-30T14:00:00Z'),
      isAdmin: false,
      recientes: [{ rol: 'clienta', texto: 'quiero un corte' }],
    };
    const res = await crearReserva.execute(
      {
        fechaHoraIso: '2026-10-02T20:00:00.000Z',
        serviciosIds: ['11111111-1111-4111-8111-111111111111'],
      },
      contexto,
    );

    expect(res).toMatchObject({ ok: true });
    expect(creada).toBe(1);
  });

  it('con proveedor de juicios y modo on, crearReserva verifica antes de crear', async () => {
    let creada = 0;
    const createReservation = {
      execute: async () => {
        creada++;
        return { id: 'r1', status: 'pendiente' };
      },
    };
    const catalog = {
      findNamesByIds: async () =>
        new Map([['11111111-1111-4111-8111-111111111111', 'Tinte']]),
    };
    const judge = {
      ask: async () => ({
        ok: true as const,
        answers: { correspondencia: { type: 'noul', noul: 0.04 } },
        model: 'jev-1.13.0',
        inputTokens: 300,
        ms: 240,
      }),
    };
    const tools = buildAssistantTools(
      catalog as never,
      {} as never,
      createReservation as never,
      {} as never,
      {} as never,
      {} as never,
      judge,
      { reserva: 'on', bucle: 'off', orden: 'off', diferido: false },
    );
    const crearReserva = tools.find((t) => t.name === 'crearReserva')!;

    const res = await crearReserva.execute(
      {
        fechaHoraIso: '2026-10-02T20:00:00.000Z',
        serviciosIds: ['11111111-1111-4111-8111-111111111111'],
      },
      {
        userId: 'u1',
        now: new Date('2026-09-30T14:00:00Z'),
        isAdmin: false,
        recientes: [{ rol: 'clienta', texto: 'quiero un corte el viernes' }],
      },
    );

    expect(res).toMatchObject({ motivo: 'confirmacion_requerida' });
    expect(creada).toBe(0);
  });

  it('con modo on, listarServicios reordena por relevancia', async () => {
    const catalog = {
      search: async () => [
        {
          id: 'a',
          name: 'Corte de caballero',
          price: 25000,
          durationMinutes: 30,
        },
        { id: 'b', name: 'Corte de dama', price: 35000, durationMinutes: 45 },
      ],
      findPrincipalImages: async () => new Map(),
    };
    const judge = {
      ask: async () => ({
        ok: true as const,
        answers: {
          r0: { type: 'noul', noul: 0.1 },
          r1: { type: 'noul', noul: 0.95 },
        },
        model: 'jev-1.13.0',
        inputTokens: 500,
        ms: 240,
      }),
    };
    const tools = buildAssistantTools(
      catalog as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      judge,
      { reserva: 'off', bucle: 'off', orden: 'on', diferido: false },
    );
    const listar = tools.find((t) => t.name === 'listarServicios')!;

    const res = (await listar.execute(
      { busqueda: 'corte para mujer' },
      {} as never,
    )) as { servicios: { nombre: string }[] };

    expect(res.servicios[0].nombre).toBe('Corte de dama');
  });
});
