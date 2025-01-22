import { Injectable } from '@nestjs/common';
import { CreateImageDto } from './dto/create-image.dto';
import { UpdateImagelDto } from './dto/update-image.dto';

@Injectable()
export class ImagesService {
  create(createImageDto: CreateImageDto) {
    return 'This action adds a new detail';
  }

  findAll() {
    return `This action returns all detail`;
  }

  findOne(id: number) {
    return `This action returns a #${id} detail`;
  }

  update(id: number, updateImagelDto: UpdateImagelDto) {
    return `This action updates a #${id} detail`;
  }

  remove(id: number) {
    return `This action removes a #${id} detail`;
  }
}
