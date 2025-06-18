// shared-info.controller.ts
import { Controller, Get } from '@nestjs/common';
import { SharedInfoService } from './shared-info.service';

@Controller('shared-info')
export class SharedInfoController {
  constructor(private readonly sharedInfoService: SharedInfoService) {}

  @Get('filters')
  async getFilters() {
    return this.sharedInfoService.getFilterData();
  }
}
