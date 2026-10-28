import { ComposedLine, Omission } from '../../domain/packages/package-composer';

/**
 * El **canal presentado**: el dato tipado que una herramienta produce para que
 * el widget lo pinte, junto al texto del asistente.
 *
 * Lo que lo hace valioso es por dónde NO pasa. El resultado de `execute` vuelve
 * al modelo como contexto de la siguiente llamada y cada campo se paga en
 * tokens (§6.2, RF56 c.9); una presentación, en cambio, va del caso de uso al
 * borde HTTP y de ahí al navegador. Enriquecerla —con imágenes, por ejemplo— no
 * cuesta nada y no contradice la proyección pobre que el asistente le enseña al
 * modelo. Esa separación es el corazón de este diseño: si algún día una
 * presentación se le entrega al LLM, deja de ser gratis.
 *
 * La unión está discriminada por `tipo` para poder crecer sin tocar lo que ya
 * existe: una clase nueva de tarjeta es una variante más, no un cambio en el
 * contrato de las anteriores.
 */
export type AssistantPresentation =
  | PackagePresentation
  | ServicesPresentation
  | ConfirmBookingPresentation
  | ConfirmCancelPresentation
  | ConfirmReschedulePresentation
  | AgendaPresentation
  | TextoPresentation;

/** Propuesta de paquete de evento, tal como la compone `componerPaquete`. */
export interface PackagePresentation {
  tipo: 'paquete';
  evento: string;
  completa: boolean;
  total: number;
  minutos: number;
  lineas: ComposedLine[];
  /** Lista explícita para reservar después el paquete que se enseñó. */
  serviciosIds: string[];
  omitidas: Omission[];
  fecha?: string;
}

/** Un servicio tal y como lo pinta la tarjeta del chat. */
export interface PresentedService {
  id: string;
  nombre: string;
  precio: number;
  minutos: number;
  /**
   * Imagen principal del servicio. Viaja SOLO por aquí: el modelo nunca ve una
   * URL, que sería un campo caro y sin utilidad para conversar.
   */
  imagen?: string;
}

/** Listado de servicios del catálogo, como el que devuelve `listarServicios`. */
export interface ServicesPresentation {
  tipo: 'servicios';
  servicios: PresentedService[];
}

/**
 * Plan 06, F4 (D4): las tres presentaciones de WhatsApp que piden un botón.
 * Nunca llegan a la web —solo las producen las herramientas del juego de
 * WhatsApp—; el webhook (F5) las convierte en botones con
 * `mensajeDeConfirmacion`.
 */
export interface ConfirmBookingPresentation {
  tipo: 'confirmar-reserva';
  /** Id de la propuesta guardada: va dentro del botón `BOOK_OK|…`. */
  propuestaId: string;
  nombre: string;
  servicios: string[];
  fecha: string;
  hora: string;
}

/**
 * La cita sobre la que se pide confirmación, **leída de la base** y no del
 * modelo (revisión de F4): es lo que la persona ve antes de pulsar, así que no
 * puede depender de que el modelo haya copiado bien el id.
 */
export interface CitaAConfirmar {
  fecha: string;
  hora: string;
  servicios: string[];
  /** Solo para la dueña: de quién es la cita (nombre ya filtrado). */
  clienta?: string;
}

export interface ConfirmCancelPresentation {
  tipo: 'confirmar-cancelacion';
  reservaId: string;
  cita: CitaAConfirmar;
}

export interface ConfirmReschedulePresentation {
  tipo: 'confirmar-cambio';
  reservaId: string;
  /** Hora nueva en la zona del salón, `YYYY-MM-DDTHH:mm`: la del botón `RSAT`. */
  cuandoLocal: string;
  fecha: string;
  hora: string;
  /** La cita tal como está ahora. */
  cita: CitaAConfirmar;
}

/**
 * RF59 c1: la agenda de la dueña por WhatsApp, una línea por cita. Se envía tal
 * cual, sin pasar por el resumen del modelo (que perdía clienta y estilista).
 * Solo la produce `verAgenda`; nunca llega a la web.
 */
export interface AgendaPresentation {
  tipo: 'agenda';
  /** Encabezado de cada día y, debajo, `10:00 · clienta · servicios · con estilista`. */
  lineas: string[];
  hayMas: boolean;
}

/**
 * Texto que la clienta debe leer **tal cual**, sin pasar por el resumen del
 * modelo: la lista de sus reservas (TC-RF54-01) o la frase de la estilista que
 * la atenderá. Una línea por elemento. En la web el caso de uso lo añade debajo
 * de la respuesta; en WhatsApp se envía como mensaje aparte.
 */
export interface TextoPresentation {
  tipo: 'texto';
  lineas: string[];
  /**
   * Qué es, para que el bucle sepa qué conservar (revisión final): `lista` es
   * la de `misReservas` (solo la última del turno, y ninguna si en el turno se
   * canceló o movió algo, porque ya no es cierta); `escritura` es la
   * confirmación de una cancelación o un cambio hecho de verdad, que se
   * conserva incluso si el turno acaba en la respuesta de cortesía.
   */
  clase?: 'lista' | 'escritura';
  /**
   * Lo que se guarda en el historial de la conversación en lugar de las líneas
   * (que no se guardan: el modelo las releería como suyas en cada turno). No
   * sale del caso de uso: el bucle lo quita antes de responder.
   */
  enElHistorial?: string;
}
