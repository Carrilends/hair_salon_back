import { Module } from '@nestjs/common';
import { ImageManager } from './images.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([ImageManager])],
})
export class ImagesModule {}
