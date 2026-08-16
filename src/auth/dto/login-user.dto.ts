import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginUserDto {
  @IsString()
  @IsEmail()
  email!: string;

  // La contraseña de inicio de sesión es una credencial a verificar con bcrypt,
  // no una a crear: no se le aplica la política de fortaleza (evita 400 antes de
  // comparar y no filtra la política). Basta con exigir una cadena no vacía.
  @IsString()
  @IsNotEmpty()
  password!: string;
}
