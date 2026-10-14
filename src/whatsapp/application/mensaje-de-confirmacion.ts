import { WhatsAppMessage } from 'src/notifications/domain/ports/whatsapp-sender.port';
import {
  AssistantPresentation,
  CitaAConfirmar,
} from 'src/assistant/application/tools/assistant-presentation';
import { encodeButtonPayload } from '../domain/button-payload';

/**
 * Convierte una presentación que pide confirmación en un mensaje con botones
 * (plan 06, F4, D4). La enviará el webhook cuando conecte el asistente (F5),
 * dentro de la ventana de 24 h, así que no necesita plantilla.
 *
 * Cancelar y mover reutilizan los botones que ya existían (`CANCEL_OK`,
 * `RSAT`), con su manejador probado; reservar usa los nuevos `BOOK_OK`/`BOOK_NO`.
 * Lo que escribe en la agenda es siempre el botón, nunca el modelo.
 *
 * `null` para las presentaciones de la web, que no piden confirmación.
 */
export function mensajeDeConfirmacion(
  presentacion: AssistantPresentation,
  to: string,
): WhatsAppMessage | null {
  const no = encodeButtonPayload({ action: 'noop' });

  switch (presentacion.tipo) {
    case 'confirmar-reserva':
      return {
        kind: 'interactive-buttons',
        to,
        body: recortar(
          `Revisa tu reserva:\n` +
            `${presentacion.servicios.join(', ')}\n` +
            `${presentacion.fecha} a las ${presentacion.hora}\n` +
            `A nombre de ${presentacion.nombre}\n\n` +
            'No queda reservada hasta que pulses «Confirmar».',
        ),
        buttons: [
          {
            id: encodeButtonPayload({
              action: 'book_ok',
              bookingId: presentacion.propuestaId,
            }),
            title: 'Confirmar',
          },
          {
            id: encodeButtonPayload({
              action: 'book_no',
              bookingId: presentacion.propuestaId,
            }),
            title: 'Cambiar',
          },
        ],
      };

    case 'confirmar-cancelacion':
      return {
        kind: 'interactive-buttons',
        to,
        body: recortar(
          `¿Cancelo la cita del ${citaEnTexto(presentacion.cita)}?`,
        ),
        buttons: [
          {
            id: encodeButtonPayload({
              action: 'cancel_ok',
              reservationId: presentacion.reservaId,
            }),
            title: 'Sí, cancelar',
          },
          { id: no, title: 'No, dejarla' },
        ],
      };

    case 'confirmar-cambio':
      return {
        kind: 'interactive-buttons',
        to,
        body: recortar(
          `¿Cambio la cita del ${citaEnTexto(presentacion.cita)} ` +
            `al ${presentacion.fecha} a las ${presentacion.hora}?`,
        ),
        buttons: [
          {
            id: encodeButtonPayload({
              action: 'reschedule_at',
              reservationId: presentacion.reservaId,
              whenYmdHm: presentacion.cuandoLocal,
            }),
            title: 'Sí, cambiar',
          },
          { id: no, title: 'No, dejarla' },
        ],
      };

    default:
      return null;
  }
}

/** El cuerpo de un mensaje con botones admite 1024 caracteres (límite de Meta). */
function recortar(texto: string): string {
  return texto.length > 1024 ? `${texto.slice(0, 1023)}…` : texto;
}

/**
 * La cita, tal como está en la base: lo que la persona ve antes de pulsar
 * (revisión de F4). «lunes 20 de octubre a las 10:00 a. m. (Corte), de Ana».
 */
function citaEnTexto(cita: CitaAConfirmar): string {
  const servicios = cita.servicios.length
    ? ` (${cita.servicios.join(', ')})`
    : '';
  const deQuien = cita.clienta ? `, de ${cita.clienta}` : '';
  return `${cita.fecha} a las ${cita.hora}${servicios}${deQuien}`;
}
