import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaixuModelController } from './taixu-model.controller';
import { TaixuModelService } from './taixu-model.service';
import { TaixuSystemModelEntity } from './entities/taixu-system-model.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TaixuSystemModelEntity])],
  controllers: [TaixuModelController],
  providers: [TaixuModelService],
  exports: [TaixuModelService],
})
export class TaixuModelModule {}

