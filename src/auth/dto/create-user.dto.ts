import {
  Equals,
  IsBoolean,
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

  /**
   * Consentimiento expreso para el tratamiento de datos personales
   * (Ley 1581 de 2012 y Decreto 1377 de 2013). El frontend lo recoge con una
   * casilla obligatoria y no premarcada en el registro; aquí se exige de forma
   * explícita para que no exista forma de crear una cuenta sin él y para poder
   * dejar constancia auditable de la aceptación en `User.dataPolicyAcceptedAt`.
   */
  @IsBoolean()
  @Equals(true, {
    message: 'Debe aceptar la Política de Tratamiento de Datos Personales',
  })
  dataPolicyAccepted: boolean;
}
