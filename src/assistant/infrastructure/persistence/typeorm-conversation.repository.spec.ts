import { TypeOrmConversationRepository } from './typeorm-conversation.repository';

/**
 * Reproduce lo que Postgres devuelve DE VERDAD en una agregación: `SUM` sobre
 * `integer` da `bigint` y `COUNT` da `bigint`, y el driver `pg` entrega los
 * `bigint` como **cadena**, no como número. Es la trampa de este código: sin
 * convertir, `'120' + '20'` sería `'12020'` y el techo diario de gasto no
 * saltaría jamás.
 *
 * Y sin filas en la ventana, `SUM` devuelve `NULL`: de ahí el `COALESCE`.
 */
function repoConAgregado(fila: Record<string, unknown> | undefined) {
  const capturado: { sql?: string; parametros?: unknown } = {};
  const qb: Record<string, unknown> = {};
  Object.assign(qb, {
    select: () => qb,
    addSelect: () => qb,
    where: (sql: string, params: unknown) => {
      capturado.sql = sql;
      capturado.parametros = params;
      return qb;
    },
    getRawOne: async () => fila,
  });
  return {
    capturado,
    mensajes: { createQueryBuilder: () => qb },
  };
}

describe('TypeOrmConversationRepository — agregados de gasto', () => {
  const desde = new Date('2026-09-29T05:00:00.000Z');

  it('sumTokensSince convierte las cadenas del driver en números y suma entrada y salida', async () => {
    const { mensajes } = repoConAgregado({ prompt: '1200', completion: '340' });
    const sut = new TypeOrmConversationRepository(
      {} as never,
      mensajes as never,
    );

    await expect(sut.sumTokensSince(desde)).resolves.toBe(1540);
  });

  it('sin mensajes en la ventana el gasto es cero, no NaN', async () => {
    const { mensajes } = repoConAgregado({ prompt: '0', completion: '0' });
    const sut = new TypeOrmConversationRepository(
      {} as never,
      mensajes as never,
    );

    await expect(sut.sumTokensSince(desde)).resolves.toBe(0);
  });

  it('una consulta que no devuelve fila cuenta como cero', async () => {
    const { mensajes } = repoConAgregado(undefined);
    const sut = new TypeOrmConversationRepository(
      {} as never,
      mensajes as never,
    );

    await expect(sut.sumTokensSince(desde)).resolves.toBe(0);
  });

  it('acota la suma a la ventana pedida', async () => {
    const { mensajes, capturado } = repoConAgregado({
      prompt: '1',
      completion: '1',
    });
    const sut = new TypeOrmConversationRepository(
      {} as never,
      mensajes as never,
    );

    await sut.sumTokensSince(desde);

    expect(capturado.sql).toContain('createdAt >=');
    expect(capturado.parametros).toEqual({ since: desde.toISOString() });
  });

  it('usageSince desglosa el gasto y cuenta mensajes y conversaciones', async () => {
    const { mensajes } = repoConAgregado({
      prompt: '1200',
      completion: '340',
      cached: '900',
      mensajes: '14',
      conversaciones: '3',
    });
    const sut = new TypeOrmConversationRepository(
      {} as never,
      mensajes as never,
    );

    await expect(sut.usageSince(desde)).resolves.toEqual({
      promptTokens: 1200,
      completionTokens: 340,
      // Lo cacheado es un DESGLOSE de la entrada, no un sumando: contarlo en el
      // total cobraría dos veces los mismos tokens.
      cachedTokens: 900,
      totalTokens: 1540,
      mensajes: 14,
      conversaciones: 3,
    });
  });
});
