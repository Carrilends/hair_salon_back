import {
  ReservationSnapshot,
  handOverFor,
  isLiveReservation,
} from './account-deletion';

const AHORA = new Date('2026-10-28T15:00:00.000Z');
const FUTURO = new Date('2026-11-02T16:00:00.000Z');
const PASADO = new Date('2026-10-27T16:00:00.000Z');
const CUENTA = { fullName: 'Ana Ficticia', email: 'ana@ejemplo.test' };

function reserva(
  extra: Partial<ReservationSnapshot> = {},
): ReservationSnapshot {
  return {
    status: 'pendiente',
    endedAt: FUTURO,
    customerName: null,
    customerPhoneE164: null,
    customerEmail: null,
    ...extra,
  };
}

describe('isLiveReservation', () => {
  it('pendiente o confirmada y por terminar es vigente', () => {
    expect(isLiveReservation(reserva(), AHORA)).toBe(true);
    expect(isLiveReservation(reserva({ status: 'confirmada' }), AHORA)).toBe(
      true,
    );
  });

  it('una pendiente ya terminada, una cancelada o una cumplida no lo son', () => {
    expect(isLiveReservation(reserva({ endedAt: PASADO }), AHORA)).toBe(false);
    expect(isLiveReservation(reserva({ endedAt: AHORA }), AHORA)).toBe(false);
    expect(isLiveReservation(reserva({ status: 'cancelada' }), AHORA)).toBe(
      false,
    );
    expect(isLiveReservation(reserva({ status: 'cumplida' }), AHORA)).toBe(
      false,
    );
  });
});

describe('handOverFor', () => {
  it('sin nombre, sin teléfono y sin correo recibe nombre y correo', () => {
    expect(handOverFor(reserva(), CUENTA, AHORA)).toEqual({
      customerName: 'Ana Ficticia',
      customerEmail: 'ana@ejemplo.test',
    });
  });

  it('con E.164 recibe el nombre pero no el correo', () => {
    expect(
      handOverFor(
        reserva({ customerPhoneE164: '573001234567' }),
        CUENTA,
        AHORA,
      ),
    ).toEqual({ customerName: 'Ana Ficticia' });
  });

  it('sin teléfono y con otro correo ya lleno conserva ese correo', () => {
    expect(
      handOverFor(
        reserva({ customerName: 'Sofía', customerEmail: 'sofia@ejemplo.test' }),
        CUENTA,
        AHORA,
      ),
    ).toEqual({});
  });

  it('un correo con solo espacios cuenta como vacío', () => {
    expect(
      handOverFor(
        reserva({ customerName: 'Ana', customerEmail: '   ' }),
        CUENTA,
        AHORA,
      ),
    ).toEqual({ customerEmail: 'ana@ejemplo.test' });
  });

  it('un nombre ya lleno se conserva', () => {
    expect(
      handOverFor(
        reserva({
          customerName: 'Sofía',
          customerPhoneE164: '573001234567',
        }),
        CUENTA,
        AHORA,
      ),
    ).toEqual({});
  });

  it('a una no vigente no se le copia nada', () => {
    expect(handOverFor(reserva({ endedAt: PASADO }), CUENTA, AHORA)).toEqual(
      {},
    );
    expect(
      handOverFor(reserva({ status: 'cancelada' }), CUENTA, AHORA),
    ).toEqual({});
  });
});
