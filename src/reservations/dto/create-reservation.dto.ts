import { IsInt, IsISO8601, Min } from 'class-validator';

export class CreateReservationDto {
  @IsISO8601()
  scheduledAt: string;

  @IsInt()
  @Min(1)
  totalDurationMinutes: number;
}
