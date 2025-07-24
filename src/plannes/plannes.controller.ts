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
import { Auth } from 'src/auth/decorators/auth.decorator';
import { ValidRoles } from 'src/auth/interfaces/valid-roles';

@Controller('plannes')
export class PlannesController {
  constructor(private readonly plannesService: PlannesService) {}

  @Auth(ValidRoles.admin)
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

  @Auth(ValidRoles.admin)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePlanneDto: UpdatePlanneDto) {
    return this.plannesService.update(+id, updatePlanneDto);
  }

  @Auth(ValidRoles.admin)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.plannesService.remove(+id);
  }
}
