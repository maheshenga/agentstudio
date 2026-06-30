import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaixuSystemSettingEntity } from './entities/taixu-system-setting.entity';
import { TaixuSettingController } from './taixu-setting.controller';
import { TaixuSettingService } from './taixu-setting.service';

@Module({
  imports: [TypeOrmModule.forFeature([TaixuSystemSettingEntity])],
  controllers: [TaixuSettingController],
  providers: [TaixuSettingService],
  exports: [TaixuSettingService],
})
export class TaixuSettingModule {}

