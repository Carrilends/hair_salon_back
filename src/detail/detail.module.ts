import { Module } from '@nestjs/common';
import { DetailService } from './detail.service';
import { DetailController } from './detail.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Detail } from './entities/detail.entity';

@Module({
  controllers: [DetailController],
  providers: [DetailService],
  imports: [TypeOrmModule.forFeature([Detail])],
})
export class DetailModule {}
