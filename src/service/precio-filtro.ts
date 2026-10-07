/**
 * El filtro de precio del catálogo llega en MILES de pesos: el control del
 * portal va de 5 a 200 y pinta «5.000 $ ― 200.000 $» (`PRECIO_ESCALA_MIN/MAX`
 * en `hari_salon_front/src/stores/filters-store.ts`). Los precios de `service`
 * están en pesos, así que el rango se convierte aquí, una sola vez, antes de
 * compararlo. Sin esta conversión `s.price BETWEEN 5 AND 200` no casaba con
 * ningún servicio y activar el filtro dejaba la lista vacía.
 */
export const PESOS_POR_UNIDAD_DE_FILTRO = 1000;

export type RangoDePrecio = { min: number; max: number };

/**
 * El rango del control, en pesos y ordenado: si el mínimo llega por encima del
 * máximo se intercambian, en vez de mandar a PostgreSQL un BETWEEN que nunca
 * casa.
 */
export function rangoEnPesos({ min, max }: RangoDePrecio): RangoDePrecio {
  const desde = Number(min) * PESOS_POR_UNIDAD_DE_FILTRO;
  const hasta = Number(max) * PESOS_POR_UNIDAD_DE_FILTRO;
  return desde <= hasta
    ? { min: desde, max: hasta }
    : { min: hasta, max: desde };
}
