import { ServiceImagesAdapter } from './service-images.adapter';

function repoQueDevuelve(filas: { serviceId: string; url: string }[]) {
  const qb: Record<string, jest.Mock> = {};
  for (const m of ['innerJoin', 'select', 'addSelect', 'where', 'orderBy']) {
    qb[m] = jest.fn(() => qb);
  }
  qb.getRawMany = jest.fn(async () => filas);
  return { repo: { createQueryBuilder: jest.fn(() => qb) }, qb };
}

describe('ServiceImagesAdapter', () => {
  it('agrupa las URLs por servicio conservando el orden de la consulta', async () => {
    const { repo, qb } = repoQueDevuelve([
      { serviceId: 's1', url: 'principal-s1' },
      { serviceId: 's2', url: 'principal-s2' },
      { serviceId: 's1', url: 'otra-s1' },
    ]);
    const adapter = new ServiceImagesAdapter(repo as any);

    const resultado = await adapter.findImageUrls(['s1', 's2']);

    expect(resultado).toEqual(
      new Map([
        ['s1', ['principal-s1', 'otra-s1']],
        ['s2', ['principal-s2']],
      ]),
    );
    // La principal delante: el orden lo pone la base, no el código.
    expect(qb.orderBy).toHaveBeenCalledWith('i.isPrincipal', 'DESC');
  });

  it('no consulta la base si no hay servicios (IN () sería SQL inválido)', async () => {
    const { repo } = repoQueDevuelve([]);
    const adapter = new ServiceImagesAdapter(repo as any);

    expect(await adapter.findImageUrls([])).toEqual(new Map());
    expect(repo.createQueryBuilder).not.toHaveBeenCalled();
  });
});
