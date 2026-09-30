/**
 * Banco de calibración del **proveedor de juicios** contra la API real
 * (plan 04, T2). No es una medición de tesis: es lo que hace que los umbrales
 * del plan sean números elegidos y no inventados. Sin él, cualquier umbral que
 * escribamos es un invento, y un umbral mal puesto produce justo el fallo que
 * preocupa: frenar o rechazar a una clienta real.
 *
 *   npx ts-node src/assistant/calibracion/banco-jev.ts
 *   npx ts-node src/assistant/calibracion/banco-jev.ts pertinencia --modelo jev-latest
 *
 * La clave sale de `TYPESAFE_API_KEY`, de `TYPESAFE_KEY` o de
 * `~/.config/typesafe/key` (una línea), por ese orden, y **nunca se imprime**. Coste: ~300 tokens de entrada por caso a
 * $0,042 por millón (la salida es gratis), o sea céntimos por tanda entera.
 *
 * Método copiado de `scripts/jev-eval-idioma.mjs` de `lenguage_especialized`:
 * usa **el mismo módulo que usaría producción** (`turn-screen.ts`), así que
 * manda exactamente las mismas instrucciones y criterios. Un banco que armara
 * sus propias preguntas mediría otra cosa.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import {
  MensajeReciente,
  PeticionDeJuicio,
  LlamadaDeLaTraza,
  UMBRAL_CORRESPONDENCIA,
  UMBRAL_PERTINENCIA,
  UMBRAL_PROGRESO,
  construirBalance,
  construirCorrespondencia,
  construirRelevancia,
  construirPertinencia,
  construirProgreso,
  leerRelevancia,
  ordenarPorRelevancia,
  probabilidadNoul,
} from '../application/screening/turn-screen';

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
/**
 * Versión FIJA y no `jev-latest`: los números de este banco se citan al decidir
 * el umbral, así que tienen que ser reproducibles. Si el id ya no existe, se
 * reintenta con `jev-latest` y el informe lo dice.
 */
const MODELO_POR_DEFECTO = 'jev-1.13.0';
const PRECIO_ENTRADA_POR_MILLON = 0.042;
const UMBRALES = [0.02, 0.05, 0.1, 0.2, 0.3, 0.5, 0.7, 0.9];

interface Caso {
  clase: string;
  por: string;
  /** Una de las dos etiquetas del juicio (`si` / `no` en `JUICIOS`). */
  esperado: string;
  recientes?: MensajeReciente[];
  /** Pertinencia. */
  mensaje?: string;
  /** Correspondencia. */
  servicios?: string[];
  fecha?: string;
  hora?: string;
  /** Progreso y balance. */
  peticion?: string;
  traza?: LlamadaDeLaTraza[];
  /** Balance: la respuesta del asistente y la intención que se espera. */
  respuesta?: string;
  intencion?: string;
  /** Relevancia: la consulta, los candidatos y cuál debería salir primero. */
  consulta?: string;
  candidatos?: string[];
  primero?: string;
}

interface Banco {
  juicio: string;
  nota: string;
  /** `true` si el fallo CARO es dejar pasar lo que debía frenarse. */
  caroSiSePasa?: boolean;
  casos: Caso[];
}

/**
 * Cada juicio del banco sabe armar su petición desde un caso, con qué umbral se
 * lee y cómo se llaman sus dos etiquetas. Añadir un juicio nuevo es añadir una
 * entrada aquí y un fichero en `casos/`: mismo método, mismo script.
 */
const JUICIOS: Record<
  string,
  {
    construir: (caso: Caso) => PeticionDeJuicio | null;
    umbral: number;
    si: string;
    no: string;
    /**
     * Cómo se lee la probabilidad de un caso. Por defecto es el noul de la
     * única pregunta; un juicio con varias preguntas —o con un `Choice`— dice
     * aquí qué número es el que se mide.
     */
    leer?: (answers: Record<string, unknown>, caso: Caso) => number | null;
  }
> = {
  pertinencia: {
    construir: (caso) =>
      construirPertinencia({
        mensaje: caso.mensaje ?? '',
        recientes: caso.recientes,
      }),
    umbral: UMBRAL_PERTINENCIA,
    si: 'atender',
    no: 'rechazar',
  },
  correspondencia: {
    construir: (caso) =>
      construirCorrespondencia({
        servicios: caso.servicios ?? [],
        fecha: caso.fecha ?? '',
        hora: caso.hora ?? '',
        recientes: caso.recientes,
      }),
    umbral: UMBRAL_CORRESPONDENCIA,
    si: 'corresponde',
    no: 'desviada',
  },
  progreso: {
    construir: (caso) =>
      construirProgreso({
        peticion: caso.peticion ?? '',
        traza: caso.traza ?? [],
      }),
    umbral: UMBRAL_PROGRESO,
    si: 'avanza',
    no: 'atascado',
  },
  /**
   * El juicio diferido. No tiene umbral que calibrar —el `Choice` solo cuenta
   * intenciones y no decide nada—, así que lo que se mide aquí es otra cosa:
   * cuánta probabilidad le da el modelo a la intención CORRECTA. Sirve para
   * saber si la telemetría va a decir algo o va a ser ruido.
   */
  balance: {
    construir: (caso) =>
      construirBalance({
        peticion: caso.peticion ?? '',
        respuesta: caso.respuesta ?? '',
        traza: caso.traza ?? [],
      }),
    umbral: 0.5,
    si: 'acierta',
    no: 'falla',
    leer: (answers, caso) => {
      const elegida = answers.intencion as {
        choice?: unknown;
        probabilities?: Record<string, number>;
      };
      const esperada = caso.intencion ?? '';
      const prob = Number(elegida?.probabilities?.[esperada] ?? NaN);
      return Number.isFinite(prob)
        ? prob
        : elegida?.choice === esperada
          ? 1
          : 0;
    },
  },
  /**
   * La reordenación por relevancia. Tampoco tiene umbral que calibrar: lo que
   * importa no es una probabilidad sino una POSICIÓN —«ante una pregunta
   * concreta, el servicio evidente debe salir primero»—, así que se mide 1 o 0
   * según si la reordenación lo pone en cabeza. La media por clase es entonces
   * la tasa de acierto.
   */
  relevancia: {
    construir: (caso) =>
      construirRelevancia({
        consulta: caso.consulta ?? '',
        candidatos: caso.candidatos ?? [],
      }),
    umbral: 0.5,
    si: 'primero',
    no: 'falla',
    leer: (answers, caso) => {
      const candidatos = caso.candidatos ?? [];
      const asked = candidatos.map((_c, i) => `r${i}`);
      const probs = leerRelevancia(answers, asked);
      const ordenados = ordenarPorRelevancia(candidatos, probs);
      return ordenados[0] === caso.primero ? 1 : 0;
    },
  },
};

/**
 * La clave, por este orden: `TYPESAFE_API_KEY` —el nombre que usa producción, y
 * el que el SDK del proveedor lee por defecto—, `TYPESAFE_KEY` —el de la
 * extensión donde nacieron estas convenciones— y el fichero
 * `~/.config/typesafe/key`.
 *
 * El fichero se lee dentro de un `try`: sin él, la excepción de `readFileSync`
 * salía cruda («ENOENT …») en vez del mensaje que explica qué falta.
 */
function leerClave(): string {
  const delEntorno = process.env.TYPESAFE_API_KEY ?? process.env.TYPESAFE_KEY;
  let clave = (delEntorno ?? '').trim();
  if (!clave) {
    try {
      clave = readFileSync(
        join(homedir(), '.config/typesafe/key'),
        'utf8',
      ).trim();
    } catch {
      clave = '';
    }
  }
  if (!clave) {
    throw new Error(
      'sin clave: define TYPESAFE_API_KEY (o TYPESAFE_KEY) o crea ~/.config/typesafe/key',
    );
  }
  return clave;
}

async function preguntar(
  clave: string,
  modelo: string,
  peticion: PeticionDeJuicio,
): Promise<{
  answers: Record<string, unknown>;
  modelo: string;
  entrada: number;
  ms: number;
}> {
  const empezo = Date.now();
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${clave}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelo,
      state: peticion.state,
      questions: peticion.questions,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text()}`);
  const json = (await res.json()) as {
    answers?: Record<string, unknown>;
    model?: string;
    usage?: { input_tokens?: number };
  };
  return {
    answers: json.answers ?? {},
    modelo: json.model ?? modelo,
    entrada: json.usage?.input_tokens ?? 0,
    ms: Date.now() - empezo,
  };
}

/**
 * Percentil **interpolado** sobre una muestra ya ordenada de menor a mayor.
 *
 * Interpola a propósito. La versión anterior tomaba `ceil(p/100 · n) - 1`, que
 * para cualquier `n <= 20` apunta al último elemento: el «p95» de dieciocho
 * medidas era «la peor de dieciocho». Con muestras de diez a treinta casos
 * —las de este banco— eso exageraba la cifra justo en un número que acaba
 * citado en la tesis.
 */
export const percentil = (ordenada: number[], p: number): number => {
  if (!ordenada.length) return 0;
  if (ordenada.length === 1) return ordenada[0];
  const exacta = (p / 100) * (ordenada.length - 1);
  const indice = Math.min(ordenada.length - 2, Math.max(0, Math.floor(exacta)));
  const fraccion = exacta - indice;
  return (
    ordenada[indice] + fraccion * (ordenada[indice + 1] - ordenada[indice])
  );
};

const dosDecimales = (n: number) => n.toFixed(2).padStart(5);

async function main(): Promise<void> {
  const juicio =
    process.argv[2] && !process.argv[2].startsWith('--')
      ? process.argv[2]
      : 'pertinencia';
  const iModelo = process.argv.indexOf('--modelo');
  let modelo = iModelo > 0 ? process.argv[iModelo + 1] : MODELO_POR_DEFECTO;

  const definicion = JUICIOS[juicio];
  if (!definicion) {
    throw new Error(
      `juicio desconocido: ${juicio}. Conocidos: ${Object.keys(JUICIOS).join(', ')}`,
    );
  }
  const { construir, umbral, si: ETIQUETA_SI, no: ETIQUETA_NO } = definicion;
  const rutaCasos = join(__dirname, 'casos', `${juicio}.json`);
  const banco = JSON.parse(readFileSync(rutaCasos, 'utf8')) as Banco;
  const clave = leerClave();

  console.log(
    `\n=== ${juicio} · ${banco.casos.length} casos · modelo ${modelo}`,
  );
  console.log(`=== umbral por defecto en el código: ${umbral}`);
  console.log(
    `=== el fallo CARO es ${banco.caroSiSePasa ? 'el falso pase' : 'el falso rechazo'}\n`,
  );

  const resultados: (Caso & { prob: number | null; ms: number | null })[] = [];
  let entradaTotal = 0;
  let modeloReal = modelo;
  let reintentado = false;

  for (const caso of banco.casos) {
    const peticion = construir(caso);
    if (!peticion) {
      console.log(
        `  ·       ${caso.clase.padEnd(18)} ${caso.por}: el código ya decidió (no se pregunta)`,
      );
      resultados.push({ ...caso, prob: null, ms: null });
      continue;
    }
    let respuesta;
    try {
      respuesta = await preguntar(clave, modelo, peticion);
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      if (!reintentado && /model/i.test(mensaje)) {
        // El id fijo ya no existe: se reintenta con el móvil y el informe lo dice.
        reintentado = true;
        modelo = 'jev-latest';
        console.log(
          `  (el modelo fijo no está disponible; se reintenta con ${modelo})`,
        );
        respuesta = await preguntar(clave, modelo, peticion);
      } else {
        throw error;
      }
    }
    modeloReal = respuesta.modelo;
    entradaTotal += respuesta.entrada;
    const prob = definicion.leer
      ? definicion.leer(respuesta.answers, caso)
      : probabilidadNoul(respuesta.answers[peticion.asked[0]]);
    resultados.push({ ...caso, prob, ms: respuesta.ms });

    const conUmbral = prob === null ? null : prob >= umbral;
    const acierta =
      conUmbral === null ? null : conUmbral === (caso.esperado === ETIQUETA_SI);
    const marca = acierta === null ? '  ?' : acierta ? '  ✓' : '  ✗';
    console.log(
      `${marca} ${prob === null ? '  —  ' : dosDecimales(prob)}  ${String(
        respuesta.ms,
      ).padStart(4)} ms  ${caso.clase.padEnd(18)} ${caso.por}${
        caso.mensaje ? ` · «${caso.mensaje}»` : ''
      }`,
    );
  }

  // --- Barrido de umbrales: qué error se comete con cada listón.
  console.log('\n--- Barrido de umbrales\n');
  console.log('  umbral   falsos rechazos   falsos pases');
  const nSi = resultados.filter((r) => r.esperado === ETIQUETA_SI).length;
  const nNo = resultados.filter((r) => r.esperado === ETIQUETA_NO).length;
  const barrido = UMBRALES.map((candidato) => {
    const falsosRechazos = resultados.filter(
      (r) =>
        r.esperado === ETIQUETA_SI && r.prob !== null && r.prob < candidato,
    );
    const falsosPases = resultados.filter(
      (r) =>
        r.esperado === ETIQUETA_NO && r.prob !== null && r.prob >= candidato,
    );
    console.log(
      `  ${candidato.toFixed(2).padStart(5)}    ${String(
        falsosRechazos.length,
      ).padStart(
        7,
      )}/${nSi}         ${String(falsosPases.length).padStart(5)}/${nNo}`,
    );
    return {
      umbral: candidato,
      falsosRechazos: falsosRechazos.map((r) => r.por),
      falsosPases: falsosPases.map((r) => r.por),
    };
  });

  // --- Resumen por clase: la que importa es la clase de riesgo de cada juicio
  // («seguimiento» en pertinencia, «desviada» en correspondencia).
  console.log('\n--- Probabilidad por clase (mín / mediana / máx)\n');
  const porClase: Record<
    string,
    { min: number; mediana: number; max: number; n: number }
  > = {};
  for (const clase of [...new Set(resultados.map((r) => r.clase))]) {
    const probs = resultados
      .filter((r) => r.clase === clase && r.prob !== null)
      .map((r) => r.prob as number)
      .sort((a, b) => a - b);
    if (!probs.length) continue;
    const mediana = probs[Math.floor(probs.length / 2)];
    porClase[clase] = {
      min: probs[0],
      mediana,
      max: probs[probs.length - 1],
      n: probs.length,
    };
    console.log(
      `  ${clase.padEnd(18)} ${dosDecimales(probs[0])} / ${dosDecimales(mediana)} / ${dosDecimales(
        probs[probs.length - 1],
      )}   (${probs.length} casos)`,
    );
  }

  // --- Latencia: el dato que decide el timeout de la colocación que SÍ se nota
  // en el camino crítico (la verificación previa a reservar, T5). El único dato
  // publicado era 0,27 s con 54.000 caracteres; aquí el estado es diminuto.
  const latencias = resultados
    .map((r) => r.ms)
    .filter((ms): ms is number => ms !== null)
    .sort((a, b) => a - b);
  const latencia = {
    min: latencias[0] ?? 0,
    p50: percentil(latencias, 50),
    p95: percentil(latencias, 95),
    max: latencias[latencias.length - 1] ?? 0,
    n: latencias.length,
  };
  console.log(
    `\n--- Latencia de ida y vuelta (ms): mín ${latencia.min} · p50 ${latencia.p50} · p95 ${latencia.p95} · máx ${latencia.max}`,
  );

  const coste = (entradaTotal / 1_000_000) * PRECIO_ENTRADA_POR_MILLON;
  console.log(
    `\n${entradaTotal} tokens de entrada · $${coste.toFixed(6)} · modelo que respondió: ${modeloReal}\n`,
  );

  const informe = {
    juicio,
    fecha: new Date().toISOString(),
    modeloPedido: modelo,
    modeloQueRespondio: modeloReal,
    umbralEnElCodigo: umbral,
    caroSiSePasa: banco.caroSiSePasa ?? false,
    nota: banco.nota,
    entradaTotal,
    costeUsd: Number(coste.toFixed(8)),
    latencia,
    porClase,
    barrido,
    casos: resultados,
  };
  const iInforme = process.argv.indexOf('--informe');
  const ruta =
    iInforme > 0
      ? process.argv[iInforme + 1]
      : join(
          __dirname,
          'informes',
          // Con la hora, y no solo el día: dos tandas del mismo juicio en la
          // misma jornada son la forma de ver cuánto se mueve el modelo, y una
          // no puede pisar a la otra.
          `${juicio}-${new Date()
            .toISOString()
            .slice(0, 16)
            .replace('T', '-')
            .replace(':', '')}.json`,
        );
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, JSON.stringify(informe, null, 2) + '\n', 'utf8');
  console.log(`informe: ${ruta}\n`);
}

// Solo se ejecuta cuando este fichero ES el programa. Sin la guarda,
// importarlo —una prueba que quiera comprobar el cálculo del percentil, o el
// `dist/` que `nest build` produce— lanzaba la tanda entera contra la API.
if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
