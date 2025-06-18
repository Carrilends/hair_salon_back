import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// import { Service } from '../service/entities/service.entity';
import { Tag } from '../tags/entities/tag.entity';
import { SharedInfoService } from './shared-info.service';
import { SharedInfoController } from './shared-info.controller';

@Module({
  imports: [TypeOrmModule.forFeature([/* Service */ Tag])],
  providers: [SharedInfoService],
  controllers: [SharedInfoController],
})
export class SharedInfoModule {}
