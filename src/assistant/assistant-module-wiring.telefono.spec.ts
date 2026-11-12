import { AssistantModule } from './assistant.module';
import { SendMessageUseCase } from './application/send-message.use-case';
import {
  ASSISTANT_WHATSAPP_TOOLS,
  CONVERSATION_PHONE_REPOSITORY,
  CONVERSATION_REPOSITORY,
  OWNER_CONTACT,
  PENDING_ABSENCES,
} from './application/tokens';
import { buildWhatsAppTools } from './build-whatsapp-tools';
import { CreateReservationUseCase } from 'src/reservations/application/create-reservation.use-case';
import { RescheduleReservationUseCase } from 'src/reservations/application/reschedule-reservation.use-case';
import { PreviewAbsenceUseCase } from 'src/reservations/application/absences/preview-absence.use-case';
import { ListAbsencesUseCase } from 'src/reservations/application/absences/list-absences.use-case';
import { WorkersService } from 'src/workers/workers.service';

/**
 * Plan 06, F3a (revisión). El puerto de teléfono se inyecta con `@Optional()`:
 * si el cableado se rompiera, la aplicación arrancaría igual y el fallo solo
 * aparecería con el primer mensaje de WhatsApp. Esto lo detecta antes, leyendo
 * los metadatos del módulo real sin instanciar nada.
 */
type Proveedor = {
  provide?: unknown;
  useExisting?: unknown;
  inject?: unknown[];
};

const proveedores = (): Proveedor[] =>
  (Reflect.getMetadata('providers', AssistantModule) ?? []) as Proveedor[];

describe('cableado de AssistantModule · canal WhatsApp', () => {
  it('el puerto de teléfono es un alias del MISMO repositorio', () => {
    const alias = proveedores().find(
      (p) => p.provide === CONVERSATION_PHONE_REPOSITORY,
    );

    expect(alias?.useExisting).toBe(CONVERSATION_REPOSITORY);
  });

  it('exporta el caso de uso para el webhook de WhatsApp (F5)', () => {
    const exportados = (Reflect.getMetadata('exports', AssistantModule) ??
      []) as unknown[];

    expect(exportados).toContain(SendMessageUseCase);
  });
});

describe('cableado de AssistantModule · herramientas de WhatsApp (F3b)', () => {
  it('provee los juegos de WhatsApp con tantas dependencias como pide la fábrica', () => {
    // Nest resuelve por POSICIÓN: una entrada descolocada le pasaría el caso
    // de uso equivocado a la herramienta equivocada, sin romper el arranque.
    const juegos = proveedores().find(
      (p) => p.provide === ASSISTANT_WHATSAPP_TOOLS,
    );

    expect(juegos?.inject).toHaveLength(buildWhatsAppTools.length);
  });

  it('pasa a los juegos los casos de uso de crear y mover, para comprobar la hora de una propuesta (2026-11-10)', () => {
    const juegos = proveedores().find(
      (p) => p.provide === ASSISTANT_WHATSAPP_TOOLS,
    );
    // Justo antes del aviso a la dueña, como `buildWhatsAppTools`: crear y
    // mover, cada uno para comprobar su propuesta.
    // Desde el 2026-11-11 las ausencias van detrás del aviso a la dueña.
    expect(juegos?.inject?.slice(-7, -5)).toEqual([
      CreateReservationUseCase,
      RescheduleReservationUseCase,
    ]);
  });

  it('provee el aviso a la dueña y lo pasa a los juegos, antes de las ausencias (F6)', () => {
    expect(proveedores().some((p) => p.provide === OWNER_CONTACT)).toBe(true);
    const juegos = proveedores().find(
      (p) => p.provide === ASSISTANT_WHATSAPP_TOOLS,
    );
    expect(juegos?.inject?.[juegos.inject.length - 5]).toBe(OWNER_CONTACT);
  });

  it('pasa a los juegos lo de las ausencias, al final y en el orden de la fábrica (2026-11-11)', () => {
    expect(proveedores().some((p) => p.provide === PENDING_ABSENCES)).toBe(
      true,
    );
    const juegos = proveedores().find(
      (p) => p.provide === ASSISTANT_WHATSAPP_TOOLS,
    );
    expect(juegos?.inject?.slice(-4)).toEqual([
      PENDING_ABSENCES,
      PreviewAbsenceUseCase,
      ListAbsencesUseCase,
      WorkersService,
    ]);
  });
});
