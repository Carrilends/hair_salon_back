import { Controller, Body, Patch, Param } from '@nestjs/common';
import { ImagesService } from './images.service';
import { UpdateImagelDto } from './dto/update-image.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { ValidRoles } from 'src/auth/interfaces/valid-roles';

@Controller('images')
export class ImagesController {
  constructor(private readonly imageService: ImagesService) {}

  @Auth(ValidRoles.admin)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateImagelDto: UpdateImagelDto) {
    return this.imageService.update(id, updateImagelDto);
  }
}
