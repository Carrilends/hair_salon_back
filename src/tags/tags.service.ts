import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { In, Repository } from 'typeorm';
import { Tag } from 'src/tags/entities/tag.entity';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import seedData from './seed/tag-seed.json'; // asegúrate de que este archivo exista
import { ID_GENDER_TAG } from './constants';
import { FilterTagValidator } from './validators/tag.validator';

@Injectable()
export class TagsService {
  constructor(
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
  ) {}

  async create(createTagDto: CreateTagDto): Promise<Tag> {
    const { name, childrenIds } = createTagDto;

    const newTag = this.tagRepository.create({ name });
    await this.tagRepository.save(newTag);

    if (childrenIds?.length) {
      const children = await this.tagRepository.find({
        where: childrenIds.map((id) => ({ id })),
        relations: ['parent'],
      });

      for (const child of children) {
        if (child.parent) {
          throw new BadRequestException(
            `Tag ${child.name} already has a parent`,
          );
        }
        child.parent = newTag;
      }

      await this.tagRepository.save(children);
    }

    return newTag;
  }

  async findAll(queryParams: FilterTagValidator): Promise<Tag[]> {
    const { genres, principalParents, idParent } = queryParams;

    const queryBuilder = this.tagRepository
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.parent', 'parent')
      .leftJoinAndSelect('t.children', 'children');

    if (genres) {
      queryBuilder.where('parent.id = :idParent', { idParent: ID_GENDER_TAG });
    }

    if (principalParents) {
      queryBuilder.where('parent.id IS NULL AND t.id != :idGender', {
        idGender: ID_GENDER_TAG,
      });
    }

    if (idParent) {
      queryBuilder.where('parent.id = :idParent', { idParent });
    }

    return await queryBuilder.getMany();
  }

  async findByIds(ids: string[]): Promise<Tag[]> {
    if (!ids || ids.length === 0) {
      throw new BadRequestException('No tag IDs provided');
    }

    const tags = await this.tagRepository
      .createQueryBuilder('tag')
      .where('tag.id IN (:...ids)', { ids })
      .getMany();

    if (tags.length === 0) {
      throw new NotFoundException(`No tags found for the provided IDs`);
    }

    return tags;
  }

  async findOne(id: string): Promise<Tag> {
    const tag = await this.tagRepository.findOne({
      where: { id },
      relations: ['parent', 'children'],
    });

    if (!tag) {
      throw new NotFoundException(`Tag with ID ${id} not found`);
    }

    return tag;
  }

  async update(id: string, updateTagDto: UpdateTagDto): Promise<Tag> {
    const tag = await this.findOne(id);
    const { name, childrenIds } = updateTagDto;
    if (name) tag.name = name;
    if (childrenIds) {
      const children = await this.tagRepository.find({
        where: childrenIds.map((childId) => ({ id: childId })),
        relations: ['parent'],
      });

      for (const child of children) {
        if (child.parent && child.parent.id !== tag.id) {
          throw new BadRequestException(
            `Tag ${child.name} already has another parent`,
          );
        }
        child.parent = tag;
      }

      await this.tagRepository.save(children);
    }

    return await this.tagRepository.save(tag);
  }

  async findChildren(idParent: string): Promise<Tag[]> {
    const tags = await this.tagRepository
      .createQueryBuilder('tag')
      .leftJoin('tag.parent', 'parent')
      .leftJoin('tag.children', 'children')
      .select([
        'tag.id',
        'tag.name',
        'parent.id as parentId',
        'children.id as childrenId',
      ])
      .where('parent.id = :idParent AND parent.id != :genderId', {
        idParent,
        genderId: ID_GENDER_TAG,
      })
      .getMany();
    return tags;
  }

  async findAllByDIds(ids: string[]): Promise<Tag[]> {
    return await this.tagRepository.find({
      where: { id: In(ids) },
      relations: ['parent', 'children'],
    });
  }

  async remove(id: string): Promise<void> {
    const tag = await this.findOne(id);
    await this.tagRepository.remove(tag);
  }

  async seed(): Promise<string> {
    for (const tagData of seedData) {
      let parent = await this.tagRepository.findOneBy({ name: tagData.name });

      if (!parent) {
        parent = this.tagRepository.create({ name: tagData.name });
        await this.tagRepository.save(parent);
      }

      if (tagData.children?.length) {
        for (const child of tagData.children) {
          const existingChild = await this.tagRepository.findOneBy({
            name: child.name,
          });

          if (!existingChild) {
            const newChild = this.tagRepository.create({
              name: child.name,
              parent,
            });
            await this.tagRepository.save(newChild);
          }
        }
      }
    }

    return 'Seed completed successfully';
  }
}
