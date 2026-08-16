import { IsEmail, IsString } from 'class-validator';

export class ResendVerificationDto {
  @IsString()
  @IsEmail()
  email: string;
}
