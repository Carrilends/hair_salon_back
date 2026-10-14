import { WhatsAppChannelConfig } from './application/handle-inbound-message.use-case';

/** Ruta pública de la política de datos en el front. */
const RUTA_POLITICA = '/politica-tratamiento-datos';

/**
 * Configuración del canal leída del entorno. Función pura, aparte del módulo,
 * para poder probarla sin levantar Nest.
 */
export function configDelCanal(env: NodeJS.ProcessEnv): WhatsAppChannelConfig {
  // FRONT_URL puede ser una lista separada por comas (CORS): manda el primero,
  // como en los enlaces de `auth`.
  const front = (env.FRONT_URL ?? '').split(',')[0].trim().replace(/\/+$/, '');
  return {
    ownerPhone: env.SALON_OWNER_WHATSAPP ?? '',
    timeZone: env.SALON_TZ ?? 'America/Bogota',
    ...(front ? { politicaUrl: `${front}${RUTA_POLITICA}` } : {}),
  };
}

/**
 * ¿Conversa el asistente por WhatsApp? Apagado por defecto (D13): encenderlo
 * en producción exige Gemini de pago, porque la capa gratuita permite la
 * revisión humana de los chats.
 */
export function asistenteActivado(env: NodeJS.ProcessEnv): boolean {
  return env.WHATSAPP_ASSISTANT_ENABLED === 'true';
}
