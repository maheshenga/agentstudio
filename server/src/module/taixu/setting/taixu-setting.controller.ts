import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ResultData } from '../../../common/utils/result';
import { TaixuSettingListDto, TaixuSettingSaveDto } from './dto';
import { TaixuSettingService } from './taixu-setting.service';

@Controller('api/taixu/setting')
export class TaixuSettingController {
  constructor(private readonly settingService: TaixuSettingService) {}

  @Get('list')
  async list(@Query() query: TaixuSettingListDto) {
    return ResultData.ok(await this.settingService.list(query));
  }

  @Get('detail')
  async detail(@Query('source') source: string) {
    return ResultData.ok(await this.settingService.detail(source));
  }

  @Post('save')
  async save(@Body() body: TaixuSettingSaveDto) {
    return ResultData.ok(await this.settingService.save(body));
  }
}

