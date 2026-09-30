import { TypeSafeJudgeAdapter } from './typesafe-judge.adapter';
import { NoopJudgeAdapter } from './noop-judge.adapter';

const PETICION = {
  state: { message: 'hola' },
  questions: { p: { type: 'noul', instructions: 'x' } },
};

const respuestaOk = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }) as unknown as Response;

describe('TypeSafeJudgeAdapter', () => {
  it('devuelve el veredicto, el modelo y los tokens cuando el proveedor contesta', async () => {
    const fetchDoble = jest.fn().mockResolvedValue(
      respuestaOk({
        model: 'jev-1.13.0',
        answers: { p: { type: 'noul', noul: 0.94 } },
        usage: { input_tokens: 312 },
      }),
    );
    const adapter = new TypeSafeJudgeAdapter(
      { apiKey: 'k', model: 'jev-1.13.0', timeoutMs: 1000 },
      fetchDoble,
    );

    const res = await adapter.ask(PETICION);

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.answers).toEqual({ p: { type: 'noul', noul: 0.94 } });
    expect(res.model).toBe('jev-1.13.0');
    expect(res.inputTokens).toBe(312);
    expect(typeof res.ms).toBe('number');
  });

  it('manda la clave en la cabecera y el modelo en el cuerpo', async () => {
    const fetchDoble = jest
      .fn()
      .mockResolvedValue(
        respuestaOk({ answers: { p: { type: 'noul', noul: 1 } } }),
      );
    const adapter = new TypeSafeJudgeAdapter(
      { apiKey: 'la-clave', model: 'jev-1.13.0', timeoutMs: 1000 },
      fetchDoble,
    );

    await adapter.ask(PETICION);

    const [, init] = fetchDoble.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer la-clave');
    expect(JSON.parse(init.body)).toEqual({
      model: 'jev-1.13.0',
      state: PETICION.state,
      questions: PETICION.questions,
    });
  });

  it('sin clave devuelve auth y NO llama al proveedor', async () => {
    // La aplicación arranca sin clave y no se entera nadie: sin ella, el
    // asistente no menciona al proveedor de juicios en ninguna parte.
    const fetchDoble = jest.fn();
    const adapter = new TypeSafeJudgeAdapter(
      { model: 'jev-1.13.0', timeoutMs: 1000 },
      fetchDoble,
    );

    const res = await adapter.ask(PETICION);

    expect(res).toMatchObject({ ok: false, error: 'auth' });
    expect(fetchDoble).not.toHaveBeenCalled();
  });

  it.each([
    [401, 'auth'],
    [403, 'auth'],
    [429, 'rate'],
    [500, 'network'],
    [503, 'network'],
  ])('traduce el HTTP %i a %s', async (status, esperado) => {
    const fetchDoble = jest
      .fn()
      .mockResolvedValue(respuestaOk({ error: 'x' }, status));
    const adapter = new TypeSafeJudgeAdapter(
      { apiKey: 'k', model: 'm', timeoutMs: 1000 },
      fetchDoble,
    );

    expect(await adapter.ask(PETICION)).toMatchObject({
      ok: false,
      error: esperado,
    });
  });

  it('una respuesta que no trae la pregunta que se pidió es invalid', async () => {
    // Un veredicto que no corresponde a lo preguntado no es un veredicto.
    const fetchDoble = jest
      .fn()
      .mockResolvedValue(respuestaOk({ answers: { otra: { type: 'noul' } } }));
    const adapter = new TypeSafeJudgeAdapter(
      { apiKey: 'k', model: 'm', timeoutMs: 1000 },
      fetchDoble,
    );

    expect(await adapter.ask(PETICION)).toMatchObject({
      ok: false,
      error: 'invalid',
    });
  });

  it('una respuesta con el tipo que no se pidió es invalid', async () => {
    const fetchDoble = jest
      .fn()
      .mockResolvedValue(
        respuestaOk({ answers: { p: { type: 'choice', choice: 'x' } } }),
      );
    const adapter = new TypeSafeJudgeAdapter(
      { apiKey: 'k', model: 'm', timeoutMs: 1000 },
      fetchDoble,
    );

    expect(await adapter.ask(PETICION)).toMatchObject({
      ok: false,
      error: 'invalid',
    });
  });

  it('aborta al agotar el tiempo y NO reintenta', async () => {
    // Aquí hay una clienta esperando el turno: timeout corto y sin reintento en
    // banda. La extensión usa 10 s porque allí no espera nadie.
    const fetchDoble = jest.fn(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise<Response>((_resolver, rechazar) => {
          init.signal.addEventListener('abort', () =>
            rechazar(
              Object.assign(new Error('abortada'), { name: 'AbortError' }),
            ),
          );
        }),
    );
    const adapter = new TypeSafeJudgeAdapter(
      { apiKey: 'k', model: 'm', timeoutMs: 20 },
      fetchDoble as unknown as typeof fetch,
    );

    const res = await adapter.ask(PETICION);

    expect(res).toMatchObject({ ok: false, error: 'timeout' });
    expect(fetchDoble).toHaveBeenCalledTimes(1);
  });

  it('un fallo de red cualquiera se normaliza a network', async () => {
    const fetchDoble = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
    const adapter = new TypeSafeJudgeAdapter(
      { apiKey: 'k', model: 'm', timeoutMs: 1000 },
      fetchDoble,
    );

    expect(await adapter.ask(PETICION)).toMatchObject({
      ok: false,
      error: 'network',
    });
  });
});

describe('NoopJudgeAdapter', () => {
  it('no pregunta nada y devuelve auth: sin proveedor, todo pasa', async () => {
    // Espejo de `fake-llm.adapter.ts`: mantiene verdes las pruebas sin red y
    // hace que el despliegue no dependa de la clave. «Todo pasa» significa, en
    // cada colocación, lo que hoy ya ocurre.
    expect(await new NoopJudgeAdapter().ask()).toEqual({
      ok: false,
      error: 'auth',
      ms: 0,
    });
  });
});
