import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ResultData } from '../../../common/utils/result';
import { TaixuModelCreateDto, TaixuModelDeleteDto, TaixuModelPageDto, TaixuModelUpdateDto } from './dto';
import { getTaixuModelMeta } from './model.constants';
import { TaixuModelService } from './taixu-model.service';

@Controller('api/taixu/model')
export class TaixuModelController {
  constructor(private readonly modelService: TaixuModelService) {}

  @Get('meta')
  meta() {
    return ResultData.ok(getTaixuModelMeta());
  }

  @Get('page')
  async page(@Query() query: TaixuModelPageDto) {
    return ResultData.ok(await this.modelService.page(query));
  }

  @Post('add')
  async add(@Body() body: TaixuModelCreateDto & Partial<TaixuModelPageDto>) {
    await this.modelService.create(body);
    return ResultData.ok(await this.modelService.page(body));
  }

  @Post('update')
  async update(@Body() body: TaixuModelUpdateDto & Partial<TaixuModelPageDto>) {
    await this.modelService.update(body);
    return ResultData.ok(await this.modelService.page(body));
  }

  @Post('delete')
  async remove(@Body() body: TaixuModelDeleteDto & Partial<TaixuModelPageDto>) {
    await this.modelService.remove(body);
    return ResultData.ok(await this.modelService.page(body));
  }

  @Get('list')
  async list(@Query() query: TaixuModelPageDto) {
    return ResultData.ok(await this.modelService.list(query));
  }
}
