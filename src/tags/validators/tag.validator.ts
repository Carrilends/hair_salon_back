import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class FilterTagValidator {
  @IsOptional()
  @IsBoolean()
  genres?: boolean;

  @IsOptional()
  @IsBoolean()
  principalParents?: boolean;

  @IsOptional()
  @IsString()
  @IsUUID('4')
  idParent?: string;
}
