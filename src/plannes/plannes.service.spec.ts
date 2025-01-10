import { Test, TestingModule } from '@nestjs/testing';
import { PlannesService } from './plannes.service';

describe('PlannesService', () => {
  let service: PlannesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PlannesService],
    }).compile();

    service = module.get<PlannesService>(PlannesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
