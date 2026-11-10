/**
 * Cierra una frase con punto, salvo que ya termine en uno (o en «?» / «!»).
 *
 * Una hora en 12 horas termina en «a. m.» o «p. m.»: si la frase le añade su
 * punto final, se lee «a. m..» (prueba con móvil del 2026-11-10). Toda frase
 * que pueda acabar en una hora se cierra con esta función.
 */
export function conPuntoFinal(frase: string): string {
  return /[.?!]$/.test(frase) ? frase : `${frase}.`;
}
