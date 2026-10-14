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
  | ConfirmReschedulePresentation;

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

export interface ConfirmCancelPresentation {
  tipo: 'confirmar-cancelacion';
  reservaId: string;
}

export interface ConfirmReschedulePresentation {
  tipo: 'confirmar-cambio';
  reservaId: string;
  /** Hora nueva en la zona del salón, `YYYY-MM-DDTHH:mm`: la del botón `RSAT`. */
  cuandoLocal: string;
  fecha: string;
  hora: string;
}
