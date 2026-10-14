import { GetMyReservationsUseCase } from 'src/reservations/application/get-my-reservations.use-case';
import { FindActionableReservationsUseCase } from 'src/reservations/application/find-actionable-reservations.use-case';
import { ListActiveReservationsUseCase } from 'src/reservations/application/list-active-reservations.use-case';
import { ConfirmReservationUseCase } from 'src/reservations/application/confirm-reservation.use-case';
import { GetReservationUseCase } from 'src/reservations/application/get-reservation.use-case';

import {
  AssistantTool,
  WhatsAppToolSets,
} from './application/tools/assistant-tool';
import { MyReservationsTool } from './application/tools/my-reservations.tool';
import { ViewAgendaTool } from './application/tools/view-agenda.tool';
import { ConfirmReservationTool } from './application/tools/confirm-reservation.tool';
import {
  ProposeBookingTool,
  ProposeCancelTool,
  ProposeRescheduleTool,
} from './application/tools/proponer.tool';
import {
  ContactOwnerTool,
  ENFRIAMIENTO_CONTACTO_MS,
} from './application/tools/contact-owner.tool';
import { EnfriamientoPorNumero } from './application/enfriamiento-por-numero';
import { OwnerContactPort } from './domain/ports/owner-contact.port';
import { PendingBookingRepositoryPort } from './domain/ports/pending-booking-repository.port';
import { ServiceCatalogQueryPort } from './domain/ports/service-catalog-query.port';

export type { WhatsAppToolSets };

/** El argumento que WhatsApp añade a las dos herramientas que crean (D5). */
const NOMBRE = {
  type: 'string',
  description:
    'Nombre de la clienta para la reserva. Pídeselo si no lo ha dicho; no lo inventes.',
};

/**
 * Composición de los juegos de WhatsApp (plan 06, F3b). Es la **tabla de
 * permisos** del canal: lo que no está aquí, ese rol no lo puede ejecutar,
 * porque el bucle solo busca herramientas dentro del juego del turno.
 *
 * Parte del arreglo de la web (`ASSISTANT_TOOLS`) y **no lo modifica**: las
 * herramientas que en WhatsApp necesitan otra descripción u otro argumento se
 * envuelven (`conDefinicion`), sin tocar el objeto original, que es el mismo
 * que publica MCP. Las de la dueña (`verAgenda`, `confirmarReserva`) solo
 * existen aquí, de modo que MCP no las publica.
 *
 * Falla al componer si falta una herramienta base: mejor un arranque roto que
 * un canal al que le falta algo y solo se nota con el primer mensaje.
 *
 * El orden de los parámetros debe coincidir con el `inject` del módulo.
 */
export function buildWhatsAppTools(
  base: AssistantTool[],
  getMyReservations: GetMyReservationsUseCase,
  findActionable: FindActionableReservationsUseCase,
  listActive: ListActiveReservationsUseCase,
  confirm: ConfirmReservationUseCase,
  pendientes: PendingBookingRepositoryPort,
  catalog: Pick<ServiceCatalogQueryPort, 'findNamesByIds'>,
  getReservation: GetReservationUseCase,
  contacto: OwnerContactPort,
): WhatsAppToolSets {
  const de = (nombre: string): AssistantTool => {
    const tool = base.find((t) => t.name === nombre);
    if (!tool) {
      throw new Error(
        `Falta la herramienta ${nombre} para componer el canal WhatsApp.`,
      );
    }
    return tool;
  };

  const listar = de('listarServicios');
  const disponibilidad = de('consultarDisponibilidad');

  // Plan 06, F4 (D4): en WhatsApp las cuatro que escribían ahora PROPONEN, y
  // escribe el botón. Conservan el nombre y la definición de WhatsApp de F3b.
  const deps = { pendientes, catalog };
  const crear = new ProposeBookingTool(
    'crearReserva',
    conDefinicion(de('crearReserva'), {
      description:
        'Prepara una reserva a nombre de la clienta que escribe, con su número de WhatsApp, en la fecha y servicios indicados. NO reserva: ella la confirma con un botón. Hace falta su nombre.',
      extra: { nombre: NOMBRE },
    }).definition,
    deps,
  );
  const paquete = new ProposeBookingTool(
    'reservarPaquete',
    conDefinicion(de('reservarPaquete'), {
      description:
        'Prepara la reserva de un paquete ya compuesto a nombre de la clienta que escribe: UNA reserva con todos sus servicios. NO reserva: ella la confirma con un botón. Hace falta su nombre.',
      extra: { nombre: NOMBRE },
    }).definition,
    deps,
  );
  const citas = { citas: getReservation };
  const cancelar = new ProposeCancelTool(
    conDefinicion(de('cancelarReserva'), {
      description:
        'Prepara la cancelación de una cita por su id. NO cancela: se confirma con un botón, y el sistema comprueba entonces su estado y su plazo.',
    }).definition,
    citas,
  );
  const reprogramar = new ProposeRescheduleTool(
    conDefinicion(de('reprogramarReserva'), {
      description: sustituir(
        de('reprogramarReserva').definition.description ?? '',
        'Cambia la fecha y hora de una reserva de la clienta con sesión iniciada',
        'Prepara el cambio de fecha y hora de una cita por su id (NO la mueve: se confirma con un botón)',
      ),
    }).definition,
    citas,
  );

  // Las citas de ESE número: las activas y no vencidas, proyectadas a la misma
  // forma que «mis reservas» de la web, para que el modelo las lea igual.
  const misReservas = new MyReservationsTool(getMyReservations, {
    execute: async (phoneE164: string) =>
      (await findActionable.execute(phoneE164)).map((r) => ({
        id: r.id,
        scheduledAt: r.scheduledAt,
        status: r.status,
        totalDurationMinutes: r.totalDurationMinutes,
        services: r.lines.map((l) => ({ name: l.name })),
        workerPinned: r.workerPinned,
      })),
  });

  return {
    clienta: [
      listar,
      disponibilidad,
      de('recomendarServicios'),
      de('componerPaquete'),
      crear,
      paquete,
      misReservas,
      cancelar,
      reprogramar,
      // Plan 06, F6: pedir hablar con una persona. Una instancia por
      // aplicación: la fábrica corre una vez, así que el enfriamiento es único.
      new ContactOwnerTool(
        contacto,
        new EnfriamientoPorNumero(ENFRIAMIENTO_CONTACTO_MS),
      ),
    ],
    duena: [
      listar,
      disponibilidad,
      new ViewAgendaTool(listActive),
      new ConfirmReservationTool(confirm),
      cancelar,
      reprogramar,
    ],
  };
}

/**
 * Reemplazo que **falla** si no encuentra el texto: si alguien cambia la
 * descripción de la web, WhatsApp no debe quedarse en silencio con «sesión
 * iniciada» (revisión de F3b).
 */
function sustituir(texto: string, buscado: string, nuevo: string): string {
  if (!texto.includes(buscado)) {
    throw new Error(
      `La descripción de la web cambió y ya no contiene «${buscado}»: revisa la de WhatsApp.`,
    );
  }
  return texto.replace(buscado, nuevo);
}

/**
 * La misma herramienta con otra definición: otra descripción y, si hace falta,
 * argumentos **obligatorios** de más. Delega en el original, sin copiarlo ni
 * mutarlo.
 */
function conDefinicion(
  tool: AssistantTool,
  cambios: { description: string; extra?: Record<string, unknown> },
): AssistantTool {
  const params = tool.definition.parameters as {
    properties?: Record<string, unknown>;
    required?: string[];
  };
  const extra = cambios.extra ?? {};
  return {
    name: tool.name,
    definition: {
      ...tool.definition,
      description: cambios.description,
      parameters: {
        ...params,
        properties: { ...(params.properties ?? {}), ...extra },
        required: [...(params.required ?? []), ...Object.keys(extra)],
      },
    },
    execute: (args, context) => tool.execute(args, context),
    ...(tool.presentar
      ? { presentar: (result: unknown) => tool.presentar!(result) }
      : {}),
  };
}
