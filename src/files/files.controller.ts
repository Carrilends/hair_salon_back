import {
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FilesService } from './files.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { fileFilter } from './helpers/fileFilter';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get('service/:imageName')
  findImage(@Param('imageName') imageName: string): string {
    return imageName;
  }

  @Post('service')
  @UseInterceptors(FileInterceptor('file', { fileFilter }))
  uploadFileService(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('The file is not allowed');
    }
    return {
      fileName: file.originalname,
    };
  }

  @Post('plan')
  @UseInterceptors(FileInterceptor('file', { fileFilter }))
  uploadFilePlan(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('The file is not allowed');
    }
    return {
      fileName: file.originalname,
    };
  }
}
