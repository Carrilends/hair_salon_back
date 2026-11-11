import { AssistantPresentation } from 'src/assistant/application/tools/assistant-presentation';

/**
 * Lo que el canal necesita del asistente (plan 06, F5): mandar lo que escribió
 * un número y recibir qué contestarle. El canal no conoce el bucle, ni el
 * presupuesto, ni los errores del asistente: solo tres motivos de fallo, que
 * sabe explicar.
 */
export type AssistantChatResult =
  | {
      ok: true;
      reply: string;
      presentaciones: AssistantPresentation[];
      /**
       * Toca el aviso legal (D10): el turno abrió conversación y el número no
       * conversó con el asistente en los últimos 30 días. Lo decide el
       * asistente; el canal solo lo envía (y nunca a la dueña).
       */
      tocaAvisoLegal: boolean;
    }
  | { ok: false; motivo: 'limite' | 'no_disponible' | 'error' };

export interface AssistantChatPort {
  conversar(entrada: {
    /** Remitente firmado por Meta, en formato `wa_id`. */
    phoneE164: string;
    /** Lo decide el canal comparando con `SALON_OWNER_WHATSAPP`, nunca el chat. */
    esDuena: boolean;
    texto: string;
  }): Promise<AssistantChatResult>;

  /**
   * Nombre vigente de un servicio del catálogo, para «Me interesa». `null` si
   * ya no existe o si la consulta falla: nunca lanza.
   */
  nombreDelServicio(id: string): Promise<string | null>;
}
