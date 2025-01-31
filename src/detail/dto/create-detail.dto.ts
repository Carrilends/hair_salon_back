import {
  IsNotEmptyObject,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateDetailDto {
  @IsString()
  @IsUUID()
  @IsOptional()
  id?: string;

  @IsString()
  @MinLength(20)
  description: string;

  @IsObject()
  @IsNotEmptyObject()
  specifications: any;
}
