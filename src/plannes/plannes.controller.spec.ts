import { Test, TestingModule } from '@nestjs/testing';
import { PlannesController } from './plannes.controller';
import { PlannesService } from './plannes.service';

describe('PlannesController', () => {
  let controller: PlannesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlannesController],
      providers: [PlannesService],
    }).compile();

    controller = module.get<PlannesController>(PlannesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
