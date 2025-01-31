import { PartialType } from '@nestjs/mapped-types';
import { CreateDetailDto } from './create-detail.dto';
import { IsString, IsUUID } from 'class-validator';

export class UpdateDetailDto extends PartialType(CreateDetailDto) {
  @IsUUID()
  @IsString()
  id: string;
}
