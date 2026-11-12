/**
 * Las dos consultas de ausencias en un solo sitio: las usa el repositorio de
 * la agenda de reservas y también `WorkersService`, que lee con SQL crudo para
 * no importar el módulo de reservas (dependencia circular).
 */

/** Bloques de ausencia que tocan un día, en minutos locales del salón: [$1 fecha, $2 zona]. */
export const SQL_BLOQUES_DE_AUSENCIA_DEL_DIA = `SELECT worker_id,
      GREATEST(0, ROUND(EXTRACT(EPOCH FROM ((starts_at AT TIME ZONE $2) - $1::date::timestamp)) / 60)) AS start_min,
      LEAST(1440, ROUND(EXTRACT(EPOCH FROM ((ends_at AT TIME ZONE $2) - $1::date::timestamp)) / 60)) AS end_min
 FROM worker_absences
WHERE (starts_at AT TIME ZONE $2) < $1::date::timestamp + interval '1 day'
  AND (ends_at AT TIME ZONE $2) > $1::date::timestamp
ORDER BY starts_at`;

/** Minutos de ausencia por estilista y día de inicio: [$1 desde, $2 hasta, $3 zona]. */
export const SQL_MINUTOS_DE_AUSENCIA_POR_DIA = `SELECT worker_id,
      to_char(starts_at AT TIME ZONE $3, 'YYYY-MM-DD') AS d,
      SUM(ROUND(EXTRACT(EPOCH FROM (ends_at - starts_at)) / 60)) AS minutes
 FROM worker_absences
WHERE (starts_at AT TIME ZONE $3)::date BETWEEN $1::date AND $2::date
GROUP BY worker_id, d
ORDER BY d, worker_id`;
