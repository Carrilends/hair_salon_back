import { MarkAbsenceTool } from './marcar-ausencia.tool';
import { AssistantContext } from './assistant-tool';
import { ConfirmAbsencePresentation } from './assistant-presentation';
import {
  AbsenceOverlapError,
  DefaultWorkerAbsenceError,
  InvalidAbsenceError,
} from 'src/reservations/domain/errors';
import { AbsencePlan } from 'src/reservations/application/absences/absence-planner';
import { PendingAbsence } from '../../domain/pending-absence';

/**
 * Ausencias por WhatsApp (2026-11-11): la dueña dice «[estilista] no viene» y
 * el asistente PREPARA la ausencia. Nada se aplica hasta el botón «Confirmar»:
 * la herramienta solo hace la vista previa y guarda la propuesta.
 */
const ahora = new Date('2026-11-12T12:00:00Z'); // 7:00 a. m. en Bogotá, jueves
const DUENA = '573208977471';
const duena: AssistantContext = {
  userId: null,
  isAdmin: true,
  now: ahora,
  canal: 'whatsapp',
  phoneE164: DUENA,
};
const clienta: AssistantContext = {
  ...duena,
  isAdmin: false,
  phoneE164: '573001112233',
};

const ESTILISTAS = [
  { id: 'w-def', name: 'Sin preferencia', isDefault: true },
  { id: 'w-ana', name: 'Ana Prueba', isDefault: false },
  { id: 'w-anb', name: 'Andrea Ficticia', isDefault: false },
  { id: 'w-lu', name: 'Lucía Ejemplo', isDefault: false },
];

const INICIO = new Date('2026-11-12T13:00:00Z'); // 8:00 a. m.
const FIN = new Date('2026-11-12T17:00:00Z'); // 12:00 p. m.

function plan(over: Partial<AbsencePlan> = {}): AbsencePlan {
  return {
    workerId: 'w-lu',
    workerName: 'Lucía Ejemplo',
    startsAt: INICIO,
    endsAt: FIN,
    impacts: [
      {
        reservationId: 'r-1',
        scheduledAt: new Date('2026-11-12T14:00:00Z'), // 9:00 a. m.
        endedAt: new Date('2026-11-12T14:30:00Z'),
        customerName: 'Clienta Uno',
        customerPhone: '3001112233',
        services: ['Corte'],
        outcome: 'reasignada',
        newWorkerId: 'w-ana',
        newWorkerName: 'Ana Prueba',
      },
      {
        reservationId: 'r-2',
        scheduledAt: new Date('2026-11-12T15:00:00Z'), // 10:00 a. m.
        endedAt: new Date('2026-11-12T16:00:00Z'),
        customerName: 'Clienta Dos',
        customerPhone: null,
        services: ['Tinte'],
        outcome: 'cancelada',
      },
    ],
    ...over,
  };
}

function montar(opts: { vista?: () => Promise<AbsencePlan> } = {}) {
  const llamadas: unknown[][] = [];
  const guardadas: Omit<PendingAbsence, 'id'>[] = [];
  const sut = new MarkAbsenceTool({
    estilistas: { findAll: async () => ESTILISTAS },
    vistaPrevia: {
      execute: async (cmd) => {
        llamadas.push(['preview', cmd]);
        return (opts.vista ?? (async () => plan()))();
      },
    },
    pendientes: {
      supersedeActiveFor: async (phone, now) => {
        llamadas.push(['supersede', phone, now]);
      },
      save: async (p) => {
        llamadas.push(['save']);
        guardadas.push(p);
        return { ...p, id: '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f' };
      },
    },
  });
  return { sut, llamadas, guardadas };
}

const pedir = (over: Record<string, unknown> = {}) => ({
  estilista: 'Lucía',
  fecha: '2026-11-12',
  desde: '08:00',
  hasta: '12:00',
  ...over,
});

describe('marcarAusencia', () => {
  it('como clienta → solo_duena, sin consultar nada', async () => {
    const { sut, llamadas } = montar();

    expect(await sut.execute(pedir(), clienta)).toEqual({
      ok: false,
      motivo: 'solo_duena',
    });
    expect(llamadas).toEqual([]);
  });

  it('fuera de WhatsApp (web o MCP con rol de administración) → solo_duena', async () => {
    const { sut } = montar();
    for (const ctx of [
      { ...duena, canal: 'web' as const },
      { ...duena, canal: undefined },
    ]) {
      expect(await sut.execute(pedir(), ctx)).toMatchObject({
        motivo: 'solo_duena',
      });
    }
  });

  it('nombre ambiguo → estilista_ambigua con la lista, sin preparar nada', async () => {
    const { sut, llamadas } = montar();

    const r = await sut.execute(pedir({ estilista: 'an' }), duena);

    expect(r).toMatchObject({
      ok: false,
      motivo: 'estilista_ambigua',
      opciones: ['Ana Prueba', 'Andrea Ficticia'],
    });
    expect(llamadas).toEqual([]);
  });

  it('nombre que no es de nadie → estilista_no_encontrada; la de por defecto no cuenta', async () => {
    const { sut } = montar();

    for (const estilista of ['Marta', 'Sin preferencia']) {
      const r = await sut.execute(pedir({ estilista }), duena);
      expect(r).toMatchObject({
        ok: false,
        motivo: 'estilista_no_encontrada',
        estilistas: ['Ana Prueba', 'Andrea Ficticia', 'Lucía Ejemplo'],
      });
    }
  });

  it('el nombre se resuelve sin mayúsculas ni tildes, exacto o por prefijo único', async () => {
    const { sut, llamadas } = montar();

    await sut.execute(pedir({ estilista: '  LUCIA ' }), duena);
    await sut.execute(pedir({ estilista: 'ana prueba' }), duena);
    await sut.execute(pedir({ estilista: 'andr' }), duena);

    const ids = llamadas
      .filter((l) => l[0] === 'preview')
      .map((l) => (l[1] as { workerId: string }).workerId);
    expect(ids).toEqual(['w-lu', 'w-ana', 'w-anb']);
  });

  it('propuesta válida → presentación confirmar-ausencia con resumen y sin tocar la agenda', async () => {
    const { sut, llamadas, guardadas } = montar();

    const r = await sut.execute(pedir(), duena);

    // Solo vista previa: ningún caso de uso que escriba en la agenda.
    expect(llamadas.map((l) => l[0])).toEqual(['preview', 'supersede', 'save']);
    expect(llamadas[0][1]).toEqual({
      workerId: 'w-lu',
      dateYmd: '2026-11-12',
      from: '08:00',
      to: '12:00',
    });
    // La nueva anula las anteriores del MISMO número.
    expect(llamadas[1]).toEqual(['supersede', DUENA, ahora]);
    expect(guardadas).toEqual([
      {
        phoneE164: DUENA,
        workerId: 'w-lu',
        startsAt: INICIO,
        endsAt: FIN,
        expiresAt: new Date(ahora.getTime() + 15 * 60_000),
      },
    ]);
    expect(r).toMatchObject({
      ok: true,
      estado: 'requiere_boton',
      resumen: '1 cita pasa a otra estilista y 1 se cancela',
    });
    expect(JSON.stringify(r)).toMatch(/TODAVÍA NO/);

    const p = (await sut.presentar(r)) as ConfirmAbsencePresentation;
    expect(p).toEqual({
      tipo: 'confirmar-ausencia',
      propuestaId: '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f',
      estilista: 'Lucía Ejemplo',
      fecha: expect.stringMatching(/12 de noviembre/),
      franja: 'de 8:00 a. m. a 12:00 p. m.',
      resumen: '1 cita pasa a otra estilista y 1 se cancela',
      lineas: [
        '9:00 a. m. · Clienta Uno · pasa a Ana Prueba',
        '10:00 a. m. · Clienta Dos · se cancela',
      ],
    });
  });

  it('lo que vuelve al modelo no lleva nombres de clientas ni teléfonos', async () => {
    const { sut } = montar();

    const r = JSON.stringify(await sut.execute(pedir(), duena));

    expect(r).not.toMatch(/Clienta Uno|Clienta Dos|3001112233/);
  });

  it('todo el día y sin citas: franja «todo el día» y «No tiene citas en esas horas»', async () => {
    const { sut, llamadas } = montar({
      vista: async () =>
        plan({
          startsAt: INICIO,
          endsAt: new Date('2026-11-13T01:00:00Z'), // 8:00 p. m.
          impacts: [],
        }),
    });

    const r = await sut.execute(
      { estilista: 'Lucía', fecha: '2026-11-12' },
      duena,
    );

    expect(llamadas[0][1]).toEqual({ workerId: 'w-lu', dateYmd: '2026-11-12' });
    expect(await sut.presentar(r)).toMatchObject({
      franja: 'todo el día',
      resumen: 'No tiene citas en esas horas',
      lineas: [],
    });
  });

  it('plural: «2 citas pasan a otra estilista y 2 se cancelan»', async () => {
    const [a, b] = plan().impacts;
    const { sut } = montar({
      vista: async () => plan({ impacts: [a, a, b, b] }),
    });

    expect(await sut.execute(pedir(), duena)).toMatchObject({
      resumen: '2 citas pasan a otra estilista y 2 se cancelan',
    });
  });

  it.each([
    [new AbsenceOverlapError(), 'ausencia_cruzada'],
    [new InvalidAbsenceError('esa franja ya pasó'), 'ausencia_invalida'],
    [new DefaultWorkerAbsenceError(), 'estilista_no_encontrada'],
    [new Error('base caída'), 'error_desconocido'],
  ])(
    'si la vista previa lanza %p → %s, sin guardar propuesta',
    async (error, motivo) => {
      const { sut, llamadas } = montar({
        vista: async () => {
          throw error;
        },
      });

      const r = await sut.execute(pedir(), duena);

      expect(r).toMatchObject({ ok: false, motivo });
      expect(llamadas.map((l) => l[0])).toEqual(['preview']);
    },
  );

  it('la ausencia no válida explica por qué (lo dice el dominio)', async () => {
    const { sut } = montar({
      vista: async () => {
        throw new InvalidAbsenceError(
          'la franja queda fuera del horario del salón',
        );
      },
    });

    expect(await sut.execute(pedir(), duena)).toMatchObject({
      motivo: 'ausencia_invalida',
      detalle: 'la franja queda fuera del horario del salón',
    });
  });

  it('argumentos mal formados → argumentos_invalidos, sin consultar', async () => {
    const { sut, llamadas } = montar();
    for (const malos of [
      { estilista: '', fecha: '2026-11-12' },
      { estilista: 'Lucía', fecha: '12/11/2026' },
      { estilista: 'Lucía', fecha: '2026-11-12', desde: '8am', hasta: '12:00' },
      { estilista: 42, fecha: '2026-11-12' },
    ]) {
      expect(await sut.execute(malos, duena)).toMatchObject({
        motivo: 'argumentos_invalidos',
      });
    }
    expect(llamadas).toEqual([]);
  });

  it('un resultado fallido no se presenta', async () => {
    const { sut } = montar();
    expect(await sut.presentar({ ok: false, motivo: 'solo_duena' })).toBeNull();
  });
});
