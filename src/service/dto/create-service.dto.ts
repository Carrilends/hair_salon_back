import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmptyObject,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';
import { ImageManager } from 'src/images/images.entity';

export class CreateServiceDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsIn(['men', 'women', 'unisex', 'kid'])
  gender: string;

  @IsIn(['manicure', 'pedicure', 'hair', 'face', 'body'])
  type: string;

  @IsNumber()
  @IsPositive()
  price: number;

  @IsBoolean()
  @IsOptional()
  isSpecial?: boolean;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString({ each: true })
  @IsArray()
  @IsOptional()
  tags: string[];

  @IsArray()
  @IsOptional()
  images?: ImageManager[];

  @IsObject()
  @IsNotEmptyObject()
  detail: any;
}
