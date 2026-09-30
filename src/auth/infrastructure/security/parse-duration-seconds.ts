const UNIT_SECONDS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 24 * 60 * 60,
};

/**
 * Convierte una vigencia expresada como `15m`, `1h`, `30d`, `45s` o un número
 * de segundos (`900`) en segundos. Se usa para derivar `accessTokenTtlSeconds`
 * de la misma variable `JWT_EXPIRES_IN` con la que se firma el JWT, evitando dos
 * fuentes de verdad para la vigencia.
 */
export function parseDurationSeconds(value: string): number {
  const trimmed = value.trim();
  const match = /^(\d+)([smhd]?)$/.exec(trimmed);
  if (!match) {
    throw new Error(
      `Vigencia inválida: "${value}" (use segundos o sufijos s/m/h/d)`,
    );
  }
  const amount = Number(match[1]);
  const unit = match[2] || 's';
  return amount * UNIT_SECONDS[unit];
}
