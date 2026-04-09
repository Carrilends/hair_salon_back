import { IsStrongPassword, MinLength } from 'class-validator';

export class UpdatePasswordDto {
  @MinLength(8)
  @IsStrongPassword()
  currentPassword: string;

  @MinLength(8)
  @IsStrongPassword()
  newPassword: string;
}
