import { Module } from '@nestjs/common';
import { DetailService } from './detail.service';
import { DetailController } from './detail.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Detail } from './entities/detail.entity';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  controllers: [DetailController],
  providers: [DetailService],
  imports: [TypeOrmModule.forFeature([Detail]), AuthModule],
})
export class DetailModule {}
