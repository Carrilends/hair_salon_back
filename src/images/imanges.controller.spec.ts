import 'reflect-metadata';
import { META_ROLES } from 'src/auth/decorators/role-protected.decorator';
import { ValidRoles } from 'src/auth/interfaces/valid-roles';
import { ImagesController } from './imanges.controller';

describe('ImagesController (autorización)', () => {
  it('exige rol admin para crear y actualizar', () => {
    expect(
      Reflect.getMetadata(META_ROLES, ImagesController.prototype.create),
    ).toEqual([ValidRoles.admin]);
    expect(
      Reflect.getMetadata(META_ROLES, ImagesController.prototype.update),
    ).toEqual([ValidRoles.admin]);
  });

  it('deja públicas las lecturas', () => {
    expect(
      Reflect.getMetadata(META_ROLES, ImagesController.prototype.findAll),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(META_ROLES, ImagesController.prototype.findOne),
    ).toBeUndefined();
  });
});
