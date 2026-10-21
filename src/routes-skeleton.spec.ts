import { MODULE_METADATA } from '@nestjs/common/constants';
import { META_ROLES } from 'src/auth/decorators/role-protected.decorator';
import { ValidRoles } from 'src/auth/interfaces/valid-roles';
import { DetailModule } from 'src/detail/detail.module';
import { ImagesController } from 'src/images/imanges.controller';
import { PlannesModule } from 'src/plannes/plannes.module';
import { TagsController } from 'src/tags/tags.controller';
import { TypeModule } from 'src/type/type.module';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Restos del generador de Nest que respondían texto fijo («HOLA», «This action
 * returns all type») como si fueran API (hallazgo de la F4). Se fijan aquí
 * para que no vuelvan.
 */
describe('la API no publica endpoints esqueleto', () => {
  const controladores = (modulo: object) =>
    Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, modulo) ?? [];

  it('tipo, detalle y planes solo registran su entidad, sin controlador', () => {
    expect(controladores(TypeModule)).toEqual([]);
    expect(controladores(PlannesModule)).toEqual([]);
    expect(controladores(DetailModule)).toEqual([]);
  });

  it('imágenes solo conserva la edición', () => {
    const metodos = Object.getOwnPropertyNames(
      ImagesController.prototype,
    ).filter((m) => m !== 'constructor');
    expect(metodos).toEqual(['update']);
  });

  it('el módulo de archivos ya no existe', () => {
    expect(fs.existsSync(path.join(__dirname, 'files'))).toBe(false);
  });

  it('la siembra de etiquetas exige administradora, además del entorno', () => {
    const roles = Reflect.getMetadata(
      META_ROLES,
      TagsController.prototype.seedTags,
    );
    expect(roles).toEqual([ValidRoles.admin]);
  });
});
