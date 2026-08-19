import { CheckAvailabilityTool } from './check-availability.tool';
import {
  AvailabilityQueryPort,
  DayAvailability,
} from '../../domain/ports/availability-query.port';
import { AssistantContext } from './assistant-tool';

class FakeAvailability implements AvailabilityQueryPort {
  calls: string[] = [];
  constructor(private readonly day: DayAvailability) {}
  async getDayAvailability(dateYmd: string): Promise<DayAvailability> {
    this.calls.push(dateYmd);
    return { ...this.day, dateYmd };
  }
}

function ctxAt(iso: string): AssistantContext {
  return { userId: 'u1', now: new Date(iso) };
}

function weekday(): DayAvailability {
  return {
    dateYmd: '2026-08-20',
    effectiveStartMin: 8 * 60,
    closeMin: 20 * 60,
    assignableWorkers: 3,
    busyBlocks: [{ startMin: 9 * 60, endMin: 9 * 60 + 30 }],
  };
}

describe('CheckAvailabilityTool', () => {
  it('rechaza fechas pasadas sin consultar disponibilidad', async () => {
    const avail = new FakeAvailability(weekday());
    const tool = new CheckAvailabilityTool(avail);
    const res = await tool.execute(
      { fecha: '2020-01-01' },
      ctxAt('2026-08-19T14:00:00Z'),
    );
    expect(res).toMatchObject({ ok: false, motivo: 'fecha_pasada' });
    expect(avail.calls).toHaveLength(0);
  });

  it('rechaza fechas a más de 90 días sin consultar disponibilidad', async () => {
    const avail = new FakeAvailability(weekday());
    const tool = new CheckAvailabilityTool(avail);
    const res = await tool.execute(
      { fecha: '2027-08-19' },
      ctxAt('2026-08-19T14:00:00Z'),
    );
    expect(res).toMatchObject({ ok: false, motivo: 'fecha_muy_lejana' });
    expect(avail.calls).toHaveLength(0);
  });

  it('rechaza fechas con formato inválido', async () => {
    const avail = new FakeAvailability(weekday());
    const tool = new CheckAvailabilityTool(avail);
    const res = await tool.execute(
      { fecha: '20/08/2026' },
      ctxAt('2026-08-19T14:00:00Z'),
    );
    expect(res).toMatchObject({ ok: false, motivo: 'fecha_invalida' });
    expect(avail.calls).toHaveLength(0);
  });

  it('devuelve franjas libres compactas excluyendo bloques ocupados', async () => {
    const avail = new FakeAvailability(weekday());
    const tool = new CheckAvailabilityTool(avail);
    const res = (await tool.execute(
      { fecha: '2026-08-20' },
      ctxAt('2026-08-19T14:00:00Z'),
    )) as { fecha: string; estilistas: number; libres: string[] };
    expect(res.fecha).toBe('2026-08-20');
    expect(res.estilistas).toBe(3);
    expect(res.libres).toContain('08:00');
    expect(res.libres).toContain('08:30');
    expect(res.libres).not.toContain('09:00');
    expect(res.libres).toContain('09:30');
    expect(avail.calls).toEqual(['2026-08-20']);
  });
});
