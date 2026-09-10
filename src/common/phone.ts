/**
 * Normaliza un teléfono colombiano al formato E.164 que exige la Cloud API de
 * WhatsApp: solo dígitos, con indicativo de país `57` y un móvil de 10 dígitos
 * (que empieza por `3`). Función pura, sin efectos.
 *
 * Vive en `common/` porque la usan **los dos sentidos** del canal, y ninguno de
 * los dos módulos puede depender del otro:
 *
 * - **Saliente:** el notificador decide el destinatario; un número que no encaje
 *   devuelve `null` y el canal se salta el envío sin lanzar.
 * - **Entrante:** el `wa_id` que Meta pone en el webhook (ya viene como
 *   `573001112233`) se compara con el teléfono guardado de la reserva. La
 *   comparación se hace **siempre sobre el valor normalizado a ambos lados**,
 *   nunca sobre el crudo, porque el teléfono se guarda tal como lo escribió la
 *   clienta y `300 123 4567` y `+573001234567` son la misma persona.
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
