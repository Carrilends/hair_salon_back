import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateWorkerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;
}
