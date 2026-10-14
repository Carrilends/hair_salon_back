/**
 * Puerto de transporte de WhatsApp (Etapa 2). Espejo de `EmailSenderPort`: quien
 * compone el mensaje lo entrega aquí sin saber qué hay detrás (consola en
 * desarrollo, Cloud API de Meta en producción).
 *
 * Es una **unión discriminada por `kind`**, y el discriminante no es decorativo:
 * obliga al adaptador real a un `switch` exhaustivo, de modo que añadir una
 * forma de mensaje no compila hasta que se decide cómo se traduce al payload de
 * Graph. El compilador hace de red de seguridad.
 *
 * Las cuatro formas existen porque Meta trata de manera distinta dos situaciones:
 *
 * - **Fuera de la ventana de 24 h** (el negocio inicia la conversación) solo se
 *   puede enviar una **plantilla aprobada**. Es el caso de todos los avisos.
 * - **Dentro de la ventana** (la clienta acaba de escribir o de pulsar un botón)
 *   se puede enviar texto e interactivos libres, **sin plantilla**. Es todo el
 *   flujo conversacional de cancelar y mover, y por eso el trámite con Meta se
 *   reduce a un puñado de plantillas en vez de una por pantalla.
 */

/** Botón de respuesta rápida de una plantilla, por posición. */
export interface WhatsAppTemplateButton {
  index: number;
  payload: string;
}

/** Fila de una lista interactiva. Máximo 10 por sección (límite de Meta). */
export interface WhatsAppListRow {
  id: string;
  title: string;
  description?: string;
}

export type WhatsAppMessage =
  | {
      kind: 'template';
      to: string;
      /**
       * La plantilla es **del mensaje, no de la aplicación**: cada aviso usa la
       * suya (confirmación, cancelación, cambio, aviso a la peluquería) y una
       * sola variable de entorno global no podría representarlo.
       */
      templateName: string;
      templateLang?: string;
      /**
       * Foto de la cabecera, para plantillas aprobadas con cabecera IMAGE
       * (plan 06, F1). Debe ir **solo** si la plantilla la tiene: Meta rechaza
       * tanto la cabecera que sobra como la que falta.
       */
      headerImageUrl?: string;
      bodyParams: string[];
      buttons?: WhatsAppTemplateButton[];
    }
  | {
      kind: 'interactive-buttons';
      to: string;
      body: string;
      /** Máximo 3 (límite de Meta). */
      buttons: { id: string; title: string }[];
    }
  | {
      kind: 'interactive-list';
      to: string;
      body: string;
      buttonText: string;
      header?: string;
      footer?: string;
      rows: WhatsAppListRow[];
    }
  | { kind: 'text'; to: string; body: string };

export interface WhatsAppSenderPort {
  send(message: WhatsAppMessage): Promise<void>;
}
