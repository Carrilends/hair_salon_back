import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Service } from 'src/service/entities/service.entity';
import {
  ServiceCatalogPort,
  ServiceSnapshot,
} from '../../domain/ports/service-catalog.port';

/**
 * Adaptador secundario: implementa el puerto de catálogo consultando la entidad
 * `Service`. Devuelve snapshots (id, nombre, precio, duración) sin exponer el
 * resto del modelo de servicios al dominio de Reservas.
 */
@Injectable()
export class ServiceCatalogAdapter implements ServiceCatalogPort {
  constructor(
    @InjectRepository(Service)
    private readonly repo: Repository<Service>,
  ) {}

  async getSnapshots(serviceIds: string[]): Promise<ServiceSnapshot[]> {
    if (serviceIds.length === 0) return [];
    const rows = await this.repo.find({ where: { id: In(serviceIds) } });
    return rows.map((s) => ({
      id: s.id,
      name: s.name,
      price: Number(s.price),
      durationMinutes: s.duration,
    }));
  }
}
