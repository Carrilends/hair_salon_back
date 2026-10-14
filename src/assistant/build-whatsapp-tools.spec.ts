import { buildAssistantTools } from './build-assistant-tools';
import { buildWhatsAppTools } from './build-whatsapp-tools';
import { AssistantTool } from './application/tools/assistant-tool';

/**
 * Plan 06, F3b (D6): qué herramientas ve cada rol en WhatsApp. Es la tabla de
 * permisos del canal; cualquier cambio aquí es un cambio de seguridad.
 */
function montar() {
  const base = buildAssistantTools(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  const definicionesAntes = JSON.stringify(base.map((t) => t.definition));
  const juegos = buildWhatsAppTools(
    base,
    {} as never,
    { execute: async () => [] } as never,
    {} as never,
    {} as never,
    // F4: propuestas y catálogo, para las herramientas que proponen.
    {} as never,
    {} as never,
  );
  return { base, juegos, definicionesAntes };
}

const nombres = (tools: AssistantTool[]) => tools.map((t) => t.name);

describe('buildWhatsAppTools (D6)', () => {
  it('la clienta: catálogo, disponibilidad, reservar y gestionar SUS citas', () => {
    expect(nombres(montar().juegos.clienta)).toEqual([
      'listarServicios',
      'consultarDisponibilidad',
      'recomendarServicios',
      'componerPaquete',
      'crearReserva',
      'reservarPaquete',
      'misReservas',
      'cancelarReserva',
      'reprogramarReserva',
    ]);
  });

  it('la dueña: catálogo, disponibilidad, agenda, confirmar, cancelar y mover; NO crea', () => {
    expect(nombres(montar().juegos.duena)).toEqual([
      'listarServicios',
      'consultarDisponibilidad',
      'verAgenda',
      'confirmarReserva',
      'cancelarReserva',
      'reprogramarReserva',
    ]);
  });

  it('la clienta no ve las herramientas de administración', () => {
    const n = nombres(montar().juegos.clienta);
    expect(n).not.toContain('verAgenda');
    expect(n).not.toContain('confirmarReserva');
  });

  it('la web y MCP siguen con sus nueve, sin herramientas nuevas y sin tocar sus definiciones', () => {
    const { base, definicionesAntes } = montar();
    expect(base).toHaveLength(9);
    expect(nombres(base)).not.toContain('verAgenda');
    expect(nombres(base)).not.toContain('confirmarReserva');
    expect(JSON.stringify(base.map((t) => t.definition))).toBe(
      definicionesAntes,
    );
  });

  it('en WhatsApp, crear exige el nombre de la clienta (D5)', () => {
    const { juegos } = montar();
    for (const n of ['crearReserva', 'reservarPaquete']) {
      const params = juegos.clienta.find((t) => t.name === n)!.definition
        .parameters as { required: string[]; properties: object };
      expect(params.required).toContain('nombre');
      expect(Object.keys(params.properties)).toContain('nombre');
    }
  });

  it('ninguna descripción de WhatsApp habla de iniciar sesión', () => {
    const { juegos } = montar();
    for (const t of [...juegos.clienta, ...juegos.duena]) {
      expect(t.definition.description).not.toMatch(/sesi[oó]n/i);
    }
  });

  it('el nombre de la definición coincide siempre con el de la herramienta', () => {
    const { juegos } = montar();
    for (const t of [...juegos.clienta, ...juegos.duena]) {
      expect(t.definition.name).toBe(t.name);
    }
  });

  it('si falta una herramienta base, falla al componer y no en el primer mensaje', () => {
    expect(() =>
      buildWhatsAppTools(
        [],
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
      ),
    ).toThrow(/listarServicios/);
  });
});

describe('buildWhatsAppTools · D4 (plan 06, F4)', () => {
  it('las cuatro que escribían ahora proponen: no son las instancias de la web', () => {
    const { base, juegos } = montar();
    for (const n of [
      'crearReserva',
      'reservarPaquete',
      'cancelarReserva',
      'reprogramarReserva',
    ]) {
      for (const juego of [juegos.clienta, juegos.duena]) {
        const t = juego.find((x) => x.name === n);
        if (!t) continue;
        expect(t).not.toBe(base.find((x) => x.name === n));
        expect(t.constructor.name).toMatch(/^Propose/);
      }
    }
  });
});
