import { rawJsonSchema } from './mcp-tool-registry';

describe('rawJsonSchema', () => {
  const esquema: Record<string, unknown> = {
    type: 'object',
    properties: { busqueda: { type: 'string' } },
    required: [],
    additionalProperties: false,
  };

  it('publica el esquema del contrato interno POR REFERENCIA, sin copiarlo ni traducirlo', () => {
    // M8: `tools/list` no reescribe el esquema para MCP, lo reutiliza. Si alguien
    // duplicara la definicion, esta asercion caeria.
    const adaptado = rawJsonSchema(esquema);

    expect(
      adaptado['~standard'].jsonSchema.input({ target: 'draft-2020-12' }),
    ).toBe(esquema);
  });

  it('deja pasar los argumentos sin validarlos', () => {
    // Decision de T0: validar aqui haria que la misma herramienta se comportase
    // distinto segun la superficie. Con `additionalProperties: false`, un
    // validador rechazaria el `userId` colado que T5 debe poder IGNORAR.
    const adaptado = rawJsonSchema(esquema);

    const resultado = adaptado['~standard'].validate({ userId: 'ajeno' });

    expect(resultado).toEqual({ value: { userId: 'ajeno' } });
  });
});
