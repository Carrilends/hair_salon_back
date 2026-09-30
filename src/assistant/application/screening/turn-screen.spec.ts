import {
  RECIENTES_EN_EL_ESTADO,
  UMBRAL_CORRESPONDENCIA,
  UMBRAL_PERTINENCIA,
  UMBRAL_PROGRESO,
  construirCorrespondencia,
  construirPertinencia,
  construirProgreso,
  leerCorrespondencia,
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
