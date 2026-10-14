import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ImageManager } from 'src/images/images.entity';
import { ServiceImagesPort } from '../../domain/ports/service-images.port';

/**
 * Adaptador secundario del puerto de fotos: una sola consulta por reserva
 * creada, que es lo que la creación espera antes de responder (los avisos van
 * en línea), así que no puede crecer con el número de servicios.
 */
@Injectable()
export class ServiceImagesAdapter implements ServiceImagesPort {
  constructor(
    @InjectRepository(ImageManager)
    private readonly repo: Repository<ImageManager>,
  ) {}

  async findImageUrls(serviceIds: string[]): Promise<Map<string, string[]>> {
    // Sin ids no hay nada que consultar (y `IN ()` sería SQL inválido).
    if (serviceIds.length === 0) return new Map();

    // `isPrincipal` se asigna al azar al subir y el modelo permite varias o
    // ninguna, así que se devuelven todas con la principal delante y la
    // elección se hace fuera, donde se sabe qué URL acepta Meta.
    const rows = await this.repo
      .createQueryBuilder('i')
      .innerJoin('i.service', 's')
      .select('s.id', 'serviceId')
      .addSelect('i.url', 'url')
      .where('s.id IN (:...serviceIds)', { serviceIds })
      .orderBy('i.isPrincipal', 'DESC')
      // Desempate estable: con varias principales (o ninguna), la misma
      // reserva tiene que dar siempre la misma foto.
      .addOrderBy('i.id', 'ASC')
      .getRawMany<{ serviceId: string; url: string }>();

    const porServicio = new Map<string, string[]>();
    for (const row of rows) {
      const urls = porServicio.get(row.serviceId) ?? [];
      urls.push(row.url);
      porServicio.set(row.serviceId, urls);
    }
    return porServicio;
  }
}
