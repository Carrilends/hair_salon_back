import * as horario from 'src/reservations/salon-schedule';
import { SALON_ADDRESS } from 'src/common/salon';
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

/**
 * Pila E2E con Gemini real (M-325 a M-327): el modelo dijo que el salón cierra
 * los domingos, que acepta tarjetas y que tiene parqueadero. Nada de eso consta
 * en ninguna fuente. Los prompts llevan ahora los datos verificados del salón,
 * **derivados** de la fuente de verdad (nunca escritos a mano), y una regla que
 * prohíbe afirmar lo que no esté en el prompt o en una herramienta.
 */
describe('datos verificados del salón y regla de no inventar (M-325 a M-327)', () => {
  const todos = [
    ['web', SYSTEM_PROMPT],
    ['clienta de WhatsApp', SYSTEM_PROMPT_WHATSAPP_CLIENTA],
    ['dueña de WhatsApp', SYSTEM_PROMPT_WHATSAPP_DUENA],
  ] as const;

  /** El horario esperado, calculado aquí desde `salon-schedule.ts`. */
  function horarioDesdeLaFuente(): string[] {
    const s = horario;
    const h = (min: number) => {
      const hour = Math.floor(min / 60);
      const sufijo = hour < 12 ? 'a. m.' : 'p. m.';
      return `${hour % 12 === 0 ? 12 : hour % 12}:${String(min % 60).padStart(2, '0')} ${sufijo}`;
    };
    return [
      `lunes a viernes de ${h(s.WEEKDAY_OPEN_MIN)} a ${h(s.WEEKDAY_CLOSE_MIN)}`,
      `sábados, domingos y festivos de ${h(s.WEEKEND_OPEN_MIN)} a ${h(s.WEEKEND_CLOSE_MIN)}`,
    ];
  }

  it.each(todos)(
    'el prompt de la %s lleva el horario derivado de salon-schedule.ts, en 12 horas',
    (_, p) => {
      for (const tramo of horarioDesdeLaFuente()) expect(p).toContain(tramo);
      // Lo que dijo el modelo en M-325: el domingo NO está cerrado.
      expect(p).toContain(
        'sábados, domingos y festivos de 9:00 a. m. a 7:00 p. m.',
      );
      expect(p).toContain('lunes a viernes de 8:00 a. m. a 8:00 p. m.');
      expect(p).not.toMatch(/\b(?:[01]\d|2[0-3]):[0-5]\d\b(?! [ap]\. m\.)/);
    },
  );

  it.each(todos)(
    'el prompt de la %s lleva la dirección que el back ya tiene (src/common/salon.ts)',
    (_, p) => {
      expect(SALON_ADDRESS).toBe('Carrera 3 #1-18, Sopó, Cundinamarca');
      expect(p).toContain(SALON_ADDRESS);
    },
  );

  it.each(todos)(
    'el prompt de la %s prohíbe afirmar lo que no esté en el prompt ni en una herramienta',
    (_, p) => {
      const regla = p
        .split('\n')
        .find((l) => /no afirmes nada sobre el salón/i.test(l));
      expect(regla).toBeDefined();
      expect(regla).toMatch(/medios de pago/i);
      expect(regla).toMatch(/parqueadero/i);
      expect(regla).toMatch(/promociones/i);
      expect(regla).toMatch(/políticas/i);
      expect(regla).toMatch(/servicios que no devuelva una herramienta/i);
      expect(regla).toMatch(/dilo/i);
    },
  );

  it('si no lo sabe, en la web remite al WhatsApp del salón y en WhatsApp ofrece a la dueña', () => {
    const regla = (p: string) =>
      p.split('\n').find((l) => /no afirmes nada sobre el salón/i.test(l))!;
    expect(regla(SYSTEM_PROMPT)).toMatch(/WhatsApp del salón/);
    expect(regla(SYSTEM_PROMPT)).not.toMatch(/hablarConLaDuena/);
    expect(regla(SYSTEM_PROMPT_WHATSAPP_CLIENTA)).toMatch(/hablarConLaDuena/);
    // La herramienta solo existe para la clienta: la dueña no la tiene.
    expect(regla(SYSTEM_PROMPT_WHATSAPP_DUENA)).not.toMatch(/hablarConLaDuena/);
  });

  it('si cambia el horario en salon-schedule.ts, cambia el prompt', async () => {
    await jest.isolateModulesAsync(async () => {
      jest.doMock('src/reservations/salon-schedule', () => ({
        ...jest.requireActual('src/reservations/salon-schedule'),
        WEEKEND_OPEN_MIN: 10 * 60,
        WEEKEND_CLOSE_MIN: 18 * 60 + 30,
      }));
      const otro = await import('./system-prompt');
      for (const p of [
        otro.SYSTEM_PROMPT,
        otro.SYSTEM_PROMPT_WHATSAPP_CLIENTA,
        otro.SYSTEM_PROMPT_WHATSAPP_DUENA,
      ]) {
        expect(p).toContain(
          'sábados, domingos y festivos de 10:00 a. m. a 6:30 p. m.',
        );
      }
    });
    jest.dontMock('src/reservations/salon-schedule');
  });
});

describe('datos del salón: puntuación', () => {
  it.each([
    SYSTEM_PROMPT,
    SYSTEM_PROMPT_WHATSAPP_CLIENTA,
    SYSTEM_PROMPT_WHATSAPP_DUENA,
  ])('no deja «p. m..» al cerrar la frase del horario', (p) => {
    expect(p).not.toMatch(/m\.\./);
  });
});

describe('ausencias por WhatsApp (2026-11-11)', () => {
  it('la dueña: marcarAusencia, preguntar si algo no está claro y nunca «hecho» antes del botón', () => {
    const p = SYSTEM_PROMPT_WHATSAPP_DUENA;
    const regla = p.split('\n').find((l) => /no viene/.test(l))!;
    expect(regla).toMatch(/marcarAusencia/);
    expect(regla).toMatch(/qué estilista, qué día o hasta qué hora/);
    expect(regla).toMatch(/pregúntale antes de llamarla/);
    const boton = p.split('\n').find((l) => /marcarAusencia NO/.test(l))!;
    expect(boton).toMatch(/botón/);
    expect(boton).toMatch(/Nunca digas que ya quedó/);
    expect(p).toMatch(/verAusencias/);
  });

  it('la clienta y la web no oyen hablar de ausencias', () => {
    for (const p of [SYSTEM_PROMPT, SYSTEM_PROMPT_WHATSAPP_CLIENTA]) {
      expect(p).not.toMatch(/marcarAusencia|verAusencias/);
    }
  });
});
