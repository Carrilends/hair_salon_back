import { PartialType } from '@nestjs/mapped-types';
import { CreateImageDto } from './create-image.dto';

export class UpdateImagelDto extends PartialType(CreateImageDto) {}
