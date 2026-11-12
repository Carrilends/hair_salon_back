import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  MarkAbsenceResult,
  MarkAbsenceUseCase,
} from 'src/reservations/application/absences/mark-absence.use-case';
import { GetReservationUseCase } from 'src/reservations/application/get-reservation.use-case';
import { PendingAbsenceRepositoryPort } from '../domain/ports/pending-absence-repository.port';
import { ClockPort } from '../domain/ports/clock.port';
import { motivoDeAusencia } from './tools/marcar-ausencia.tool';
import {
  REVISALA,
  horaDeLaCita,
  lineaAplicada,
} from './tools/ausencia-en-palabras';
import { ASSISTANT_CLOCK, PENDING_ABSENCES } from './tokens';

export type ConfirmPendingAbsenceResult =
  | {
      ok: true;
      resultado: MarkAbsenceResult;
      /**
       * Lo que la dueña lee, una línea por cita: `10:00 a. m. · clienta · pasa
       * a [nueva]`, `· cancelada, avísale` o, si no se pudo ni mover ni
       * cancelar, `· revísala en la bandeja`. Vacío si no tenía citas.
       */
      lineas: string[];
    }
  | {
      ok: false;
      motivo:
        | 'no_encontrada'
        | 'otro_numero'
        | 'vencida'
        | 'usada'
        | 'ausencia_cruzada'
        | 'ausencia_invalida'
        | 'estilista_no_encontrada'
        | 'error_desconocido'
        | string;
    };

/**
 * Lo que hace el botón «Confirmar» de una propuesta de ausencia (2026-11-11).
 * Es la **única** vía por la que una ausencia dicha al asistente por WhatsApp
 * se aplica, y no pasa por el modelo.
 *
 * Primero consume la propuesta (atómico: de dos toques, solo uno gana; solo el
 * número que la pidió, y antes de que venza) y después la aplica con el MISMO
 * caso de uso que el panel (`MarkAbsenceUseCase.executeExact`), que mueve o
 * cancela cada cita y avisa una por una. Si aplicarla falla, la propuesta queda
 * gastada, como las de reserva: liberarla podría aplicar dos veces.
 */
@Injectable()
export class ConfirmPendingAbsenceUseCase {
  private readonly logger = new Logger(ConfirmPendingAbsenceUseCase.name);

  constructor(
    @Inject(PENDING_ABSENCES)
    private readonly pendientes: PendingAbsenceRepositoryPort,
    private readonly markAbsence: MarkAbsenceUseCase,
    private readonly citas: GetReservationUseCase,
    @Inject(ASSISTANT_CLOCK) private readonly clock: ClockPort,
  ) {}

  async confirm(
    id: string,
    phoneE164: string,
  ): Promise<ConfirmPendingAbsenceResult> {
    const consumida = await this.pendientes.consume(
      id,
      phoneE164,
      this.clock.now(),
      'confirmada',
    );
    if (consumida.ok === false) return { ok: false, motivo: consumida.motivo };
    const p = consumida.absence;

    let resultado: MarkAbsenceResult;
    try {
      resultado = await this.markAbsence.executeExact({
        workerId: p.workerId,
        startsAt: p.startsAt,
        endsAt: p.endsAt,
      });
    } catch (error) {
      const motivo = motivoDeAusencia(error);
      if (motivo === 'error_desconocido') {
        this.logger.error(
          `No se pudo aplicar la ausencia de la propuesta ${p.id}`,
          error as Error,
        );
      }
      return { ok: false, motivo };
    }

    const lineas = resultado.impacts.map(lineaAplicada);
    for (const reservaId of resultado.sinResolver) {
      lineas.push(await this.lineaSinResolver(reservaId));
    }
    return { ok: true, resultado, lineas };
  }

  /** «Descartar»: la propuesta se gasta sin aplicar nada. */
  async discard(
    id: string,
    phoneE164: string,
  ): Promise<{ ok: true } | { ok: false; motivo: string }> {
    const r = await this.pendientes.consume(
      id,
      phoneE164,
      this.clock.now(),
      'descartada',
    );
    return r.ok === false ? { ok: false, motivo: r.motivo } : { ok: true };
  }

  /**
   * Una cita que no se pudo mover ni cancelar (`sinResolver`): con su hora y
   * clienta si se puede leer, para que la dueña la encuentre en la bandeja. Si
   * ni eso se puede, la línea sale igual: callarla sería peor.
   */
  private async lineaSinResolver(reservaId: string): Promise<string> {
    try {
      const cita = await this.citas.execute(reservaId);
      if (cita) {
        const clienta = cita.contact?.name || 'Cliente registrado';
        return `${horaDeLaCita(cita.scheduledAt)} · ${clienta} · ${REVISALA}`;
      }
    } catch (error) {
      this.logger.warn(
        `No se pudo leer la reserva sin resolver ${reservaId}: ${(error as Error).message}`,
      );
    }
    return `Una cita que no pude leer · ${REVISALA}`;
  }
}
