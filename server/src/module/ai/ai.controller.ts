import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { User } from '../system/user/user.decorator';
import type { UserDto } from '../system/user/user.decorator';
import { ResultData } from '../../common/utils/result';
import { ChatService } from './services/chat.service';
import { AiConfigService } from './services/ai-config.service';

@ApiTags('AI 助手')
@ApiBearerAuth('Authorization')
@Controller('api/ai')
export class AiController {
  constructor(
    private readonly chatService: ChatService,
    private readonly aiConfigService: AiConfigService,
  ) {}

  @ApiOperation({ summary: '创建会话' })
  @Post('sessions')
  @RequirePermission('ai:chat:use')
  createSession(
    @User() user: UserDto,
    @Body() body: { agent_id?: string; model_id?: string; title?: string },
  ) {
    return this.chatService.createSession(user as any, body).then((data) => ResultData.ok(data));
  }

  @ApiOperation({ summary: '会话列表' })
  @Get('sessions')
  @RequirePermission('ai:chat:use')
  listSessions(
    @User() user: UserDto,
    @Query() query: { page?: number; limit?: number },
  ) {
    return this.chatService.listSessions(user as any, query).then((data) => ResultData.ok(data));
  }

  @ApiOperation({ summary: '会话消息历史' })
  @Get('sessions/:uuid/messages')
  @RequirePermission('ai:chat:use')
  listMessages(@User() user: UserDto, @Param('uuid') uuid: string) {
    return this.chatService.listMessages(user as any, uuid).then((data) => ResultData.ok(data));
  }

  @ApiOperation({ summary: '切换会话默认模型' })
  @Patch('sessions/:uuid/model')
  @RequirePermission('ai:chat:use')
  updateModel(
    @User() user: UserDto,
    @Param('uuid') uuid: string,
    @Body() body: { model_id: string },
  ) {
    return this.chatService
      .updateSessionModel(user as any, uuid, body.model_id)
      .then((data) => ResultData.ok(data));
  }

  @ApiOperation({ summary: '更新会话标题' })
  @Patch('sessions/:uuid/title')
  @RequirePermission('ai:chat:use')
  updateTitle(
    @User() user: UserDto,
    @Param('uuid') uuid: string,
    @Body() body: { title: string },
  ) {
    return this.chatService
      .updateSessionTitle(user as any, uuid, body.title)
      .then((data) => ResultData.ok(data));
  }

  @ApiOperation({ summary: '删除会话' })
  @Delete('sessions/:uuid')
  @RequirePermission('ai:chat:use')
  deleteSession(@User() user: UserDto, @Param('uuid') uuid: string) {
    return this.chatService.deleteSession(user as any, uuid).then((data) => ResultData.ok(data));
  }

  @ApiOperation({ summary: '可选模型列表' })
  @Get('models/options')
  @RequirePermission('ai:chat:use')
  async modelOptions(@User() user: UserDto) {
    const tenantId = (user as any).tenantId ?? 0;
    const list = await this.aiConfigService.listModelOptions(tenantId);
    return ResultData.ok({ list });
  }

  @ApiOperation({ summary: '可选 Agent 列表' })
  @Get('agents/options')
  @RequirePermission('ai:chat:use')
  async agentOptions(@User() user: UserDto) {
    const tenantId = (user as any).tenantId ?? 0;
    const list = await this.aiConfigService.listAgentOptions(tenantId);
    return ResultData.ok({ list });
  }
}
