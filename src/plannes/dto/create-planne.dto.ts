import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ImageManager } from 'src/images/images.entity';

export class CreatePlanneDto {
  @IsString()
  @MinLength(5)
  name: string;

  @IsString({ each: true })
  @IsArray()
  servicesIds: string[];

  @IsIn(['men', 'women', 'unisex', 'kid'])
  gender: string;

  @IsArray()
  @IsOptional()
  images?: ImageManager[];
}
