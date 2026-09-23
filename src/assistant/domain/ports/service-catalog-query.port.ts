/** Resumen mínimo de un servicio para el asistente (proyección pobre, §6.2). */
export interface AssistantServiceSummary {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
}

/**
 * Criterios de `listarServicios`. El texto libre resuelve el **concepto** que la
 * clienta busca; el género y el tope de precio viajan aparte porque son filtros,
 * no palabras del catálogo: colarlos en el texto («corte para hombre barato»)
 * obligaba a que el nombre o la etiqueta los contuviera literalmente, y la
 * búsqueda volvía vacía.
 */
export interface ServiceSearchCriteria {
  /** Concepto a buscar; se parte en palabras y cada una debe encajar. */
  texto?: string;
  /** Nombre de la etiqueta de género: `Hombre`, `Mujer`, `Unisex` o `Niños`. */
  genero?: string;
  /** Tope de precio en pesos, inclusive. */
  precioMaximo?: number;
}

/**
 * Consulta del catálogo para el asistente. Distinto del `ServiceCatalogPort` de
 * Reservas (que resuelve snapshots por id): aquí se busca por concepto, género y
 * precio, y se acota el número de resultados. **Nunca** expone
 * `Detail.description` ni `Detail.specifications` (coste impredecible).
 */
export interface ServiceCatalogQueryPort {
  search(
    criteria: ServiceSearchCriteria,
    limit: number,
  ): Promise<AssistantServiceSummary[]>;

  /**
   * Candidatos por nombre de etiqueta (recuperación acotada, §6.2): hasta
   * `limitPerTag` por etiqueta, ordenados por precio ascendente —lo que el
   * compositor voraz necesita—. El mapa devuelto incluye SIEMPRE todas las
   * etiquetas pedidas; las que no tengan candidatos quedan con arreglo vacío.
   */
  findByTagNames(
    tagNames: string[],
    limitPerTag: number,
  ): Promise<Map<string, AssistantServiceSummary[]>>;
}
