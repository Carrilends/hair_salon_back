import { AssistantModule } from './assistant.module';
import { SendMessageUseCase } from './application/send-message.use-case';
import {
  ASSISTANT_WHATSAPP_TOOLS,
  CONVERSATION_PHONE_REPOSITORY,
  CONVERSATION_REPOSITORY,
  OWNER_CONTACT,
} from './application/tokens';
import { buildWhatsAppTools } from './build-whatsapp-tools';

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

  it('provee el aviso a la dueña y lo pasa el último a los juegos (F6)', () => {
    expect(proveedores().some((p) => p.provide === OWNER_CONTACT)).toBe(true);
    const juegos = proveedores().find(
      (p) => p.provide === ASSISTANT_WHATSAPP_TOOLS,
    );
    expect(juegos?.inject?.[juegos.inject.length - 1]).toBe(OWNER_CONTACT);
  });
});
