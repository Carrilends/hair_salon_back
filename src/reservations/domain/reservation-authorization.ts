import { normalizeCoPhoneToE164 } from 'src/common/phone';
import { Reservation } from './reservation';
import { ReservationActor } from './reservation-actor';
import { ReservationOwnershipError } from './errors';

/**
 * ¿Puede este actor operar sobre esta reserva? Regla única de propiedad, en el
 * dominio, para que las tres puertas —portal, asistente y WhatsApp— no puedan
 * divergir.
 *
 * No decide *qué* se puede hacer (eso lo dice la máquina de estados y las reglas
 * de plazo del agregado), solo *sobre qué reserva*.
 */
export function assertCanActOn(
  reservation: Reservation,
  actor: ReservationActor,
): void {
  if (canActOn(reservation, actor)) return;
  throw new ReservationOwnershipError();
}

function canActOn(reservation: Reservation, actor: ReservationActor): boolean {
  switch (actor.kind) {
    case 'admin':
      return true;

    case 'user':
      // El `!== null` explícito es el parche del agujero: una reserva anónima no
      // pertenece a ninguna usuaria con sesión, por mucho que ambos lados
      // pudieran ser nulos.
      return reservation.userId !== null && reservation.userId === actor.userId;

    case 'phone': {
      // Se compara **normalizado a ambos lados**: el teléfono se guarda tal como
      // lo escribió la clienta, así que en crudo nunca coincidiría con el `wa_id`
      // de Meta. Un teléfono que no normaliza (un fijo, un número mal escrito)
      // da `null`, y un `null` no puede empatar con el del actor, que siempre es
      // un E.164 válido.
      const propietaria = normalizeCoPhoneToE164(
        reservation.contact?.phone ?? null,
      );
      return propietaria !== null && propietaria === actor.phoneE164;
    }
  }
}
