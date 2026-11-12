import { Injectable } from '@nestjs/common';
import { ConfirmPendingAbsenceUseCase } from 'src/assistant/application/confirm-pending-absence.use-case';
import { fechaYFranja } from 'src/assistant/application/tools/ausencia-en-palabras';
import { PendingAbsenceActionsPort } from '../../domain/ports/pending-absence-actions.port';

/**
 * Puente entre el canal y el caso de uso del asistente que aplica o descarta
 * una propuesta de ausencia (2026-11-11). El canal solo pide «aplica ésta, con
 * este número» y recibe lo que la dueña va a leer.
 */
@Injectable()
export class PendingAbsenceActionsAdapter implements PendingAbsenceActionsPort {
  constructor(private readonly useCase: ConfirmPendingAbsenceUseCase) {}

  async confirm(id: string, phoneE164: string) {
    const r = await this.useCase.confirm(id, phoneE164);
    if (r.ok === false) return { ok: false as const, motivo: r.motivo };
    return {
      ok: true as const,
      estilista: r.resultado.workerName,
      ...fechaYFranja(r.resultado.startsAt, r.resultado.endsAt),
      lineas: r.lineas,
    };
  }

  discard(id: string, phoneE164: string) {
    return this.useCase.discard(id, phoneE164);
  }
}
