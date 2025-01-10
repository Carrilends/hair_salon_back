import { PartialType } from '@nestjs/mapped-types';
import { CreatePlanneDto } from './create-planne.dto';

export class UpdatePlanneDto extends PartialType(CreatePlanneDto) {}
