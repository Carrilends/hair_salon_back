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
import { Detail } from 'src/detail/entities/detail.entity';
import { FilterServiceDto } from './dto/filter-service.dto';
import { TagsService } from 'src/tags/tags.service';
import seedData from './seed/seed-services.json';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { ImageManager } from 'src/images/images.entity';
import { ImagesService } from 'src/images/images.service';
import { selectPrincipalImage } from 'src/images/utils/utils.images';

// TODO: Continua con la edicion del detalle
@Injectable()
export class ServiceService {
  private readonly logger = new Logger('ServiceService');

  constructor(
    @InjectRepository(Service)
    private readonly serviceRepository: Repository<Service>,
    @InjectRepository(Detail)
    private readonly detailRepository: Repository<Detail>,
    @InjectRepository(ImageManager)
    private readonly imagesRepository: Repository<ImageManager>,

    private readonly tagService: TagsService,
    private readonly imageService: ImagesService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async create(createServiceDto: CreateServiceDto) {
    try {
      const { tags, images, ...rest } = createServiceDto;
      const tagsEntities = await this.tagService.findByIds(tags);

      const product = this.serviceRepository.create({
        ...rest,
        images: selectPrincipalImage(images),
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
      .leftJoinAndSelect('s.images', 'i', 'i.isPrincipal = true')
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
    try {
      const { images, tags, ...rest } = updateServiceDto;

      const tagsEntities = await this.tagService.findByIds(tags);
      const imagesFromDb = await this.imagesRepository.find({
        where: { service: { id } },
      });

      // Imagenes existentes DTO / Base de datos
      const idsFromImagesDto = images.filter((img) => img.id).map((i) => i.id);

      const newImages = images.filter((img) => !img.id);
      const imagesToKeep = imagesFromDb.filter((img) =>
        idsFromImagesDto.includes(img.id),
      );

      // Eliminacion de imagenes
      const imagesToDelete = imagesFromDb.filter(
        (img) => !idsFromImagesDto.includes(img.id),
      );
      if (imagesToDelete.length > 0) {
        await this.imageService.removeByExternalId(
          imagesToDelete.map((i) => i.id),
          imagesToDelete.map((i) => i.publicId),
        );
      }

      console.log('Tags DTO:', tags);
      console.log('Tags Entities:', tagsEntities);

      // Creacion de nuevas imagenes
      const imagesToSafe = selectPrincipalImage(imagesToKeep.concat(newImages));
      const service = await this.serviceRepository.preload({
        id: id,
        tags: tagsEntities,
        images: imagesToSafe,
        ...rest,
      });

      await this.serviceRepository.save(service);
      return service;
    } catch (error) {
      this.handleException(error);
    }
  }

  async remove(id: string) {
    const serviceWithRelations = await this.serviceRepository.findOne({
      where: { id },
      relations: ['detail', 'images'],
    });
    const images = serviceWithRelations.images.map((img) => img.publicId);
    await this.cloudinaryService.deleteAssets(images);
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
    this.logger.error(error);
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
