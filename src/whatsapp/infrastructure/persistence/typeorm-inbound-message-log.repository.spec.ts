import { LessThan } from 'typeorm';
import { TypeOrmInboundMessageLog } from './typeorm-inbound-message-log.repository';

function repoConInsert(identifiers: unknown[]) {
  const capturado: { values?: unknown; ignorado?: boolean } = {};
  const qb: any = {
    insert: () => qb,
    into: () => qb,
    values: (v: unknown) => {
      capturado.values = v;
      return qb;
    },
    orIgnore: () => {
      capturado.ignorado = true;
      return qb;
    },
    execute: async () => ({ identifiers }),
  };
  return {
    capturado,
    repo: { createQueryBuilder: () => qb, delete: jest.fn(async () => ({})) },
  };
}

describe('TypeOrmInboundMessageLog.markProcessedIfNew', () => {
  it('la primera vez devuelve true y anota el mensaje', async () => {
    const { repo, capturado } = repoConInsert([{ waMessageId: 'wamid.A' }]);
    const sut = new TypeOrmInboundMessageLog(repo as never);

    await expect(
      sut.markProcessedIfNew('wamid.A', '573001112233'),
    ).resolves.toBe(true);
    expect(capturado.values).toEqual({
      waMessageId: 'wamid.A',
      waFrom: '573001112233',
    });
  });

  it('la reentrega del mismo mensaje devuelve false', async () => {
    // Meta reenvía con backoff durante días si algo va mal. Sin esto, la clienta
    // recibiría tres «tu cita quedó cancelada» seguidos.
    const { repo } = repoConInsert([]);
    const sut = new TypeOrmInboundMessageLog(repo as never);

    await expect(
      sut.markProcessedIfNew('wamid.A', '573001112233'),
    ).resolves.toBe(false);
  });

  it('decide y registra en la MISMA operación, no con un findOne previo', async () => {
    // Con leer-y-luego-escribir, dos reentregas simultáneas leerían «no existe»
    // las dos. `ON CONFLICT DO NOTHING` lo resuelve en la base.
    const { repo, capturado } = repoConInsert([{ waMessageId: 'wamid.A' }]);
    const sut = new TypeOrmInboundMessageLog(repo as never);

    await sut.markProcessedIfNew('wamid.A', '573001112233');

    expect(capturado.ignorado).toBe(true);
  });
});

describe('TypeOrmInboundMessageLog.deleteOlderThan', () => {
  it('borra lo anterior al corte', async () => {
    const { repo } = repoConInsert([]);
    const sut = new TypeOrmInboundMessageLog(repo as never);
    const corte = new Date('2026-08-01T00:00:00.000Z');

    await sut.deleteOlderThan(corte);

    expect(repo.delete).toHaveBeenCalledWith({ receivedAt: LessThan(corte) });
  });
});
