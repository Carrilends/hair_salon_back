import { ReservationDomainExceptionFilter } from './reservation-domain-exception.filter';
import {
  CancellationTooLateError,
  ChosenWorkerBusyError,
  OutOfBusinessHoursError,
  ReservationNotFoundError,
  ReservationOwnershipError,
  WorkerOverlapError,
} from '../../domain/errors';

/** Respuesta de Express mínima: solo anota lo que el filtro le pide. */
function respuesta() {
  const salida: { status?: number; body?: any } = {};
  const res = {
    status(code: number) {
      salida.status = code;
      return this;
    },
    json(body: unknown) {
      salida.body = body;
    },
  };
  const host = { switchToHttp: () => ({ getResponse: () => res }) } as any;
  return { host, salida };
}

function traducir(error: any) {
  const { host, salida } = respuesta();
  new ReservationDomainExceptionFilter().catch(error, host);
  return salida;
}

describe('ReservationDomainExceptionFilter', () => {
  it.each([
    [new WorkerOverlapError(), 409],
    [new ChosenWorkerBusyError(), 409],
    [new CancellationTooLateError(), 409],
    [new ReservationNotFoundError('r-1'), 404],
    [new ReservationOwnershipError(), 403],
    [new OutOfBusinessHoursError(), 400],
  ])('traduce %s al estado que le toca', (error, status) => {
    expect(traducir(error).status).toBe(status);
  });

  /**
   * Los dos motivos del 409 tienen remedios distintos y el portal tiene que
   * poder decírselo a la clienta. Viajan como un **código estable**, no como el
   * texto del mensaje: un texto se reescribe, se traduce y se acorta, y el día
   * que alguien lo retoque el portal empieza a contar la historia equivocada sin
   * que ninguna prueba se entere.
   */
  it('el 409 por estilista elegida viaja con su propio motivo', () => {
    expect(traducir(new ChosenWorkerBusyError()).body).toMatchObject({
      statusCode: 409,
      reason: 'estilista_ocupada',
    });
  });

  it('el 409 por salón lleno viaja con el motivo genérico', () => {
    expect(traducir(new WorkerOverlapError()).body).toMatchObject({
      statusCode: 409,
      reason: 'hora_ocupada',
    });
  });

  it('el motivo específico gana al genérico del que hereda', () => {
    // Si el `instanceof` genérico fuera primero se comería al específico.
    // Se exige que el motivo EXISTA además de que no sea el genérico: sin eso,
    // la prueba pasaría sola mientras el campo no estuviera implementado.
    const reason = traducir(new ChosenWorkerBusyError()).body.reason;
    expect(reason).toBeDefined();
    expect(reason).not.toBe('hora_ocupada');
  });
});
