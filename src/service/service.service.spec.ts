import { Test, TestingModule } from '@nestjs/testing';
import { ServiceService } from './service.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Service } from './entities/service.entity';
import { Detail } from 'src/detail/entities/detail.entity';
import { ImageManager } from 'src/images/images.entity';
import { TagsService } from 'src/tags/tags.service';
import { ImagesService } from 'src/images/images.service';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';

describe('ServiceService', () => {
  let service: ServiceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceService,
        { provide: getRepositoryToken(Service), useValue: {} },
        { provide: getRepositoryToken(Detail), useValue: {} },
        { provide: getRepositoryToken(ImageManager), useValue: {} },
        { provide: TagsService, useValue: { findByIds: jest.fn() } },
        { provide: ImagesService, useValue: { removeByExternalId: jest.fn() } },
        { provide: CloudinaryService, useValue: { deleteAssets: jest.fn() } },
      ],
    }).compile();

    service = module.get<ServiceService>(ServiceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('filtro de precio', () => {
    // `applyFilters` es privado: se le pasa un query builder de mentira que
    // solo apunta lo que se le pide.
    const qbFalso = () => ({ where: jest.fn(), andWhere: jest.fn() });
    const aplicar = (qb: ReturnType<typeof qbFalso>, filtro: object) =>
      (
        service as unknown as {
          applyFilters: (qb: unknown, filtro: object) => void;
        }
      ).applyFilters(qb, filtro);

    it('compara contra pesos, no contra los miles del control', () => {
      const qb = qbFalso();
      aplicar(qb, { includePriceRange: true, prices: { min: 30, max: 100 } });
      expect(qb.andWhere).toHaveBeenCalledWith(
        's.price BETWEEN :min AND :max',
        { min: 30000, max: 100000 },
      );
    });

    it('sin el interruptor no filtra por precio aunque llegue un rango', () => {
      const qb = qbFalso();
      aplicar(qb, { includePriceRange: false, prices: { min: 30, max: 100 } });
      expect(qb.andWhere).not.toHaveBeenCalled();
    });
  });
});
