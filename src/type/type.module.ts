import { Module } from '@nestjs/common';
import { TypeService } from './type.service';
import { TypeController } from './type.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Type } from './entities/type.entity';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  controllers: [TypeController],
  providers: [TypeService],
  // AuthModule es necesario para que @Auth(admin) resuelva el guard JWT.
  imports: [TypeOrmModule.forFeature([Type]), AuthModule],
})
export class TypeModule {}
