import {
  JudgmentPort,
  JudgmentRequest,
  JudgmentResult,
} from '../../domain/ports/judgment.port';
import { NoopJudgeAdapter } from '../../infrastructure/judgment/noop-judge.adapter';
import { verificarReservaPropuesta } from './verify-reservation';

class JuezDoble implements JudgmentPort {
  readonly disponible = true;
  peticiones: JudgmentRequest[] = [];
  constructor(private readonly noul: number | null) {}
  async ask(request: JudgmentRequest): Promise<JudgmentResult> {
    this.peticiones.push(request);
    if (this.noul === null) return { ok: false, error: 'timeout', ms: 5 };
    return {
      ok: true,
      answers: { correspondencia: { type: 'noul', noul: this.noul } },
      model: 'jev-1.13.0',
      inputTokens: 300,
      ms: 240,
    };
  }
}

const PROPUESTA = {
  servicios: ['Corte de dama'],
  fecha: 'viernes 2 de octubre de 2026',
  hora: '15:00',
  recientes: [
    { rol: 'clienta' as const, texto: 'quiero un corte el viernes a las 3' },
  ],
};

describe('verificarReservaPropuesta', () => {
  it('en off no pregunta nada y deja crear', async () => {
    const juez = new JuezDoble(0.01);

    const veredicto = await verificarReservaPropuesta({
      judge: juez,
      modo: 'off',
      ...PROPUESTA,
    });

    expect(veredicto.permitir).toBe(true);
    expect(veredicto.prob).toBeNull();
    expect(juez.peticiones).toHaveLength(0);
  });

  it('en on deja crear la reserva que se corresponde con lo que pidió', async () => {
    const veredicto = await verificarReservaPropuesta({
      judge: new JuezDoble(0.95),
      modo: 'on',
      ...PROPUESTA,
    });

    expect(veredicto.permitir).toBe(true);
    expect(veredicto.prob).toBe(0.95);
  });

  it('en on frena la reserva desviada', async () => {
    const veredicto = await verificarReservaPropuesta({
      judge: new JuezDoble(0.08),
      modo: 'on',
      ...PROPUESTA,
    });

    expect(veredicto.permitir).toBe(false);
    expect(veredicto.prob).toBe(0.08);
  });

  it('en shadow pregunta y anota, pero NO frena', async () => {
    // Paso obligatorio antes de encender: con unos días de sombra el umbral se
    // calibra sobre turnos reales en vez de copiarse del banco.
    const juez = new JuezDoble(0.08);

    const veredicto = await verificarReservaPropuesta({
      judge: juez,
      modo: 'shadow',
      ...PROPUESTA,
    });

    expect(veredicto.permitir).toBe(true);
    expect(veredicto.prob).toBe(0.08);
    expect(veredicto.habriaFrenado).toBe(true);
    expect(juez.peticiones).toHaveLength(1);
  });

  it('si el proveedor no contesta, la reserva se crea como hoy', async () => {
    const veredicto = await verificarReservaPropuesta({
      judge: new JuezDoble(null),
      modo: 'on',
      ...PROPUESTA,
    });

    expect(veredicto.permitir).toBe(true);
    expect(veredicto.prob).toBeNull();
    expect(veredicto.error).toBe('timeout');
  });

  it('si el juez LANZA, la reserva se crea como hoy', async () => {
    // El fail-open no puede depender de que el adaptador se porte bien. Un
    // adaptador futuro, un envoltorio de métricas o un `AbortController` que no
    // exista en algún runtime lanzarían, y la excepción subiría hasta el
    // borde HTTP: 500, y la clienta pierde su mensaje y su fila de auditoría.
    const juezQueLanza = {
      ask: async () => {
        throw new Error('el adaptador reventó');
      },
    };

    const veredicto = await verificarReservaPropuesta({
      judge: juezQueLanza as never,
      modo: 'on',
      ...PROPUESTA,
    });

    expect(veredicto.permitir).toBe(true);
    expect(veredicto.prob).toBeNull();
  });

  it('con el adaptador nulo la reserva se crea como hoy', async () => {
    const veredicto = await verificarReservaPropuesta({
      judge: new NoopJudgeAdapter(),
      modo: 'on',
      ...PROPUESTA,
    });

    expect(veredicto.permitir).toBe(true);
    expect(veredicto.prob).toBeNull();
  });

  it('sin conversación previa no se pregunta: no hay con qué comparar', async () => {
    // Es el caso de los otros adaptadores primarios —MCP, WhatsApp, el cron—,
    // que no traen historial. La salvaguarda es del canal conversacional y no
    // se le impone a los demás.
    const juez = new JuezDoble(0.01);

    const veredicto = await verificarReservaPropuesta({
      judge: juez,
      modo: 'on',
      ...PROPUESTA,
      recientes: [],
    });

    expect(veredicto.permitir).toBe(true);
    expect(juez.peticiones).toHaveLength(0);
  });

  it('el estado que viaja lleva los nombres de los servicios, no sus ids', async () => {
    const juez = new JuezDoble(0.9);

    await verificarReservaPropuesta({
      judge: juez,
      modo: 'on',
      ...PROPUESTA,
    });

    expect(juez.peticiones[0].state).toMatchObject({
      services: ['Corte de dama'],
      date: 'viernes 2 de octubre de 2026',
      time: '15:00',
    });
    // Y ningún identificador: los ids del catálogo son UUID y no significan
    // nada para quien tiene que compararlos con lo que dijo la clienta.
    expect(JSON.stringify(juez.peticiones[0].state)).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}/,
    );
  });
});
