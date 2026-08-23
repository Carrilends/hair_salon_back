import { AssistantServiceSummary } from '../../domain/ports/service-catalog-query.port';

/** Fila cruda del join servicio↔etiqueta (el `numeric` de Postgres llega como cadena). */
export interface TaggedServiceRow {
  id: string;
  name: string;
  price: number | string;
  duration: number;
  tagName: string;
}

/**
 * Agrupa candidatos por nombre de etiqueta, ordena cada grupo por precio
 * ascendente (lo que el compositor voraz necesita) y lo capa a `limitPerTag`. El
 * mapa incluye SIEMPRE todas las etiquetas pedidas: las que no tengan candidatos
 * quedan con arreglo vacío, para que el compositor pueda distinguir «sin
 * candidatos» sin ambigüedad. Ordena aquí y no confía solo en el `ORDER BY` del
 * SQL: la selección de los más baratos es una regla de dominio, no de la consulta.
 */
export function groupCandidatesByTag(
  rows: TaggedServiceRow[],
  tagNames: string[],
  limitPerTag: number,
): Map<string, AssistantServiceSummary[]> {
  const result = new Map<string, AssistantServiceSummary[]>();
  for (const name of tagNames) result.set(name, []);

  for (const row of rows) {
    const bucket = result.get(row.tagName);
    if (!bucket) continue;
    bucket.push({
      id: row.id,
      name: row.name,
      price: Number(row.price),
      durationMinutes: row.duration,
    });
  }

  for (const [name, bucket] of result) {
    bucket.sort((a, b) => a.price - b.price);
    result.set(name, bucket.slice(0, limitPerTag));
  }

  return result;
}
