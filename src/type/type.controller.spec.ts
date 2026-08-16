import 'reflect-metadata';
import { META_ROLES } from 'src/auth/decorators/role-protected.decorator';
import { ValidRoles } from 'src/auth/interfaces/valid-roles';
import { TypeController } from './type.controller';

describe('TypeController (autorización)', () => {
  it('exige rol admin para crear, actualizar y borrar', () => {
    expect(
      Reflect.getMetadata(META_ROLES, TypeController.prototype.create),
    ).toEqual([ValidRoles.admin]);
    expect(
      Reflect.getMetadata(META_ROLES, TypeController.prototype.update),
    ).toEqual([ValidRoles.admin]);
    expect(
      Reflect.getMetadata(META_ROLES, TypeController.prototype.remove),
    ).toEqual([ValidRoles.admin]);
  });

  it('deja públicas las lecturas', () => {
    expect(
      Reflect.getMetadata(META_ROLES, TypeController.prototype.findAll),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(META_ROLES, TypeController.prototype.findOne),
    ).toBeUndefined();
  });
});
