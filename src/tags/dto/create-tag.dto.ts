import {
  IsOptional,
  IsUUID,
  IsNotEmpty,
  IsString,
  ArrayUnique,
} from 'class-validator';

export class CreateTagDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  childrenIds?: string[];
}
