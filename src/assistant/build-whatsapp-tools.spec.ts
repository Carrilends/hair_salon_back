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
    // F4: propuestas, catálogo y lectura de citas, para las que proponen.
    {} as never,
    {} as never,
    {} as never,
    // F6: aviso a la dueña.
    { avisar: async () => 'enviado' } as never,
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
      // F6: pedir hablar con una persona.
      'hablarConLaDuena',
    ]);
  });

  it('la dueña no tiene hablarConLaDuena (no se avisa a sí misma)', () => {
    expect(nombres(montar().juegos.duena)).not.toContain('hablarConLaDuena');
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

  it('cancelar y mover piden el día y la hora de la cita y lo dicen (TC-RF54-02)', () => {
    const { juegos } = montar();
    for (const n of ['cancelarReserva', 'reprogramarReserva']) {
      const def = juegos.clienta.find((t) => t.name === n)!.definition;
      const params = def.parameters as { required: string[] };
      expect(params.required).toEqual(
        expect.arrayContaining(['fechaDeLaCita', 'horaDeLaCita']),
      );
      expect(def.description).toMatch(/no coinciden/);
      expect(def.description).toMatch(/misReservas/);
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

describe('buildWhatsAppTools · catálogo acotado', () => {
  it('clienta y dueña usan el envoltorio; la web y MCP, el original', () => {
    const { base, juegos } = montar();
    const original = base.find((t) => t.name === 'listarServicios')!;
    const copia = { ...original };
    const deClienta = juegos.clienta.find((t) => t.name === 'listarServicios')!;
    expect(deClienta).not.toBe(original);
    expect(juegos.duena.find((t) => t.name === 'listarServicios')).toBe(
      deClienta,
    );
    expect(deClienta.definition.parameters).toEqual(
      original.definition.parameters,
    );
    expect(base.find((t) => t.name === 'listarServicios')).toBe(original);
    expect(original).toEqual(copia);
  });

  it('recomendarServicios va envuelto para la clienta y el original queda intacto', () => {
    const { base, juegos } = montar();
    const original = base.find((t) => t.name === 'recomendarServicios')!;
    const deClienta = juegos.clienta.find(
      (t) => t.name === 'recomendarServicios',
    )!;
    expect(deClienta).not.toBe(original);
    expect(deClienta.definition.parameters).toEqual(
      original.definition.parameters,
    );
  });

  it('componerPaquete sigue siendo el original', () => {
    const { base, juegos } = montar();
    expect(juegos.clienta.find((t) => t.name === 'componerPaquete')).toBe(
      base.find((t) => t.name === 'componerPaquete'),
    );
  });
});

describe('buildWhatsAppTools: la hora que ella no dijo (prueba con móvil 2026-11-10)', () => {
  it.each(['crearReserva', 'reservarPaquete'])(
    '%s no guarda una propuesta a una hora distinta de la escrita',
    async (nombre) => {
      const base = buildAssistantTools(
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
      );
      const guardadas: unknown[] = [];
      const S1 = '11111111-1111-4111-8111-111111111111';
      const juegos = buildWhatsAppTools(
        base,
        {} as never,
        { execute: async () => [] } as never,
        {} as never,
        {} as never,
        {
          save: async (b: object) => {
            guardadas.push(b);
            return { ...b, id: 'p-1' };
          },
          supersedeActiveFor: async () => undefined,
        } as never,
        { findNamesByIds: async () => new Map([[S1, 'Taper fade']]) } as never,
        {} as never,
        { avisar: async () => 'enviado' } as never,
      );
      const tool = juegos.clienta.find((t) => t.name === nombre)!;
      const contexto = {
        userId: null,
        isAdmin: false,
        now: new Date('2026-11-10T23:00:00Z'),
        canal: 'whatsapp' as const,
        phoneE164: '573001112233',
        canalConversacional: true,
        recientes: [
          {
            rol: 'clienta' as const,
            texto:
              'quiero reservar el Taper Fade el viernes 10 a nombre de Luisa',
          },
        ],
      };
      const args = (hhmm: string) => ({
        fechaHoraIso: `2026-11-13T${hhmm}:00`,
        serviciosIds: [S1],
        nombre: 'Luisa',
      });

      expect(await tool.execute(args('08:00'), contexto)).toMatchObject({
        ok: false,
        motivo: 'hora_no_dicha',
      });
      expect(guardadas).toEqual([]);

      expect(await tool.execute(args('10:00'), contexto)).toMatchObject({
        ok: true,
      });
      expect(guardadas).toHaveLength(1);
    },
  );
});
