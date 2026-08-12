import { IsDateString, Matches } from 'class-validator';

export class OccupancyQueryDto {
  @IsDateString({ strict: false })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'from must be YYYY-MM-DD',
  })
  from: string;

  @IsDateString({ strict: false })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'to must be YYYY-MM-DD',
  })
  to: string;
}
