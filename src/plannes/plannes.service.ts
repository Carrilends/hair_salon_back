import { Injectable } from '@nestjs/common';
import { CreatePlanneDto } from './dto/create-planne.dto';
import { UpdatePlanneDto } from './dto/update-planne.dto';

@Injectable()
export class PlannesService {
  create(createPlanneDto: CreatePlanneDto) {
    return 'This action adds a new planne';
  }

  findAll() {
    return `This action returns all plannes`;
  }

  findOne(id: number) {
    return `This action returns a #${id} planne`;
  }

  update(id: number, updatePlanneDto: UpdatePlanneDto) {
    return `This action updates a #${id} planne`;
  }

  remove(id: number) {
    return `This action removes a #${id} planne`;
  }
}
