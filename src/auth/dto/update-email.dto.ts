import {
  IsEmail,
  IsString,
  IsStrongPassword,
  MinLength,
} from 'class-validator';

export class UpdateEmailDto {
  @IsString()
  @IsEmail()
  newEmail: string;

  @MinLength(8)
  @IsStrongPassword()
  currentPassword: string;
}
