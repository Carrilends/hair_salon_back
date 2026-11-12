import { ValidationPipe } from '@nestjs/common';
import { META_ROLES } from 'src/auth/decorators/role-protected.decorator';
import { ValidRoles } from 'src/auth/interfaces/valid-roles';
import { AbsenceDto } from './dto/absence.dto';
import { WorkerAbsencesController } from './worker-absences.controller';

const ID = '4d2f0e4e-6f1b-4a3e-9a2f-2b1c3d4e5f60';

describe('WorkerAbsencesController', () => {
  let list: { execute: jest.Mock };
  let preview: { execute: jest.Mock };
  let mark: { execute: jest.Mock };
  let remove: { execute: jest.Mock };
  let controller: WorkerAbsencesController;

  beforeEach(() => {
    list = { execute: jest.fn() };
    preview = { execute: jest.fn() };
    mark = { execute: jest.fn() };
    remove = { execute: jest.fn() };
    controller = new WorkerAbsencesController(
      list as any,
      preview as any,
      mark as any,
      remove as any,
    );
  });

  it('todas las rutas exigen rol admin (sin sesión el guard responde 401/403)', () => {
    for (const ruta of [
      'findAll',
      'previewAbsence',
      'markAbsence',
      'removeAbsence',
    ] as const) {
      expect(
        Reflect.getMetadata(
          META_ROLES,
          WorkerAbsencesController.prototype[ruta],
        ),
      ).toEqual([ValidRoles.admin]);
    }
  });

  it('GET lista las ausencias', async () => {
    list.execute.mockResolvedValue([{ id: 'a' }]);
    await expect(controller.findAll()).resolves.toEqual([{ id: 'a' }]);
  });

  it('preview mapea date a dateYmd y devuelve el plan (200)', async () => {
    preview.execute.mockResolvedValue({ impacts: [] });
    await expect(
      controller.previewAbsence({
        workerId: ID,
        date: '2026-11-20',
        from: '09:00',
        to: '12:00',
      }),
    ).resolves.toEqual({ impacts: [] });
    expect(preview.execute).toHaveBeenCalledWith({
      workerId: ID,
      dateYmd: '2026-11-20',
      from: '09:00',
      to: '12:00',
    });
    expect(
      Reflect.getMetadata(
        '__httpCode__',
        WorkerAbsencesController.prototype.previewAbsence,
      ),
    ).toBe(200);
  });

  it('mark responde 201 con el resultado del caso de uso', async () => {
    mark.execute.mockResolvedValue({ absenceId: 'x', sinResolver: [] });
    await expect(
      controller.markAbsence({ workerId: ID, date: '2026-11-20' }),
    ).resolves.toEqual({ absenceId: 'x', sinResolver: [] });
    expect(mark.execute).toHaveBeenCalledWith({
      workerId: ID,
      dateYmd: '2026-11-20',
      from: undefined,
      to: undefined,
    });
    expect(
      Reflect.getMetadata(
        '__httpCode__',
        WorkerAbsencesController.prototype.markAbsence,
      ),
    ).toBe(201);
  });

  it('delete responde 204 y borra por id', async () => {
    remove.execute.mockResolvedValue(undefined);
    await expect(controller.removeAbsence(ID)).resolves.toBeUndefined();
    expect(remove.execute).toHaveBeenCalledWith(ID);
    expect(
      Reflect.getMetadata(
        '__httpCode__',
        WorkerAbsencesController.prototype.removeAbsence,
      ),
    ).toBe(204);
  });

  describe('AbsenceDto con el ValidationPipe global', () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    const validar = (body: object) =>
      pipe.transform(body, { type: 'body', metatype: AbsenceDto });

    it('acepta un cuerpo válido', async () => {
      await expect(
        validar({
          workerId: ID,
          date: '2026-11-20',
          from: '09:00',
          to: '12:00',
        }),
      ).resolves.toBeDefined();
    });

    it('rechaza un campo desconocido con 400', async () => {
      await expect(
        validar({ workerId: ID, date: '2026-11-20', extra: 1 }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('rechaza una fecha que no existe (2026-02-30) con 400', async () => {
      await expect(
        validar({ workerId: ID, date: '2026-02-30' }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('rechaza workerId que no es UUID y horas mal formadas', async () => {
      await expect(
        validar({ workerId: 'abc', date: '2026-11-20' }),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        validar({
          workerId: ID,
          date: '2026-11-20',
          from: '9:00',
          to: '12:00',
        }),
      ).rejects.toMatchObject({ status: 400 });
    });
  });
});
