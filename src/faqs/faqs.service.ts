import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';
import { Faq } from './entities/faq.entity';

@Injectable()
export class FaqsService {
  private readonly logger = new Logger('FaqsService');

  constructor(
    @InjectRepository(Faq)
    private readonly faqRepository: Repository<Faq>,
  ) {}

  async create(createFaqDto: CreateFaqDto) {
    const faq = this.faqRepository.create({
      ...createFaqDto,
      question: createFaqDto.question.trim(),
      answer: createFaqDto.answer.trim(),
      sortOrder: createFaqDto.sortOrder ?? 0,
    });

    return this.faqRepository.save(faq);
  }

  async findAll() {
    return this.faqRepository.find({
      order: {
        sortOrder: 'ASC',
        createdAt: 'ASC',
      },
    });
  }

  async findOne(id: string) {
    const faq = await this.faqRepository.findOneBy({ id });
    if (!faq) {
      throw new NotFoundException(`FAQ with id ${id} was not found`);
    }

    return faq;
  }

  async update(id: string, updateFaqDto: UpdateFaqDto) {
    const faq = await this.findOne(id);

    if (typeof updateFaqDto.question === 'string') {
      faq.question = updateFaqDto.question.trim();
    }
    if (typeof updateFaqDto.answer === 'string') {
      faq.answer = updateFaqDto.answer.trim();
    }
    if (typeof updateFaqDto.sortOrder === 'number') {
      faq.sortOrder = updateFaqDto.sortOrder;
    }

    return this.faqRepository.save(faq);
  }

  async remove(id: string) {
    const faq = await this.findOne(id);

    try {
      await this.faqRepository.remove(faq);
      return { deleted: true };
    } catch (error) {
      this.logger.error(error);
      throw new InternalServerErrorException('Unexpected error');
    }
  }
}
