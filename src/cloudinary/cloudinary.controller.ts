// cloudinary.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service';

class SignDto {
  folder?: string;
  public_id?: string;
  eager?: string[];
  tags?: string[];
  overwrite?: boolean;
}

@Controller('cloudinary')
export class CloudinaryController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  // El front llama a este endpoint para obtener signature + timestamp + apiKey + cloudName
  @Post('sign')
  sign(@Body() body: SignDto) {
    // TIP de seguridad: puedes ignorar body y fijar tú mismo folder/tags desde el backend
    return this.cloudinaryService.generateSignature({
      folder: body.folder ?? 'uploads',
      public_id: body.public_id,
      eager: body.eager,
      tags: body.tags,
      overwrite: body.overwrite,
    });
  }
}
