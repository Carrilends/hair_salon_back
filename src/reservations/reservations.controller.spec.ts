import { META_ROLES } from 'src/auth/decorators/role-protected.decorator';
import { ValidRoles } from 'src/auth/interfaces/valid-roles';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';

/**
 * Red de caracterización del controlador de Reservas, previa al refactor
 * hexagonal. Fija el contrato observable actual: qué método del servicio invoca
 * cada endpoint, con qué argumentos, y qué rutas quedan restringidas por rol.
 */
describe('ReservationsController', () => {
  let service: jest.Mocked<Partial<ReservationsService>>;
  let controller: ReservationsController;

  beforeEach(() => {
    service = {
      findAll: jest.fn(),
      getOccupancy: jest.fn(),
      create: jest.fn(),
      remove: jest.fn(),
    };

    controller = new ReservationsController(service as any);
  });

  describe('delegación en el servicio', () => {
    it('GET /reservations delega en findAll', async () => {
      const reservations = [{ id: 'r-1' }];
      (service.findAll as jest.Mock).mockResolvedValue(reservations);

      await expect(controller.findAll()).resolves.toBe(reservations);
      expect(service.findAll).toHaveBeenCalledTimes(1);
    });

    it('GET /reservations/occupancy pasa el rango como dos argumentos sueltos', async () => {
      const occupancy = { byDate: {} };
      (service.getOccupancy as jest.Mock).mockResolvedValue(occupancy);

      const result = await controller.occupancy({
        from: '2026-04-20',
        to: '2026-04-21',
      });

      expect(result).toBe(occupancy);
      expect(service.getOccupancy).toHaveBeenCalledWith(
        '2026-04-20',
        '2026-04-21',
      );
    });

    it('POST /reservations delega la creación con el DTO íntegro', async () => {
      const dto = {
        scheduledAt: '2026-04-20T15:00:00.000Z',
        totalDurationMinutes: 60,
        workerId: 'w-1',
      };
      (service.create as jest.Mock).mockResolvedValue({ id: 'r-1', ...dto });

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toMatchObject({ id: 'r-1' });
    });

    it('DELETE /reservations/:id delega en remove con el id', async () => {
      (service.remove as jest.Mock).mockResolvedValue(undefined);

      await controller.remove('4d2f0e4e-6f1b-4a3e-9a2f-2b1c3d4e5f60');

      expect(service.remove).toHaveBeenCalledWith(
        '4d2f0e4e-6f1b-4a3e-9a2f-2b1c3d4e5f60',
      );
    });
  });

  describe('protección por rol', () => {
    it('restringe el listado y el borrado a administradores', () => {
      expect(
        Reflect.getMetadata(
          META_ROLES,
          ReservationsController.prototype.findAll,
        ),
      ).toEqual([ValidRoles.admin]);
      expect(
        Reflect.getMetadata(
          META_ROLES,
          ReservationsController.prototype.remove,
        ),
      ).toEqual([ValidRoles.admin]);
    });

    it('deja públicos la consulta de ocupación y la creación de reservas', () => {
      // El portal permite reservar sin cuenta; si esto cambiara, sería un
      // cambio de contrato y este test debe actualizarse conscientemente.
      expect(
        Reflect.getMetadata(
          META_ROLES,
          ReservationsController.prototype.occupancy,
        ),
      ).toBeUndefined();
      expect(
        Reflect.getMetadata(
          META_ROLES,
          ReservationsController.prototype.create,
        ),
      ).toBeUndefined();
    });
  });
});
