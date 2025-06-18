import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { ServiceService } from './service.service';
import { ServiceController } from './service.controller';
import { ImagesService } from 'src/images/images.service';
import { AlreadyExistOnePrincipalConstraint } from './validators/customValidators';
import { Detail } from 'src/detail/entities/detail.entity';
import { Tag } from 'src/tags/entities/tag.entity';
import { ImageManager } from 'src/images/images.entity';
import { Service } from './entities/service.entity';
import { AuthModule } from 'src/auth/auth.module';
import { TagsService } from 'src/tags/tags.service';

@Module({
  controllers: [ServiceController],
  providers: [
    TagsService,
    ImagesService,
    ServiceService,
    AlreadyExistOnePrincipalConstraint,
  ],
  imports: [
    TypeOrmModule.forFeature([Service, ImageManager, Detail, Tag]),
    AuthModule,
  ],
})
export class ServiceModule {}
