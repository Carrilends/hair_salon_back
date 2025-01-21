import {
  registerDecorator,
  ValidationOptions,
  // ValidationArguments,
} from 'class-validator';

export function AtLeastOnePrincipalImage(
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'AtLeastOnePrincipalImage',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [],
      options: validationOptions,
      validator: {
        validate(value: any) {
          // Probablemente haya que traer las imagenes del serivicio y validar que al menos una sea principal (update)
          const images = value;
          if (!images) return true;
          return images.some((image: any) => image.isPrincipal);
        },
      },
    });
  };
}
