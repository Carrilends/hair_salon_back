import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';
import { Tag } from 'src/tags/entities/tag.entity';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import seedData from './seed/tag-seed.json'; // asegúrate de que este archivo exista

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

  async findAll(): Promise<Tag[]> {
    return await this.tagRepository.find({
      relations: ['parent', 'children'],
    });
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
