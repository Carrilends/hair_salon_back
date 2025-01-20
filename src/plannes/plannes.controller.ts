import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { PlannesService } from './plannes.service';
import { CreatePlanneDto } from './dto/create-planne.dto';
import { UpdatePlanneDto } from './dto/update-planne.dto';

@Controller('plannes')
export class PlannesController {
  constructor(private readonly plannesService: PlannesService) {}

  @Post()
  create(@Body() createPlanneDto: CreatePlanneDto) {
    return this.plannesService.create(createPlanneDto);
  }

  @Get()
  findAll() {
    return this.plannesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.plannesService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePlanneDto: UpdatePlanneDto) {
    return this.plannesService.update(+id, updatePlanneDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.plannesService.remove(+id);
  }
}
