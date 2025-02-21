import {
  IsEmail,
  IsString,
  IsStrongPassword,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsEmail()
  email: string;

  @MinLength(8)
  @IsStrongPassword()
  password: string;

  @IsString()
  fullName: string;
}
