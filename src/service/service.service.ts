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
import { Repository } from 'typeorm';
import { Service } from './entities/service.entity';
import { PaginationDto } from 'src/common/dtos/pagination.dto';
import { isUUID } from 'class-validator';
import { ImagesService } from 'src/images/images.service';
import { Detail } from 'src/detail/entities/detail.entity';

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
  ) {}

  async create(createServiceDto: CreateServiceDto) {
    try {
      const product = this.serviceRepository.create({
        ...createServiceDto,
      });
      await this.serviceRepository.save(product);
      return product;
    } catch (error) {
      this.handleException(error);
    }
  }

  findAll(pagination: PaginationDto) {
    const { limit = 10, page = 1 } = pagination;
    const take = limit;
    const skip = (page - 1) * limit;
    return this.serviceRepository
      .createQueryBuilder('s')
      .leftJoin('s.images', 'i')
      .leftJoin('s.detail', 'd')
      .select(['s', 'i', 'd'])
      .orderBy('s.name', 'DESC')
      .take(take)
      .skip(skip)
      .getManyAndCount();
  }

  async findOne(term: string) {
    const queryBuilder = this.serviceRepository
      .createQueryBuilder('service')
      .leftJoinAndSelect('service.images', 'i')
      .leftJoinAndSelect('service.detail', 'd')
      .select(['service', 'i', 'd']);
    let service: Service; // = this.serviceRepository.createQueryBuilder('service');

    if (isUUID(term)) {
      service = await queryBuilder
        .where('service.id = :id', { id: term })
        .getOne();
    } else {
      // query.where('c.email ILIKE :search OR c.identification ILIKE :search', { search: searchPattern })
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
    const { images, deleteImages, updateImages, ...rest } = updateServiceDto;
    const service = await this.serviceRepository.preload({
      id: id,
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

  private handleException(error: any) {
    if (error.code === '23505') {
      throw new BadRequestException(error.detail);
    }
    this.looger.error(error);
    throw new InternalServerErrorException('Unexpected error');
  }
}
