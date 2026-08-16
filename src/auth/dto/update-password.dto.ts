import {
  IsNotEmpty,
  IsString,
  IsStrongPassword,
  MinLength,
} from 'class-validator';

export class UpdatePasswordDto {
  // Credencial actual: solo se verifica con bcrypt, sin política de fortaleza.
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  // Contraseña nueva: política vigente (min. 8 + mayúscula + minúscula + número,
  // SIN símbolo obligatorio) alineada con el frontend.
  @MinLength(8)
  @IsStrongPassword({ minSymbols: 0 })
  newPassword: string;
}
