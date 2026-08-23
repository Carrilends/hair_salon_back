import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Service } from 'src/service/entities/service.entity';
import {
  AssistantServiceSummary,
  ServiceCatalogQueryPort,
} from '../../domain/ports/service-catalog-query.port';

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
}
