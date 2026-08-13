import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class ReservationContactDto {
  @IsString()
  @MinLength(3)
  name: string;

  @IsString()
  @MinLength(7)
  phone: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
