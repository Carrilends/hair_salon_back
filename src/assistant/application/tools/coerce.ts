/**
 * Coacciona un argumento opcional a número finito. Los modelos a veces emiten un
 * número como cadena (`"200000"`); descartar la restricción en silencio es peor
 * que coercionarla. Devuelve `undefined` si no hay un número finito que extraer.
 */
export function coerceOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}
