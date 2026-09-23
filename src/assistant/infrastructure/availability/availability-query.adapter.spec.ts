import { AvailabilityQueryAdapter } from './availability-query.adapter';
import { CheckAvailabilityTool } from '../../application/tools/check-availability.tool';
import {
  ReservationBlock,
  WorkerAvailabilityResponse,
  WorkersService,
} from 'src/workers/workers.service';

/** Miércoles laborable, a ocho días del «ahora» de las pruebas. */
const DIA = '2026-09-30';
const AHORA = new Date('2026-09-22T15:00:00Z');

type Agendas = Partial<
  Record<'ale' | 'mon' | 'son' | 'def', ReservationBlock[]>
>;

/**
 * Respuesta de `WorkersService` con la plantilla real del salón: tres estilistas
 * asignables y el trabajador por defecto (`Sin prefencia`), que es el que NO es
 * asignable y al que hoy cae toda reserva conversacional.
 */
function disponibilidad(agendas: Agendas): WorkerAvailabilityResponse {
  const fila = (
    id: string,
    name: string,
    isDefault: boolean,
    reservations: ReservationBlock[],
  ) => ({
    id,
    name,
    isDefault,
    assignable: !isDefault,
    usedMinutes: reservations.reduce((t, b) => t + (b.endMin - b.startMin), 0),
    capacityMinutes: 720,
    availableMinutes: 720,
    reservations,
  });

  return {
    workers: [
      fila('w-ale', 'Alejandro', false, agendas.ale ?? []),
      fila('w-mon', 'Monica', false, agendas.mon ?? []),
      fila('w-son', 'Sonia s', false, agendas.son ?? []),
      fila('w-def', 'Sin prefencia', true, agendas.def ?? []),
    ],
    dayBounds: {
      openMin: 8 * 60,
      closeMin: 20 * 60,
      effectiveStartMin: 8 * 60,
      isToday: false,
    },
    salonNow: { ymd: '2026-09-22', minOfDay: 10 * 60, tz: 'America/Bogota' },
  };
}

function adaptadorCon(agendas: Agendas): AvailabilityQueryAdapter {
  const workers = {
    getAvailabilityByDate: jest.fn().mockResolvedValue(disponibilidad(agendas)),
  } as unknown as WorkersService;
  return new AvailabilityQueryAdapter(workers);
}

/** Lo que el asistente acabaría ofreciendo con esas agendas. */
async function libresDelAsistente(agendas: Agendas): Promise<string[]> {
  const tool = new CheckAvailabilityTool(adaptadorCon(agendas));
  const salida = (await tool.execute(
    { fecha: DIA },
    { userId: 'u1', now: AHORA, isAdmin: false },
  )) as { libres: string[] };
  return salida.libres;
}

const DIEZ_A_ONCE: ReservationBlock[] = [{ startMin: 600, endMin: 660 }];

describe('AvailabilityQueryAdapter', () => {
  describe('lo que el asistente ofrece', () => {
    it('mantiene la franja libre si solo una estilista está ocupada', async () => {
      const libres = await libresDelAsistente({ ale: DIEZ_A_ONCE });
      // Quedan Monica y Sonia: la franja se sigue pudiendo vender.
      expect(libres).toContain('10:00');
      expect(libres).toContain('10:30');
    });

    it('deja de ofrecer la franja cuando las tres asignables están ocupadas', async () => {
      const libres = await libresDelAsistente({
        ale: DIEZ_A_ONCE,
        mon: DIEZ_A_ONCE,
        son: DIEZ_A_ONCE,
      });
      // El salón no tiene a nadie más: ofrecer esa hora sería mentir.
      expect(libres).not.toContain('10:00');
      expect(libres).not.toContain('10:30');
      // El resto del día sigue intacto.
      expect(libres).toContain('09:30');
      expect(libres).toContain('11:00');
    });

    it('cuenta también la agenda del trabajador por defecto', async () => {
      const libres = await libresDelAsistente({
        ale: DIEZ_A_ONCE,
        mon: DIEZ_A_ONCE,
        def: DIEZ_A_ONCE,
      });
      // Una reserva de `Sin prefencia` es una clienta real a la que alguien
      // atiende: tres citas a la vez agotan a las tres estilistas del salón.
      expect(libres).not.toContain('10:00');
    });
  });

  describe('la proyección del puerto', () => {
    it('cuenta estilistas ocupados a la vez, no bloques sueltos', async () => {
      const dia = await adaptadorCon({
        ale: DIEZ_A_ONCE,
        mon: DIEZ_A_ONCE,
      }).getDayAvailability(DIA);

      expect(dia.busySegments).toEqual([
        { startMin: 600, endMin: 660, busyWorkers: 2 },
      ]);
    });

    it('no cuenta dos veces a la misma estilista por dos citas seguidas', async () => {
      const dia = await adaptadorCon({
        ale: [
          { startMin: 600, endMin: 630 },
          { startMin: 630, endMin: 660 },
        ],
      }).getDayAvailability(DIA);

      // Una persona ocupa una sola agenda aunque encadene dos citas.
      expect(dia.busySegments).toEqual([
        { startMin: 600, endMin: 660, busyWorkers: 1 },
      ]);
    });

    it('conserva el rango del día y el número de estilistas asignables', async () => {
      const dia = await adaptadorCon({}).getDayAvailability(DIA);

      expect(dia).toEqual({
        dateYmd: DIA,
        effectiveStartMin: 8 * 60,
        closeMin: 20 * 60,
        assignableWorkers: 3, // los tres nombrados; `Sin prefencia` no cuenta
        busySegments: [],
      });
    });
  });
});
