import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SendMessageDto {
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @IsString()
  @MinLength(1)
  // Tope de longitud: sin él, cualquiera puede pegar diez mil palabras y
  // facturarlas al proyecto (§6.2).
  @MaxLength(500)
  message: string;
}
