import { IsDateString, Matches } from 'class-validator';

export class WorkerAvailabilityQueryDto {
  @IsDateString({ strict: false })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be YYYY-MM-DD',
  })
  date: string;
}
