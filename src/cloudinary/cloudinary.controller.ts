// cloudinary.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service';
import { SignDto } from './dto/sign.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { ValidRoles } from 'src/auth/interfaces/valid-roles';

@Controller('cloudinary')
export class CloudinaryController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  // Firma de subida: habilita escribir en la cuenta Cloudinary del salón, por lo
  // que exige rol admin (la subida de medios es una operación de administración).
  @Auth(ValidRoles.admin)
  @Post('sign')
  sign(@Body() body: SignDto) {
    return this.cloudinaryService.generateSignature({
      folder: body.folder ?? 'uploads',
      public_id: body.public_id,
      eager: body.eager,
      tags: body.tags,
      overwrite: body.overwrite,
    });
  }
}
