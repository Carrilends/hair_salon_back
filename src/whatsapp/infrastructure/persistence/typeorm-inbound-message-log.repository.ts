import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { InboundMessageLogPort } from '../../domain/ports/inbound-message-log.port';
import { InboundMessageOrmEntity } from './inbound-message.orm-entity';

@Injectable()
export class TypeOrmInboundMessageLog implements InboundMessageLogPort {
  constructor(
    @InjectRepository(InboundMessageOrmEntity)
    private readonly repo: Repository<InboundMessageOrmEntity>,
  ) {}

  async markProcessedIfNew(messageId: string, from: string): Promise<boolean> {
    // `ON CONFLICT DO NOTHING` hace que decidir y registrar sean la MISMA
    // operación atómica. Con un `findOne` seguido de un `save`, dos reentregas
    // simultáneas podrían leer «no existe» las dos y procesarse por duplicado.
    const result = await this.repo
      .createQueryBuilder()
      .insert()
      .into(InboundMessageOrmEntity)
      .values({ waMessageId: messageId, waFrom: from })
      .orIgnore()
      .execute();

    // Postgres devuelve las filas realmente insertadas: vacío = ya estaba.
    return (result.identifiers?.length ?? 0) > 0;
  }

  async deleteOlderThan(cutoff: Date): Promise<void> {
    await this.repo.delete({ receivedAt: LessThan(cutoff) });
  }
}
