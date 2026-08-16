import { IsString, IsStrongPassword, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @MinLength(20) // los tokens generados son de 32 bytes en base64url
  token: string;

  @MinLength(8)
  @IsStrongPassword({ minSymbols: 0 }) // misma política que CreateUserDto (sin símbolo)
  newPassword: string;
}
