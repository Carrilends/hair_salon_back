import { AssistantModule } from './assistant.module';
import { SendMessageUseCase } from './application/send-message.use-case';
import {
  CONVERSATION_PHONE_REPOSITORY,
  CONVERSATION_REPOSITORY,
} from './application/tokens';

/**
 * Plan 06, F3a (revisión). El puerto de teléfono se inyecta con `@Optional()`:
 * si el cableado se rompiera, la aplicación arrancaría igual y el fallo solo
 * aparecería con el primer mensaje de WhatsApp. Esto lo detecta antes, leyendo
 * los metadatos del módulo real sin instanciar nada.
 */
type Proveedor = { provide?: unknown; useExisting?: unknown };

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
