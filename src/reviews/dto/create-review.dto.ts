import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateReviewDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  description: string;

  @IsInt()
  @Min(1)
  @Max(5)
  score: number;
}
