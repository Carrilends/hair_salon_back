import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  /* IsIn, */
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CreateDetailDto } from 'src/detail/dto/create-detail.dto';
import { ImageManager } from 'src/images/images.entity';
import {
  AlreadyExistOnePrincipal,
  AtLeastOnePrincipalImage,
} from '../validators/customValidators';

export class CreateServiceDto {
  @IsString()
  @MinLength(2)
  name: string;

  // @IsIn(['men', 'women', 'unisex', 'kid'])
  // gender: string;

  // @IsIn(['manicure', 'pedicure', 'hair', 'face', 'body'])
  // type: string;

  @IsNumber()
  @IsPositive()
  price: number;

  @IsBoolean()
  @IsOptional()
  isSpecial?: boolean;

  @IsBoolean()
  @IsOptional()
  havePromotion?: boolean;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  porcentageDiscount?: number;

  @IsInt()
  @Min(5)
  @Max(480)
  duration: number;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString({ each: true })
  @IsArray()
  @ArrayUnique()
  @ArrayMinSize(1)
  tags!: string[];

  @IsUUID()
  @IsOptional()
  externalId?: string;

  @IsArray()
  @IsOptional()
  @AtLeastOnePrincipalImage({
    message: 'At least one image must be principal',
  })
  @AlreadyExistOnePrincipal({
    message: 'Already exist one principal image',
  })
  images?: ImageManager[];

  @ValidateNested()
  @Type(() => CreateDetailDto)
  detail: CreateDetailDto;
}
