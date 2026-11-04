import { ADJETIVOS_DE_PRECIO } from './price-intent';

/**
 * Pliega los diacríticos del español. Se aplica a **los dos lados** de la
 * comparación: quien teclea desde el móvil escribe «unas» y espera «Uñas», y el
 * catálogo no puede ignorarlo en silencio.
 */
export function sinDiacriticos(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Palabras con las que la clienta envuelve la petición y que no existen ni como
 * nombre ni como etiqueta: artículos y muletillas. Exigirlas dejaba la búsqueda
 * vacía («algo para las uñas» no devolvía nada). Se comparan ya plegadas, así
 * que basta la forma sin tilde («que» cubre «qué»).
 *
 * «unas» **no** está aquí: plegada colisiona con «uñas», la palabra más buscada
 * del catálogo (defecto 1). Vive en `PALABRAS_AMBIGUAS`. «unos» sí, porque nada
 * del catálogo se pliega a «unos» —verificado contra la BD sembrada— y «una»
 * también, porque el singular «uña» no nombra ningún servicio.
 */
const PALABRAS_VACIAS = new Set([
  'algo',
  'alguna',
  'algunas',
  'alguno',
  'algunos',
  'buenas',
  'buenos',
  'busco',
  'como',
  'con',
  'cual',
  'cuanto',
  'cuesta',
  'cuestan',
  'dame',
  'del',
  'desde',
  'eso',
  'esta',
  'estas',
  'este',
  'esto',
  'estos',
  'favor',
  'gracias',
  'hacer',
  'hay',
  'hola',
  'las',
  'los',
  'mas',
  'mis',
  'muy',
  'necesita',
  'necesito',
  'opcion',
  'opciones',
  'para',
  'pero',
  'por',
  'precio',
  'precios',
  'presupuesto',
  'puede',
  'puedes',
  'que',
  'quiero',
  'quisiera',
  'servicio',
  'servicios',
  'sobre',
  'sus',
  'tengo',
  'tiene',
  'tienen',
  'tipo',
  'tipos',
  'todo',
  'una',
  'unos',
  'ver',
]);

// Los adjetivos de precio (las formas que antes vivían en `PALABRAS_VACIAS`,
// reclasificadas) se movieron al dominio: desde el plan 04 los necesita también
// la capa de aplicación, para no reordenar por relevancia cuando la clienta ya
// dijo cómo quería el orden. Dos listas que se desincronicen sería peor.

/**
 * Palabras que unas veces son artículo y otras son el servicio. Solo «unas»:
 * plegada vale para «uñas» («unas acrílicas») y para el artículo («unas
 * mechas»). Se exige primero y se suelta solo si la respuesta vendría vacía.
 */
const PALABRAS_AMBIGUAS = new Set(['unas']);

/** Menos de tres letras nunca discrimina nada en este catálogo («de», «el», «mi»). */
const LONGITUD_MINIMA = 3;

/**
 * Etiquetas que satisfacen un género. «Hombre» y «Mujer» arrastran los
 * «Unisex» —un corte unisex sirve a ambos—, pero «Niños» no: lo que se ofrece a
 * un adulto no vale para un niño. Se acepta la forma que el modelo emita
 * («ninos», «NIÑOS»); un género desconocido ignora el filtro en vez de vaciar la
 * respuesta.
 */
const ETIQUETAS_POR_GENERO = new Map<string, string[]>([
  ['hombre', ['Hombre', 'Unisex']],
  ['mujer', ['Mujer', 'Unisex']],
  ['unisex', ['Unisex']],
  ['ninos', ['Niños']],
  ['nino', ['Niños']],
  ['nina', ['Niños']],
  ['ninas', ['Niños']],
]);

export function etiquetasDeGenero(genero: string | undefined): string[] {
  const clave = sinDiacriticos((genero ?? '').trim().toLowerCase());
  return ETIQUETAS_POR_GENERO.get(clave) ?? [];
}

/** Lo que el texto libre de la clienta resulta significar. */
export interface BusquedaAnalizada {
  /** Palabras con contenido: todas deben encajar. */
  palabras: string[];
  /** Palabras que podrían ser artículo; se sueltan solo si la respuesta vendría vacía. */
  ambiguas: string[];
  /** Público deducido del propio texto («corte para hombre»). */
  genero?: string;
  /** La clienta dijo «barato»: el orden pasa a ser por precio ascendente. */
  porPrecio: boolean;
}

/**
 * Parte la frase y clasifica cada palabra. Devolver `palabras` y `ambiguas`
 * vacías significa «sin texto»: una frase hecha solo de muletillas no debe
 * vaciar el catálogo. El género y el adjetivo de precio se extraen **antes** de
 * descartar nada, porque no son ruido: son criterios mal colocados.
 */
export function analizarBusqueda(texto: string | undefined): BusquedaAnalizada {
  const crudas = (texto ?? '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map(sinDiacriticos)
    .filter((palabra) => palabra.length >= LONGITUD_MINIMA);

  const palabras: string[] = [];
  const ambiguas: string[] = [];
  let genero: string | undefined;
  let porPrecio = false;

  for (const palabra of new Set(crudas)) {
    if (ADJETIVOS_DE_PRECIO.has(palabra)) {
      porPrecio = true;
      continue;
    }
    // El público escrito dentro de la búsqueda se comporta como el filtro de
    // género, unisex incluidos (defecto 3): «corte para hombre» no puede perder
    // los trece servicios unisex puros solo porque el modelo lo puso aquí. Si
    // llegan varios, manda el primero; ninguno se deja como palabra a exigir,
    // porque «hombre» literal solo encaja con la etiqueta homónima.
    if (ETIQUETAS_POR_GENERO.has(palabra)) {
      genero ??= palabra;
      continue;
    }
    if (PALABRAS_VACIAS.has(palabra)) continue;
    if (PALABRAS_AMBIGUAS.has(palabra)) {
      ambiguas.push(palabra);
      continue;
    }
    palabras.push(palabra);
  }

  return { palabras, ambiguas, genero, porPrecio };
}
