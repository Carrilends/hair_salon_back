import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  // ValidationArguments,
} from 'class-validator';
import { UpdateImagelDto } from 'src/images/dto/update-image.dto';
import { ImageManager } from 'src/images/images.entity';
// import { ImagesService } from 'src/images/images.service';
import { Repository } from 'typeorm';

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

@Injectable()
@ValidatorConstraint({ async: true })
export class AlreadyExistOnePrincipalConstraint
  implements ValidatorConstraintInterface
{
  constructor(
    @InjectRepository(ImageManager)
    private readonly imagesRepository: Repository<ImageManager>,
  ) {}
  async validate(
    value: any,
    validationArguments?: ValidationArguments,
  ): Promise<boolean> {
    const externalID = validationArguments.object as UpdateImagelDto;
    const images = await this.imagesRepository
      .createQueryBuilder('i')
      .where('i.service = :id OR i.planne = :id', {
        id: externalID.externalId,
      })
      .getMany();
    const haveOnePrincipal = images.some((image) => image.isPrincipal);
    const comeOnePrincipal = value.some((image: any) => image.isPrincipal);
    return !(comeOnePrincipal && haveOnePrincipal);
  }
}

export function AlreadyExistOnePrincipal(
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: AlreadyExistOnePrincipalConstraint,
    });
  };
}

export function AlreadyExistOnePrincipalForUpdateImages(
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    console.log('object', object);
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: AlreadyExistOnePrincipalConstraint,
    });
  };
}
