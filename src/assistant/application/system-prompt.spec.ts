import {
  SYSTEM_PROMPT,
  SYSTEM_PROMPT_WHATSAPP_CLIENTA,
  SYSTEM_PROMPT_WHATSAPP_DUENA,
  RECOMMENDABLE_CATEGORIES,
} from './system-prompt';

/**
 * El prompt del sistema es la única pieza del asistente que nadie estaba
 * protegiendo: es una constante, viaja en cada turno y una edición descuidada no
 * rompe ninguna prueba. Estas fijan lo que no puede perderse sin darse cuenta.
 */
describe('SYSTEM_PROMPT', () => {
  /** Las reglas se leen por línea: el prompt se arma uniendo frases con \n. */
  const lineas = SYSTEM_PROMPT.split('\n');

  it('pide texto plano y prohíbe el marcado', () => {
    const formato = lineas.filter((l) => /texto plano/i.test(l));
    expect(formato).not.toHaveLength(0);
    expect(formato.join(' ')).toMatch(/asterisco|markdown/i);
  });

  it('manda derivar los listados largos a las tarjetas en vez de enumerarlos', () => {
    expect(SYSTEM_PROMPT).toMatch(/tarjeta/i);
  });

  it('no usa marcado él mismo: lo que predica es lo que practica', () => {
    expect(SYSTEM_PROMPT).not.toMatch(/\*\*|^\s*[*-]\s/m);
  });

  it('no se dirige a la clienta por ningún nombre: el modelo no recibe el de la sesión', () => {
    // Decía «solo por el nombre de su sesión», pero ese nombre no le llega
    // nunca: la regla prometía un dato que no existe.
    expect(SYSTEM_PROMPT).not.toMatch(/nombre de su sesión/i);
    expect(SYSTEM_PROMPT).toMatch(
      /no te dirijas a la clienta por ningún nombre/i,
    );
  });

  it('dice que la confirmación de cancelar o mover la escribe el sistema, aparte', () => {
    const regla = lineas.find((l) => /confirmación/i.test(l));
    expect(regla).toBeDefined();
    expect(regla).toMatch(/cancel/i);
    expect(regla).toMatch(/no la contradigas/i);
  });

  it('sigue siendo constante: ni fecha ni catálogo incrustados (NF12)', () => {
    // El prompt caching se pierde si el prefijo cambia entre llamadas. Las
    // categorías sí se incrustan, pero son una lista fija y corta.
    expect(SYSTEM_PROMPT).toContain(RECOMMENDABLE_CATEGORIES[0]);
    expect(SYSTEM_PROMPT).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

/**
 * Los dos prompts de WhatsApp comparten las reglas de catálogo (COMUN_WHATSAPP):
 * presentar como mucho seis servicios, preguntar antes de acotar y no repetir
 * una pregunta sin el servicio que nombra.
 */
describe('SYSTEM_PROMPT_WHATSAPP (clienta y dueña)', () => {
  const whatsapp = [
    ['clienta', SYSTEM_PROMPT_WHATSAPP_CLIENTA],
    ['dueña', SYSTEM_PROMPT_WHATSAPP_DUENA],
  ] as const;

  it.each(whatsapp)(
    'el prompt de la %s manda preguntar primero y presentar como mucho seis',
    (_, p) => {
      expect(p).toMatch(/pregunta primero/i);
      expect(p).toMatch(/como mucho seis/i);
      expect(p).not.toMatch(/como mucho cinco/i);
    },
  );

  it.each(whatsapp)(
    'el prompt de la %s pide mantener el servicio al repetir una pregunta',
    (_, p) => {
      expect(p).toContain('sin quitar el servicio que nombra');
    },
  );

  it.each(whatsapp)(
    'el prompt de la %s no pide decir lo que ya dice la línea fija del sistema',
    (_, p) => {
      expect(p).not.toMatch(/\(parcial\), dilo/);
      expect(p).toMatch(/parcial/);
      expect(p).toMatch(/no lo repitas/i);
    },
  );

  it.each(whatsapp)(
    'el prompt de la %s dice cómo salir del «me da igual»',
    (_, p) => {
      expect(p).toMatch(/le da igual/i);
      expect(p).toMatch(/listarServicios sin busqueda/);
    },
  );

  it.each(whatsapp)(
    'el prompt de la %s prohíbe copiar las notas entre corchetes',
    (_, p) => {
      expect(p).toMatch(/corchetes/);
    },
  );

  it.each(whatsapp)(
    'el prompt de la %s solo llama sin busqueda si no ha nombrado ningún servicio (N1)',
    (_, p) => {
      expect(p).toMatch(/no ha nombrado ningún servicio/i);
      expect(p).toMatch(/si ya nombró uno/i);
    },
  );

  it('el prompt de la web no lleva las reglas de WhatsApp', () => {
    expect(SYSTEM_PROMPT).not.toMatch(
      /como mucho seis|pregunta primero|sin quitar el servicio que nombra/i,
    );
    expect(SYSTEM_PROMPT).toMatch(/tarjeta/i);
  });

  it.each(whatsapp)(
    'el prompt de la %s sigue siendo constante: sin fechas',
    (_, p) => {
      expect(p).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    },
  );
});
