import { META_ROLES } from 'src/auth/decorators/role-protected.decorator';
import { ValidRoles } from 'src/auth/interfaces/valid-roles';
import { ReservationsController } from './reservations.controller';

/**
 * Caracterización del controlador hexagonal: mismo contrato observable que el
 * monolítico de la Fase 0, pero delegando en casos de uso en lugar del servicio.
 * Fija qué caso de uso invoca cada endpoint, con qué argumentos, y qué rutas
 * quedan restringidas por rol.
 */
describe('ReservationsController', () => {
  let create: { execute: jest.Mock };
  let occupancy: { execute: jest.Mock };
  let list: { execute: jest.Mock };
  let cancel: { execute: jest.Mock };
  let controller: ReservationsController;

  beforeEach(() => {
    create = { execute: jest.fn() };
    occupancy = { execute: jest.fn() };
    list = { execute: jest.fn() };
    cancel = { execute: jest.fn() };
    controller = new ReservationsController(
      create as any,
      occupancy as any,
      list as any,
      cancel as any,
    );
  });

  describe('delegación en los casos de uso', () => {
    it('GET /reservations delega en el listado de activas', async () => {
      const reservations = [{ id: 'r-1' }];
      create.execute.mockResolvedValue(undefined);
      list.execute.mockResolvedValue(reservations);

      await expect(controller.findAll()).resolves.toBe(reservations);
      expect(list.execute).toHaveBeenCalledTimes(1);
    });

    it('GET /reservations/occupancy pasa el rango como dos argumentos sueltos', async () => {
      const result = { byDate: {} };
      occupancy.execute.mockResolvedValue(result);

      await expect(
        controller.occupancy({ from: '2026-04-20', to: '2026-04-21' }),
      ).resolves.toBe(result);
      expect(occupancy.execute).toHaveBeenCalledWith(
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
      create.execute.mockResolvedValue({ id: 'r-1', ...dto });

      const result = await controller.create(dto as any);

      expect(create.execute).toHaveBeenCalledWith(dto);
      expect(result).toMatchObject({ id: 'r-1' });
    });

    it('DELETE /reservations/:id delega la cancelación con el id', async () => {
      cancel.execute.mockResolvedValue(undefined);

      await controller.remove('4d2f0e4e-6f1b-4a3e-9a2f-2b1c3d4e5f60');

      expect(cancel.execute).toHaveBeenCalledWith(
        '4d2f0e4e-6f1b-4a3e-9a2f-2b1c3d4e5f60',
      );
    });
  });

  describe('protección por rol (contrato preservado)', () => {
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
