import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseFilters,
} from '@nestjs/common';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { ValidRoles } from 'src/auth/interfaces/valid-roles';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { OccupancyQueryDto } from './dto/occupancy-query.dto';
import { CreateReservationUseCase } from '../../application/create-reservation.use-case';
import { GetOccupancyUseCase } from '../../application/get-occupancy.use-case';
import { ListActiveReservationsUseCase } from '../../application/list-active-reservations.use-case';
import { CancelReservationUseCase } from '../../application/cancel-reservation.use-case';
import { ReservationDomainExceptionFilter } from './reservation-domain-exception.filter';

@Controller('reservations')
@UseFilters(ReservationDomainExceptionFilter)
export class ReservationsController {
  constructor(
    private readonly createReservation: CreateReservationUseCase,
    private readonly getOccupancy: GetOccupancyUseCase,
    private readonly listActive: ListActiveReservationsUseCase,
    private readonly cancelReservation: CancelReservationUseCase,
  ) {}

  @Auth(ValidRoles.admin)
  @Get()
  findAll() {
    return this.listActive.execute();
  }

  @Get('occupancy')
  occupancy(@Query() query: OccupancyQueryDto) {
    return this.getOccupancy.execute(query.from, query.to);
  }

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateReservationDto) {
    return this.createReservation.execute(dto);
  }

  @Auth(ValidRoles.admin)
  @Delete(':id')
  @HttpCode(200)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.cancelReservation.execute(id);
  }
}
