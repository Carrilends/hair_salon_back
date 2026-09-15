/**
 * Guarda de exhaustividad para los `switch` sobre `event.type`.
 *
 * Este proyecto compila con `strictNullChecks: false` y sin `noImplicitReturns`,
 * así que un `switch` al que le falta un caso **no avisa**: cae al final y
 * devuelve `undefined`. Fue exactamente lo que pasó al añadir el cuarto evento:
 * los tres notificadores compilaron y habrían fallado en producción. Poner esta
 * llamada en el `default` convierte el olvido en un error de compilación, que
 * es lo que aquellos comentarios de «el compilador es la red» prometían y no
 * cumplían.
 */
export function assertNever(value: never, contexto: string): never {
  throw new Error(
    `${contexto}: evento no contemplado ${JSON.stringify(value)}`,
  );
}
