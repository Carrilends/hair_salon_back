import { AssistantContext } from './assistant-tool';
import {
  ContactOwnerTool,
  ENFRIAMIENTO_CONTACTO_MS,
} from './contact-owner.tool';
import { EnfriamientoPorNumero } from '../enfriamiento-por-numero';
import { OwnerContactPort } from '../../domain/ports/owner-contact.port';

const NUMERO = '573001112233';
const AHORA = new Date('2026-10-14T15:00:00Z');
const clienta: AssistantContext = {
  userId: null,
  now: AHORA,
  isAdmin: false,
  canal: 'whatsapp',
  phoneE164: NUMERO,
};

function montar(
  responde: () => Promise<'enviado' | 'sin_configurar'> = async () => 'enviado',
) {
  const avisos: Parameters<OwnerContactPort['avisar']>[0][] = [];
  const tool = new ContactOwnerTool(
    {
      avisar: async (a) => {
        avisos.push(a);
        return responde();
      },
    },
    new EnfriamientoPorNumero(ENFRIAMIENTO_CONTACTO_MS),
  );
  return { tool, avisos };
}

describe('hablarConLaDuena (plan 06, F6)', () => {
  it('avisa con el número del contexto, no con uno del modelo', async () => {
    const { tool, avisos } = montar();
    const r = await tool.execute(
      {
        motivo: 'Quiere un peinado de novia',
        nombre: 'Ana',
        telefono: '573000000000',
      },
      clienta,
    );
    expect(r).toEqual({ ok: true, avisada: true });
    expect(avisos).toEqual([
      {
        nombre: 'Ana',
        telefonoE164: NUMERO,
        motivo: 'Quiere un peinado de novia',
      },
    ]);
  });

  it('sin nombre, avisa igual (D16)', async () => {
    const { tool, avisos } = montar();
    await tool.execute({ motivo: 'Duda de precios' }, clienta);
    expect(avisos[0].nombre).toBeNull();
  });

  it('sin motivo no avisa y lo pregunta', async () => {
    const { tool, avisos } = montar();
    const r = (await tool.execute({ motivo: '  ' }, clienta)) as {
      ok: boolean;
      pregunta?: string;
    };
    expect(r.ok).toBe(false);
    expect(r.pregunta).toBeTruthy();
    expect(avisos).toHaveLength(0);
  });

  it('un segundo pedido antes de 6 h no vuelve a avisar (D8, D17)', async () => {
    const { tool, avisos } = montar();
    await tool.execute({ motivo: 'a' }, clienta);
    const r = await tool.execute(
      { motivo: 'b' },
      {
        ...clienta,
        now: new Date(AHORA.getTime() + ENFRIAMIENTO_CONTACTO_MS - 1),
      },
    );
    expect(r).toEqual({ ok: true, yaAvisada: true });
    expect(avisos).toHaveLength(1);
  });

  it('pasadas 6 h, vuelve a avisar', async () => {
    const { tool, avisos } = montar();
    await tool.execute({ motivo: 'a' }, clienta);
    await tool.execute(
      { motivo: 'b' },
      { ...clienta, now: new Date(AHORA.getTime() + ENFRIAMIENTO_CONTACTO_MS) },
    );
    expect(avisos).toHaveLength(2);
  });

  it('sin dueña configurada: alternativa, no error ni «ya le avisé» (D15)', async () => {
    const { tool } = montar(async () => 'sin_configurar');
    const r = (await tool.execute({ motivo: 'a' }, clienta)) as {
      ok: boolean;
      motivo: string;
      pregunta: string;
    };
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe('sin_aviso');
    expect(r.pregunta).toMatch(/no pude avisarle/);
  });

  it('si el envío falla, alternativa, y puede volver a pedirlo enseguida', async () => {
    let falla = true;
    const { tool, avisos } = montar(async () => {
      if (falla) throw new Error('Meta 400');
      return 'enviado';
    });
    const r1 = (await tool.execute({ motivo: 'a' }, clienta)) as {
      ok: boolean;
    };
    expect(r1.ok).toBe(false);
    falla = false;
    const r2 = await tool.execute({ motivo: 'a' }, clienta);
    expect(r2).toEqual({ ok: true, avisada: true });
    expect(avisos).toHaveLength(2);
  });

  it.each([
    ['la dueña', { ...clienta, isAdmin: true }],
    ['la web', { ...clienta, canal: 'web' as const, phoneE164: undefined }],
    ['WhatsApp sin número', { ...clienta, phoneE164: undefined }],
  ])('%s no puede usarla', async (_quien, contexto) => {
    const { tool, avisos } = montar();
    const r = (await tool.execute({ motivo: 'a' }, contexto)) as {
      ok: boolean;
    };
    expect(r.ok).toBe(false);
    expect(avisos).toHaveLength(0);
  });
});
