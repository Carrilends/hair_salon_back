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
    const queryBuilder = this.tagRepo
      .createQueryBuilder('t')
      .leftJoin('t.parent', 'par');

    const gendersPromise = queryBuilder
      .where('par.id = :idParent', { idParent: ID_GENDER })
      .getMany();

    const principalParentsPromise = queryBuilder
      .where('par.id IS NULL')
      .andWhere('t.id != :idGender', { idGender: ID_GENDER })
      .getMany();

    const [genders, principalParents] = await Promise.all([
      gendersPromise,
      principalParentsPromise,
    ]);

    return {
      genders,
      principalParents,
    };
  }
}
