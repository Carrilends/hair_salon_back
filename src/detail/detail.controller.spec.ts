import 'reflect-metadata';
import { META_ROLES } from 'src/auth/decorators/role-protected.decorator';
import { ValidRoles } from 'src/auth/interfaces/valid-roles';
import { DetailController } from './detail.controller';

describe('DetailController (autorización)', () => {
  it('exige rol admin para crear, actualizar y borrar', () => {
    expect(
      Reflect.getMetadata(META_ROLES, DetailController.prototype.create),
    ).toEqual([ValidRoles.admin]);
    expect(
      Reflect.getMetadata(META_ROLES, DetailController.prototype.update),
    ).toEqual([ValidRoles.admin]);
    expect(
      Reflect.getMetadata(META_ROLES, DetailController.prototype.remove),
    ).toEqual([ValidRoles.admin]);
  });

  it('deja públicas las lecturas', () => {
    expect(
      Reflect.getMetadata(META_ROLES, DetailController.prototype.findAll),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(META_ROLES, DetailController.prototype.findOne),
    ).toBeUndefined();
  });
});
