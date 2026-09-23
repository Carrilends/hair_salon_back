import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { ValidRoles } from 'src/auth/interfaces/valid-roles';
import { User } from 'src/auth/entities/user.entity';
import { ReservationActor } from '../../domain/reservation-actor';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { RescheduleReservationDto } from './dto/reschedule-reservation.dto';
import { OccupancyQueryDto } from './dto/occupancy-query.dto';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';
import { ReservationDomainExceptionFilter } from './reservation-domain-exception.filter';
import { CreateReservationUseCase } from '../../application/create-reservation.use-case';
import { GetOccupancyUseCase } from '../../application/get-occupancy.use-case';
import { ListActiveReservationsUseCase } from '../../application/list-active-reservations.use-case';
import { GetMyReservationsUseCase } from '../../application/get-my-reservations.use-case';
import { ConfirmReservationUseCase } from '../../application/confirm-reservation.use-case';
import { CancelReservationUseCase } from '../../application/cancel-reservation.use-case';
import { RescheduleReservationUseCase } from '../../application/reschedule-reservation.use-case';

@Controller('reservations')
@UseFilters(ReservationDomainExceptionFilter)
export class ReservationsController {
  constructor(
    private readonly createReservation: CreateReservationUseCase,
    private readonly getOccupancy: GetOccupancyUseCase,
    private readonly listActive: ListActiveReservationsUseCase,
    private readonly getMine: GetMyReservationsUseCase,
    private readonly confirm: ConfirmReservationUseCase,
    private readonly cancel: CancelReservationUseCase,
    private readonly reschedule: RescheduleReservationUseCase,
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

  @Auth()
  @Get('me')
  mine(@GetUser() user: User) {
    return this.getMine.execute(user.id);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  @HttpCode(201)
  create(
    @Body() dto: CreateReservationDto,
    @Req() req: { user?: User | null },
  ) {
    const user = req.user ?? null;
    return this.createReservation.execute({
      scheduledAt: dto.scheduledAt,
      serviceIds: dto.serviceIds,
      workerId: dto.workerId,
      userId: user?.id ?? null,
      contact: dto.contact ?? null,
    });
  }

  @Auth(ValidRoles.admin)
  @Patch(':id/confirm')
  confirmReservation(@Param('id', ParseUUIDPipe) id: string) {
    return this.confirm.execute(id);
  }

  @Auth()
  @Patch(':id/cancel')
  cancelReservation(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: User,
  ) {
    return this.cancel.execute(id, actorFromUser(user));
  }

  /**
   * Mueve una cita. Es `PATCH` y no `PUT` porque solo cambia la ventana: la
   * reserva sigue siendo la misma, con su id y sus servicios. La estilista sí
   * puede cambiar, pero solo si la repartió el sistema —quien la eligió conserva
   * la suya—; esa decisión vive entera en el caso de uso y aquí no se replica
   * ninguna línea de ella. Que conserve el id importa además fuera de aquí: es
   * el asa que viaja dentro de los botones de WhatsApp.
   */
  @Auth()
  @Patch(':id/reschedule')
  async rescheduleReservation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RescheduleReservationDto,
    @GetUser() user: User,
  ) {
    // El caso de uso devuelve la **operación** (`{ reservation, workerChanged }`)
    // porque «cambió la estilista» es un hecho del movimiento, no un campo de la
    // reserva. El cuerpo de la respuesta se queda como estaba: la reserva trae su
    // `workerId`, y el portal deduce el cambio comparándolo con el que ya tenía
    // en pantalla. Envolverla rompería a todo consumidor sin darle nada nuevo.
    const { reservation } = await this.reschedule.execute(
      id,
      dto.scheduledAt,
      actorFromUser(user),
    );
    return reservation;
  }

  // RF33: el borrado de administración se implementa como cancelación (no borrado físico).
  @Auth(ValidRoles.admin)
  @Delete(':id')
  @HttpCode(200)
  removeAsAdmin(@Param('id', ParseUUIDPipe) id: string) {
    return this.cancel.execute(id, { kind: 'admin' });
  }
}

/**
 * Traduce la sesión al actor del dominio. Este es el borde donde se fabrica la
 * identidad del portal: sale del JWT y de ningún otro sitio.
 */
function actorFromUser(user: User): ReservationActor {
  return user.roles?.includes(ValidRoles.admin)
    ? { kind: 'admin' }
    : { kind: 'user', userId: user.id };
}
