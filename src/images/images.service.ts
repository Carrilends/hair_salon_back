import { Injectable } from '@nestjs/common';
import { CreateImageDtoByService } from './dto/create-image.dto';
import { UpdateImagelDto } from './dto/update-image.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { ImageManager } from './images.entity';
import { Repository } from 'typeorm';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';

@Injectable()
export class ImagesService {
  constructor(
    @InjectRepository(ImageManager)
    private readonly imageRepository: Repository<ImageManager>,

    private readonly cloudinaryService: CloudinaryService,
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

  async findByExternalId(externalId: string) {
    return await this.imageRepository
      .createQueryBuilder('i')
      .where('i.service = :id OR i.planne = :id', {
        id: externalId,
      })
      .getMany();
  }

  async update(id: string, updateImagelDto: UpdateImagelDto) {
    const { isPrincipal, url } = updateImagelDto;
    return await this.imageRepository.update(id, { isPrincipal, url });
  }

  async removeByExternalId(ids: string[], publicIds?: string[]) {
    await this.cloudinaryService.deleteAssets(publicIds);
    return await this.imageRepository.delete(ids);
  }
}
