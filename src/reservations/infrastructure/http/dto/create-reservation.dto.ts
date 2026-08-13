import {
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReservationContactDto } from './reservation-contact.dto';

export class CreateReservationDto {
  @IsISO8601()
  scheduledAt: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  serviceIds: string[];

  @IsOptional()
  @IsUUID()
  workerId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ReservationContactDto)
  contact?: ReservationContactDto;
}
