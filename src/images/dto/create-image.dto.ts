import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateImageDto {
  @IsUUID()
  @IsNotEmpty()
  externalId: string;

  @IsIn(['service', 'plan'])
  @IsNotEmpty()
  type: string;

  @IsString()
  @MinLength(10)
  url: string;

  @IsString()
  @MinLength(5)
  publicId: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  version: string;

  @IsBoolean()
  isPrincipal: boolean;
}

export class CreateImageDtoByService {
  @IsUUID()
  @IsNotEmpty()
  service: string;

  @IsString()
  @MinLength(10)
  url: string;

  @IsString()
  @MinLength(5)
  publicId: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  version: string;

  @IsBoolean()
  isPrincipal: boolean;
}
