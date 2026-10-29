import { EntityManager } from 'typeorm';

/**
 * Abre una transacción desde la capa de aplicación sin que esta conozca el
 * `DataSource`. Todo lo que `work` haga con el `tx` recibido se confirma junto
 * o, si lanza, se revierte junto; el error sube tal cual.
 */
export interface UnitOfWorkPort {
  run<T>(work: (tx: EntityManager) => Promise<T>): Promise<T>;
}
