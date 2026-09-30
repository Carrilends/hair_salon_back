import { Logger } from '@nestjs/common';
import {
  JudgmentPort,
  JudgmentRequest,
  JudgmentResult,
  fallo,
} from '../../domain/ports/judgment.port';

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';

export interface TypeSafeJudgeConfig {
  apiKey?: string;
  model: string;
  /**
   * Tope de espera. **Corto**: aquí hay una clienta esperando su turno. La
   * extensión de escritorio usa 10 s porque allí no espera nadie; medido contra
   * la API con estado pequeño, la mediana es de 250 ms y el p95 de 420 ms, así
   * que un segundo son más de dos veces el p95.
   */
  timeoutMs: number;
}

/**
 * Adaptador del proveedor de juicios sobre la API de TypeSafe
 * (`POST /v1/systemone`): `{model, state, questions}` →
 * `{model, answers, usage}`.
 *
 * **Sin SDK**: es una petición y una validación, y el `fetch` de Node basta. Es
 * lo que hace la extensión donde nacieron estas convenciones, y así el
 * proveedor no añade **ninguna dependencia** al proyecto.
 *
 * **Sin reintento en banda.** Un reintento duplicaría la espera del turno para
 * arreglar algo que el fail-open ya cubre.
 */
export class TypeSafeJudgeAdapter implements JudgmentPort {
  private readonly logger = new Logger(TypeSafeJudgeAdapter.name);

  constructor(
    private readonly config: TypeSafeJudgeConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async ask(request: JudgmentRequest): Promise<JudgmentResult> {
    // Sin clave no se sale a la red: la aplicación arranca igual y nadie se
    // entera. Es el mismo arranque perezoso del proveedor de lenguaje.
    if (!this.config.apiKey) return fallo('auth');

    const empezo = Date.now();
    const abortador = new AbortController();
    const reloj = setTimeout(() => abortador.abort(), this.config.timeoutMs);
    try {
      const res = await this.fetchImpl(ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          state: request.state,
          questions: request.questions,
        }),
        signal: abortador.signal,
      });
      if (!res.ok) return fallo(errorDeEstado(res.status), Date.now() - empezo);

      const json = (await res.json()) as {
        answers?: Record<string, unknown>;
        model?: string;
        usage?: { input_tokens?: number };
      };
      if (!esperadoYCompleto(json.answers, request.questions)) {
        return fallo('invalid', Date.now() - empezo);
      }
      return {
        ok: true,
        answers: json.answers,
        model: typeof json.model === 'string' ? json.model : this.config.model,
        inputTokens: Number(json.usage?.input_tokens ?? 0),
        ms: Date.now() - empezo,
      };
    } catch (error) {
      const esAborto =
        error instanceof Error &&
        (error.name === 'AbortError' || abortador.signal.aborted);
      // A nivel de aviso y no de error: un juicio que no llega no es una
      // avería de este sistema, y el turno sigue su camino.
      this.logger.warn(
        `El proveedor de juicios no contestó (${
          esAborto ? 'timeout' : error instanceof Error ? error.message : 'red'
        }).`,
      );
      return fallo(esAborto ? 'timeout' : 'network', Date.now() - empezo);
    } finally {
      clearTimeout(reloj);
    }
  }
}

const errorDeEstado = (status: number): string => {
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate';
  return 'network';
};

/**
 * La respuesta vale si trae **cada** pregunta que se hizo y con el tipo que se
 * pidió. Un veredicto que no corresponde a lo preguntado no es un veredicto.
 */
function esperadoYCompleto(
  answers: Record<string, unknown> | undefined,
  questions: Record<string, unknown>,
): answers is Record<string, unknown> {
  if (!answers || typeof answers !== 'object') return false;
  for (const [id, pregunta] of Object.entries(questions)) {
    const tipoPedido = (pregunta as { type?: unknown })?.type;
    const respuesta = answers[id] as { type?: unknown } | undefined;
    if (!respuesta || respuesta.type !== tipoPedido) return false;
  }
  return true;
}
