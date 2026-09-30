import {
  RECIENTES_EN_EL_ESTADO,
  UMBRAL_PERTINENCIA,
  construirPertinencia,
  leerPertinencia,
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
