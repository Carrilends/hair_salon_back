import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Service } from 'src/service/entities/service.entity';
import {
  AssistantServiceSummary,
  ServiceCatalogQueryPort,
  ServiceSearchCriteria,
} from '../../domain/ports/service-catalog-query.port';
import {
  groupCandidatesByTag,
  TaggedServiceRow,
} from './group-candidates-by-tag';
import { ADJETIVOS_DE_PRECIO } from '../../domain/price-intent';

/**
 * Pliega los diacríticos del español. Se aplica a **los dos lados** de la
 * comparación: quien teclea desde el móvil escribe «unas» y espera «Uñas», y el
 * catálogo no puede ignorarlo en silencio.
 */
function sinDiacriticos(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * El mismo plegado, pero dentro de Postgres. `translate()` es nativo: `unaccent`
 * obligaría a `CREATE EXTENSION` y a una migración, y el catálogo son ciento
 * sesenta filas, así que perder el índice no cuesta nada medible.
 */
const CON_TILDES = 'áéíóúüñÁÉÍÓÚÜÑ';
const SIN_TILDES = 'aeiouunAEIOUUN';
const plegada = (columna: string) =>
  `translate(${columna}, '${CON_TILDES}', '${SIN_TILDES}')`;

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

function etiquetasDeGenero(genero: string | undefined): string[] {
  const clave = sinDiacriticos((genero ?? '').trim().toLowerCase());
  return ETIQUETAS_POR_GENERO.get(clave) ?? [];
}

/** Lo que el texto libre de la clienta resulta significar. */
interface BusquedaAnalizada {
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
function analizarBusqueda(texto: string | undefined): BusquedaAnalizada {
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

/**
 * Adaptador secundario: busca servicios por nombre, etiqueta, género y precio, y
 * proyecta solo lo que el asistente necesita (§6.2). Nunca toca `Detail`
 * (descripción/`specifications`).
 */
@Injectable()
export class ServiceCatalogQueryAdapter implements ServiceCatalogQueryPort {
  constructor(
    @InjectRepository(Service)
    private readonly repo: Repository<Service>,
  ) {}

  async search(
    criteria: ServiceSearchCriteria,
    limit: number,
  ): Promise<AssistantServiceSummary[]> {
    const analisis = analizarBusqueda(criteria.texto);

    // Precedencia del género: manda el parámetro explícito **cuando el catálogo
    // lo reconoce**; el deducido del texto solo actúa si aquel falta o si el
    // modelo emitió una variante inexistente («masculino»), donde quedarse sin
    // ningún filtro sería peor que usar el que la clienta escribió.
    const explicito = etiquetasDeGenero(criteria.genero);
    const etiquetasGenero =
      explicito.length > 0 ? explicito : etiquetasDeGenero(analisis.genero);

    const filas = await this.ejecutar(
      [...analisis.palabras, ...analisis.ambiguas],
      etiquetasGenero,
      criteria.precioMaximo,
      analisis.porPrecio,
      limit,
    );

    // Segundo intento soltando las ambiguas: «unas mechas» no puede volver vacía
    // porque ahí «unas» era el artículo. Se exige que quede al menos una palabra
    // con contenido, de modo que «unas» sola siga significando uñas y ninguna
    // consulta degrade a «sin filtro» sin que se note.
    const conviene =
      filas.length === 0 &&
      analisis.ambiguas.length > 0 &&
      analisis.palabras.length > 0;
    if (!conviene) return filas;

    return this.ejecutar(
      analisis.palabras,
      etiquetasGenero,
      criteria.precioMaximo,
      analisis.porPrecio,
      limit,
    );
  }

  /** Una pasada de la consulta con el juego de palabras que se le entregue. */
  private async ejecutar(
    palabras: string[],
    etiquetasGenero: string[],
    precioMaximo: number | undefined,
    porPrecio: boolean,
    limit: number,
  ): Promise<AssistantServiceSummary[]> {
    const qb = this.repo
      .createQueryBuilder('s')
      .select(['s.id', 's.name', 's.price', 's.duration'])
      .take(limit);

    // Una frase natural («corte para hombre») no es una subcadena del catálogo:
    // se parte en palabras y se exige que **todas** encajen, cada una por nombre
    // **o** por etiqueta, comparando sin diacríticos a ambos lados. Quien
    // pregunta por «corte» quiere «Taper fade», que no lleva la palabra en el
    // nombre pero sí en su etiqueta. Se usa EXISTS y no un JOIN para que un
    // servicio con varias etiquetas coincidentes no se duplique y `take` siga
    // comportándose como un LIMIT limpio.
    palabras.forEach((palabra, i) => {
      qb.andWhere(
        `(${plegada('s.name')} ILIKE :palabra${i} OR EXISTS (
            SELECT 1 FROM service_tags_tag st
            INNER JOIN tag t ON t.id = st."tagId"
            WHERE st."serviceId" = s.id AND ${plegada('t.name')} ILIKE :palabra${i}
          ))`,
        { [`palabra${i}`]: `%${palabra}%` },
      );
    });

    if (etiquetasGenero.length > 0) {
      qb.andWhere(
        `EXISTS (
            SELECT 1 FROM service_tags_tag sg
            INNER JOIN tag g ON g.id = sg."tagId"
            WHERE sg."serviceId" = s.id AND g.name IN (:...generos)
          )`,
        { generos: etiquetasGenero },
      );
    }

    if (typeof precioMaximo === 'number' && Number.isFinite(precioMaximo)) {
      qb.andWhere('s.price <= :precioMaximo', { precioMaximo });
    }

    if (porPrecio) {
      // Pedir «algo barato» **sustituye** la precedencia por nombre, no la
      // pospone: con el tope de ocho de RF56, posponerla dejaba fuera el
      // esmaltado de 20.000 detrás de las acrílicas de 78.000, que es justo lo
      // contrario de lo que se pidió. Que una coincidencia sea de nombre o de
      // etiqueta es detalle interno; el precio es lo que la clienta enunció.
      qb.orderBy('s.price', 'ASC').addOrderBy('s.name', 'ASC');
    } else if (palabras.length > 0) {
      // Sin criterio de precio el orden sigue siendo la intención literal:
      // primero lo que coincide por nombre.
      const todasEnNombre = palabras
        .map((_, i) => `${plegada('s.name')} ILIKE :palabra${i}`)
        .join(' AND ');
      qb.orderBy(
        `CASE WHEN ${todasEnNombre} THEN 0 ELSE 1 END`,
        'ASC',
      ).addOrderBy('s.name', 'ASC');
    } else {
      qb.orderBy('s.name', 'ASC');
    }

    const rows = await qb.getMany();
    return rows.map((s) => ({
      id: s.id,
      name: s.name,
      price: Number(s.price),
      durationMinutes: s.duration,
    }));
  }

  async findByTagNames(
    tagNames: string[],
    limitPerTag: number,
  ): Promise<Map<string, AssistantServiceSummary[]>> {
    // Sin etiquetas no hay nada que consultar (y `IN ()` sería SQL inválido).
    if (tagNames.length === 0) return new Map();

    // Un join servicio↔etiqueta filtrado por los nombres pedidos. Una fila por
    // cada par (servicio, etiqueta coincidente): un servicio con dos etiquetas
    // pedidas es candidato en ambas. El agrupado, orden y capado los hace la
    // función pura del dominio.
    const rows = await this.repo
      .createQueryBuilder('s')
      .innerJoin('s.tags', 't')
      .where('t.name IN (:...names)', { names: tagNames })
      .orderBy('s.price', 'ASC')
      .select('s.id', 'id')
      .addSelect('s.name', 'name')
      .addSelect('s.price', 'price')
      .addSelect('s.duration', 'duration')
      .addSelect('t.name', 'tagName')
      .getRawMany<TaggedServiceRow>();

    return groupCandidatesByTag(rows, tagNames, limitPerTag);
  }

  async findPrincipalImages(ids: string[]): Promise<Map<string, string>> {
    // Sin ids no hay nada que consultar (y `IN ()` sería SQL inválido).
    if (ids.length === 0) return new Map();

    // Se ordena por `isPrincipal` descendente y se queda la primera de cada
    // servicio: hoy el catálogo sembrado tiene exactamente una imagen por
    // servicio y todas marcadas como principal, pero el modelo de datos permite
    // varias y ninguna, así que la consulta no puede dar por hecho ni una cosa
    // ni la otra. Se descarta la URL por defecto de la columna ('/'), que
    // significa «sin imagen» y rompería la miniatura.
    const rows = await this.repo
      .createQueryBuilder('s')
      .innerJoin('s.images', 'i')
      .where('s.id IN (:...ids)', { ids })
      .andWhere("i.url <> '/' AND i.url <> ''")
      .orderBy('i.isPrincipal', 'DESC')
      .select('s.id', 'id')
      .addSelect('i.url', 'url')
      .getRawMany<{ id: string; url: string }>();

    const porServicio = new Map<string, string>();
    for (const row of rows) {
      if (!porServicio.has(row.id)) porServicio.set(row.id, row.url);
    }
    return porServicio;
  }

  async findNamesByIds(ids: string[]): Promise<Map<string, string>> {
    // Sin ids no hay nada que consultar (y `IN ()` sería SQL inválido).
    if (ids.length === 0) return new Map();

    const rows = await this.repo.find({
      where: { id: In(ids) },
      select: ['id', 'name'],
    });
    return new Map(rows.map((row) => [row.id, row.name]));
  }
}
