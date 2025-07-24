import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  ForbiddenException,
} from '@nestjs/common';
import { ServiceService } from './service.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { FilterServiceDto } from './dto/filter-service.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { ValidRoles } from 'src/auth/interfaces/valid-roles';

@Controller('service')
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  @Auth(ValidRoles.admin)
  @Post()
  create(@Body() createServiceDto: CreateServiceDto) {
    return this.serviceService.create(createServiceDto);
  }

  @Post('search')
  search(@Body() filterDto: FilterServiceDto) {
    return this.serviceService.search(filterDto);
  }

  @Get(':term')
  findOne(@Param('term') term: string) {
    return this.serviceService.findOne(term);
  }

  @Auth(ValidRoles.admin)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateServiceDto: UpdateServiceDto,
  ) {
    return this.serviceService.update(id, updateServiceDto);
  }

  @Auth(ValidRoles.admin)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.serviceService.remove(id);
  }

  @Auth(ValidRoles.admin)
  @Post('seed')
  seed() {
    // 🔐 Protege el seed
    if (process.env.NODE_ENV !== 'development') {
      throw new ForbiddenException('Seed can only be run in development');
    }
    return this.serviceService.seed();
  }
}
