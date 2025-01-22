import { Module } from '@nestjs/common';
import { ImageManager } from './images.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImagesController } from './imanges.controller';
import { ImagesService } from './images.service';

@Module({
  controllers: [ImagesController],
  providers: [ImagesService],
  imports: [TypeOrmModule.forFeature([ImageManager])],
})
export class ImagesModule {}
