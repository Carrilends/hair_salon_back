import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Service } from 'src/service/entities/service.entity';
import {
  AssistantServiceSummary,
  ServiceCatalogQueryPort,
} from '../../domain/ports/service-catalog-query.port';
import {
  groupCandidatesByTag,
  TaggedServiceRow,
} from './group-candidates-by-tag';

/**
 * Adaptador secundario: busca servicios por nombre y proyecta solo lo que el
 * asistente necesita (§6.2). Nunca toca `Detail` (descripción/`specifications`).
 */
@Injectable()
export class ServiceCatalogQueryAdapter implements ServiceCatalogQueryPort {
  constructor(
    @InjectRepository(Service)
    private readonly repo: Repository<Service>,
  ) {}

  async search(
    text: string | undefined,
    limit: number,
  ): Promise<AssistantServiceSummary[]> {
    const qb = this.repo
      .createQueryBuilder('s')
      .select(['s.id', 's.name', 's.price', 's.duration'])
      .orderBy('s.name', 'ASC')
      .take(limit);
    const term = text?.trim();
    if (term) {
      qb.where('s.name ILIKE :term', { term: `%${term}%` });
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
}
