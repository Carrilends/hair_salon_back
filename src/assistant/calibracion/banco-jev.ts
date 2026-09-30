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
 * La clave sale de `TYPESAFE_KEY` o de `~/.config/typesafe/key` (una línea) y
 * **nunca se imprime**. Coste: ~300 tokens de entrada por caso a
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
  UMBRAL_PERTINENCIA,
  construirPertinencia,
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

type Esperado = 'atender' | 'rechazar';

interface Caso {
  clase: string;
  por: string;
  esperado: Esperado;
  mensaje: string;
  recientes?: MensajeReciente[];
}

interface Banco {
  juicio: string;
  nota: string;
  casos: Caso[];
}

/** Cada juicio del banco sabe armar su petición desde un caso. */
const CONSTRUCTORES: Record<string, (caso: Caso) => PeticionDeJuicio | null> = {
  pertinencia: (caso) =>
    construirPertinencia({
      mensaje: caso.mensaje,
      recientes: caso.recientes,
    }),
};

function leerClave(): string {
  const clave = (
    process.env.TYPESAFE_KEY ??
    readFileSync(join(homedir(), '.config/typesafe/key'), 'utf8')
  ).trim();
  if (!clave)
    throw new Error('sin clave: ni TYPESAFE_KEY ni ~/.config/typesafe/key');
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

/** Percentil sobre una muestra ya ordenada de menor a mayor. */
const percentil = (ordenada: number[], p: number): number =>
  ordenada.length
    ? ordenada[
        Math.min(
          ordenada.length - 1,
          Math.ceil((p / 100) * ordenada.length) - 1,
        )
      ]
    : 0;

const dosDecimales = (n: number) => n.toFixed(2).padStart(5);

async function main(): Promise<void> {
  const juicio =
    process.argv[2] && !process.argv[2].startsWith('--')
      ? process.argv[2]
      : 'pertinencia';
  const iModelo = process.argv.indexOf('--modelo');
  let modelo = iModelo > 0 ? process.argv[iModelo + 1] : MODELO_POR_DEFECTO;

  const construir = CONSTRUCTORES[juicio];
  if (!construir) {
    throw new Error(
      `juicio desconocido: ${juicio}. Conocidos: ${Object.keys(CONSTRUCTORES).join(', ')}`,
    );
  }
  const rutaCasos = join(__dirname, 'casos', `${juicio}.json`);
  const banco = JSON.parse(readFileSync(rutaCasos, 'utf8')) as Banco;
  const clave = leerClave();

  console.log(
    `\n=== ${juicio} · ${banco.casos.length} casos · modelo ${modelo}`,
  );
  console.log(`=== umbral por defecto en el código: ${UMBRAL_PERTINENCIA}\n`);

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
    const prob = probabilidadNoul(respuesta.answers[peticion.asked[0]]);
    resultados.push({ ...caso, prob, ms: respuesta.ms });

    const conUmbral = prob === null ? null : prob >= UMBRAL_PERTINENCIA;
    const acierta =
      conUmbral === null ? null : conUmbral === (caso.esperado === 'atender');
    const marca = acierta === null ? '  ?' : acierta ? '  ✓' : '  ✗';
    console.log(
      `${marca} ${prob === null ? '  —  ' : dosDecimales(prob)}  ${String(respuesta.ms).padStart(4)} ms  ${caso.clase.padEnd(18)} ${caso.por} · «${caso.mensaje}»`,
    );
  }

  // --- Barrido de umbrales: qué error se comete con cada listón.
  console.log(
    '\n--- Barrido de umbrales (el error CARO es el falso rechazo)\n',
  );
  console.log('  umbral   falsos rechazos   falsos pases');
  const barrido = UMBRALES.map((umbral) => {
    const falsosRechazos = resultados.filter(
      (r) => r.esperado === 'atender' && r.prob !== null && r.prob < umbral,
    );
    const falsosPases = resultados.filter(
      (r) => r.esperado === 'rechazar' && r.prob !== null && r.prob >= umbral,
    );
    console.log(
      `  ${umbral.toFixed(2).padStart(5)}    ${String(falsosRechazos.length).padStart(7)}/${
        resultados.filter((r) => r.esperado === 'atender').length
      }         ${String(falsosPases.length).padStart(5)}/${
        resultados.filter((r) => r.esperado === 'rechazar').length
      }`,
    );
    return {
      umbral,
      falsosRechazos: falsosRechazos.map((r) => r.mensaje),
      falsosPases: falsosPases.map((r) => r.mensaje),
    };
  });

  // --- Resumen por clase: la clase que importa es «seguimiento».
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
    umbralEnElCodigo: UMBRAL_PERTINENCIA,
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
          `${juicio}-${new Date().toISOString().slice(0, 10)}.json`,
        );
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, JSON.stringify(informe, null, 2) + '\n', 'utf8');
  console.log(`informe: ${ruta}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
