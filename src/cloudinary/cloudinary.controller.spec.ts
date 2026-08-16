import 'reflect-metadata';
import { META_ROLES } from 'src/auth/decorators/role-protected.decorator';
import { ValidRoles } from 'src/auth/interfaces/valid-roles';
import { CloudinaryController } from './cloudinary.controller';

describe('CloudinaryController (autorización)', () => {
  it('exige rol admin para firmar subidas', () => {
    // La firma habilita subir/pisar assets en la cuenta Cloudinary del salón;
    // no debe ser accesible de forma anónima.
    expect(
      Reflect.getMetadata(META_ROLES, CloudinaryController.prototype.sign),
    ).toEqual([ValidRoles.admin]);
  });
});
