import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseFilters,
} from '@nestjs/common';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { ValidRoles } from 'src/auth/interfaces/valid-roles';
import { AbsenceDto } from './dto/absence.dto';
import { ReservationDomainExceptionFilter } from './reservation-domain-exception.filter';
import { PreviewAbsenceUseCase } from '../../application/absences/preview-absence.use-case';
import { MarkAbsenceUseCase } from '../../application/absences/mark-absence.use-case';
import { RemoveAbsenceUseCase } from '../../application/absences/remove-absence.use-case';
import { ListAbsencesUseCase } from '../../application/absences/list-absences.use-case';

/** Ausencias de las estilistas: solo la dueña las ve y las marca. */
@Controller('absences')
@UseFilters(ReservationDomainExceptionFilter)
export class WorkerAbsencesController {
  constructor(
    private readonly list: ListAbsencesUseCase,
    private readonly preview: PreviewAbsenceUseCase,
    private readonly mark: MarkAbsenceUseCase,
    private readonly remove: RemoveAbsenceUseCase,
  ) {}

  @Auth(ValidRoles.admin)
  @Get()
  findAll() {
    return this.list.execute();
  }

  /** Qué pasaría con las citas, sin tocar nada. */
  @Auth(ValidRoles.admin)
  @Post('preview')
  @HttpCode(200)
  previewAbsence(@Body() dto: AbsenceDto) {
    return this.preview.execute(this.comando(dto));
  }

  @Auth(ValidRoles.admin)
  @Post()
  @HttpCode(201)
  markAbsence(@Body() dto: AbsenceDto) {
    return this.mark.execute(this.comando(dto));
  }

  @Auth(ValidRoles.admin)
  @Delete(':id')
  @HttpCode(204)
  async removeAbsence(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.remove.execute(id);
  }

  private comando(dto: AbsenceDto) {
    return {
      workerId: dto.workerId,
      dateYmd: dto.date,
      from: dto.from,
      to: dto.to,
    };
  }
}
