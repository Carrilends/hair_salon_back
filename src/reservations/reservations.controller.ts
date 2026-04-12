import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { OccupancyQueryDto } from './dto/occupancy-query.dto';

@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get('occupancy')
  occupancy(@Query() query: OccupancyQueryDto) {
    return this.reservationsService.getOccupancy(query.from, query.to);
  }

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateReservationDto) {
    return this.reservationsService.create(dto);
  }
}
