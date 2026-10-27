import { NotFoundException } from '@nestjs/common';
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
  let serviceRepo: Record<string, jest.Mock>;
  let imagesRepo: Record<string, jest.Mock>;
  let tags: { findByIds: jest.Mock };
  let images: { removeByExternalId: jest.Mock };
  let cloudinary: { deleteAssets: jest.Mock };
  let detailRepo: { delete: jest.Mock };

  beforeEach(async () => {
    serviceRepo = {
      create: jest.fn((x) => x),
      preload: jest.fn(async (x) => x),
      save: jest.fn(async (x) => x),
      findOne: jest.fn(),
      delete: jest.fn(),
    };
    imagesRepo = { find: jest.fn(async () => []) };
    tags = { findByIds: jest.fn(async () => []) };
    images = { removeByExternalId: jest.fn() };
    cloudinary = { deleteAssets: jest.fn() };
    detailRepo = { delete: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceService,
        { provide: getRepositoryToken(Service), useValue: serviceRepo },
        { provide: getRepositoryToken(Detail), useValue: detailRepo },
        { provide: getRepositoryToken(ImageManager), useValue: imagesRepo },
        { provide: TagsService, useValue: tags },
        { provide: ImagesService, useValue: images },
        { provide: CloudinaryService, useValue: cloudinary },
      ],
    }).compile();

    service = module.get<ServiceService>(ServiceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('crear', () => {
    it('crear con varias imágenes marca la primera como principal', async () => {
      await service.create({
        name: 'Corte',
        tags: [],
        images: [{ publicId: 'p1' }, { publicId: 'p2' }, { publicId: 'p3' }],
      } as never);

      const guardadas = serviceRepo.create.mock.calls[0][0].images;
      expect(guardadas.map((i) => i.isPrincipal)).toEqual([true, false, false]);
    });
  });

  describe('editar', () => {
    it('editar quitando la principal deja como principal una de las que quedan', async () => {
      imagesRepo.find.mockResolvedValue([
        { id: 'a', publicId: 'pa', isPrincipal: true },
        { id: 'b', publicId: 'pb', isPrincipal: false },
        { id: 'c', publicId: 'pc', isPrincipal: false },
      ]);

      await service.update('s-1', {
        images: [{ id: 'b' }, { id: 'c' }] as never,
      });

      expect(images.removeByExternalId).toHaveBeenCalledWith(['a'], ['pa']);
      const guardadas = serviceRepo.preload.mock.calls[0][0].images;
      expect(guardadas.map((i) => i.id)).toEqual(['b', 'c']);
      expect(guardadas.filter((i) => i.isPrincipal)).toHaveLength(1);
    });

    // Antes reventaba con 500: `images.filter` sobre `undefined`.
    it('sin imágenes ni etiquetas no toca ninguna de las dos', async () => {
      await service.update('s-1', { name: 'Corte nuevo' });

      expect(images.removeByExternalId).not.toHaveBeenCalled();
      const preload = serviceRepo.preload.mock.calls[0][0];
      expect(preload).toEqual({ id: 's-1', name: 'Corte nuevo' });
      expect(preload).not.toHaveProperty('images');
      expect(preload).not.toHaveProperty('tags');
    });

    it('con imágenes conserva la principal que ya había', async () => {
      imagesRepo.find.mockResolvedValue([
        { id: 'a', isPrincipal: false },
        { id: 'b', isPrincipal: true },
      ]);

      await service.update('s-1', {
        images: [{ id: 'a' }, { id: 'b' }] as never,
      });

      const guardadas = serviceRepo.preload.mock.calls[0][0].images;
      expect(guardadas.filter((i) => i.isPrincipal).map((i) => i.id)).toEqual([
        'b',
      ]);
    });
  });

  describe('borrar', () => {
    it('borrar llama a deleteAssets con los publicId de sus imágenes y después borra el servicio', async () => {
      serviceRepo.findOne.mockResolvedValue({
        id: 's-1',
        images: [{ publicId: 'pa' }, { publicId: 'pb' }],
        detail: null,
      });

      await service.remove('s-1');

      expect(cloudinary.deleteAssets).toHaveBeenCalledWith(['pa', 'pb']);
      expect(serviceRepo.delete).toHaveBeenCalledWith('s-1');
      expect(cloudinary.deleteAssets.mock.invocationCallOrder[0]).toBeLessThan(
        serviceRepo.delete.mock.invocationCallOrder[0],
      );
    });

    it('uno que no existe responde «no encontrado», no 500', async () => {
      serviceRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('no-existe')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(serviceRepo.delete).not.toHaveBeenCalled();
    });
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
