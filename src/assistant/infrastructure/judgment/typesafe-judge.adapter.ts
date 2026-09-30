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
   * Tope de espera por defecto, que cada petición puede sobreescribir
   * (`JudgmentRequest.timeoutMs`). **Corto**: aquí hay una clienta esperando su
   * turno; la extensión de escritorio usa 10 s porque allí no espera nadie.
   *
   * Medido contra la API con estado pequeño, 82 juicios del 2026-09-30:
   * mediana **245 ms**, p95 entre **330 y 400 ms** según el juicio, y un
   * **máximo de 846 ms** —el peor de los 82—. Los juicios bateados (una
   * pregunta por candidato) son los más lentos, como cabía esperar.
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

  /** Sin credencial no hay proveedor, aunque la clase esté construida. */
  readonly disponible: boolean;

  constructor(
    private readonly config: TypeSafeJudgeConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.disponible = Boolean(config.apiKey);
  }

  async ask(request: JudgmentRequest): Promise<JudgmentResult> {
    // Sin clave no se sale a la red: la aplicación arranca igual y nadie se
    // entera. Es el mismo arranque perezoso del proveedor de lenguaje.
    if (!this.config.apiKey) return fallo('auth');

    const empezo = Date.now();
    const abortador = new AbortController();
    const reloj = setTimeout(
      () => abortador.abort(),
      request.timeoutMs ?? this.config.timeoutMs,
    );
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
      if (!res.ok) {
        // El cuerpo no se va a leer: se descarta explícitamente para no dejar
        // flujos abiertos en una ráfaga de 429 o de 5xx.
        void res.body?.cancel().catch(() => undefined);
        return fallo(errorDeEstado(res.status), Date.now() - empezo);
      }

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

/**
 * El estado HTTP traducido a uno de los cinco fallos del puerto. Los 4xx que no
 * son de credencial ni de tasa son `invalid` y no `network`: una petición mal
 * formada no es un problema de red, y llamarla así manda a quien depure por el
 * camino equivocado —el mensaje del log diría «no contestó» cuando sí
 * contestó—. El comportamiento no cambia: los cinco fallan abierto.
 */
const errorDeEstado = (status: number): string => {
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate';
  if (status >= 400 && status < 500) return 'invalid';
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
