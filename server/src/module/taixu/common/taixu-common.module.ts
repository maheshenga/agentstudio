import { Module } from '@nestjs/common';

import { TaixuCommonController } from './taixu-common.controller';
import { TaixuCommonService } from './taixu-common.service';

@Module({
  controllers: [TaixuCommonController],
  providers: [TaixuCommonService],
})
export class TaixuCommonModule {}

