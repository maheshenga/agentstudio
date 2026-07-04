import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaixuHistoryRecordEntity } from './entities/taixu-history-record.entity';
import { TaixuMemoryDetailEntity } from './entities/taixu-memory-detail.entity';
import { TaixuHistoryController } from './taixu-history.controller';
import { TaixuHistoryService } from './taixu-history.service';

@Module({
  imports: [TypeOrmModule.forFeature([TaixuHistoryRecordEntity, TaixuMemoryDetailEntity])],
  controllers: [TaixuHistoryController],
  providers: [TaixuHistoryService],
  exports: [TaixuHistoryService],
})
export class TaixuHistoryModule {}

