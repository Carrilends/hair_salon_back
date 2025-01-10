import { IsObject, IsString, MinLength } from 'class-validator';

export class CreateDetailDto {
  @IsString()
  @MinLength(20)
  description: string;

  @IsObject()
  specifications: any;
}
