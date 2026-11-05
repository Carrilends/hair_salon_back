import { WhatsAppMessage } from 'src/notifications/domain/ports/whatsapp-sender.port';
import {
  AssistantPresentation,
  CriterioParcial,
  PresentedService,
} from 'src/assistant/application/tools/assistant-presentation';
import { toWhatsAppImageUrl } from 'src/common/whatsapp-image-url';
import {
  PESOS,
  lineaDeServicio,
  pideConfirmacion,
  serviciosDelTurno,
} from 'src/assistant/application/tools/servicios-del-turno';
import { encodeButtonPayload } from '../domain/button-payload';
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
/** Tope del texto de una tarjeta del carrusel (límite de Meta). */
const MAX_TARJETA = 160;
const CUERPO_CARRUSEL = 'Desliza para ver las opciones.';
const BOTON_TARJETA = 'Me interesa';
/** Lo que se dice siempre que el listado es solo una parte (D2). */
const LINEA_DE_PARCIAL: Record<CriterioParcial, string> = {
  menor_precio: 'Son los 6 de menor precio; si buscas otro, dime cuál.',
  menor_precio_por_categoria:
    'Es el de menor precio de cada categoría; si buscas otro, dime cuál.',
};

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
 * Parte una lista de líneas en trozos que WhatsApp acepte sin cortar nunca una
 * línea por la mitad (una cita no se reparte en dos mensajes).
 */
function partirLineas(lineas: string[], max = MAX_TEXTO): string[] {
  const trozos: string[] = [];
  let actual = '';
  for (const linea of lineas.flatMap((l) => partirTexto(l, max))) {
    if (actual && actual.length + 1 + linea.length > max) {
      trozos.push(actual);
      actual = '';
    }
    actual = actual ? `${actual}\n${linea}` : linea;
  }
  if (actual) trozos.push(actual);
  return trozos;
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
 * orden en que se envían: aviso legal (si toca), el texto con la lista de los
 * servicios presentados (la lista siempre sale: una foto puede fallar después
 * de que Meta responda 200), los textos de agenda, los medios (foto o carrusel)
 * y los botones de lo que haya que confirmar.
 *
 * `imagenPorDefecto` es la foto de respaldo ya validada; sin ella, un servicio
 * sin foto válida va solo en la lista.
 */
export function mensajesDeLaRespuesta(
  respuesta: { reply: string; presentaciones: AssistantPresentation[] },
  to: string,
  aviso: string | null,
  imagenPorDefecto?: string,
): WhatsAppMessage[] {
  const mensajes: WhatsAppMessage[] = [];
  if (aviso) mensajes.push({ kind: 'text', to, body: aviso });

  const servicios = serviciosDelTurno(respuesta.presentaciones);
  const confirma = pideConfirmacion(respuesta.presentaciones);
  // Con un botón de confirmación pendiente no se lista nada: la lista
  // distraería del único paso que importa.
  const lista = confirma ? [] : servicios.map(lineaDeServicio);
  const parcial = confirma ? [] : lineasDeParcial(respuesta.presentaciones);
  const reply = aFormatoWhatsApp(respuesta.reply);
  const junto = [reply, lista.join('\n'), parcial.join('\n')]
    .filter(Boolean)
    .join('\n\n');
  // Si cabe, va en un mensaje. Si no, la respuesta se parte aparte y la lista
  // por líneas: una línea de servicio no se reparte en dos mensajes.
  const partes =
    junto.length <= MAX_TEXTO
      ? partirTexto(junto)
      : [...partirTexto(reply), ...partirLineas([...lista, ...parcial])];
  const botones = conBotones(respuesta.presentaciones)
    .map((p) => mensajeDeConfirmacion(p, to))
    .filter((m): m is WhatsAppMessage => m !== null);

  for (const parte of partes.length || botones.length
    ? partes
    : [SIN_RESPUESTA]) {
    mensajes.push({ kind: 'text', to, body: parte });
  }

  // RF59 c1: la agenda de la dueña va tal cual, una línea por cita; el texto del
  // modelo de arriba solo la introduce.
  for (const p of respuesta.presentaciones) {
    if (p.tipo === 'agenda' || p.tipo === 'texto') {
      for (const parte of partirLineas(p.lineas)) {
        mensajes.push({ kind: 'text', to, body: parte });
      }
    }
  }

  mensajes.push(...mediosDelTurno(servicios, confirma, to, imagenPorDefecto));

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

/** La línea fija de cada listado parcial del turno, sin repetirla. */
function lineasDeParcial(presentaciones: AssistantPresentation[]): string[] {
  const lineas = new Set<string>();
  for (const p of presentaciones) {
    if (p.tipo === 'servicios' && p.criterio) {
      lineas.add(LINEA_DE_PARCIAL[p.criterio]);
    }
  }
  return [...lineas];
}

/** `lineaDeServicio` recortada al tope de una tarjeta. */
function textoDeTarjeta(linea: string): string {
  return linea.length > MAX_TARJETA
    ? `${linea.slice(0, MAX_TARJETA - 1)}…`
    : linea;
}

function foto(to: string, imageUrl: string, pie: string): WhatsAppMessage {
  return {
    kind: 'image',
    to,
    imageUrl,
    caption: pie.length > MAX_PIE ? `${pie.slice(0, MAX_PIE - 1)}…` : pie,
  };
}

/**
 * Las fotos del turno. En un turno que pide confirmación: solo la foto real de
 * un único servicio, con su pie, como siempre. Fuera de él: una foto si hay un
 * solo servicio con imagen (o con respaldo), un carrusel si hay dos o más
 * tarjetas posibles (Meta exige de 2 a 10), y nada si ninguno tiene imagen. La
 * numeración de cada tarjeta es la de la lista de texto, aunque a algunos
 * servicios les falte tarjeta.
 */
function mediosDelTurno(
  servicios: PresentedService[],
  confirma: boolean,
  to: string,
  imagenPorDefecto?: string,
): WhatsAppMessage[] {
  const real = (s: PresentedService) =>
    s.imagen ? toWhatsAppImageUrl(s.imagen) : null;

  if (confirma) {
    if (servicios.length !== 1) return [];
    const url = real(servicios[0]);
    if (!url) return [];
    const s = servicios[0];
    return [
      foto(
        to,
        url,
        `${s.nombre}: ${PESOS.format(s.precio)} (${s.minutos} min)`,
      ),
    ];
  }

  const candidatos = servicios
    .map((s, i) => ({
      s,
      i,
      imageUrl: real(s) ?? imagenPorDefecto ?? null,
    }))
    .filter((c): c is typeof c & { imageUrl: string } => c.imageUrl !== null);

  if (candidatos.length === 0) return [];
  if (candidatos.length === 1) {
    const [{ s, i, imageUrl }] = candidatos;
    return [foto(to, imageUrl, lineaDeServicio(s, i))];
  }
  return [
    {
      kind: 'carousel',
      to,
      body: CUERPO_CARRUSEL,
      cards: candidatos.map(({ s, i, imageUrl }) => ({
        imageUrl,
        body: textoDeTarjeta(lineaDeServicio(s, i)),
        buttonId: encodeButtonPayload({ action: 'service', serviceId: s.id }),
        buttonTitle: BOTON_TARJETA,
      })),
    },
  ];
}
