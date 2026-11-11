import { SendMessageUseCase } from 'src/assistant/application/send-message.use-case';
import { AssistantTool } from 'src/assistant/application/tools/assistant-tool';
import { ListServicesTool } from 'src/assistant/application/tools/list-services.tool';
import { RecommendServicesTool } from 'src/assistant/application/tools/recommend-services.tool';
import { buildWhatsAppTools } from 'src/assistant/build-whatsapp-tools';
import {
  analizarBusqueda,
  etiquetasDeGenero,
  sinDiacriticos,
} from 'src/assistant/domain/catalog-search';
import { Conversation } from 'src/assistant/domain/conversation';
import { LlmCompletion, LlmMessage } from 'src/assistant/domain/ports/llm.port';
import { ServiceSearchCriteria } from 'src/assistant/domain/ports/service-catalog-query.port';
import { TokenUsage } from 'src/assistant/domain/token-usage';
import { AssistantChatAdapter } from '../infrastructure/assistant/assistant-chat.adapter';
import { WhatsAppMessage } from 'src/notifications/domain/ports/whatsapp-sender.port';
import { HandleInboundMessageUseCase } from './handle-inbound-message.use-case';

/**
 * Las piezas reales juntas: envoltorios de `buildWhatsAppTools` → bucle de
 * `SendMessageUseCase` → `mensajesDeLaRespuesta` → lo que se envía. Solo son
 * falsos el modelo, que sigue un guion, y el catálogo, en memoria y con las mismas
 * reglas de búsqueda que el adaptador. Las reglas sueltas pasaban todas sus
 * pruebas mientras «corte» acababa en un solo servicio arbitrario: ese fallo vivía
 * en este hueco.
 */

const CLIENTA = '573000001001';
const DUENA = '573000001999';
const AHORA = new Date('2026-11-04T15:00:00Z');
const SEIS = 'Son los 6 de menor precio; si buscas otro, dime cuál.';
const CATEGORIA =
  'Es el de menor precio de cada categoría; si buscas otro, dime cuál.';

const RAICES = ['Cabello', 'Cejas y pestañas', 'Maquillajes', 'Tintes', 'Uñas'];
const GENEROS = ['Hombre', 'Mujer', 'Unisex', 'Niños'];

interface Fila {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
  tags: string[];
}

let secuencia = 0;
const fila = (name: string, price: number, ...tags: string[]): Fila => ({
  id: `00000000-0000-4000-8000-${String(++secuencia).padStart(12, '0')}`,
  name,
  price,
  durationMinutes: 30,
  tags,
});

const CORTES = ['Cabello', 'Cortes'];
const MECHAS = ['Cabello', 'Mechas'];
const FILAS: Fila[] = [
  // «corte»: uno solo lo lleva en el nombre; los demás, por etiqueta.
  fila('Corte midi con cortina', 90000, ...CORTES, 'Cortes medios'),
  fila('Taper fade', 30000, ...CORTES, 'Fade'),
  fila('Low fade', 31000, ...CORTES, 'Fade'),
  fila('High fade', 32000, ...CORTES, 'Fade'),
  fila('Bob clásico', 33000, ...CORTES, 'Bob'),
  fila('Bob francés', 34000, ...CORTES, 'Bob'),
  fila('Pixie', 35000, ...CORTES, 'Cortes cortos'),
  fila('Mullet', 36000, ...CORTES, 'Cortes cortos'),
  fila('Shag', 37000, ...CORTES, 'Cortes medios'),
  // «capas»: la ventana da varias, y solo una es la que se pulsó.
  fila('Capas en U', 50000, 'Cabello', 'Capas'),
  fila('Capas en V', 51000, 'Cabello', 'Capas'),
  fila('Capas largas', 52000, 'Cabello', 'Capas'),
  // «mechas»: más de 6.
  fila('Mechas californianas', 90000, ...MECHAS, 'Californianas'),
  fila('Mechas babylights', 91000, ...MECHAS, 'Babylights'),
  fila('Mechas balayage', 92000, ...MECHAS, 'Balayage'),
  fila('Mechas con gorro', 93000, ...MECHAS, 'Gorro'),
  fila('Mechas de color', 94000, ...MECHAS, 'Fantasía'),
  fila('Mechas platino', 95000, ...MECHAS, 'Platino'),
  fila('Mechas chocolate', 96000, ...MECHAS, 'Chocolate'),
  fila('Mechas miel', 97000, ...MECHAS, 'Miel'),
  // «maquillaje»: más de 6, y lo más barato de su raíz.
  ...[
    'noche',
    'día',
    'fiesta',
    'novia',
    'grado',
    'gala',
    'social',
    'quince',
  ].map((m, i) =>
    fila(`Maquillaje de ${m}`, 60000 + i, 'Maquillajes', `Maquillaje ${m}`),
  ),
  fila('Perfilado de cejas', 15000, 'Cejas y pestañas', 'Cejas'),
  fila('Lifting de pestañas', 40000, 'Cejas y pestañas', 'Pestañas'),
  fila('Tinte completo', 70000, 'Tintes', 'Tinte global'),
  fila('Tinte de raíz', 45000, 'Tintes', 'Raíz'),
  fila('Manicure rusa', 28000, 'Uñas', 'Manicure'),
  fila('Manicure clásica', 20000, 'Uñas', 'Manicure'),
  fila('Pedicure spa', 38000, 'Uñas', 'Pedicure'),
];

const plegar = (t: string) => sinDiacriticos(t).toLowerCase();

/** Las mismas reglas que `ServiceCatalogQueryAdapter`, sobre `FILAS`. */
function coincidencias(c: ServiceSearchCriteria): Fila[] {
  const a = analizarBusqueda(c.texto);
  const explicito = etiquetasDeGenero(c.genero);
  const generos = explicito.length ? explicito : etiquetasDeGenero(a.genero);
  const porPrecio = a.porPrecio || c.ordenarPorPrecio === true;
  const enNombre = (s: Fila, ps: string[]) =>
    ps.every((p) => plegar(s.name).includes(p));
  const consulta = (ps: string[]) =>
    FILAS.filter(
      (s) =>
        ps.every(
          (p) =>
            plegar(s.name).includes(p) ||
            s.tags.some((t) => plegar(t).includes(p)),
        ) &&
        (!generos.length || s.tags.some((t) => generos.includes(t))) &&
        (typeof c.precioMaximo !== 'number' || s.price <= c.precioMaximo),
    ).sort((x, y) =>
      porPrecio
        ? x.price - y.price || x.name.localeCompare(y.name)
        : Number(enNombre(y, ps)) - Number(enNombre(x, ps)) ||
          x.name.localeCompare(y.name),
    );
  const todas = consulta([...a.palabras, ...a.ambiguas]);
  return todas.length === 0 && a.ambiguas.length > 0 && a.palabras.length > 0
    ? consulta(a.palabras)
    : todas;
}

const catalogo = {
  search: async (c: ServiceSearchCriteria, limite: number) =>
    coincidencias(c)
      .slice(0, limite)
      .map(({ id, name, price, durationMinutes }) => ({
        id,
        name,
        price,
        durationMinutes,
      })),
  findNarrowingOptions: async (c: ServiceSearchCriteria, limite: number) => {
    const todas = coincidencias(c);
    const n = new Map<string, number>();
    for (const s of todas) {
      for (const t of s.tags) {
        if (RAICES.includes(t) || GENEROS.includes(t)) continue;
        n.set(t, (n.get(t) ?? 0) + 1);
      }
    }
    return [...n]
      .filter(([, k]) => k < todas.length)
      .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
      .slice(0, limite)
      .map(([t]) => t);
  },
  findPrincipalImages: async (ids: string[]) =>
    new Map(
      ids.map((i) => [
        i,
        `https://res.cloudinary.com/demo/image/upload/v1/${i}.webp`,
      ]),
    ),
  findNamesByIds: async (ids: string[]) =>
    new Map(FILAS.filter((s) => ids.includes(s.id)).map((s) => [s.id, s.name])),
  findByTagNames: async (tags: string[], limite: number) =>
    new Map(
      tags.map((t) => [
        t,
        FILAS.filter((s) => s.tags.includes(t))
          .sort((a, b) => a.price - b.price)
          .slice(0, limite),
      ]),
    ),
  findTagFamilies: async (tags: string[]) =>
    new Map(
      tags.flatMap((t): [string, string][] => {
        const s = FILAS.find((f) => f.tags.includes(t));
        return s ? [[t, s.tags[0]]] : [];
      }),
    ),
};

const herramientaVacia = (name: string, description = 'x'): AssistantTool => ({
  name,
  definition: {
    name,
    description,
    parameters: { type: 'object', properties: {} },
  },
  execute: async () => ({ ok: true }),
});

type Paso =
  | { tool: string; args?: Record<string, unknown> }
  | { texto: string };

function montar() {
  const base: AssistantTool[] = [
    new ListServicesTool(catalogo as never),
    new RecommendServicesTool(catalogo as never),
    herramientaVacia('consultarDisponibilidad'),
    herramientaVacia('componerPaquete'),
    herramientaVacia('crearReserva'),
    herramientaVacia('reservarPaquete'),
    herramientaVacia('cancelarReserva'),
    herramientaVacia(
      'reprogramarReserva',
      'Cambia la fecha y hora de una reserva de la clienta con sesión iniciada. Si la cita que nombra no está en misReservas, consúltala con misReservas pasando ese día.',
    ),
  ];
  const juegos = buildWhatsAppTools(
    base,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    catalogo as never,
    {} as never,
    { comprobar: async () => undefined } as never,
    { comprobar: async () => undefined } as never,
    {} as never,
  );

  let guion: Paso[] = [];
  const vistoPorElModelo: string[] = [];
  const llm = {
    complete: async (req: {
      messages: LlmMessage[];
    }): Promise<LlmCompletion> => {
      vistoPorElModelo.push(JSON.stringify(req.messages));
      const paso = guion.shift();
      if (!paso) throw new Error('El guion del modelo se acabó');
      const usage = TokenUsage.zero();
      return 'tool' in paso
        ? {
            message: {
              role: 'assistant',
              content: '',
              toolCalls: [
                {
                  id: `c${guion.length}`,
                  name: paso.tool,
                  arguments: paso.args ?? {},
                },
              ],
            },
            usage,
          }
        : { message: { role: 'assistant', content: paso.texto }, usage };
    },
  };

  const conversaciones = new Map<string, Conversation>();
  const repo = {
    findById: async () => null,
    save: async (c: Conversation) => {
      conversaciones.set(c.phoneE164!, c);
      return c;
    },
    sumTokensSince: async () => 0,
    countMessagesOfUserSince: async () => 0,
    findActiveByPhone: async (p: string) => conversaciones.get(p) ?? null,
    countMessagesOfPhoneSince: async () => 0,
  };
  const casoDeUso = new SendMessageUseCase(
    llm as never,
    repo as never,
    base,
    { now: () => AHORA },
    {
      maxMessagesPerConversation: 50,
      maxMessagesPerUserPerDay: 999,
      maxTokensPerDay: 0,
    },
    {
      execute: async () => ({ summary: 'r', usage: TokenUsage.zero() }),
    } as never,
    {} as never,
    undefined,
    undefined,
    undefined,
    repo as never,
    juegos,
    DUENA,
  );

  let enviados: WhatsAppMessage[] = [];
  const manejador = new HandleInboundMessageUseCase(
    { findActionableByPhone: async () => [] } as never,
    {
      send: async (m: WhatsAppMessage) => {
        enviados.push(m);
      },
    } as never,
    { ownerPhone: DUENA, timeZone: 'America/Bogota' },
    { now: () => AHORA } as never,
    undefined,
    new AssistantChatAdapter(casoDeUso, catalogo as never),
  );

  let n = 0;
  const turno = async (
    from: string,
    entrada: { texto: string } | { boton: string },
    pasos: Paso[],
  ): Promise<WhatsAppMessage[]> => {
    guion = [...pasos];
    enviados = [];
    await manejador.handle(
      'boton' in entrada
        ? {
            messageId: `m${++n}`,
            from,
            kind: 'button',
            text: null,
            payload: entrada.boton,
          }
        : {
            messageId: `m${++n}`,
            from,
            kind: 'text',
            text: entrada.texto,
            payload: null,
          },
    );
    return enviados;
  };
  const historial = (from: string) =>
    conversaciones.get(from)!.window(1)[0].content;

  return { turno, historial, vistoPorElModelo, conversaciones };
}

const texto = (ms: WhatsAppMessage[]) =>
  ms.map((m) => (m.kind === 'text' ? m.body : '')).join('\n');
const carrusel = (ms: WhatsAppMessage[]) =>
  ms.find(
    (m): m is Extract<WhatsAppMessage, { kind: 'carousel' }> =>
      m.kind === 'carousel',
  );
const lineasDeServicio = (ms: WhatsAppMessage[]) =>
  texto(ms)
    .split('\n')
    .filter((l) => /^\d+\. /.test(l));
const baratos = (...nombres: string[]) =>
  nombres.map((nombre, i) => expect.stringContaining(`${i + 1}. ${nombre}:`));

describe('Catálogo por WhatsApp, cableado de punta a punta', () => {
  it('«¿Cuánto vale un corte?» pregunta y no entrega ningún servicio; «me da igual» da los 6 más baratos con la línea fija', async () => {
    const { turno, historial } = montar();

    const t1 = await turno(CLIENTA, { texto: '¿Cuánto vale un corte?' }, [
      { tool: 'listarServicios', args: { busqueda: 'corte' } },
      // El modelo reescribe la pregunta y no nombra el concepto: da igual.
      { texto: '¿Cuál prefieres: fade, bob o algo corto?' },
    ]);
    expect(lineasDeServicio(t1)).toEqual([]);
    expect(carrusel(t1)).toBeUndefined();
    expect(t1.some((m) => m.kind === 'image')).toBe(false);
    expect(texto(t1)).not.toContain('Corte midi con cortina');
    expect(historial(CLIENTA)).toContain('[Se le preguntó para acotar: corte]');

    const t2 = await turno(CLIENTA, { texto: 'me da igual' }, [
      { tool: 'listarServicios', args: { busqueda: 'corte' } },
      { texto: 'Te mando estos.' },
    ]);
    expect(lineasDeServicio(t2)).toEqual(
      baratos(
        'Taper fade',
        'Low fade',
        'High fade',
        'Bob clásico',
        'Bob francés',
        'Pixie',
      ),
    );
    expect(texto(t2)).toContain(SEIS);
    expect(carrusel(t2)?.cards).toHaveLength(6);
    expect(historial(CLIENTA)).toContain('[Se le enviaron aparte');
  });

  it('«mándame el catálogo» → «me da igual» → «todo» termina en servicios', async () => {
    const { turno, historial } = montar();

    const t1 = await turno(CLIENTA, { texto: 'mándame el catálogo' }, [
      { tool: 'listarServicios', args: { busqueda: 'catálogo' } },
      { texto: '¿Qué servicio estás buscando?' },
    ]);
    expect(lineasDeServicio(t1)).toEqual([]);
    expect(historial(CLIENTA)).toContain('[Se le preguntó qué busca]');

    const porCategoria = baratos(
      'Taper fade',
      'Perfilado de cejas',
      'Maquillaje de noche',
      'Tinte de raíz',
      'Manicure clásica',
    );
    const t2 = await turno(CLIENTA, { texto: 'me da igual' }, [
      { tool: 'listarServicios', args: { busqueda: 'todo' } },
      { texto: 'Te mando una muestra.' },
    ]);
    expect(lineasDeServicio(t2)).toEqual(porCategoria);
    expect(texto(t2)).toContain(CATEGORIA);

    const t3 = await turno(CLIENTA, { texto: 'todo' }, [
      { tool: 'listarServicios', args: {} },
      { texto: 'Es lo que te envío.' },
    ]);
    expect(lineasDeServicio(t3)).toEqual(porCategoria);
    expect(texto(t3)).toContain(CATEGORIA);
  });

  it('C «Mándame el catálogo» (el modelo pregunta, sin marca) → «Me da igual» da el listado por categoría en el segundo mensaje', async () => {
    const { turno, historial } = montar();
    const t1 = await turno(CLIENTA, { texto: 'Mándame el catálogo' }, [
      { texto: '¿Qué te interesa: cabello, uñas o maquillaje?' },
    ]);
    expect(lineasDeServicio(t1)).toEqual([]);
    expect(historial(CLIENTA)).not.toContain('Se le preguntó');
    const t2 = await turno(CLIENTA, { texto: 'Me da igual' }, [
      { tool: 'listarServicios', args: {} },
      { texto: 'Te mando una muestra.' },
    ]);
    expect(lineasDeServicio(t2).length).toBeGreaterThan(0);
    expect(texto(t2)).toContain(CATEGORIA);
  });

  it('C una cortesía con «?» seguida de «mándame el catálogo» pregunta', async () => {
    const { turno } = montar();
    await turno(CLIENTA, { texto: 'hola' }, [{ texto: '¿En qué te ayudo?' }]);
    const t = await turno(CLIENTA, { texto: 'mándame el catálogo' }, [
      { tool: 'listarServicios', args: { busqueda: 'catálogo' } },
      { texto: '¿Qué servicio estás buscando?' },
    ]);
    expect(lineasDeServicio(t)).toEqual([]);
    expect(texto(t)).not.toContain(CATEGORIA);
  });

  it('«Me interesa» en «Capas en U» da un servicio, con una foto y sin carrusel', async () => {
    const { turno } = montar();
    const capas = FILAS.find((s) => s.name === 'Capas en U')!;
    const t = await turno(CLIENTA, { boton: `SERVICE|${capas.id}` }, [
      { tool: 'listarServicios', args: { busqueda: 'Capas en U' } },
      { texto: 'Perfecto, ¿para qué día?' },
    ]);
    expect(lineasDeServicio(t)).toEqual(baratos('Capas en U'));
    expect(carrusel(t)).toBeUndefined();
    expect(t.filter((m) => m.kind === 'image')).toHaveLength(1);
  });

  it('una cortesía con «?» no cuenta como haber preguntado (I2, falso positivo)', async () => {
    const { turno } = montar();
    const t1 = await turno(CLIENTA, { texto: 'mechas californianas' }, [
      {
        tool: 'listarServicios',
        args: { busqueda: 'mechas californianas' },
      },
      { texto: 'Aquí están. ¿Te gustaría reservar?' },
    ]);
    expect(lineasDeServicio(t1)).toEqual(baratos('Mechas californianas'));

    const t2 = await turno(CLIENTA, { texto: '¿qué otras mechas hay?' }, [
      { tool: 'listarServicios', args: { busqueda: 'mechas' } },
      { texto: '¿Cuál te llama la atención?' },
    ]);
    expect(lineasDeServicio(t2)).toEqual([]);
    expect(texto(t2)).not.toContain(SEIS);
  });

  it('la pregunta reescrita sin el concepto sigue contando (I2, falso negativo)', async () => {
    const { turno } = montar();
    await turno(CLIENTA, { texto: 'quiero maquillaje' }, [
      { tool: 'listarServicios', args: { busqueda: 'maquillaje' } },
      { texto: '¿Cuál prefieres: de noche, natural o de fiesta?' },
    ]);
    const t2 = await turno(CLIENTA, { texto: 'cualquiera' }, [
      { tool: 'listarServicios', args: { busqueda: 'maquillaje' } },
      { texto: 'Te mando estos.' },
    ]);
    expect(lineasDeServicio(t2)).toHaveLength(6);
    expect(texto(t2)).toContain(SEIS);
  });

  it('dos preguntas aparte no interrumpen la reserva de «manicure rusa» (I3)', async () => {
    const { turno, vistoPorElModelo } = montar();
    await turno(CLIENTA, { texto: 'cuánto vale la manicure rusa' }, [
      { tool: 'listarServicios', args: { busqueda: 'manicure rusa' } },
      { texto: 'Aquí está.' },
    ]);
    await turno(CLIENTA, { texto: '¿dónde quedan?' }, [
      { texto: 'En Sopó, Cundinamarca.' },
    ]);
    await turno(CLIENTA, { texto: '¿abren el domingo?' }, [
      { texto: 'Sí, de 9 a 7.' },
    ]);
    const t = await turno(
      CLIENTA,
      { texto: 'resérvamela el viernes a las 3, soy Ana' },
      [
        { tool: 'listarServicios', args: { busqueda: 'manicure rusa' } },
        { texto: 'Claro.' },
      ],
    );
    expect(vistoPorElModelo.at(-1)).toContain('manicure rusa');
    expect(lineasDeServicio(t)).toEqual(baratos('Manicure rusa'));
  });

  it('la dueña recibe el mismo trato: R7 y luego R6 con carrusel', async () => {
    const { turno } = montar();
    const t1 = await turno(DUENA, { texto: 'qué mechas hay' }, [
      { tool: 'listarServicios', args: { busqueda: 'mechas' } },
      { texto: '¿Qué opción?' },
    ]);
    expect(lineasDeServicio(t1)).toEqual([]);
    const t2 = await turno(DUENA, { texto: 'me da igual' }, [
      { tool: 'listarServicios', args: { busqueda: 'mechas' } },
      { texto: 'Estos.' },
    ]);
    expect(carrusel(t2)?.cards).toHaveLength(6);
    expect(texto(t2)).toContain(SEIS);
  });

  it.each([
    ['sin busqueda', {}],
    ['con la frase literal', { busqueda: 'me da igual' }],
  ])(
    'N1 tras R7 el modelo llama %s: los 6 de menor precio de ese concepto, no otra pregunta',
    async (_n, args) => {
      const { turno } = montar();
      const t1 = await turno(CLIENTA, { texto: '¿Cuánto vale un corte?' }, [
        { tool: 'listarServicios', args: { busqueda: 'corte' } },
        { texto: '¿Qué opción de corte te interesa?' },
      ]);
      expect(lineasDeServicio(t1)).toEqual([]);

      const t2 = await turno(CLIENTA, { texto: 'me da igual' }, [
        { tool: 'listarServicios', args },
        { texto: 'Te mando estos.' },
      ]);
      expect(lineasDeServicio(t2)).toEqual(
        baratos(
          'Taper fade',
          'Low fade',
          'High fade',
          'Bob clásico',
          'Bob francés',
          'Pixie',
        ),
      );
      expect(texto(t2)).toContain(SEIS);
      expect(texto(t2)).not.toContain(CATEGORIA);
      expect(carrusel(t2)?.cards).toHaveLength(6);
    },
  );

  it('N2 las frases literales en busqueda terminan en servicios y no se repiten', async () => {
    const { turno } = montar();
    const t1 = await turno(CLIENTA, { texto: 'mándame el catálogo' }, [
      { tool: 'listarServicios', args: { busqueda: 'mándame' } },
      { texto: '¿Qué servicio estás buscando?' },
    ]);
    expect(lineasDeServicio(t1)).toEqual([]);
    const t2 = await turno(CLIENTA, { texto: 'lo que sea' }, [
      { tool: 'listarServicios', args: { busqueda: 'lo que sea' } },
      { texto: 'Te mando una muestra.' },
    ]);
    expect(lineasDeServicio(t2).length).toBeGreaterThan(0);
    expect(texto(t2)).toContain(CATEGORIA);
    const t3 = await turno(CLIENTA, { texto: 'cualquiera' }, [
      { tool: 'listarServicios', args: { busqueda: 'cualquiera' } },
      { texto: 'Es lo que te envío.' },
    ]);
    expect(texto(t3)).toContain(CATEGORIA);
  });

  it('N5 una marca copiada por el modelo no llega a la clienta ni hace saltar R6', async () => {
    const { turno, historial } = montar();
    const copia = '[Se le preguntó para acotar: corte]';
    const t1 = await turno(CLIENTA, { texto: 'hola' }, [
      { texto: `Hola, ¿qué buscas?\n\n${copia}` },
    ]);
    expect(texto(t1)).not.toContain('Se le preguntó');
    expect(historial(CLIENTA)).toBe('Hola, ¿qué buscas?');

    const t2 = await turno(CLIENTA, { texto: 'un corte' }, [
      { tool: 'listarServicios', args: { busqueda: 'corte' } },
      { texto: '¿Cuál prefieres?' },
    ]);
    expect(lineasDeServicio(t2)).toEqual([]);
    expect(texto(t2)).not.toContain(SEIS);
    expect(historial(CLIENTA)).toContain(copia);
  });

  it('«Me interesa» con el punto final del mensaje en la búsqueda sigue siendo un servicio', async () => {
    const { turno } = montar();
    const capas = FILAS.find((s) => s.name === 'Capas en U')!;
    const t = await turno(CLIENTA, { boton: `SERVICE|${capas.id}` }, [
      { tool: 'listarServicios', args: { busqueda: 'Capas en U.' } },
      { texto: 'Perfecto, ¿para qué día?' },
    ]);
    expect(lineasDeServicio(t)).toEqual(baratos('Capas en U'));
    expect(carrusel(t)).toBeUndefined();
  });

  it('A la marca en singular, copiada por el modelo, no llega a la clienta', async () => {
    const { turno, historial } = montar();
    const t = await turno(CLIENTA, { texto: 'hola' }, [
      {
        texto:
          'Claro.\n\n[Se le envió aparte, con foto si la hay: 1. Mohawk con trenzas: $ 40.000 (45 min)]',
      },
    ]);
    expect(texto(t)).toContain('Claro.');
    expect(texto(t)).not.toContain('Mohawk');
    expect(historial(CLIENTA)).toBe('Claro.');
  });

  it.each([
    ['busca el concepto', { busqueda: 'corte' }],
    ['llama sin concepto', {}],
  ])(
    'B tras R7 responde con el nombre y el modelo %s: solo ese servicio',
    async (_n, args) => {
      const { turno } = montar();
      await turno(CLIENTA, { texto: '¿Cuánto vale un corte?' }, [
        { tool: 'listarServicios', args: { busqueda: 'corte' } },
        { texto: '¿Qué opción de corte te interesa?' },
      ]);
      const t = await turno(CLIENTA, { texto: 'Corte midi con cortina' }, [
        { tool: 'listarServicios', args },
        { texto: 'Perfecto, ¿para qué día?' },
      ]);
      expect(lineasDeServicio(t)).toEqual(baratos('Corte midi con cortina'));
      expect(texto(t)).not.toContain(SEIS);
      expect(carrusel(t)).toBeUndefined();
    },
  );

  it('B «Quiero reservar Corte midi con cortina…» en un mensaje no pregunta por corte', async () => {
    const { turno } = montar();
    const t = await turno(
      CLIENTA,
      { texto: 'Quiero reservar Corte midi con cortina el viernes a las 3' },
      [
        { tool: 'listarServicios', args: { busqueda: 'corte' } },
        { texto: 'Claro, ¿a nombre de quién?' },
      ],
    );
    expect(lineasDeServicio(t)).toEqual(baratos('Corte midi con cortina'));
  });

  it('ninguna URL de imagen llega al modelo ni al historial; las fotos sí salen', async () => {
    const { turno, vistoPorElModelo, conversaciones } = montar();
    await turno(CLIENTA, { texto: 'un corte' }, [
      { tool: 'listarServicios', args: { busqueda: 'corte' } },
      { texto: '¿Cuál?' },
    ]);
    const t2 = await turno(CLIENTA, { texto: 'me da igual' }, [
      { tool: 'listarServicios', args: { busqueda: 'corte' } },
      { texto: 'Estos.' },
    ]);
    await turno(CLIENTA, { texto: 'gracias' }, [{ texto: 'A ti.' }]);
    expect(JSON.stringify(t2)).toContain('res.cloudinary.com');
    expect(vistoPorElModelo.join()).not.toContain('cloudinary');
    const guardado = conversaciones
      .get(CLIENTA)!
      .window(50)
      .map((m) => m.content)
      .join();
    expect(guardado).not.toContain('cloudinary');
    expect(guardado).not.toMatch(/00000000-0000/);
  });
});
