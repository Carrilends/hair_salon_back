import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

/**
 * Parámetros opcionales para la firma de subida a Cloudinary. Con el
 * ValidationPipe global (`forbidNonWhitelisted`), cada campo aceptado debe
 * llevar decoradores o el body con parámetros devolvería 400.
 */
export class SignDto {
  @IsOptional()
  @IsString()
  folder?: string;

  @IsOptional()
  @IsString()
  public_id?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eager?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  overwrite?: boolean;
}
