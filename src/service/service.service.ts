import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { /* In, */ Repository, type SelectQueryBuilder } from 'typeorm';
import { Service } from './entities/service.entity';
import { isUUID } from 'class-validator';
import { ImagesService } from 'src/images/images.service';
import { Detail } from 'src/detail/entities/detail.entity';
import { FilterServiceDto } from './dto/filter-service.dto';
import { TagsService } from 'src/tags/tags.service';
import seedData from './seed/seed-services.json';

// TODO: Continua con la edicion del detalle
@Injectable()
export class ServiceService {
  private readonly looger = new Logger('ServiceService');

  constructor(
    @InjectRepository(Service)
    private readonly serviceRepository: Repository<Service>,
    @InjectRepository(Detail)
    private readonly detailRepository: Repository<Detail>,
    private readonly imagesService: ImagesService,
    private readonly tagService: TagsService,
  ) {}

  async create(createServiceDto: CreateServiceDto) {
    try {
      const { tags, ...rest } = createServiceDto;
      const tagsEntities = await this.tagService.findByIds(tags);
      const product = this.serviceRepository.create({
        ...rest,
        tags: tagsEntities,
      });

      await this.serviceRepository.save(product);
      return product;
    } catch (error) {
      this.handleException(error);
    }
  }

  async search(filterDto: FilterServiceDto) {
    const { limit = 10, page = 1 } = filterDto;
    const take = limit;
    const skip = (page - 1) * limit;

    const qb = this.serviceRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.tags', 'tags')
      .leftJoinAndSelect('s.images', 'i')
      .leftJoinAndSelect('s.detail', 'd');

    this.applyFilters(qb, filterDto);

    const [services, total] = await qb
      .orderBy('s.name', 'DESC')
      .skip(skip)
      .take(take)
      .getManyAndCount();

    return [services, total];
  }

  async findOne(term: string) {
    const queryBuilder = this.serviceRepository
      .createQueryBuilder('service')
      .leftJoinAndSelect('service.images', 'i')
      .leftJoinAndSelect('service.detail', 'd')
      .leftJoinAndSelect('service.tags', 't')
      .select(['service', 'i', 'd', 't']);
    let service: Service;

    if (isUUID(term)) {
      service = await queryBuilder
        .where('service.id = :id', { id: term })
        .getOne();
    } else {
      service = await queryBuilder
        .where('service.name ILIKE :term or slug = :term', { term })
        .getOne();
    }

    if (!service) {
      throw new NotFoundException(`Service with id ${service} not found`);
    }

    return service;
  }

  async update(id: string, updateServiceDto: UpdateServiceDto) {
    const { images, deleteImages, updateImages, tags, ...rest } =
      updateServiceDto;

    const tagsEntities = await this.tagService.findByIds(tags);

    const service = await this.serviceRepository.preload({
      id: id,
      tags: tagsEntities,
      ...rest,
    });

    if (images && images?.length) {
      images.forEach(async (image) => {
        this.imagesService.createFromService({
          isPrincipal: image.isPrincipal,
          url: image.url,
          service: service.id,
        });
      });
    }

    if (deleteImages?.length && deleteImages) {
      const ids = deleteImages.map((image) => image.id);
      this.imagesService.removeByExternalId(ids);
    }

    if (updateImages?.length && updateImages) {
      updateImages.forEach(async (image) => {
        this.imagesService.update(image.id, image);
      });
    }

    if (rest.detail) {
      await this.detailRepository.update(rest.detail.id, rest.detail);
    }

    if (!service) {
      throw new NotFoundException(`Service with id ${id} not found`);
    }

    try {
      await this.serviceRepository.save(service);
      return service;
    } catch (error) {
      this.handleException(error);
    }
  }

  async remove(id: string) {
    const serviceWithRelations = await this.serviceRepository.findOne({
      where: { id },
      relations: ['detail'],
    });
    await this.serviceRepository.delete(id);
    await this.detailRepository.delete(serviceWithRelations.detail.id);
    return 'deleted';
  }

  private applyFilters(
    qb: SelectQueryBuilder<Service>,
    filterDto: FilterServiceDto,
  ) {
    const { name, selectedGenres, includePriceRange, selectedServicesIDs } =
      filterDto;

    const commonTags = [
      ...(selectedGenres || []),
      ...(selectedServicesIDs || []),
    ];

    if (name) {
      qb.where('s.name ILIKE :name', {
        name: `%${name.toLowerCase()}%`,
      });
    }

    if (commonTags.length) {
      qb.andWhere((subQb) => {
        const subQuery = subQb
          .subQuery()
          .from('service_tags_tag', 'st') // 👈 tabla pivot generada por TypeORM
          .select('st.serviceId')
          .where('st.tagId IN (:...ids)', { ids: commonTags })
          .groupBy('st.serviceId')
          .having('COUNT(DISTINCT st.tagId) = :count', {
            count: commonTags.length,
          })
          .getQuery();

        return 's.id IN ' + subQuery;
      });
    }

    if (includePriceRange && filterDto.prices) {
      const { min, max } = filterDto.prices;
      qb.andWhere('s.price BETWEEN :min AND :max', { min, max });
    }
  }

  private handleException(error: any) {
    if (error.code === '23505') {
      throw new BadRequestException(error.detail);
    }
    this.looger.error(error);
    throw new InternalServerErrorException('Unexpected error');
  }

  async seed() {
    for (const serviceData of seedData) {
      const { tags, ...rest } = serviceData;
      const tagsEntities = await this.tagService.findByIds(tags);
      const service = this.serviceRepository.create({
        ...rest,
        tags: tagsEntities,
      });

      try {
        await this.serviceRepository.save(service);
      } catch (error) {
        this.handleException(error);
      }
    }
  }
}
