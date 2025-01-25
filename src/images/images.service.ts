import { Injectable } from '@nestjs/common';
import {
  CreateImageDto,
  CreateImageDtoByService,
} from './dto/create-image.dto';
import { UpdateImagelDto } from './dto/update-image.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { ImageManager } from './images.entity';
import { Repository } from 'typeorm';

@Injectable()
export class ImagesService {
  constructor(
    @InjectRepository(ImageManager)
    private readonly imageRepository: Repository<ImageManager>,
  ) {}

  async createFromService(createImageDtoByService: CreateImageDtoByService) {
    const { isPrincipal, url, service } = createImageDtoByService;
    const image = this.imageRepository.create({
      service: { id: service } as any,
      url,
      isPrincipal: isPrincipal || false,
    });
    await this.imageRepository.save(image);
  }

  async create(createImageDto: CreateImageDto) {
    return 'HOLA';
  }

  findAll() {
    return `This action returns all detail`;
  }

  async findByExternalId(externalId: string) {
    return await this.imageRepository
      .createQueryBuilder('i')
      .where('i.service = :id OR i.planne = :id', {
        id: externalId,
      })
      .getMany();
  }

  findOne(id: number) {
    return `This action returns a #${id} detail`;
  }

  async update(id: string, updateImagelDto: UpdateImagelDto) {
    const { isPrincipal, url } = updateImagelDto;
    return await this.imageRepository.update(id, { isPrincipal, url });
  }

  async removeByExternalId(ids: string[]) {
    return await this.imageRepository.delete(ids);
  }

  remove(id: number) {
    return `This action removes a #${id} detail`;
  }
}
