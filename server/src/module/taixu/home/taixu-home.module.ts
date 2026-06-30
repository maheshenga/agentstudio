import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LoginLogEntity } from '../../monitor/loginlog/entities/loginlog.entity';
import { UserEntity } from '../../system/user/entities/sys-user.entity';
import { SysUserTenantEntity } from '../../system/user/entities/user-tenant.entity';
import { TaixuHistoryRecordEntity } from '../history/entities/taixu-history-record.entity';
import { TaixuMemoryDetailEntity } from '../history/entities/taixu-memory-detail.entity';
import { TaixuSystemModelEntity } from '../model/entities/taixu-system-model.entity';
import { TaixuHomeController } from './taixu-home.controller';
import { TaixuHomeService } from './taixu-home.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      SysUserTenantEntity,
      TaixuSystemModelEntity,
      TaixuHistoryRecordEntity,
      TaixuMemoryDetailEntity,
      LoginLogEntity,
    ]),
  ],
  controllers: [TaixuHomeController],
  providers: [TaixuHomeService],
})
export class TaixuHomeModule {}

