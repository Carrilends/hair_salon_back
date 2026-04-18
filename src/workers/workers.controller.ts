import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { ValidRoles } from 'src/auth/interfaces/valid-roles';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { WorkersService } from './workers.service';
import { WorkerAvailabilityQueryDto } from './dto/worker-availability-query.dto';

@Controller('workers')
export class WorkersController {
  constructor(private readonly workersService: WorkersService) {}

  @Auth(ValidRoles.admin)
  @Get()
  findAll() {
    return this.workersService.findAll();
  }

  @Auth(ValidRoles.admin)
  @Post()
  create(@Body() createWorkerDto: CreateWorkerDto) {
    return this.workersService.create(createWorkerDto);
  }

  @Auth(ValidRoles.admin)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateWorkerDto: UpdateWorkerDto,
  ) {
    return this.workersService.update(id, updateWorkerDto);
  }

  @Auth(ValidRoles.admin)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.workersService.remove(id);
  }

  @Get('availability')
  availability(@Query() query: WorkerAvailabilityQueryDto) {
    return this.workersService.getAvailabilityByDate(query.date);
  }
}
