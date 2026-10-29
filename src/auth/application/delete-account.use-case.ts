import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  AccountDeletionConfirmationError,
  AdminAccountDeletionError,
  TooManyAttemptsError,
  UserNotFoundError,
} from '../domain/errors';
import { UserAccount } from '../domain/user-account';
import { UserRepositoryPort } from '../domain/ports/user-repository.port';
import { PasswordHasherPort } from '../domain/ports/password-hasher.port';
import { UnitOfWorkPort } from '../domain/ports/unit-of-work.port';
import { AccountReservationsPort } from '../domain/ports/account-reservations.port';
import { AccountReviewsPort } from '../domain/ports/account-reviews.port';
import { AccountAssistantDataPort } from '../domain/ports/account-assistant-data.port';
import { ClockPort } from '../domain/ports/clock.port';
import { ValidRoles } from '../interfaces/valid-roles';
import { FailedAttemptLimiter } from './failed-attempt-limiter';
import {
  USER_REPOSITORY,
  PASSWORD_HASHER,
  AUTH_UNIT_OF_WORK,
  ACCOUNT_RESERVATIONS,
  ACCOUNT_REVIEWS,
  ACCOUNT_ASSISTANT_DATA,
  AUTH_CLOCK,
  ACCOUNT_DELETION_LIMITER,
} from './tokens';

/** Lo que la clienta escribe para confirmar (DTO `{ password?, email? }`). */
export interface DeleteAccountCommand {
  password?: string;
  email?: string;
}

export interface DeleteAccountResult {
  reservasVigentes: number;
  reservasDesvinculadas: number;
  resenasAnonimizadas: number;
  conversacionesBorradas: number;
}

/**
 * Eliminar la cuenta propia (derecho de supresión, Ley 1581 de 2012).
 *
 * Reglas (diseño `2026-10-28-eliminar-cuenta`), todas aquí y no en el borde:
 * - una cuenta con rol `admin` no puede borrarse (403), sin tocar nada; se
 *   comprueba antes de confirmar y otra vez sobre la fila bloqueada;
 * - se confirma con la contraseña si la cuenta tiene una; si no (solo Google),
 *   con el correo, sin distinguir mayúsculas y sin espacios alrededor. Si no
 *   coincide, 422 sin tocar nada (no 401: la sesión es válida, y el portal
 *   renueva la sesión ante un 401);
 * - 5 confirmaciones fallidas en 15 minutos por cuenta bloquean (429). El
 *   intento se reserva antes de comparar, para que peticiones en paralelo no
 *   multipliquen los intentos;
 * - en **una** transacción: se copia nombre/correo a las reservas vigentes, se
 *   anonimizan las reseñas, se borran las conversaciones del asistente y se
 *   borra el usuario (sus sesiones y enlaces caen por CASCADE; sus reservas
 *   quedan con `user_id` NULL por SET NULL). Ninguna cita se cancela;
 * - no se avisa a nadie: no cambia ninguna cita.
 */
@Injectable()
export class DeleteAccountUseCase {
  private readonly logger = new Logger(DeleteAccountUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
    @Inject(AUTH_UNIT_OF_WORK) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(ACCOUNT_RESERVATIONS)
    private readonly reservations: AccountReservationsPort,
    @Inject(ACCOUNT_REVIEWS) private readonly reviews: AccountReviewsPort,
    @Inject(ACCOUNT_ASSISTANT_DATA)
    private readonly assistantData: AccountAssistantDataPort,
    @Inject(AUTH_CLOCK) private readonly clock: ClockPort,
    @Inject(ACCOUNT_DELETION_LIMITER)
    private readonly limiter: FailedAttemptLimiter,
  ) {}

  async execute(
    userId: string,
    command: DeleteAccountCommand,
  ): Promise<DeleteAccountResult> {
    const user = await this.users.findById(userId);
    if (!user) throw new UserNotFoundError();
    if (user.roles.includes(ValidRoles.admin))
      throw new AdminAccountDeletionError();

    const now = this.clock.now();
    // Se reserva el intento (contado como fallo) antes de la comparación
    // asíncrona; si la confirmación es buena, se devuelve.
    if (!this.limiter.tryAcquire(userId, now)) throw new TooManyAttemptsError();
    if (!(await this.confirms(user, command)))
      throw new AccountDeletionConfirmationError();
    this.limiter.release(userId, now);

    const result = await this.unitOfWork.run(async (tx) => {
      const locked = await this.users.lockForDeletion(tx, userId);
      if (!locked) throw new UserNotFoundError();
      // Se vuelve a mirar el rol sobre la fila bloqueada: un ascenso a admin
      // hecho en paralelo no puede colarse.
      if (locked.roles.includes(ValidRoles.admin))
        throw new AdminAccountDeletionError();
      const { vigentes, detached } = await this.reservations.handOverAndDetach(
        tx,
        userId,
        { fullName: locked.fullName, email: locked.email },
        now,
      );
      const resenas = await this.reviews.anonymize(tx, userId);
      const conversaciones = await this.assistantData.purge(tx, userId);
      await this.users.deleteWithin(tx, userId);
      return {
        reservasVigentes: vigentes,
        reservasDesvinculadas: detached,
        resenasAnonimizadas: resenas,
        conversacionesBorradas: conversaciones,
      };
    });

    this.limiter.clear(userId);
    // Sin datos personales en el registro: solo el id y los conteos.
    this.logger.log(
      `Cuenta ${userId} eliminada: ${result.reservasVigentes} reservas vigentes entregadas, ` +
        `${result.reservasDesvinculadas} desvinculadas, ${result.resenasAnonimizadas} reseñas anonimizadas, ` +
        `${result.conversacionesBorradas} conversaciones borradas`,
    );
    return result;
  }

  private async confirms(
    user: UserAccount,
    command: DeleteAccountCommand,
  ): Promise<boolean> {
    if (user.passwordHash) {
      // Con contraseña (aunque también tenga Google) se exige la contraseña:
      // el correo solo no basta.
      if (!command.password) return false;
      return this.hasher.compare(command.password, user.passwordHash);
    }
    // Solo Google: confirmación débil a propósito (la sesión ya está
    // autenticada); evita un borrado por error, no prueba identidad.
    if (typeof command.email !== 'string') return false;
    return command.email.trim().toLowerCase() === user.email.value;
  }
}
