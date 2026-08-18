import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class GoogleLoginDto {
  @IsString()
  @MinLength(20)
  idToken: string;

  /**
   * Solo se exige cuando el inicio de sesión crea una cuenta nueva (S9). Al
   * entrar a una cuenta ya existente el consentimiento ya está registrado.
   */
  @IsOptional()
  @IsBoolean()
  dataPolicyAccepted?: boolean;
}
