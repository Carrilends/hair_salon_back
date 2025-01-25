import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { ServiceService } from './service.service';
import { ServiceController } from './service.controller';
import { Service } from './entities/service.entity';
import { ImagesService } from 'src/images/images.service';
import { ImageManager } from 'src/images/images.entity';
import { AlreadyExistOnePrincipalConstraint } from './validators/customValidators';

@Module({
  controllers: [ServiceController],
  providers: [
    ServiceService,
    ImagesService,
    AlreadyExistOnePrincipalConstraint,
  ],
  imports: [TypeOrmModule.forFeature([Service, ImageManager])],
})
export class ServiceModule {}
