import 'reflect-metadata';
import { PATH_METADATA } from '@nestjs/common/constants';
import { META_ROLES } from 'src/auth/decorators/role-protected.decorator';
import { ValidRoles } from 'src/auth/interfaces/valid-roles';
import { WorkersController } from './workers.controller';
import { WorkersService } from './workers.service';

describe('WorkersController', () => {
  describe('autorización', () => {
    it('la carga de la semana es solo de la dueña', () => {
      expect(
        Reflect.getMetadata(META_ROLES, WorkersController.prototype.week),
      ).toEqual([ValidRoles.admin]);
    });

    it('la disponibilidad de un día sigue pública: la usa el diálogo de reserva', () => {
      expect(
        Reflect.getMetadata(
          META_ROLES,
          WorkersController.prototype.availability,
        ),
      ).toBeUndefined();
    });
  });

  it('cuelga de availability/week, distinta de availability', () => {
    expect(
      Reflect.getMetadata(PATH_METADATA, WorkersController.prototype.week),
    ).toBe('availability/week');
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        WorkersController.prototype.availability,
      ),
    ).toBe('availability');
  });

  it('pasa start al servicio tal cual: normalizar al lunes es cosa del servicio', async () => {
    const respuesta = { start: '2026-10-05', days: [], workers: [] };
    const servicio = { getWeekLoad: jest.fn().mockResolvedValue(respuesta) };
    const controlador = new WorkersController(
      servicio as unknown as WorkersService,
    );

    await expect(controlador.week({ start: '2026-10-07' })).resolves.toBe(
      respuesta,
    );
    expect(servicio.getWeekLoad).toHaveBeenCalledWith('2026-10-07');
  });
});
