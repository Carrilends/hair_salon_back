import { AssistantContext, AssistantTool } from './assistant-tool';
import { LlmToolDefinition } from '../../domain/ports/llm.port';
import { ServiceCatalogQueryPort } from '../../domain/ports/service-catalog-query.port';

const MAX_RESULTS = 8;

/**
 * `listarServicios`: busca en el catálogo, **proyecta** y **acota** (§6.2). La
 * proyección es deliberadamente pobre —ni descripción ni `specifications`—
 * porque el resultado vuelve como contexto de la siguiente llamada y cada campo
 * de más se paga.
 */
export class ListServicesTool implements AssistantTool {
  readonly name = 'listarServicios';

  readonly definition: LlmToolDefinition = {
    name: this.name,
    description:
      'Busca servicios del salón por texto. Devuelve nombre, precio y duración.',
    parameters: {
      type: 'object',
      properties: {
        busqueda: {
          type: 'string',
          description: 'Texto a buscar, por ejemplo "corte" o "manicure"',
        },
      },
      required: [],
      additionalProperties: false,
    },
  };

  constructor(private readonly catalog: ServiceCatalogQueryPort) {}

  async execute(
    args: Record<string, unknown>,
    _context?: AssistantContext,
  ): Promise<unknown> {
    const busqueda =
      typeof args.busqueda === 'string' ? args.busqueda : undefined;
    const services = await this.catalog.search(busqueda, MAX_RESULTS);
    return services.map((s) => ({
      id: s.id,
      nombre: s.name,
      precio: s.price,
      minutos: s.durationMinutes,
    }));
  }
}
