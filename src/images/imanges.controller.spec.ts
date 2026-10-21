import 'reflect-metadata';
import { META_ROLES } from 'src/auth/decorators/role-protected.decorator';
import { ValidRoles } from 'src/auth/interfaces/valid-roles';
import { ImagesController } from './imanges.controller';

describe('ImagesController (autorización)', () => {
  it('exige rol admin para actualizar', () => {
    expect(
      Reflect.getMetadata(META_ROLES, ImagesController.prototype.update),
    ).toEqual([ValidRoles.admin]);
  });
});
