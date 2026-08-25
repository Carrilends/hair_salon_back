/**
 * Normaliza un teléfono colombiano al formato E.164 que exige la Cloud API de
 * WhatsApp: solo dígitos, con indicativo de país `57` y un móvil de 10 dígitos
 * (que empieza por `3`). Función pura, sin efectos: la usa el notificador para
 * decidir el destinatario y, si el número no es un móvil colombiano válido,
 * devuelve `null` para que el canal se salte el envío sin lanzar.
 */
export function normalizeCoPhoneToE164(raw: string | null): string | null {
  if (!raw) return null;

  // Solo dígitos: descarta `+`, espacios, guiones, paréntesis, etc.
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 0) return null;

  // Quita ceros de troncal iniciales (p. ej. `0300...`).
  digits = digits.replace(/^0+/, '');

  // Si ya trae el indicativo `57` (12 dígitos), quédate con el móvil local.
  const local =
    digits.startsWith('57') && digits.length === 12 ? digits.slice(2) : digits;

  // Móvil colombiano válido: 10 dígitos que empiezan por 3.
  if (/^3\d{9}$/.test(local)) {
    return `57${local}`;
  }

  return null;
}
