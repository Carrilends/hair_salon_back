import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { ValidRoles } from 'src/auth/interfaces/valid-roles';
import { CreateFaqDto } from './dto/create-faq.dto';
import { ReordenarFaqsDto } from './dto/reordenar-faqs.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';
import { FaqsService } from './faqs.service';

@Controller('faqs')
export class FaqsController {
  constructor(private readonly faqsService: FaqsService) {}

  @Get()
  findAll() {
    return this.faqsService.findAll();
  }

  @Auth(ValidRoles.admin)
  @Post()
  create(@Body() createFaqDto: CreateFaqDto) {
    return this.faqsService.create(createFaqDto);
  }

  /**
   * Reordena todas las preguntas (F3). Va ANTES de `@Patch(':id')` a
   * propósito: Express prueba las rutas en el orden en que se declaran, y
   * `:id` también casaría con «orden» (su `ParseUUIDPipe` respondería 400).
   */
  @Auth(ValidRoles.admin)
  @Patch('orden')
  reordenar(@Body() dto: ReordenarFaqsDto) {
    return this.faqsService.reordenar(dto.ids);
  }

  @Auth(ValidRoles.admin)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateFaqDto: UpdateFaqDto,
  ) {
    return this.faqsService.update(id, updateFaqDto);
  }

  @Auth(ValidRoles.admin)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.faqsService.remove(id);
  }
}
