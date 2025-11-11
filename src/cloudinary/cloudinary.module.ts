import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Cloudinary } from './cloudinary';
import { CloudinaryService } from './cloudinary.service';
import { CloudinaryProvider } from './cloudinary.provider';
import { CloudinaryController } from './cloudinary.controller';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [CloudinaryController],
  providers: [Cloudinary, CloudinaryService, CloudinaryProvider],
  exports: [CloudinaryProvider, CloudinaryService],
})
export class CloudinaryModule {}
// cloudinary.module.ts
