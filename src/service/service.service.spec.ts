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
});
