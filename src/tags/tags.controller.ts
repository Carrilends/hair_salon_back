import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ForbiddenException,
} from '@nestjs/common';
import { TagsService } from './tags.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { ValidRoles } from 'src/auth/interfaces/valid-roles';

@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Auth(ValidRoles.admin)
  @Post()
  create(@Body() createTagDto: CreateTagDto) {
    return this.tagsService.create(createTagDto);
  }

  @Get()
  findAll() {
    return this.tagsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tagsService.findOne(id);
  }

  @Auth(ValidRoles.admin)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTagDto: UpdateTagDto) {
    return this.tagsService.update(id, updateTagDto);
  }

  @Auth(ValidRoles.admin)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tagsService.remove(id);
  }

  @Post('seed')
  async seedTags() {
    // 🔐 Protege el seed
    if (process.env.NODE_ENV !== 'development') {
      throw new ForbiddenException('Seed can only be run in development');
    }

    return this.tagsService.seed();
  }
}
