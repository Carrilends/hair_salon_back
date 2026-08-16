import { Controller, Get, Post, Body, Patch, Param } from '@nestjs/common';
import { ImagesService } from './images.service';
import { CreateImageDto } from './dto/create-image.dto';
import { UpdateImagelDto } from './dto/update-image.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { ValidRoles } from 'src/auth/interfaces/valid-roles';

@Controller('images')
export class ImagesController {
  constructor(private readonly imageService: ImagesService) {}

  @Auth(ValidRoles.admin)
  @Post()
  create(@Body() createImageDto: CreateImageDto) {
    return this.imageService.create(createImageDto);
  }

  @Get()
  findAll() {
    return this.imageService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.imageService.findOne(+id);
  }

  @Auth(ValidRoles.admin)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateImagelDto: UpdateImagelDto) {
    return this.imageService.update(id, updateImagelDto);
  }
}
