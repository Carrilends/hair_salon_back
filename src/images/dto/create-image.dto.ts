import { IsBoolean, IsString, MinLength } from 'class-validator';

export class CreateImageDto {
  @IsString()
  @MinLength(10)
  url: string;

  @IsBoolean()
  isPrincipal: any;
}
