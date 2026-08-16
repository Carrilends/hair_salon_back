import { IsString, MinLength } from 'class-validator';

export class VerifyEmailDto {
  @IsString()
  @MinLength(20) // los tokens generados son de 32 bytes en base64url
  token: string;
}
