import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../../system/user/entities/sys-user.entity';
import { SysUserTenantEntity } from '../../system/user/entities/user-tenant.entity';
import { TaixuUserController } from './taixu-user.controller';
import { TaixuUserService } from './taixu-user.service';
import { TaixuUserProfileEntity } from './entities/taixu-user-profile.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, SysUserTenantEntity, TaixuUserProfileEntity])],
  controllers: [TaixuUserController],
  providers: [TaixuUserService],
  exports: [TaixuUserService],
})
export class TaixuUserModule {}
