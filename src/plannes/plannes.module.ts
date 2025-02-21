import { Module } from '@nestjs/common';
import { PlannesService } from './plannes.service';
import { PlannesController } from './plannes.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Planne } from './entities/planne.entity';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  controllers: [PlannesController],
  providers: [PlannesService],
  imports: [TypeOrmModule.forFeature([Planne]), AuthModule],
})
export class PlannesModule {}
