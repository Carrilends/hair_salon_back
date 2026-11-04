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
import {
  analizarBusqueda,
  etiquetasDeGenero,
} from '../../domain/catalog-search';

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

  async findTagFamilies(tagNames: string[]): Promise<Map<string, string>> {
    if (tagNames.length === 0) return new Map();

    // Sube por `parentId` hasta la etiqueta raíz (parent nulo). Una raíz es su
    // propia familia. Solo lee; el significado de «familia» vive en la
    // herramienta, aquí únicamente se resuelve la jerarquía.
    const rows: { name: string; family: string }[] = await this.repo.query(
      `WITH RECURSIVE arriba AS (
         SELECT t.id, t.name AS origen, t."parentId", t.name AS raiz
         FROM tag t WHERE t.name = ANY($1)
         UNION ALL
         SELECT a.id, a.origen, p."parentId", p.name
         FROM arriba a JOIN tag p ON p.id = a."parentId"
       )
       SELECT origen AS name, raiz AS family FROM arriba WHERE "parentId" IS NULL`,
      [tagNames],
    );
    return new Map(rows.map((r) => [r.name, r.family]));
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
