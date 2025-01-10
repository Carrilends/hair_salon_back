import { IsArray, IsIn, IsString, MinLength } from 'class-validator';

export class CreatePlanneDto {
  @IsString()
  @MinLength(5)
  name: string;

  @IsString({ each: true })
  @IsArray()
  servicesIds: string[];

  @IsIn(['men', 'women', 'unisex', 'kid'])
  gender: string;
}
