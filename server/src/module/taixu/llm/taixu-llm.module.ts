import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaixuSystemModelEntity } from '../model/entities/taixu-system-model.entity';
import { TaixuHistoryRecordEntity } from '../history/entities/taixu-history-record.entity';
import { TaixuSettingModule } from '../setting/taixu-setting.module';
import { AiModule } from '../../ai/ai.module';
import { TaixuLlmService } from './taixu-llm.service';
import { TaixuLlmRuntimeService } from './taixu-llm-runtime.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TaixuSystemModelEntity, TaixuHistoryRecordEntity]),
    TaixuSettingModule,
    AiModule,
  ],
  providers: [TaixuLlmService, TaixuLlmRuntimeService],
  exports: [TaixuLlmService, TaixuLlmRuntimeService],
})
export class TaixuLlmModule {}
