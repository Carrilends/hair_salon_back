import { PartialType } from '@nestjs/mapped-types';
import { CreateServiceDto } from './create-service.dto';
import { IsArray, IsOptional } from 'class-validator';
import { ImageManager } from 'src/images/images.entity';
import {
  AlreadyExistOnePrincipal,
  AlreadyExistOnePrincipalForUpdateImages,
} from '../validators/customValidators';
// import { AlreadyExistOnePrincipal } from '../validators/customValidators';

export class UpdateServiceDto extends PartialType(CreateServiceDto) {
  @IsArray()
  @IsOptional()
  @AlreadyExistOnePrincipal({
    message: 'Already exist one principal image',
  })
  images?: ImageManager[];

  @IsArray()
  @IsOptional()
  @AlreadyExistOnePrincipalForUpdateImages({
    message: 'Already exist one principal image',
  })
  updateImages?: ImageManager[];

  // deleteImages
  @IsArray()
  @IsOptional()
  deleteImages?: ImageManager[];
}
