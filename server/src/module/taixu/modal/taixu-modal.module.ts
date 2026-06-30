import { Module } from '@nestjs/common';
import { TaixuHistoryModule } from '../history/taixu-history.module';
import { TaixuLlmModule } from '../llm/taixu-llm.module';
import { TaixuModalCompatController } from './taixu-modal.compat.controller';
import { TaixuModalController } from './taixu-modal.controller';
import { TaixuModalService } from './taixu-modal.service';

@Module({
  imports: [TaixuLlmModule, TaixuHistoryModule],
  controllers: [TaixuModalController, TaixuModalCompatController],
  providers: [TaixuModalService],
  exports: [TaixuModalService],
})
export class TaixuModalModule {}

