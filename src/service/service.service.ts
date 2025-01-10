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

@Injectable()
export class ServiceService {
  private readonly looger = new Logger('ServiceService');

  constructor(
    @InjectRepository(Service)
    private readonly serviceRepository: Repository<Service>,
  ) {}

  async create(createServiceDto: CreateServiceDto) {
    try {
      const product = this.serviceRepository.create(createServiceDto);
      await this.serviceRepository.save(product);
      return product;
    } catch (error) {
      this.handleException(error);
    }
  }

  findAll(pagination: PaginationDto) {
    const { limit = 10, offset = 0 } = pagination;
    return this.serviceRepository
      .createQueryBuilder('service')
      .take(limit)
      .skip(offset)
      .getMany();
  }

  async findOne(term: string) {
    const service = this.serviceRepository.createQueryBuilder('service');
    if (isUUID(term)) {
      service.where('service.id = :id', { id: term });
    } else {
      service.where('service.name ILIKE :name', { name: `%${term}%` });
    }

    await service.getOne();
    console.log(await service.getOne());
    if (!service) {
      throw new NotFoundException(`Service with id ${service} not found`);
    }

    return service;
  }

  update(id: number, updateServiceDto: UpdateServiceDto) {
    return `This action updates a #${id} service`;
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
