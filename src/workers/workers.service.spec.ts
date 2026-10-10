import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { WorkersService } from './workers.service';
import { Worker } from './entities/worker.entity';
import { ReservationOrmEntity } from 'src/reservations/infrastructure/persistence/reservation.orm-entity';

describe('WorkersService', () => {
  let service: WorkersService;
  let workerRepository: jest.Mocked<Partial<Repository<Worker>>>;
  let reservationRepository: jest.Mocked<
    Partial<Repository<ReservationOrmEntity>>
  >;

  beforeEach(() => {
    workerRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    };

    reservationRepository = {
      manager: {
        query: jest.fn(),
      } as any,
      count: jest.fn(),
    };

    service = new WorkersService(
      workerRepository as any,
      reservationRepository as any,
    );
    jest.spyOn(service, 'ensureDefaultWorker').mockResolvedValue();
    process.env.SALON_TZ = 'America/Bogota';
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getWorkerName', () => {
    it('devuelve el nombre del estilista', async () => {
      (workerRepository.findOne as jest.Mock).mockResolvedValue({
        id: 'w-1',
        name: 'Marlene',
      });
      expect(await service.getWorkerName('w-1')).toBe('Marlene');
    });

    it('devuelve cadena vacía si el estilista no existe', async () => {
      (workerRepository.findOne as jest.Mock).mockResolvedValue(null);
      expect(await service.getWorkerName('inexistente')).toBe('');
    });
  });

  it('computes effective capacity for today and only counts future reservation minutes', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-20T23:00:00.000Z')); // 18:00 Bogota

    (workerRepository.find as jest.Mock).mockResolvedValue([
      { id: 'w-1', name: 'Ana', isDefault: false },
      { id: 'w-def', name: 'Default', isDefault: true },
    ]);

    (
      reservationRepository.manager!.query as unknown as jest.Mock
    ).mockResolvedValue([
      { worker_id: 'w-1', start_min: '960', duration: '30' }, // pasada
      { worker_id: 'w-1', start_min: '1050', duration: '90' }, // en curso
      { worker_id: 'w-1', start_min: '1110', duration: '90' }, // futura
    ]);

    const result = await service.getAvailabilityByDate('2026-04-20');
    const ana = result.workers.find((w) => w.id === 'w-1');
    const def = result.workers.find((w) => w.id === 'w-def');

    expect(result.dayBounds).toEqual({
      openMin: 8 * 60,
      closeMin: 20 * 60,
      effectiveStartMin: 18 * 60,
      isToday: true,
    });
    expect(result.salonNow).toEqual({
      ymd: '2026-04-20',
      minOfDay: 18 * 60,
      tz: 'America/Bogota',
    });

    // Cierre 20:00 y "ahora" 18:00 → capacidad 120 min (18:00–20:00). Las dos
    // reservas futuras suman 150 min (se solapan), así que la disponibilidad se
    // satura en 0.
    expect(ana).toEqual(
      expect.objectContaining({
        assignable: true,
        capacityMinutes: 120,
        usedMinutes: 150,
        availableMinutes: 0,
      }),
    );
    expect(def).toEqual(
      expect.objectContaining({
        assignable: false,
      }),
    );
  });

  describe('getAvailabilityByDate y las reservas canceladas', () => {
    /**
     * Doble de la base: aplica el `WHERE` que se le pide. Si el SQL excluye las
     * canceladas, no las devuelve; si no, las devuelve todas. Así la prueba mide
     * el comportamiento (minutos y bloques) y no solo el texto de la consulta.
     */
    function fakeDb(
      filas: {
        worker_id: string;
        start_min: string;
        duration: string;
        status: string;
      }[],
    ) {
      return jest.fn().mockImplementation(async (sql: string) => {
        const excluyeCanceladas = /status\s*<>\s*'cancelada'/.test(sql);
        return filas
          .filter((f) => !excluyeCanceladas || f.status !== 'cancelada')
          .map((f) => ({
            // La consulta real no trae `status`: solo se usa aquí para decidir
            // qué filas devolvería el motor.
            worker_id: f.worker_id,
            start_min: f.start_min,
            duration: f.duration,
          }));
      });
    }

    it('no cuenta una reserva cancelada ni en usedMinutes ni en reservations', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-04-20T23:00:00.000Z')); // 18:00 Bogotá

      (workerRepository.find as jest.Mock).mockResolvedValue([
        { id: 'w-1', name: 'Ana', isDefault: false },
      ]);

      (reservationRepository.manager as any).query = fakeDb([
        {
          worker_id: 'w-1',
          start_min: '600',
          duration: '60',
          status: 'confirmada',
        },
        {
          worker_id: 'w-1',
          start_min: '780',
          duration: '90',
          status: 'cancelada',
        },
      ]);

      // Fecha distinta de hoy: la capacidad es el día entero y los minutos usados
      // son la duración completa, sin recortes contra «ahora».
      const result = await service.getAvailabilityByDate('2026-04-21');
      const ana = result.workers.find((w) => w.id === 'w-1');

      // Una cancelación libera la franja: la única ocupación real es la de 60 min.
      expect(ana?.usedMinutes).toBe(60);
      expect(ana?.reservations).toEqual([{ startMin: 600, endMin: 660 }]);
    });

    it('excluye las canceladas en el propio SQL, como countOverlaps', async () => {
      (workerRepository.find as jest.Mock).mockResolvedValue([]);
      const query = fakeDb([]);
      (reservationRepository.manager as any).query = query;

      await service.getAvailabilityByDate('2026-04-21');

      const [sql] = query.mock.calls[0] as [string, unknown[]];
      expect(sql.replace(/\s+/g, ' ')).toContain("status <> 'cancelada'");
    });
  });

  describe('create', () => {
    it('persiste un nuevo empleado con isDefault=false y nombre recortado', async () => {
      const created = { name: 'Ana', isDefault: false } as Partial<Worker>;
      const saved = { id: 'w-new', name: 'Ana', isDefault: false } as Worker;
      (workerRepository.create as jest.Mock).mockReturnValue(created);
      (workerRepository.save as jest.Mock).mockResolvedValue(saved);

      const result = await service.create({ name: '  Ana  ' });

      expect(workerRepository.create).toHaveBeenCalledWith({
        name: 'Ana',
        isDefault: false,
      });
      expect(workerRepository.save).toHaveBeenCalledWith(created);
      expect(result).toBe(saved);
    });
  });

  describe('update', () => {
    it('actualiza el nombre del empleado y lo persiste recortado', async () => {
      const existing = { id: 'w-1', name: 'Ana', isDefault: false } as Worker;
      (workerRepository.findOne as jest.Mock).mockResolvedValue(existing);
      (workerRepository.save as jest.Mock).mockImplementation(
        async (w: Worker) => w,
      );

      const result = await service.update('w-1', { name: '  Ana María  ' });

      expect(workerRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'w-1' },
      });
      expect(result.name).toBe('Ana María');
      expect(workerRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'w-1', name: 'Ana María' }),
      );
    });

    it('lanza NotFoundException si el empleado no existe', async () => {
      (workerRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update('missing', { name: 'X' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('rechaza eliminar al estilista por defecto con BadRequestException', async () => {
      (workerRepository.findOne as jest.Mock).mockResolvedValue({
        id: 'w-def',
        name: 'Estilista default',
        isDefault: true,
      });

      await expect(service.remove('w-def')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(reservationRepository.count).not.toHaveBeenCalled();
      expect(workerRepository.delete).not.toHaveBeenCalled();
    });

    it('rechaza eliminar a un empleado con reservas asociadas con ConflictException', async () => {
      (workerRepository.findOne as jest.Mock).mockResolvedValue({
        id: 'w-1',
        name: 'Ana',
        isDefault: false,
      });
      (reservationRepository.count as jest.Mock).mockResolvedValue(2);

      await expect(service.remove('w-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(reservationRepository.count).toHaveBeenCalledWith({
        where: { workerId: 'w-1' },
      });
      expect(workerRepository.delete).not.toHaveBeenCalled();
    });

    it('elimina al empleado sin reservas y devuelve { deleted: true }', async () => {
      (workerRepository.findOne as jest.Mock).mockResolvedValue({
        id: 'w-2',
        name: 'Beatriz',
        isDefault: false,
      });
      (reservationRepository.count as jest.Mock).mockResolvedValue(0);
      (workerRepository.delete as jest.Mock).mockResolvedValue({ affected: 1 });

      const result = await service.remove('w-2');

      expect(workerRepository.delete).toHaveBeenCalledWith('w-2');
      expect(result).toEqual({ deleted: true });
    });
  });

  describe('getWeekLoad', () => {
    /**
     * Lo que devolvería Postgres: una fila por estilista y día con citas no
     * canceladas. `used` llega como número (`::int`), pero se acepta texto por
     * si el driver cambia: el servicio lo pasa por `Number`.
     */
    const filas = [
      { worker_id: 'w-1', ymd: '2026-10-12', used: 90 },
      { worker_id: 'w-1', ymd: '2026-10-14', used: '150' },
      { worker_id: 'w-def', ymd: '2026-10-18', used: 60 },
    ];

    const query = () =>
      reservationRepository.manager!.query as unknown as jest.Mock;

    beforeEach(() => {
      (workerRepository.find as jest.Mock).mockResolvedValue([
        { id: 'w-1', name: 'Ana', isDefault: false },
        { id: 'w-2', name: 'Bea', isDefault: false },
        { id: 'w-def', name: 'Sin preferencia', isDefault: true },
      ]);
      query().mockResolvedValue(filas);
    });

    it('lleva el inicio al lunes y devuelve los siete días', async () => {
      const semana = await service.getWeekLoad('2026-10-15'); // jueves

      expect(semana.start).toBe('2026-10-12');
      expect(semana.days).toEqual([
        '2026-10-12',
        '2026-10-13',
        '2026-10-14',
        '2026-10-15',
        '2026-10-16',
        '2026-10-17',
        '2026-10-18',
      ]);
    });

    it('la capacidad es el horario entero: 10 h el lunes festivo y el fin de semana, 12 h entre semana', async () => {
      const semana = await service.getWeekLoad('2026-10-12');

      expect(semana.workers[0].days.map((d) => d.capacityMinutes)).toEqual([
        600, 720, 720, 720, 720, 600, 600,
      ]);
    });

    it('reparte los minutos por estilista y día, con cero donde no hay citas', async () => {
      const semana = await service.getWeekLoad('2026-10-12');
      const minutos = (id: string) =>
        semana.workers.find((w) => w.id === id)!.days.map((d) => d.usedMinutes);

      expect(minutos('w-1')).toEqual([90, 0, 150, 0, 0, 0, 0]);
      expect(minutos('w-2')).toEqual([0, 0, 0, 0, 0, 0, 0]);
      // La predeterminada también trae su carga: si tiene citas, no se esconden.
      expect(minutos('w-def')).toEqual([0, 0, 0, 0, 0, 0, 60]);
    });

    it('hoy cuenta el día entero, no solo lo que falta', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-10-14T23:00:00.000Z')); // miércoles, 18:00 Bogotá

      const semana = await service.getWeekLoad('2026-10-14');
      const ana = semana.workers.find((w) => w.id === 'w-1')!;

      expect(ana.days[2]).toEqual({
        date: '2026-10-14',
        usedMinutes: 150,
        capacityMinutes: 720,
      });
    });

    it('pide la semana entera en UNA consulta, agrupada y sin las canceladas', async () => {
      await service.getWeekLoad('2026-10-14');

      expect(query()).toHaveBeenCalledTimes(1);
      expect(workerRepository.find).toHaveBeenCalledTimes(1);
      const [sql, params] = query().mock.calls[0] as [string, unknown[]];
      const plano = sql.replace(/\s+/g, ' ');
      expect(plano).toContain("status <> 'cancelada'");
      expect(plano).toContain('BETWEEN $2::date AND $3::date');
      expect(plano).toContain('GROUP BY');
      expect(params).toEqual(['America/Bogota', '2026-10-12', '2026-10-18']);
    });

    it('cruza el año sin perder días: Año Nuevo es festivo', async () => {
      const semana = await service.getWeekLoad('2027-01-01'); // viernes

      expect(semana.start).toBe('2026-12-28');
      expect(semana.days[6]).toBe('2027-01-03');
      expect(semana.workers[0].days.map((d) => d.capacityMinutes)).toEqual([
        720, 720, 720, 720, 600, 600, 600,
      ]);
    });

    it('las estilistas salen por nombre, con la predeterminada al final', async () => {
      await service.getWeekLoad('2026-10-12');

      expect(workerRepository.find).toHaveBeenCalledWith({
        order: { isDefault: 'ASC', name: 'ASC' },
      });
    });
  });
});
