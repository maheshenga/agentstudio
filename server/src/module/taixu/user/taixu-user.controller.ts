import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ResultData } from '../../../common/utils/result';
import {
  TaixuUserCreateDto,
  TaixuUserDeleteDto,
  TaixuUserPageDto,
  TaixuUserSelectDto,
  TaixuUserUpdateDto,
} from './dto';
import { TaixuUserService } from './taixu-user.service';

@Controller('api/taixu/user')
export class TaixuUserController {
  constructor(private readonly userService: TaixuUserService) {}

  @Get('page')
  async page(@Query() query: TaixuUserPageDto) {
    return ResultData.ok(await this.userService.page(query));
  }

  @Post('add')
  async add(@Body() body: TaixuUserCreateDto & Partial<TaixuUserPageDto>) {
    await this.userService.create(body);
    return ResultData.ok(await this.userService.page(body));
  }

  @Post('update')
  async update(@Body() body: TaixuUserUpdateDto & Partial<TaixuUserPageDto>) {
    await this.userService.update(body);
    return ResultData.ok(await this.userService.page(body));
  }

  @Post('delete')
  async remove(@Body() body: TaixuUserDeleteDto & Partial<TaixuUserPageDto>) {
    await this.userService.remove(body);
    return ResultData.ok(await this.userService.page(body));
  }

  @Get('select')
  async select(@Query() query: TaixuUserSelectDto) {
    return ResultData.ok(await this.userService.select(query));
  }
}

