import {
  IsEmail,
  IsString,
  IsStrongPassword,
  MinLength,
} from 'class-validator';

export class LoginUserDto {
  @IsString()
  @IsEmail()
  email!: string;

  @MinLength(8)
  @IsStrongPassword()
  password!: string;
}
