import { SYSTEM_PROMPT, RECOMMENDABLE_CATEGORIES } from './system-prompt';

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
