import { Module } from '@nestjs/common';
import { PlannesService } from './plannes.service';
import { PlannesController } from './plannes.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Planne } from './entities/planne.entity';

@Module({
  controllers: [PlannesController],
  providers: [PlannesService],
  imports: [TypeOrmModule.forFeature([Planne])],
})
export class PlannesModule {}
