import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
// import { Service } from '../service/entities/service.entity';
import { Tag } from '../tags/entities/tag.entity';
import { ID_GENDER } from 'src/constants/shared-info';

@Injectable()
export class SharedInfoService {
  constructor(
    // @InjectRepository(Service)
    // private serviceRepo: Repository<Service>,
    @InjectRepository(Tag)
    private tagRepo: Repository<Tag>,
  ) {}

  async getFilterData() {
    const tags = await this.tagRepo.find({
      select: ['id', 'name', 'parent'],
      relations: ['parent'],
    });

    const principalParents: Tag[] = [];
    const genders: Tag[] = [];
    const childrens: Tag[] = [];

    tags.forEach((tag) => {
      if (!tag.parent) {
        principalParents.push(tag);
      } else {
        if (tag.parent.id === ID_GENDER) {
          genders.push(tag);
        } else {
          childrens.push(tag);
        }
      }
    });

    return {
      // services,
      genders: genders.map((tag) => ({ ...tag, parent: null })),
      childrens: childrens.map((tag) => ({ ...tag, parent: tag.parent?.id })),
      principalParents: principalParents.filter((tag) => tag.id !== ID_GENDER),
    };
  }
}
