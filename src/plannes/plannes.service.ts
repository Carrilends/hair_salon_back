import { Injectable } from '@nestjs/common';
import { CreatePlanneDto } from './dto/create-planne.dto';
import { UpdatePlanneDto } from './dto/update-planne.dto';

@Injectable()
export class PlannesService {
  create(createPlanneDto: CreatePlanneDto) {
    void createPlanneDto;
    return 'This action adds a new planne';
  }

  findAll() {
    return `This action returns all plannes`;
  }

  findOne(id: number) {
    return `This action returns a #${id} planne`;
  }

  update(id: number, updatePlanneDto: UpdatePlanneDto) {
    void updatePlanneDto;
    return `This action updates a #${id} planne`;
  }

  remove(id: number) {
    return `This action removes a #${id} planne`;
  }
}
