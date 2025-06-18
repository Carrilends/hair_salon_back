import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  // MinLength,
} from 'class-validator';

type pricesType = {
  min: number;
  max: number;
};
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
  @IsOptional()
  prices: pricesType | null;
  @IsNumber()
  @IsOptional()
  page: number; // Para la paginación
  @IsNumber()
  @IsOptional()
  limit: number; // Para la paginación
}
