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
      /** El turno abrió conversación: toca el aviso legal (D10). */
      conversacionNueva: boolean;
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
}
