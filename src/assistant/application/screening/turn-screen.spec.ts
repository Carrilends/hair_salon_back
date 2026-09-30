import {
  RECIENTES_EN_EL_ESTADO,
  UMBRAL_CORRESPONDENCIA,
  UMBRAL_PERTINENCIA,
  UMBRAL_PROGRESO,
  INTENCIONES,
  construirBalance,
  construirCorrespondencia,
  construirRelevancia,
  construirPertinencia,
  construirProgreso,
  leerBalance,
  leerCorrespondencia,
  leerRelevancia,
  ordenarPorRelevancia,
  leerPertinencia,
  leerProgreso,
} from './turn-screen';

describe('construirPertinencia', () => {
  it('arma UN noul con criterios explícitos sobre el mensaje nuevo', async () => {
    const req = construirPertinencia({ mensaje: '¿cuánto vale un corte?' });

    expect(req).not.toBeNull();
    expect(req!.asked).toEqual(['pertinencia']);
    const pregunta = req!.questions.pertinencia;
    expect(pregunta.type).toBe('noul');
    // Criterios explícitos: sin ellos, el modelo decide dónde está la frontera.
    expect(typeof pregunta.criteria.true).toBe('string');
    expect(typeof pregunta.criteria.false).toBe('string');
    expect(req!.state.message).toBe('¿cuánto vale un corte?');
  });

  it('las instrucciones nombran los campos del estado con comillas invertidas', () => {
    // Convención de la casa: `state` es un objeto con campos nombrados y las
    // instrucciones los referencian con comillas invertidas.
    const req = construirPertinencia({
      mensaje: '¿y el viernes?',
      recientes: [{ rol: 'clienta', texto: 'quiero un corte' }],
    });

    expect(req!.questions.pertinencia.instructions).toContain('`message`');
    expect(req!.questions.pertinencia.instructions).toContain('`recent`');
  });

  it('el estado lleva los últimos mensajes, los más viejos primero', () => {
    const recientes = Array.from({ length: 7 }, (_, i) => ({
      rol: 'clienta' as const,
      texto: `m${i}`,
    }));

    const req = construirPertinencia({ mensaje: '¿y el viernes?', recientes });

    // Sin contexto, un seguimiento corto («¿y el viernes?») no «trata del
    // salón» y el juicio rechazaría a una clienta a un mensaje de reservar.
    const recent = req!.state.recent as { text: string }[];
    expect(recent).toHaveLength(RECIENTES_EN_EL_ESTADO);
    expect(recent.map((m) => m.text)).toEqual(['m3', 'm4', 'm5', 'm6']);
  });

  it('el estado solo lleva rol y texto: ni identificadores, ni nombres, ni fechas', () => {
    // Minimización: el texto de la conversación puede contener datos
    // personales, así que lo que sale hacia el proveedor es lo mínimo para
    // decidir. Nada de `userId`, ni nombre, ni id de reserva.
    const req = construirPertinencia({
      mensaje: 'hola',
      recientes: [{ rol: 'asistente', texto: 'buenas' }],
    });

    expect(Object.keys(req!.state).sort()).toEqual(['message', 'recent']);
    const recent = req!.state.recent as Record<string, unknown>[];
    expect(Object.keys(recent[0]).sort()).toEqual(['role', 'text']);
  });

  it('un mensaje vacío no se pregunta: el código ya sabe que no hay nada que juzgar', () => {
    // «Nunca se llama si el código puede decidir solo»: acertar no cuesta ni
    // una llamada.
    expect(construirPertinencia({ mensaje: '   ' })).toBeNull();
  });
});

describe('leerPertinencia', () => {
  const req = construirPertinencia({ mensaje: '¿cuánto vale un corte?' })!;

  it('devuelve la probabilidad del noul', () => {
    const veredicto = leerPertinencia(
      { pertinencia: { type: 'noul', noul: 0.97 } },
      req.asked,
    );

    expect(veredicto.prob).toBe(0.97);
    expect(veredicto.pertinente).toBe(true);
  });

  it('por debajo del umbral, no es pertinente', () => {
    const veredicto = leerPertinencia(
      { pertinencia: { type: 'noul', noul: UMBRAL_PERTINENCIA / 2 } },
      req.asked,
    );

    expect(veredicto.pertinente).toBe(false);
  });

  it('sin veredicto se atiende igual: fail-open, nunca fail-closed', () => {
    // Si el proveedor no contesta, el turno sigue por el camino de hoy. Es una
    // optimización, no un control de seguridad: bloquear convertiría la caída
    // de un tercero en la caída del asistente (mismo criterio que NF11).
    expect(leerPertinencia({}, req.asked)).toEqual({
      pertinente: true,
      prob: null,
    });
    expect(
      leerPertinencia({ pertinencia: { type: 'choice' } }, req.asked),
    ).toEqual({ pertinente: true, prob: null });
  });

  it('el umbral es bajo y asimétrico: rechazar a una clienta real es el fallo caro', () => {
    // Atender una pregunta ajena cuesta tokens, o sea nada; rechazar a una
    // clienta real cuesta una clienta. El umbral se elige para que el error
    // que se comete sea el barato.
    expect(UMBRAL_PERTINENCIA).toBeLessThan(0.5);
  });
});

describe('construirCorrespondencia', () => {
  const reserva = {
    servicios: ['Corte de dama'],
    fecha: 'viernes 3 de octubre de 2026',
    hora: '15:00',
  };

  it('arma UN noul sobre la reserva que se va a crear y lo que se pidió', () => {
    const req = construirCorrespondencia({
      ...reserva,
      recientes: [
        { rol: 'clienta', texto: 'quiero un corte el viernes a las 3' },
      ],
    });

    expect(req!.asked).toEqual(['correspondencia']);
    expect(req!.questions.correspondencia.type).toBe('noul');
    expect(req!.state.services).toEqual(['Corte de dama']);
    expect(req!.state.date).toBe('viernes 3 de octubre de 2026');
    expect(req!.state.time).toBe('15:00');
  });

  it('las instrucciones nombran los campos del estado y prohíben juzgar el horario', () => {
    // Jev lee literalmente y trata las fechas como texto, no como cantidades
    // ordenadas: preguntarle si la hora es válida, si cae en horario o si hay
    // solape es pedirle justo lo que hace mal. Eso ya lo resuelven
    // `salon-schedule.ts` y `countOverlaps`.
    const instrucciones = construirCorrespondencia({
      ...reserva,
      recientes: [{ rol: 'clienta', texto: 'quiero un corte' }],
    })!.questions.correspondencia.instructions;

    expect(instrucciones).toContain('`recent`');
    expect(instrucciones).toContain('`services`');
    expect(instrucciones).toContain('`date`');
    expect(instrucciones).toContain('`time`');
    expect(instrucciones.toLowerCase()).toContain('do not judge');
  });

  it('el estado no lleva identificadores, ni nombres de personas, ni teléfonos', () => {
    const req = construirCorrespondencia({
      ...reserva,
      recientes: [{ rol: 'asistente', texto: 'te agendo el corte' }],
    });

    // Sin `message`: el mensaje que disparó la reserva ya viaja dentro de
    // `recent`, y un estado con ruido distrae al modelo.
    expect(Object.keys(req!.state).sort()).toEqual([
      'date',
      'recent',
      'services',
      'time',
    ]);
  });

  it('sin servicios no se pregunta: no hay reserva que comparar', () => {
    expect(
      construirCorrespondencia({ ...reserva, servicios: [], recientes: [] }),
    ).toBeNull();
  });

  it('sin conversación previa tampoco se pregunta: no hay con qué comparar', () => {
    // El juicio es una comparación. Sin `recent` no hay término contra el que
    // comparar y preguntarlo sería pagar por una respuesta sin fundamento.
    expect(construirCorrespondencia({ ...reserva, recientes: [] })).toBeNull();
  });
});

describe('leerCorrespondencia', () => {
  const asked = ['correspondencia'];

  it('el umbral es ESTRICTO: aquí el fallo caro es dejar pasar una reserva desviada', () => {
    // Al revés que la pertinencia. Un veredicto negativo no cancela nada: pide
    // confirmación explícita, que es barato. Dejar pasar la reserva que no era
    // toca la única operación irreversible del asistente.
    expect(UMBRAL_CORRESPONDENCIA).toBeGreaterThanOrEqual(0.5);
    expect(UMBRAL_CORRESPONDENCIA).toBeGreaterThan(UMBRAL_PERTINENCIA);
  });

  it('por debajo del umbral, no corresponde', () => {
    expect(
      leerCorrespondencia(
        { correspondencia: { type: 'noul', noul: 0.4 } },
        asked,
      ).corresponde,
    ).toBe(false);
  });

  it('sin veredicto la reserva se crea como hoy: fail-open', () => {
    expect(leerCorrespondencia({}, asked)).toEqual({
      corresponde: true,
      prob: null,
    });
  });
});

const UUID = '9f1c2b3a-4d5e-4f60-8a71-b2c3d4e5f6a7';
const OTRO_UUID = '11111111-2222-4333-8444-555555555555';

describe('identificadores en la traza', () => {
  // La cabecera de este módulo promete que por aquí no pasa ningún id de
  // reserva, y el plan lo prohíbe con esas palabras. Los argumentos de las
  // herramientas SÍ viajan —T6 necesita ver si cambian— y entre ellos hay
  // UUID: `reservaId` y `serviciosIds`. Se sustituyen por un alias estable,
  // que conserva la única señal que el juicio necesita (si dos valores son el
  // mismo o no) sin mandar el identificador.
  const trazaConIds = [
    {
      herramienta: 'misReservas',
      argumentos: {},
      resultado: 'ok' as const,
    },
    {
      herramienta: 'cancelarReserva',
      argumentos: { reservaId: UUID },
      resultado: 'error' as const,
    },
    {
      herramienta: 'crearReserva',
      argumentos: {
        serviciosIds: [UUID, OTRO_UUID],
        fechaHoraIso: '2026-10-02T20:00:00.000Z',
      },
      resultado: 'pendiente' as const,
    },
  ];

  it.each([
    [
      'construirProgreso',
      () =>
        construirProgreso({ peticion: 'cancela mi cita', traza: trazaConIds }),
    ],
    [
      'construirBalance',
      () =>
        construirBalance({
          peticion: 'cancela mi cita',
          respuesta: 'Listo, cancelada.',
          traza: trazaConIds,
        }),
    ],
  ])('%s no manda ningún identificador', (_nombre, construir) => {
    const serializado = JSON.stringify(construir()!.state);

    expect(serializado).not.toContain(UUID);
    expect(serializado).not.toContain(OTRO_UUID);
    expect(serializado).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i);
  });

  it('el mismo identificador recibe el mismo alias, y otro distinto otro alias', () => {
    // Es lo que permite juzgar «reintenta lo mismo» frente a «pide algo nuevo».
    const estado = construirProgreso({
      peticion: 'cancela mi cita',
      traza: trazaConIds,
    })!.state as { calls: { arguments: Record<string, unknown> }[] };

    expect(estado.calls[1].arguments.reservaId).toBe('id_1');
    expect(estado.calls[2].arguments.serviciosIds).toEqual(['id_1', 'id_2']);
  });

  it('lo que no es un identificador viaja tal cual', () => {
    // La fecha se queda: no identifica a nadie, y sin ella el caso «el mismo
    // día preguntado con otro formato» deja de ser detectable.
    const estado = construirProgreso({
      peticion: 'cancela mi cita',
      traza: trazaConIds,
    })!.state as { calls: { arguments: Record<string, unknown> }[] };

    expect(estado.calls[2].arguments.fechaHoraIso).toBe(
      '2026-10-02T20:00:00.000Z',
    );
  });
});

describe('construirProgreso', () => {
  const traza = [
    {
      herramienta: 'listarServicios',
      argumentos: { busqueda: 'corte' },
      resultado: 'ok' as const,
    },
    {
      herramienta: 'listarServicios',
      argumentos: { busqueda: 'cortes' },
      resultado: 'ok' as const,
    },
    {
      herramienta: 'listarServicios',
      argumentos: { busqueda: 'corte dama' },
      resultado: 'pendiente' as const,
    },
  ];

  it('arma UN noul sobre la traza del turno y la petición de la clienta', () => {
    const req = construirProgreso({
      peticion: '¿cuánto vale un corte?',
      traza,
    });

    expect(req!.asked).toEqual(['progreso']);
    expect(req!.questions.progreso.type).toBe('noul');
    expect(req!.state.request).toBe('¿cuánto vale un corte?');
    expect(req!.state.calls).toHaveLength(3);
  });

  it('pregunta por la RELACIÓN, nunca por el número de llamadas', () => {
    // Jev cuenta mal, y peor cuanto más largo el estado. El tope por conteo ya
    // existe y se llama `MAX_TOOL_ITERATIONS`.
    const texto = JSON.stringify(
      construirProgreso({ peticion: 'x', traza })!.questions,
    );

    expect(texto.toLowerCase()).toContain('do not count');
    expect(texto).not.toMatch(/how many/i);
  });

  it('sin traza o sin petición no se pregunta', () => {
    expect(construirProgreso({ peticion: 'x', traza: [] })).toBeNull();
    expect(construirProgreso({ peticion: '  ', traza })).toBeNull();
  });
});

describe('leerProgreso', () => {
  const asked = ['progreso'];

  it('el umbral deja margen: cortar un turno que iba a converger es el fallo caro', () => {
    // En la duda, que siga. Para eso está `MAX_TOOL_ITERATIONS` como red final.
    // Medido en dos tandas: la cadena legítima más floja sale a 0,67, así que
    // el listón se queda en 0,5 y no se acerca a ella.
    expect(UMBRAL_PROGRESO).toBeLessThanOrEqual(0.5);
  });

  it('con progreso, el bucle sigue', () => {
    expect(
      leerProgreso({ progreso: { type: 'noul', noul: 0.9 } }, asked).avanza,
    ).toBe(true);
  });

  it('sin progreso, el bucle se corta', () => {
    expect(
      leerProgreso({ progreso: { type: 'noul', noul: 0.02 } }, asked).avanza,
    ).toBe(false);
  });

  it('sin veredicto el bucle SIGUE: fail-open aquí significa seguir', () => {
    expect(leerProgreso({}, asked)).toEqual({ avanza: true, prob: null });
  });
});

describe('construirBalance (juicio diferido)', () => {
  const balance = {
    peticion: '¿cuánto vale un corte?',
    respuesta: 'El corte de dama cuesta $35.000 y dura 45 minutos.',
    traza: [
      {
        herramienta: 'listarServicios',
        argumentos: { busqueda: 'corte' },
        resultado: 'ok' as const,
      },
    ],
  };

  it('bate las DOS preguntas en una sola petición', () => {
    // Convención de la casa: las preguntas independientes sobre el mismo estado
    // van juntas, corren en paralelo y salen mucho más baratas que sueltas.
    const req = construirBalance(balance);

    expect(req!.asked.sort()).toEqual(['intencion', 'resuelta']);
  });

  it('la intención es un Choice con una opción por caso y una de escape', () => {
    // El Choice se reserva para telemetría, donde no decide nada: con un Choice
    // que decidiera, una distribución plana podría dar la victoria por descarte.
    const pregunta = construirBalance(balance)!.questions
      .intencion as unknown as {
      type: string;
      criteria: Record<string, string>;
    };

    expect(pregunta.type).toBe('choice');
    expect(Object.keys(pregunta.criteria).sort()).toEqual(
      [...INTENCIONES].sort(),
    );
    expect(Object.keys(pregunta.criteria)).toContain('otro');
  });

  it('el estado no lleva la conversación entera: solo el turno', () => {
    // Minimización: lo que se registra no es la conversación, son los
    // veredictos, y lo que viaja para calcularlos es un turno.
    expect(Object.keys(construirBalance(balance)!.state).sort()).toEqual([
      'calls',
      'reply',
      'request',
    ]);
  });

  it('sin petición o sin respuesta no se pregunta', () => {
    expect(construirBalance({ ...balance, peticion: ' ' })).toBeNull();
    expect(construirBalance({ ...balance, respuesta: '' })).toBeNull();
  });
});

describe('leerBalance', () => {
  it('devuelve la intención elegida y la probabilidad de resuelta', () => {
    expect(
      leerBalance({
        intencion: { type: 'choice', choice: 'reservar', confidence: 0.9 },
        resuelta: { type: 'noul', noul: 0.88 },
      }),
    ).toEqual({ intencion: 'reservar', resuelta: 0.88 });
  });

  it('una intención que no está en la lista se descarta', () => {
    // Lo que vuelva tiene que ser una de las opciones que se ofrecieron; si no,
    // contaría una categoría inventada en la telemetría.
    expect(
      leerBalance({
        intencion: { type: 'choice', choice: 'pedir_un_prestamo' },
        resuelta: { type: 'noul', noul: 0.5 },
      }).intencion,
    ).toBeNull();
  });

  it('sin respuestas devuelve nulos: la telemetría nunca inventa', () => {
    expect(leerBalance({})).toEqual({ intencion: null, resuelta: null });
    expect(leerBalance(undefined)).toEqual({ intencion: null, resuelta: null });
  });
});

describe('construirRelevancia', () => {
  const candidatos = ['Corte de dama', 'Corte de caballero', 'Manicure'];

  it('bate una pregunta por candidato en UNA sola petición', () => {
    // Un juicio por candidato suelto sería absurdo aquí: las preguntas
    // independientes sobre el mismo estado van juntas y salen mucho más baratas.
    const req = construirRelevancia({
      consulta: 'corte para mujer',
      candidatos,
    });

    expect(req!.asked).toEqual(['r0', 'r1', 'r2']);
    expect(Object.keys(req!.questions)).toHaveLength(3);
    expect(req!.state).toEqual({
      query: 'corte para mujer',
      services: candidatos,
    });
  });

  it('cada pregunta señala a su candidato por posición', () => {
    const req = construirRelevancia({ consulta: 'corte', candidatos });

    expect(req!.questions.r1.instructions).toContain('`services[1]`');
  });

  it('no se pregunta cuando no hay nada que ordenar', () => {
    // Un solo candidato ya está ordenado, y sin consulta no hay con qué medir
    // la relevancia. Acertar no cuesta ni una llamada.
    expect(
      construirRelevancia({ consulta: 'corte', candidatos: ['Corte'] }),
    ).toBeNull();
    expect(construirRelevancia({ consulta: ' ', candidatos })).toBeNull();
  });
});

describe('leerRelevancia', () => {
  it('devuelve una probabilidad por candidato, en orden', () => {
    expect(
      leerRelevancia(
        {
          r0: { type: 'noul', noul: 0.9 },
          r1: { type: 'noul', noul: 0.4 },
        },
        ['r0', 'r1'],
      ),
    ).toEqual([0.9, 0.4]);
  });

  it('si falta un veredicto devuelve null: se conserva el orden de hoy', () => {
    // Fail-open al orden actual, sin que la respuesta cambie de forma. Media
    // ordenación es peor que ninguna.
    expect(
      leerRelevancia({ r0: { type: 'noul', noul: 0.9 } }, ['r0', 'r1']),
    ).toBeNull();
    expect(leerRelevancia({}, ['r0'])).toBeNull();
  });
});

describe('ordenarPorRelevancia', () => {
  it('pone delante lo más relevante y mantiene el orden entre iguales', () => {
    const items = ['a', 'b', 'c', 'd'];

    expect(ordenarPorRelevancia(items, [0.2, 0.9, 0.2, 0.95])).toEqual([
      'd',
      'b',
      'a',
      'c',
    ]);
  });

  it('sin probabilidades devuelve el mismo arreglo', () => {
    const items = ['a', 'b'];

    expect(ordenarPorRelevancia(items, null)).toBe(items);
  });

  it('con tantas probabilidades como no toca, devuelve el mismo arreglo', () => {
    const items = ['a', 'b'];

    expect(ordenarPorRelevancia(items, [0.9])).toBe(items);
  });

  it('no cambia nada cuando todas las probabilidades son iguales', () => {
    // Sin información no hay reordenación: cambiar el orden porque el
    // comparador es inestable sería peor que dejarlo.
    expect(ordenarPorRelevancia(['a', 'b', 'c'], [0.5, 0.5, 0.5])).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
});
