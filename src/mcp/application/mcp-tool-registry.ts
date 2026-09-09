import {
  McpServer,
  StandardSchemaWithJSON,
} from '@modelcontextprotocol/server';

import {
  AssistantContext,
  AssistantTool,
} from 'src/assistant/application/tools/assistant-tool';

/**
 * Envuelve un **JSON Schema crudo** —el que ya lleva `AssistantTool.definition.
 * parameters` porque es lo que consume el modelo— en el contrato Standard Schema
 * que exige `registerTool`.
 *
 * Las dos propiedades que importan, y por que:
 *
 * 1. `jsonSchema.input` devuelve el objeto **por referencia**. `tools/list` publica
 *    entonces el esquema del contrato interno, no una copia ni una traduccion: es
 *    la decision M8 del plan, y la que sostiene el argumento de la fase (un mismo
 *    objeto sirviendo al bucle interno y a un cliente MCP ajeno).
 * 2. `validate` **deja pasar**. El SDK admite validar con AJV y se descarta a
 *    proposito: los esquemas llevan `additionalProperties: false`, asi que un
 *    validador rechazaria una llamada con un identificador ajeno colado en los
 *    argumentos, y la regla de seguridad de esta fase consiste justamente en que
 *    ese argumento se **ignore** mientras la identidad sale del JWT. Validar aqui
 *    haria que la misma herramienta se comportase distinto segun la superficie.
 *    Las herramientas ya validan sus propios argumentos.
 */
export function rawJsonSchema(
  schema: Record<string, unknown>,
): StandardSchemaWithJSON<Record<string, unknown>> {
  return {
    '~standard': {
      version: 1,
      vendor: 'peluqueria-marlene',
      validate: (value: unknown) => ({
        value: value as Record<string, unknown>,
      }),
      jsonSchema: { input: () => schema, output: () => schema },
    },
  };
}

/**
 * Revision de la especificacion que este servidor implementa. Se declara de forma
 * explicita porque la especificacion ha cambiado de manera apreciable entre
 * revisiones y la tesis debe poder citar cual se cumplio.
 */
export const MCP_PROTOCOL_VERSION = '2026-07-28';

/**
 * Construye el servidor MCP publicando las herramientas del asistente **tal cual**.
 * No hay catalogo propio de MCP: la lista que recorre es `ASSISTANT_TOOLS`, el
 * mismo arreglo que el bucle interno inyecta al modelo. Un contrato, dos
 * consumidores (M8).
 */
export function buildMcpServer(
  tools: AssistantTool[],
  context: AssistantContext,
): McpServer {
  const server = new McpServer({
    name: 'peluqueria-marlene',
    version: MCP_PROTOCOL_VERSION,
  });

  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        description: tool.definition.description,
        inputSchema: rawJsonSchema(tool.definition.parameters),
      },
      async (args: Record<string, unknown>) => {
        // Fachada delgada: la herramienta ya devuelve datos compactados y el
        // contexto de identidad viene dado. Aqui solo se proyecta al formato de
        // contenido que espera el protocolo. Si `execute` lanza, el SDK lo
        // convierte en un resultado con `isError`, que es lo que el cliente debe
        // ver: un fallo de dominio nunca es un 500 opaco.
        const resultado = await tool.execute(args ?? {}, context);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(resultado) }],
        };
      },
    );
  }

  return server;
}
