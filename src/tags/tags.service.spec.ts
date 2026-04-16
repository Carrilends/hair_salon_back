import { Test, TestingModule } from '@nestjs/testing';
import { TagsService } from './tags.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Tag } from './entities/tag.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('TagsService', () => {
  let service: TagsService;
  const tagRepository = {
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TagsService,
        {
          provide: getRepositoryToken(Tag),
          useValue: tagRepository,
        },
      ],
    }).compile();

    service = module.get<TagsService>(TagsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByIds', () => {
    it('throws BadRequest when ids empty', async () => {
      await expect(service.findByIds([])).rejects.toThrow(BadRequestException);
    });

    it('throws NotFound when no tags found', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      tagRepository.createQueryBuilder.mockReturnValue(qb);

      await expect(service.findByIds(['id-1'])).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns tags when found', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: 'id-1' }]),
      };
      tagRepository.createQueryBuilder.mockReturnValue(qb);

      await expect(service.findByIds(['id-1'])).resolves.toEqual([
        { id: 'id-1' },
      ]);
    });
  });
});
