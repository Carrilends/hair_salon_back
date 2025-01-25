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

@Injectable()
export class ServiceService {
  private readonly looger = new Logger('ServiceService');

  constructor(
    @InjectRepository(Service)
    private readonly serviceRepository: Repository<Service>,
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
    const { limit = 10, offset = 0 } = pagination;
    return this.serviceRepository
      .createQueryBuilder('s')
      .leftJoin('s.images', 'i')
      .leftJoin('s.detail', 'd')
      .select(['s', 'i', 'd'])
      .take(limit)
      .skip(offset)
      .getMany();
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

    if (images) {
      images.forEach(async (image) => {
        this.imagesService.createFromService({
          isPrincipal: image.isPrincipal,
          url: image.url,
          service: service.id,
        });
      });
    }

    if (deleteImages) {
      const ids = deleteImages.map((image) => image.id);
      this.imagesService.removeByExternalId(ids);
    }

    if (updateImages) {
      updateImages.forEach(async (image) => {
        this.imagesService.update(image.id, image);
      });
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

  remove(id: string) {
    return this.serviceRepository.delete(id);
  }

  private handleException(error: any) {
    if (error.code === '23505') {
      throw new BadRequestException(error.detail);
    }
    this.looger.error(error);
    throw new InternalServerErrorException('Unexpected error');
  }
}
