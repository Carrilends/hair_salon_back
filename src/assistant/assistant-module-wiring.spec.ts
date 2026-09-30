import { AssistantModule } from './assistant.module';
import { buildAssistantTools } from './build-assistant-tools';
import {
  ASSISTANT_JUDGMENT_TELEMETRY,
  ASSISTANT_TOOLS,
  JUDGMENT,
  JUDGMENT_SETTINGS,
} from './application/tokens';

/**
 * El cableado del módulo solo se ejecuta al arrancar, y arrancar exige base de
 * datos. Estas dos comprobaciones leen los metadatos del módulo REAL —sin
 * instanciar nada— y cubren los dos fallos que no se verían hasta el
 * despliegue: un token que nadie provee y un `inject` descolocado.
 */
type Proveedor = { provide?: unknown; inject?: unknown[] };

const proveedores = (): Proveedor[] =>
  (Reflect.getMetadata('providers', AssistantModule) ?? []) as Proveedor[];

describe('cableado de AssistantModule', () => {
  it.each([
    ['JUDGMENT', JUDGMENT],
    ['JUDGMENT_SETTINGS', JUDGMENT_SETTINGS],
    ['ASSISTANT_JUDGMENT_TELEMETRY', ASSISTANT_JUDGMENT_TELEMETRY],
  ])('provee %s, que varios proveedores inyectan', (_nombre, token) => {
    expect(proveedores().some((p) => p.provide === token)).toBe(true);
  });

  it('el `inject` de ASSISTANT_TOOLS tiene tantas entradas como parámetros la fábrica', () => {
    // Nest resuelve por POSICIÓN: una entrada de más o de menos no rompe el
    // arranque, le pasa el argumento equivocado a la herramienta equivocada.
    const tools = proveedores().find((p) => p.provide === ASSISTANT_TOOLS);

    expect(tools?.inject).toHaveLength(buildAssistantTools.length);
  });
});
