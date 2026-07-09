import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ResultData } from '../../common/utils/result';
import { User } from '../system/user/user.decorator';
import type { UserDto } from '../system/user/user.decorator';
import { AppFactoryListQueryDto, PublishAppFactoryModuleDto, SaveAppFactoryModuleDto } from './dto/app-factory.dto';
import { AppFactoryService } from './services/app-factory.service';

@ApiTags('App Factory')
@ApiBearerAuth('Authorization')
@Controller('api/app-platform/factory')
export class AppFactoryController {
  constructor(private readonly factoryService: AppFactoryService) {}

  private getOperatorId(user?: UserDto) {
    return Number(user?.userId || user?.user?.id) || undefined;
  }

  @Get('modules')
  @ApiOperation({ summary: 'List app factory modules' })
  @RequirePermission('app:factory:list')
  listModules(@Query() query: AppFactoryListQueryDto) {
    return this.factoryService.listModules(query).then((data) => ResultData.ok(data));
  }

  @Post('modules')
  @ApiOperation({ summary: 'Create app factory module' })
  @RequirePermission('app:factory:create')
  createModule(@Body() body: SaveAppFactoryModuleDto, @User() user: UserDto) {
    return this.factoryService.createModule(body, this.getOperatorId(user)).then((data) => ResultData.ok(data));
  }

  @Get('modules/:code')
  @ApiOperation({ summary: 'Get app factory module' })
  @RequirePermission('app:factory:list')
  getModule(@Param('code') code: string) {
    return this.factoryService.getModule(code).then((data) => ResultData.ok(data));
  }

  @Put('modules/:code')
  @ApiOperation({ summary: 'Update app factory module' })
  @RequirePermission('app:factory:update')
  updateModule(@Param('code') code: string, @Body() body: SaveAppFactoryModuleDto) {
    return this.factoryService.updateModule(code, body).then((data) => ResultData.ok(data));
  }

  @Post('modules/:code/publish')
  @ApiOperation({ summary: 'Publish app factory module as marketplace app' })
  @RequirePermission('app:factory:publish')
  publishModule(@Param('code') code: string, @Body() body: PublishAppFactoryModuleDto, @User() user: UserDto) {
    return this.factoryService.publishModule(code, body, this.getOperatorId(user)).then((data) => ResultData.ok(data));
  }
}
