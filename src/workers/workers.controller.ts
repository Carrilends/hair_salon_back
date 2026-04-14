import { Controller, Get, Query } from '@nestjs/common';
import { WorkersService } from './workers.service';
import { WorkerAvailabilityQueryDto } from './dto/worker-availability-query.dto';

@Controller('workers')
export class WorkersController {
  constructor(private readonly workersService: WorkersService) {}

  @Get('availability')
  availability(@Query() query: WorkerAvailabilityQueryDto) {
    return this.workersService.getAvailabilityByDate(query.date);
  }
}
