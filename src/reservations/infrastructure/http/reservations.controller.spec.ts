import { META_ROLES } from 'src/auth/decorators/role-protected.decorator';
import { ValidRoles } from 'src/auth/interfaces/valid-roles';
import { ReservationsController } from './reservations.controller';

/**
 * Caracterización del controlador maduro (Fase 2): delega en los casos de uso
 * del dominio de reservas y preserva el contrato observable. Fija qué caso de
 * uso invoca cada endpoint, con qué argumentos, y qué rutas quedan restringidas.
 */
describe('ReservationsController', () => {
  let create: { execute: jest.Mock };
  let occupancy: { execute: jest.Mock };
  let list: { execute: jest.Mock };
  let getMine: { execute: jest.Mock };
  let confirm: { execute: jest.Mock };
  let cancel: { execute: jest.Mock };
  let reschedule: { execute: jest.Mock };
  let controller: ReservationsController;

  const ID = '4d2f0e4e-6f1b-4a3e-9a2f-2b1c3d4e5f60';

  beforeEach(() => {
    create = { execute: jest.fn() };
    occupancy = { execute: jest.fn() };
    list = { execute: jest.fn() };
    getMine = { execute: jest.fn() };
    confirm = { execute: jest.fn() };
    cancel = { execute: jest.fn() };
    reschedule = { execute: jest.fn() };
    controller = new ReservationsController(
      create as any,
      occupancy as any,
      list as any,
      getMine as any,
      confirm as any,
      cancel as any,
      reschedule as any,
    );
  });

  describe('delegación en los casos de uso', () => {
    it('GET /reservations delega en el listado de activas', async () => {
      const reservations = [{ id: 'r-1' }];
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

    it('GET /reservations/me lista las reservas del usuario autenticado', async () => {
      const views = [{ id: 'r-1' }];
      getMine.execute.mockResolvedValue(views);
      await expect(controller.mine({ id: 'u-9' } as any)).resolves.toBe(views);
      expect(getMine.execute).toHaveBeenCalledWith('u-9');
    });

    it('POST /reservations arma el comando con serviceIds y enlaza el usuario del JWT', async () => {
      const dto = {
        scheduledAt: '2026-04-20T15:00:00.000Z',
        serviceIds: ['s1', 's2'],
        workerId: 'w-1',
      };
      create.execute.mockResolvedValue({ id: 'r-1' });
      const result = await controller.create(
        dto as any,
        {
          user: { id: 'u-1' },
        } as any,
      );
      expect(create.execute).toHaveBeenCalledWith({
        scheduledAt: dto.scheduledAt,
        serviceIds: dto.serviceIds,
        workerId: dto.workerId,
        userId: 'u-1',
        contact: null,
      });
      expect(result).toMatchObject({ id: 'r-1' });
    });

    it('POST /reservations admite reserva anónima con contacto y sin usuario', async () => {
      const dto = {
        scheduledAt: '2026-04-20T15:00:00.000Z',
        serviceIds: ['s1'],
        contact: { name: 'Ana', phone: '3001234567' },
      };
      create.execute.mockResolvedValue({ id: 'r-2' });
      await controller.create(dto as any, {} as any);
      expect(create.execute).toHaveBeenCalledWith(
        expect.objectContaining({ userId: null, contact: dto.contact }),
      );
    });

    it('PATCH /reservations/:id/confirm delega la confirmación', async () => {
      confirm.execute.mockResolvedValue({ id: ID, status: 'confirmada' });
      await controller.confirmReservation(ID);
      expect(confirm.execute).toHaveBeenCalledWith(ID);
    });

    it('PATCH /reservations/:id/cancel pasa el actor (usuario no admin)', async () => {
      cancel.execute.mockResolvedValue({ id: ID, status: 'cancelada' });
      await controller.cancelReservation(ID, {
        id: 'u-1',
        roles: ['user'],
      } as any);
      expect(cancel.execute).toHaveBeenCalledWith(ID, {
        kind: 'user',
        userId: 'u-1',
      });
    });

    it('PATCH /reservations/:id/cancel fabrica un actor admin si el usuario lo es', async () => {
      cancel.execute.mockResolvedValue({ id: ID, status: 'cancelada' });
      await controller.cancelReservation(ID, {
        id: 'a-1',
        roles: ['admin'],
      } as any);
      expect(cancel.execute).toHaveBeenCalledWith(ID, { kind: 'admin' });
    });

    it('PATCH /reservations/:id/reschedule pasa la hora nueva y el actor', async () => {
      reschedule.execute.mockResolvedValue({ id: ID, status: 'pendiente' });
      await controller.rescheduleReservation(
        ID,
        { scheduledAt: '2026-04-21T16:00:00.000Z' } as any,
        { id: 'u-1', roles: ['user'] } as any,
      );
      expect(reschedule.execute).toHaveBeenCalledWith(
        ID,
        '2026-04-21T16:00:00.000Z',
        { kind: 'user', userId: 'u-1' },
      );
    });

    it('PATCH /reservations/:id/reschedule fabrica un actor admin si el usuario lo es', async () => {
      reschedule.execute.mockResolvedValue({ id: ID, status: 'confirmada' });
      await controller.rescheduleReservation(
        ID,
        { scheduledAt: '2026-04-21T16:00:00.000Z' } as any,
        { id: 'a-1', roles: ['admin'] } as any,
      );
      expect(reschedule.execute).toHaveBeenCalledWith(
        ID,
        '2026-04-21T16:00:00.000Z',
        { kind: 'admin' },
      );
    });

    it('DELETE /reservations/:id cancela como administración', async () => {
      cancel.execute.mockResolvedValue({ id: ID, status: 'cancelada' });
      await controller.removeAsAdmin(ID);
      expect(cancel.execute).toHaveBeenCalledWith(ID, { kind: 'admin' });
    });
  });

  describe('protección por rol (contrato preservado)', () => {
    it('restringe listado, confirmación y borrado a administradores', () => {
      expect(
        Reflect.getMetadata(
          META_ROLES,
          ReservationsController.prototype.findAll,
        ),
      ).toEqual([ValidRoles.admin]);
      expect(
        Reflect.getMetadata(
          META_ROLES,
          ReservationsController.prototype.confirmReservation,
        ),
      ).toEqual([ValidRoles.admin]);
      expect(
        Reflect.getMetadata(
          META_ROLES,
          ReservationsController.prototype.removeAsAdmin,
        ),
      ).toEqual([ValidRoles.admin]);
    });

    it('exige sesión (sin rol específico) en "mis reservas" y cancelación', () => {
      expect(
        Reflect.getMetadata(META_ROLES, ReservationsController.prototype.mine),
      ).toEqual([]);
      expect(
        Reflect.getMetadata(
          META_ROLES,
          ReservationsController.prototype.cancelReservation,
        ),
      ).toEqual([]);
    });

    it('deja públicos la consulta de ocupación y la creación de reservas', () => {
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
