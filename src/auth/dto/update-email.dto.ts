import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class UpdateEmailDto {
  @IsString()
  @IsEmail()
  newEmail: string;

  // Credencial actual: solo se verifica con bcrypt, sin política de fortaleza.
  @IsString()
  @IsNotEmpty()
  currentPassword: string;
}
