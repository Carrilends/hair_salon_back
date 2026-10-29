import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Confirmación para eliminar la cuenta: la contraseña si la cuenta tiene una,
 * o el correo si solo entra con Google. Ambos opcionales en el borde; cuál
 * hace falta lo decide el caso de uso, que responde 401 si no coincide.
 */
export class DeleteAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(256)
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  email?: string;
}
