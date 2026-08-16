import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { DetailService } from './detail.service';
import { CreateDetailDto } from './dto/create-detail.dto';
import { UpdateDetailDto } from './dto/update-detail.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { ValidRoles } from 'src/auth/interfaces/valid-roles';

@Controller('detail')
export class DetailController {
  constructor(private readonly detailService: DetailService) {}

  @Auth(ValidRoles.admin)
  @Post()
  create(@Body() createDetailDto: CreateDetailDto) {
    return this.detailService.create(createDetailDto);
  }

  @Get()
  findAll() {
    return this.detailService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.detailService.findOne(+id);
  }

  @Auth(ValidRoles.admin)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDetailDto: UpdateDetailDto) {
    return this.detailService.update(+id, updateDetailDto);
  }

  @Auth(ValidRoles.admin)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.detailService.remove(+id);
  }
}
