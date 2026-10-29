import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { UnitOfWorkPort } from '../../domain/ports/unit-of-work.port';

@Injectable()
export class TypeOrmUnitOfWorkAdapter implements UnitOfWorkPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  run<T>(work: (tx: EntityManager) => Promise<T>): Promise<T> {
    // `transaction` hace BEGIN, COMMIT si `work` resuelve y ROLLBACK si lanza.
    return this.dataSource.transaction(work);
  }
}
