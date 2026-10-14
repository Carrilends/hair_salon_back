/**
 * Avisar a la dueña de que una clienta quiere hablar con una persona (plan 06,
 * F6, vía (a)). El asistente no sabe por dónde llega el aviso; hoy, una
 * plantilla de WhatsApp a `SALON_OWNER_WHATSAPP`.
 *
 * `sin_configurar`: no hay a quién o con qué avisar. Un fallo del transporte
 * se propaga como excepción.
 */
export type ResultadoDelAviso = 'enviado' | 'sin_configurar';

export interface OwnerContactPort {
  avisar(aviso: {
    /** El que dio la clienta, o `null` si no lo dio (D16). */
    nombre: string | null;
    /** Remitente firmado por Meta, formato `wa_id`. Nunca del modelo. */
    telefonoE164: string;
    motivo: string;
  }): Promise<ResultadoDelAviso>;
}
