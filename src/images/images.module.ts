import { Module } from '@nestjs/common';
import { ImageManager } from './images.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImagesController } from './imanges.controller';
import { ImagesService } from './images.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  controllers: [ImagesController],
  providers: [ImagesService],
  imports: [TypeOrmModule.forFeature([ImageManager]), AuthModule],
})
export class ImagesModule {}
