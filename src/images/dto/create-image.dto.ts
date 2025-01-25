import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
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

  @IsBoolean()
  isPrincipal: any;
}

export class CreateImageDtoByService {
  @IsUUID()
  @IsNotEmpty()
  service: string;

  @IsString()
  @MinLength(10)
  url: string;

  @IsBoolean()
  isPrincipal: boolean;
}
