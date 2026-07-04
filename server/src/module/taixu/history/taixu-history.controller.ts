import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express-serve-static-core';
import { ResultData } from '../../../common/utils/result';
import {
  TaixuHistoryRecordDeleteDto,
  TaixuHistoryRecordListDto,
  TaixuHistoryRecordUpdateDto,
  TaixuHistoryRecordUpdateModelsDto,
  TaixuMemoryDetailDownloadDto,
  TaixuMemoryDetailListDto,
} from './dto';
import { TaixuHistoryService } from './taixu-history.service';

@Controller('api/taixu')
export class TaixuHistoryController {
  constructor(private readonly historyService: TaixuHistoryService) {}

  @Get('history/records')
  async historyRecords(@Query() query: TaixuHistoryRecordListDto) {
    return ResultData.ok(await this.historyService.listRecords(query));
  }

  @Post('history/update')
  async updateHistory(@Body() body: TaixuHistoryRecordUpdateDto) {
    await this.historyService.updateRecord(body);
    return ResultData.ok({});
  }

  @Post('history/delete')
  async deleteHistory(@Body() body: TaixuHistoryRecordDeleteDto) {
    await this.historyService.deleteRecords(body);
    return ResultData.ok({});
  }

  /**
   * 更新历史记录的对话模型 ID。
   * @param body - 包含记录 ID 和对话模型 ID 的请求体
   */
  @Post('history/update-models')
  async updateModels(@Body() body: TaixuHistoryRecordUpdateModelsDto) {
    await this.historyService.updateRecordModels({
      id: body.id,
      chatModelId: body.chat_model_id ?? undefined,
    });
    return ResultData.ok({});
  }

  @Get('memory/details')
  async memoryDetails(@Query() query: TaixuMemoryDetailListDto) {
    return ResultData.ok(await this.historyService.listDetails(query));
  }

  /**
   * 下载指定来源的详细记忆文本。
   * @param body - 包含来源 ID 的请求体
   * @param res - Express 响应对象
   */
  @Post('memory/download')
  async downloadMemory(
    @Body() body: TaixuMemoryDetailDownloadDto,
    @Res() res: Response,
  ) {
    const content = await this.historyService.downloadDetailsText(body.source_id);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=memory_detail.txt');
    res.status(200).send(content);
  }
}
