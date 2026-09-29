import {
  getDatePartsInTz,
  salonLocalToUtcIso,
} from 'src/reservations/salon-time';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Zona del salón. Única lectura del entorno para el día del asistente. */
function zona(): string {
  return process.env.SALON_TZ ?? 'America/Bogota';
}

/**
 * Fecha de hoy en la zona del salón, en el mismo formato `YYYY-MM-DD` que
 * espera `consultarDisponibilidad`. El modelo la necesita para resolver
 * «mañana» o «el viernes».
 */
export function fechaDelSalon(now: Date): string {
  const { year, month, day } = getDatePartsInTz(now, zona());
  const dosDigitos = (n: number) => String(n).padStart(2, '0');
  return `${year}-${dosDigitos(month)}-${dosDigitos(day)}`;
}

/**
 * Medianoche del día del salón, como instante UTC.
 *
 * El corte del techo de gasto es el día natural de la peluquería, no «las
 * últimas 24 horas»: un presupuesto diario tiene que reponerse a una hora
 * predecible en vez de ir arrastrándose. En Bogotá esa medianoche son las 05:00
 * UTC.
 */
export function inicioDelDiaDelSalon(now: Date): Date {
  const iso = salonLocalToUtcIso(fechaDelSalon(now), '00:00', zona());
  // `fechaDelSalon` siempre produce un `YYYY-MM-DD` válido, así que el `null` no
  // ocurre. Si ocurriera, un día entero hacia atrás sobreestima el gasto y por
  // tanto acota de más, que es el lado seguro.
  return iso ? new Date(iso) : new Date(now.getTime() - DAY_MS);
}
