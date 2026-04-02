import { selectPrincipalImage } from './utils.images';

describe('selectPrincipalImage', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('marks exactly one image as principal', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.6);
    const images: any[] = [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }];

    const result = selectPrincipalImage(images as any);

    expect(result).toHaveLength(4);
    expect(result.filter((i) => i.isPrincipal)).toHaveLength(1);
  });

  it('is deterministic when Math.random is mocked', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const images: any[] = [{ id: '1' }, { id: '2' }, { id: '3' }];

    const result = selectPrincipalImage(images as any);

    expect(result[0].isPrincipal).toBe(true);
    expect(result[1].isPrincipal).toBe(false);
    expect(result[2].isPrincipal).toBe(false);
  });
});

