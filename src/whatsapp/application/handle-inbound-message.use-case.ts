import { Inject, Injectable, Logger } from '@nestjs/common';
import { normalizeCoPhoneToE164 } from 'src/common/phone';
import {
  WhatsAppMessage,
  WhatsAppSenderPort,
} from 'src/notifications/domain/ports/whatsapp-sender.port';
import { WHATSAPP_SENDER } from 'src/notifications/application/tokens';
import { ReservationActor } from 'src/reservations/domain/reservation-actor';
import {
  CancellationTooLateError,
  OutOfBusinessHoursError,
  RescheduleTooLateError,
  ReservationInThePastError,
  ReservationNotFoundError,
  ReservationNotReschedulableError,
  ReservationOwnershipError,
  WorkerOverlapError,
  ChosenWorkerBusyError,
} from 'src/reservations/domain/errors';
import { salonLocalToUtcIso } from 'src/reservations/salon-time';
import { ClockPort } from 'src/reservations/domain/ports/clock.port';
import { InboundMessage, kindOf } from '../domain/inbound-message';
import {
  ButtonPayload,
  encodeButtonPayload,
  parseButtonPayload,
} from '../domain/button-payload';
import {
  ReservationActionsPort,
  ReservationSummary,
} from '../domain/ports/reservation-actions.port';
import { formatHumanTime } from './slot-options';
import { RESERVATION_ACTIONS, WHATSAPP_CHANNEL_CONFIG, CLOCK } from './tokens';

export interface WhatsAppChannelConfig {
  /** Móvil de la peluquería. Un mensaje desde aquí actúa como administración. */
  ownerPhone: string;
  timeZone: string;
}

/** Respuesta a lo que no es texto (plan 06, F2). */
const SOLO_TEXTO =
  'Por ahora solo puedo leer texto: no veo fotos, audios ni stickers. ' +
  'Escríbeme lo que necesitas y te ayudo.';
/**
 * Respuesta a un botón que no reconocemos: uno de un formato anterior, o uno
 * que este canal todavía no sabe atender. Antes caía en la rama del texto y
 * le respondía con sus citas, sin relación con lo que pulsó.
 */
const BOTON_DESCONOCIDO =
  'Ese botón ya no está disponible. Escríbeme lo que necesitas y te ayudo.';

/** Tope de filas de una lista de WhatsApp. */
const MAX_FILAS = 10;
/** Se reserva una fila para «ver más» cuando hay que paginar. */
const FILAS_CON_PAGINACION = MAX_FILAS - 1;

/**
 * El cerebro del canal entrante: traduce lo que la clienta —o la peluquería—
 * pulsó en una acción de dominio, y responde.
 *
 * **Identidad.** Aquí la identidad es el `wa_id` que Meta verifica, y lo que la
 * respalda es la firma HMAC de la petición. Es un borde nuevo, con su propio
 * mecanismo, distinto del JWT del portal y de MCP. Regla dura: este canal
 * **nunca fabrica un `userId`** a partir de un teléfono. Llama a los casos de uso
 * con un actor `phone` —o `admin` si el remitente es el número de la
 * peluquería— y deja que la propiedad se compruebe allí.
 *
 * **Nunca lanza.** Cualquier fallo se convierte en un mensaje legible o en un
 * registro. Una excepción que subiera solo conseguiría que Meta reintentara el
 * mismo mensaje una y otra vez.
 */
@Injectable()
export class HandleInboundMessageUseCase {
  private readonly logger = new Logger(HandleInboundMessageUseCase.name);

  constructor(
    @Inject(RESERVATION_ACTIONS)
    private readonly reservas: ReservationActionsPort,
    @Inject(WHATSAPP_SENDER)
    private readonly sender: WhatsAppSenderPort,
    @Inject(WHATSAPP_CHANNEL_CONFIG)
    private readonly config: WhatsAppChannelConfig,
    @Inject(CLOCK)
    private readonly clock: ClockPort,
  ) {}

  async handle(mensaje: InboundMessage): Promise<void> {
    try {
      await this.despachar(mensaje);
    } catch (error) {
      // Última red: si algo se escapó, se registra y se calla. Propagarlo haría
      // que Meta reintentara el mismo mensaje indefinidamente.
      this.logger.error(
        `Fallo procesando el mensaje ${mensaje.messageId} de ${mensaje.from}`,
        error as Error,
      );
    }
  }

  private async despachar(mensaje: InboundMessage): Promise<void> {
    const from = normalizeCoPhoneToE164(mensaje.from);
    if (!from) return;

    const esDuena = this.esLaPeluqueria(from);
    const actor: ReservationActor = esDuena
      ? { kind: 'admin' }
      : { kind: 'phone', phoneE164: from };

    // Una rama por tipo (plan 06, F2). El orden importa poco: son excluyentes.
    switch (kindOf(mensaje)) {
      case 'other':
        // Una reacción o un aviso del sistema: no se contesta.
        return;

      case 'media':
        await this.texto(from, SOLO_TEXTO);
        return;

      case 'text':
        // Texto libre: se le ofrecen sus citas. Es el punto por donde entrará
        // el asistente cuando se conecte (F5).
        await this.ofrecerSusCitas(from, esDuena);
        return;

      case 'button': {
        const payload = parseButtonPayload(mensaje.payload);
        if (!payload) {
          await this.texto(from, BOTON_DESCONOCIDO);
          return;
        }
        await this.ejecutar(payload, from, esDuena, actor);
        return;
      }
    }
  }

  private async ejecutar(
    payload: ButtonPayload,
    from: string,
    esDuena: boolean,
    actor: ReservationActor,
  ): Promise<void> {
    switch (payload.action) {
      case 'noop':
        return;

      case 'reservation':
        return this.mostrarOpciones(payload.reservationId, from, esDuena);

      case 'cancel':
        return this.pedirConfirmacionDeCancelar(payload.reservationId, from);

      case 'cancel_ok':
        return this.cancelar(payload.reservationId, from, actor);

      case 'confirm':
        return this.confirmar(payload.reservationId, from, esDuena);

      case 'reschedule':
        return this.ofrecerDias(payload.reservationId, from);

      case 'reschedule_day':
        return this.ofrecerHoras(
          payload.reservationId,
          from,
          payload.dateYmd,
          payload.offset ?? 0,
        );

      case 'reschedule_at':
        return this.mover(
          payload.reservationId,
          from,
          payload.whenYmdHm,
          actor,
        );
    }
  }

  // ---------------------------------------------------------------- consultar

  private async ofrecerSusCitas(from: string, esDuena: boolean): Promise<void> {
    if (esDuena) {
      await this.texto(
        from,
        'Los avisos de reservas llegan aquí con sus botones. ' +
          'Para ver la agenda completa, entra al panel.',
      );
      return;
    }

    const citas = await this.reservas.findActionableByPhone(
      from,
      this.clock.now(),
    );

    if (citas.length === 0) {
      await this.texto(
        from,
        'No encuentro citas próximas a nombre de este número. ' +
          'Si reservaste con otro teléfono, escríbenos y lo revisamos.',
      );
      return;
    }

    if (citas.length === 1) {
      await this.mostrarOpciones(citas[0].id, from, esDuena, citas[0]);
      return;
    }

    await this.enviar({
      kind: 'interactive-list',
      to: from,
      header: 'Tus citas',
      body: '¿Sobre cuál quieres hacer algo?',
      buttonText: 'Ver mis citas',
      rows: citas.slice(0, MAX_FILAS).map((c) => ({
        id: encodeButtonPayload({ action: 'reservation', reservationId: c.id }),
        title: recortar(this.fechaCorta(c.scheduledAt), 24),
        description: recortar(c.serviceNames.join(', '), 72),
      })),
    });
  }

  private async mostrarOpciones(
    id: string,
    from: string,
    esDuena: boolean,
    conocida?: ReservationSummary,
  ): Promise<void> {
    const cita = conocida ?? (await this.reservas.findById(id));
    if (!cita || !(await this.puedeVerla(cita, from, esDuena))) {
      await this.texto(from, 'No encuentro esa cita.');
      return;
    }

    const botones = [
      {
        id: this.p({ action: 'cancel', reservationId: id }),
        title: 'Cancelar',
      },
      {
        id: this.p({ action: 'reschedule', reservationId: id }),
        title: 'Cambiar fecha',
      },
    ];
    // Confirmar es de administración: el botón ni se le enseña a la clienta.
    if (esDuena) {
      botones.unshift({
        id: this.p({ action: 'confirm', reservationId: id }),
        title: 'Confirmar',
      });
    }

    await this.enviar({
      kind: 'interactive-buttons',
      to: from,
      body:
        `${this.fechaLarga(cita.scheduledAt)}\n` +
        `Con ${cita.workerName}. ${cita.serviceNames.join(', ')}.`,
      buttons: botones,
    });
  }

  // ----------------------------------------------------------------- cancelar

  private async pedirConfirmacionDeCancelar(
    id: string,
    from: string,
  ): Promise<void> {
    // Dos pulsaciones a propósito: un toque accidental no borra una cita.
    const cita = await this.reservas.findById(id);
    if (!cita) {
      await this.texto(from, 'No encuentro esa cita.');
      return;
    }

    await this.enviar({
      kind: 'interactive-buttons',
      to: from,
      body: `¿Seguro que quieres cancelar la cita del ${this.fechaLarga(cita.scheduledAt)}?`,
      buttons: [
        {
          id: this.p({ action: 'cancel_ok', reservationId: id }),
          title: 'Sí, cancelar',
        },
        { id: this.p({ action: 'noop' }), title: 'No, dejarla' },
      ],
    });
  }

  private async cancelar(
    id: string,
    from: string,
    actor: ReservationActor,
  ): Promise<void> {
    try {
      await this.reservas.cancel(id, actor);
      await this.texto(from, 'Listo, tu cita quedó cancelada.');
    } catch (error) {
      await this.texto(from, this.explicar(error));
    }
  }

  private async confirmar(
    id: string,
    from: string,
    esDuena: boolean,
  ): Promise<void> {
    // `ConfirmReservationUseCase` no comprueba actor —su autorización vive en el
    // borde HTTP con `@Auth(admin)`—, así que este borde tiene que poner la suya.
    if (!esDuena) {
      await this.texto(
        from,
        'La confirmación la hace la peluquería. Tu cita ya está registrada.',
      );
      return;
    }

    try {
      await this.reservas.confirm(id);
      await this.texto(from, 'Cita confirmada.');
    } catch (error) {
      await this.texto(from, this.explicar(error));
    }
  }

  // --------------------------------------------------------------- reprogramar

  private async ofrecerDias(id: string, from: string): Promise<void> {
    const cita = await this.reservas.findById(id);
    if (!cita) {
      await this.texto(from, 'No encuentro esa cita.');
      return;
    }

    const dias = await this.reservas.daysWithAvailability(
      cita.workerId,
      cita.totalDurationMinutes,
      this.clock.now(),
      MAX_FILAS,
    );

    if (dias.length === 0) {
      await this.texto(
        from,
        `No veo días con hueco para ${cita.serviceNames.join(', ')} en las próximas semanas. Escríbenos y lo miramos.`,
      );
      return;
    }

    await this.enviar({
      kind: 'interactive-list',
      to: from,
      header: 'Cambiar fecha',
      body: `¿Qué día te viene bien? La cita dura ${cita.totalDurationMinutes} minutos.`,
      buttonText: 'Ver días',
      // Se recorta aquí aunque al puerto se le pida un máximo: el tope de diez
      // filas es de la plataforma, y quien dibuja el mensaje es el responsable
      // de respetarlo. Meta rechazaría la lista entera.
      rows: dias.slice(0, MAX_FILAS).map((ymd) => ({
        id: this.p({
          action: 'reschedule_day',
          reservationId: id,
          dateYmd: ymd,
        }),
        title: recortar(this.diaCorto(ymd), 24),
      })),
    });
  }

  private async ofrecerHoras(
    id: string,
    from: string,
    dateYmd: string,
    offset: number,
  ): Promise<void> {
    const cita = await this.reservas.findById(id);
    if (!cita) {
      await this.texto(from, 'No encuentro esa cita.');
      return;
    }

    const todas = await this.reservas.slotsFor(
      dateYmd,
      cita.workerId,
      cita.totalDurationMinutes,
    );
    const restantes = todas.slice(offset);

    if (restantes.length === 0) {
      await this.texto(
        from,
        'Ese día ya no queda hueco. Elige otro día e inténtalo de nuevo.',
      );
      return;
    }

    // Si no caben todas, la última fila lleva al siguiente tramo. Diez es el
    // tope de la plataforma, no una decisión de diseño.
    const hayMas = restantes.length > MAX_FILAS;
    const visibles = hayMas
      ? restantes.slice(0, FILAS_CON_PAGINACION)
      : restantes;

    const filas = visibles.map((hhmm) => ({
      id: this.p({
        action: 'reschedule_at',
        reservationId: id,
        whenYmdHm: `${dateYmd}T${hhmm}`,
      }),
      title: recortar(formatHumanTime(hhmm), 24),
    }));

    if (hayMas) {
      filas.push({
        id: this.p({
          action: 'reschedule_day',
          reservationId: id,
          dateYmd,
          offset: offset + FILAS_CON_PAGINACION,
        }),
        title: 'Ver más horas',
      });
    }

    await this.enviar({
      kind: 'interactive-list',
      to: from,
      header: this.diaCorto(dateYmd),
      // Pulsar una hora **es** la confirmación: no hay paso siguiente donde
      // advertirla. El aviso es genérico —«puede»— porque hasta que no se
      // intenta mover nadie sabe quién quedará libre. Y solo se le muestra a
      // quien no eligió estilista: a quien la eligió, mover la cita nunca se la
      // cambia (o la conserva, o se rechaza), así que avisarla sería
      // preocuparla por algo que no puede pasarle.
      body: cita.workerPinned
        ? '¿A qué hora?'
        : '¿A qué hora? Ten en cuenta que cambiar la hora puede significar que te atienda otra estilista.',
      buttonText: 'Ver horas',
      rows: filas,
    });
  }

  private async mover(
    id: string,
    from: string,
    whenYmdHm: string,
    actor: ReservationActor,
  ): Promise<void> {
    const [dateYmd, hhmm] = whenYmdHm.split('T');
    const iso = salonLocalToUtcIso(dateYmd, hhmm, this.config.timeZone);
    if (!iso) {
      await this.texto(from, 'No pude entender esa hora. Inténtalo de nuevo.');
      return;
    }

    try {
      await this.reservas.reschedule(id, iso, actor);
      await this.texto(
        from,
        `Listo, tu cita quedó para el ${this.diaCorto(dateYmd)} a las ${formatHumanTime(hhmm)}.`,
      );
    } catch (error) {
      // El caso más probable —y el único que ella puede resolver sola— es que la
      // franja se ocupara entre que se envió la lista y ella pulsó: se le vuelve
      // a ofrecer el día en vez de dejarla en un callejón sin salida.
      //
      // El específico va ANTES que el genérico, del que hereda: si no, las dos
      // causas contarían la misma historia y una de las dos sería mentira. Las
      // dos siguen volviendo a ofrecer el día.
      if (error instanceof ChosenWorkerBusyError) {
        await this.texto(
          from,
          'Tu estilista no tiene libre esa hora. Mira las que sí.',
        );
        await this.ofrecerHoras(id, from, dateYmd, 0);
        return;
      }
      if (error instanceof WorkerOverlapError) {
        await this.texto(
          from,
          'Esa hora acaba de ocuparse. Mira las que quedan.',
        );
        await this.ofrecerHoras(id, from, dateYmd, 0);
        return;
      }
      await this.texto(from, this.explicar(error));
    }
  }

  // ------------------------------------------------------------------ apoyos

  /**
   * ¿Puede este número siquiera ver esta cita? Evita filtrar los datos de una
   * cita ajena en el mensaje antes de que el caso de uso rechace la acción.
   */
  private async puedeVerla(
    cita: ReservationSummary,
    from: string,
    esDuena: boolean,
  ): Promise<boolean> {
    if (esDuena) return true;
    const suyas = await this.reservas.findActionableByPhone(
      from,
      this.clock.now(),
    );
    return suyas.some((c) => c.id === cita.id);
  }

  private esLaPeluqueria(from: string): boolean {
    const duena = normalizeCoPhoneToE164(this.config.ownerPhone);
    return duena !== null && duena === from;
  }

  /** Traduce los errores de dominio a algo que una persona entienda. */
  private explicar(error: unknown): string {
    if (error instanceof ReservationOwnershipError) {
      return 'Esa cita no está a nombre de este número.';
    }
    if (error instanceof ReservationNotFoundError) {
      return 'No encuentro esa cita.';
    }
    if (
      error instanceof CancellationTooLateError ||
      error instanceof RescheduleTooLateError
    ) {
      return 'Ya pasó la hora de esa cita, así que no puedo cambiarla desde aquí. Escríbenos y lo miramos.';
    }
    if (error instanceof ReservationNotReschedulableError) {
      return 'Esa cita ya está cerrada y no se puede mover.';
    }
    // Específico antes que genérico: `ChosenWorkerBusyError` hereda de
    // `WorkerOverlapError` y el orden es lo único que los distingue.
    if (error instanceof ChosenWorkerBusyError) {
      return 'Tu estilista no tiene libre esa hora. Elige otra, por favor.';
    }
    if (error instanceof WorkerOverlapError) {
      return 'Esa hora acaba de ocuparse. Elige otra, por favor.';
    }
    if (error instanceof OutOfBusinessHoursError) {
      return 'Esa hora queda fuera del horario del salón.';
    }
    if (error instanceof ReservationInThePastError) {
      return 'Esa hora ya pasó. Elige otra, por favor.';
    }
    this.logger.error('Error inesperado atendiendo WhatsApp', error as Error);
    return 'Algo no salió bien. Inténtalo de nuevo en un momento.';
  }

  private p(payload: ButtonPayload): string {
    return encodeButtonPayload(payload);
  }

  private texto(to: string, body: string): Promise<void> {
    return this.enviar({ kind: 'text', to, body });
  }

  private async enviar(mensaje: WhatsAppMessage): Promise<void> {
    await this.sender.send(mensaje);
  }

  private fechaLarga(fecha: Date): string {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: this.config.timeZone,
    }).format(fecha);
  }

  private fechaCorta(fecha: Date): string {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: this.config.timeZone,
    }).format(fecha);
  }

  private diaCorto(ymd: string): string {
    // Mediodía UTC para que el día no se corra al formatear en Bogotá (UTC-5).
    const fecha = new Date(`${ymd}T12:00:00.000Z`);
    return new Intl.DateTimeFormat('es-CO', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: this.config.timeZone,
    }).format(fecha);
  }
}

/** Las filas y los botones de WhatsApp tienen topes de caracteres. */
function recortar(texto: string, max: number): string {
  return texto.length <= max ? texto : `${texto.slice(0, max - 1)}…`;
}
