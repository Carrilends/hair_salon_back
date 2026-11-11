import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  LegalNoticeLogPort,
  LegalNoticeRecord,
} from '../../domain/ports/legal-notice-log.port';
import { LegalNoticeOrmEntity } from './legal-notice.orm-entity';

@Injectable()
export class TypeOrmLegalNoticeLog implements LegalNoticeLogPort {
  constructor(
    @InjectRepository(LegalNoticeOrmEntity)
    private readonly repo: Repository<LegalNoticeOrmEntity>,
  ) {}

  async lastSent(
    phoneE164: string,
  ): Promise<Omit<LegalNoticeRecord, 'phoneE164'> | null> {
    const fila = await this.repo.findOneBy({ phoneE164 });
    return fila
      ? { sentAt: fila.enviadoEn, policyVersion: fila.versionPolitica }
      : null;
  }

  async recordSent(record: LegalNoticeRecord): Promise<void> {
    // `ON CONFLICT (phone_e164) DO UPDATE`: una fila por número, sin leer antes.
    await this.repo.upsert(
      {
        phoneE164: record.phoneE164,
        enviadoEn: record.sentAt,
        versionPolitica: record.policyVersion,
      },
      ['phoneE164'],
    );
  }
}
