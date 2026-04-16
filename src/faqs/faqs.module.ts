import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { Faq } from './entities/faq.entity';
import { FaqsController } from './faqs.controller';
import { FaqsService } from './faqs.service';

@Module({
  imports: [TypeOrmModule.forFeature([Faq]), AuthModule],
  controllers: [FaqsController],
  providers: [FaqsService],
})
export class FaqsModule {}
