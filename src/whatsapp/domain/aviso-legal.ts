/**
 * Versión de la política de tratamiento de datos que nombra el aviso legal de
 * WhatsApp. **Tiene que cambiar a la vez que la del portal**:
 * `POLICY_VERSION` en `hari_salon_front/src/pages/PrivacyPolicyPage.vue`
 * (hoy «1.5», del 28 de octubre de 2026). Al subirla, cada número vuelve a
 * recibir el aviso en su siguiente mensaje.
 */
export const POLITICA_DE_DATOS_VERSION = '1.5';

/** El aviso se repite a los 15 días del último (decisión de Luis, 2026-11-10). */
export const AVISO_LEGAL_CADA_MS = 15 * 24 * 60 * 60 * 1000;

/**
 * ¿Le toca el aviso de tratamiento de datos a este número? Sí si nunca lo
 * recibió, si pasaron 15 días o más desde el último, o si aquél nombraba otra
 * versión de la política. Antes salía en cada conversación nueva, y una
 * conversación llena que rotaba lo repetía a los pocos minutos (prueba con
 * móvil del 2026-11-10).
 */
export function tocaElAvisoLegal(
  ultimo: { sentAt: Date; policyVersion: string } | null,
  ahora: Date,
  version: string = POLITICA_DE_DATOS_VERSION,
): boolean {
  if (!ultimo) return true;
  if (ultimo.policyVersion !== version) return true;
  return ahora.getTime() - ultimo.sentAt.getTime() >= AVISO_LEGAL_CADA_MS;
}
