import { WorkerAbsence } from './worker-absence';
import { InvalidAbsenceError } from './errors';

const TZ = 'America/Bogota';
const NOW = new Date('2026-11-11T15:00:00Z'); // 10:00 en Bogotá
const W = '00000000-0000-0000-0000-0000000000aa';

const crear = (o: {
  dateYmd: string;
  from?: string;
  to?: string;
  now?: Date;
}) => WorkerAbsence.create({ workerId: W, tz: TZ, now: NOW, ...o });

describe('WorkerAbsence.create', () => {
  it('día completo de un martes = 08:00–20:00 hora del salón', () => {
    const a = crear({ dateYmd: '2026-11-17' });
    expect(a.startsAt.toISOString()).toBe('2026-11-17T13:00:00.000Z');
    expect(a.endsAt.toISOString()).toBe('2026-11-18T01:00:00.000Z');
    expect(a.id).toBeNull();
    expect(a.workerId).toBe(W);
  });

  it('día completo de un domingo o festivo = 09:00–19:00', () => {
    for (const d of ['2026-11-22', '2026-12-25']) {
      const a = crear({ dateYmd: d });
      expect(a.startsAt.getUTCHours()).toBe(14);
      expect(a.endsAt.getUTCHours()).toBe(0); // 19:00 Bogotá = 00:00Z del día siguiente
    }
  });

  it('franja 08:00–12:00 válida', () => {
    const a = crear({ dateYmd: '2026-11-17', from: '08:00', to: '12:00' });
    expect(a.startsAt.toISOString()).toBe('2026-11-17T13:00:00.000Z');
    expect(a.endsAt.toISOString()).toBe('2026-11-17T17:00:00.000Z');
  });

  it.each([
    ['from >= to', { from: '12:00', to: '12:00' }],
    ['from > to', { from: '14:00', to: '12:00' }],
    ['minutos que no son :00/:30', { from: '08:15', to: '12:00' }],
    ['antes de abrir', { from: '07:30', to: '10:00' }],
    ['después de cerrar', { from: '18:00', to: '20:30' }],
    ['solo from', { from: '08:00' }],
    ['solo to', { to: '12:00' }],
  ])('rechaza %s', (_n, extra) => {
    expect(() => crear({ dateYmd: '2026-11-17', ...extra })).toThrow(
      InvalidAbsenceError,
    );
  });

  it('el domingo cierra a las 19:00', () => {
    expect(() =>
      crear({ dateYmd: '2026-11-22', from: '18:00', to: '20:00' }),
    ).toThrow(InvalidAbsenceError);
  });

  it('rechaza una fecha cuyo fin ya pasó', () => {
    expect(() => crear({ dateYmd: '2026-11-10' })).toThrow(InvalidAbsenceError);
  });

  it('acepta hoy si endsAt > now aunque startsAt haya pasado', () => {
    const a = crear({ dateYmd: '2026-11-11' });
    expect(a.startsAt.getTime()).toBeLessThan(NOW.getTime());
    expect(a.endsAt.getTime()).toBeGreaterThan(NOW.getTime());
  });
});

describe('WorkerAbsence.overlaps', () => {
  const a = WorkerAbsence.create({
    workerId: W,
    dateYmd: '2026-11-17',
    from: '08:00',
    to: '12:00',
    now: NOW,
    tz: TZ,
  });
  const at = (h: string) => new Date(`2026-11-17T${h}:00Z`);

  it('11:30–12:30 cruza 08:00–12:00; 12:00–12:30 no', () => {
    expect(a.overlaps(at('16:30'), at('17:30'))).toBe(true);
    expect(a.overlaps(at('17:00'), at('17:30'))).toBe(false);
  });
});
