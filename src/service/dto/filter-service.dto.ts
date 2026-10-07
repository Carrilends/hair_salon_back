import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
  // MinLength,
} from 'class-validator';

/**
 * Rango del filtro de precio, en MILES de pesos (el control del portal va de
 * 5 a 300). `ServiceService` lo convierte a pesos con `rangoEnPesos`
 * (`src/service/precio-filtro.ts`) antes de compararlo con `s.price`.
 */
export class RangoPreciosDto {
  @IsNumber()
  @Min(0)
  min: number;
  @IsNumber()
  @Min(0)
  max: number;
}

export class FilterServiceDto {
  @IsString()
  @IsOptional()
  // @MinLength(3)
  name: string;
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  selectedGenres: string[];
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  selectedServicesIDs: string[];
  @IsBoolean()
  @IsOptional()
  includePriceRange: boolean;
  @IsBoolean()
  @IsOptional()
  includePromotionsOnly: boolean;
  @IsOptional()
  @ValidateNested()
  @Type(() => RangoPreciosDto)
  prices: RangoPreciosDto | null;
  @IsNumber()
  @IsOptional()
  page: number; // Para la paginación
  @IsNumber()
  @IsOptional()
  limit: number; // Para la paginación
}
