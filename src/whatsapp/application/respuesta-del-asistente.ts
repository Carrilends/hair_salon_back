import { WhatsAppMessage } from 'src/notifications/domain/ports/whatsapp-sender.port';
import { AssistantPresentation } from 'src/assistant/application/tools/assistant-presentation';
import { toWhatsAppImageUrl } from 'src/common/whatsapp-image-url';
import { mensajeDeConfirmacion } from './mensaje-de-confirmacion';

/** Tope de un mensaje de texto de WhatsApp (límite de Meta). */
export const MAX_TEXTO = 4096;
/**
 * Si el modelo devuelve solo espacios y no hay nada que confirmar, se contesta
 * esto: el silencio no es una respuesta (NF11, revisión de F5).
 */
const SIN_RESPUESTA =
  'Disculpa, no logré responderte. ¿Me lo escribes de otra forma?';
/** Tope del pie de una imagen (límite de Meta). */
const MAX_PIE = 1024;

const PESOS = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

/**
 * El prompt de WhatsApp pide texto plano, pero el modelo a veces escribe
 * Markdown igual. WhatsApp tiene su propia sintaxis (`*negrita*`, `_cursiva_`)
 * y el Markdown se vería con los asteriscos dobles a la vista. Se traduce lo
 * habitual; lo que ya está en formato de WhatsApp no se toca.
 */
export function aFormatoWhatsApp(texto: string): string {
  return texto
    .replace(/\r\n/g, '\n')
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    .replace(/__(.+?)__/g, '_$1_')
    .replace(/^#{1,6}\s+(.+)$/gm, '*$1*')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1: $2')
    .replace(/^[ \t]*[-*][ \t]+/gm, '• ')
    .trim();
}

/**
 * Parte un texto en trozos que WhatsApp acepte. Corta por el último salto de
 * línea o espacio antes del tope; si no hay, corta a la fuerza.
 */
export function partirTexto(texto: string, max = MAX_TEXTO): string[] {
  const partes: string[] = [];
  let resto = texto.trim();
  while (resto.length > max) {
    const corte = Math.max(
      resto.lastIndexOf('\n', max),
      resto.lastIndexOf(' ', max),
    );
    const donde = corte > 0 ? corte : max;
    partes.push(resto.slice(0, donde).trimEnd());
    resto = resto.slice(donde).trimStart();
  }
  if (resto) partes.push(resto);
  return partes;
}

/**
 * Primer mensaje de cada conversación nueva de una clienta (plan 06, D10):
 * quién responde, que nada queda hecho sin su botón y dónde leer la política.
 */
export function avisoLegal(politicaUrl?: string): string {
  return (
    'Hola, soy el asistente virtual de la Peluquería Marlene. Te respondo con ' +
    'inteligencia artificial (Gemini, de Google): tus mensajes se procesan con ' +
    'ese proveedor, fuera del país, y puedo equivocarme. Ninguna cita queda ' +
    'hecha ni cambiada hasta que pulses el botón «Confirmar».' +
    (politicaUrl
      ? ` Lo que escribes aquí se trata según nuestra política de datos: ${politicaUrl}`
      : '')
  );
}

/**
 * La respuesta de un turno, convertida en los mensajes que se envían y en el
 * orden en que se envían: aviso legal (si toca), el texto, la foto del servicio
 * (si se habló de uno solo) y los botones de lo que haya que confirmar.
 */
export function mensajesDeLaRespuesta(
  respuesta: { reply: string; presentaciones: AssistantPresentation[] },
  to: string,
  aviso: string | null,
): WhatsAppMessage[] {
  const mensajes: WhatsAppMessage[] = [];
  if (aviso) mensajes.push({ kind: 'text', to, body: aviso });

  const partes = partirTexto(aFormatoWhatsApp(respuesta.reply));
  const botones = conBotones(respuesta.presentaciones)
    .map((p) => mensajeDeConfirmacion(p, to))
    .filter((m): m is WhatsAppMessage => m !== null);

  for (const parte of partes.length || botones.length
    ? partes
    : [SIN_RESPUESTA]) {
    mensajes.push({ kind: 'text', to, body: parte });
  }

  const foto = fotoDelServicio(respuesta.presentaciones, to);
  if (foto) mensajes.push(foto);

  mensajes.push(...botones);
  return mensajes;
}

/**
 * Solo la ÚLTIMA propuesta de reserva del turno: cada propuesta nueva anula las
 * anteriores del número (revisión de F4), así que los botones de una anterior
 * ya solo dirían «esa propuesta ya se usó». Cancelar y mover no guardan estado y
 * van todas.
 */
function conBotones(
  presentaciones: AssistantPresentation[],
): AssistantPresentation[] {
  const ultimaReserva = [...presentaciones]
    .reverse()
    .find((p) => p.tipo === 'confirmar-reserva');
  return presentaciones.filter(
    (p) => p.tipo !== 'confirmar-reserva' || p === ultimaReserva,
  );
}

/** La foto, solo si el turno presentó exactamente un servicio con imagen válida. */
function fotoDelServicio(
  presentaciones: AssistantPresentation[],
  to: string,
): WhatsAppMessage | null {
  const listas = presentaciones.filter((p) => p.tipo === 'servicios');
  if (listas.length !== 1) return null;
  const lista = listas[0];
  if (lista.tipo !== 'servicios' || lista.servicios.length !== 1) return null;

  const s = lista.servicios[0];
  const imageUrl = s.imagen ? toWhatsAppImageUrl(s.imagen) : null;
  if (!imageUrl) return null;

  const pie = `${s.nombre}: ${PESOS.format(s.precio)} (${s.minutos} min)`;
  return {
    kind: 'image',
    to,
    imageUrl,
    caption: pie.length > MAX_PIE ? `${pie.slice(0, MAX_PIE - 1)}…` : pie,
  };
}
