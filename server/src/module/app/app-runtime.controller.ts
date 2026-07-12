import {
  BadRequestException,
  Controller,
  Get,
  Req,
  ServiceUnavailableException,
  UseFilters,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { Public } from '../../common/decorators/auth.decorator';
import { ResultData } from '../../common/utils/result';
import { AppRuntimeHttpExceptionFilter } from './app-runtime-http-exception.filter';
import { AppRuntimeContextService } from './services/app-runtime-context.service';
import { AppRuntimeSessionService } from './services/app-runtime-session.service';

@ApiTags('App Runtime')
@Controller('api/app-runtime')
@UseFilters(AppRuntimeHttpExceptionFilter)
export class AppRuntimeController {
  constructor(
    private readonly sessionService: AppRuntimeSessionService,
    private readonly contextService: AppRuntimeContextService,
  ) {}

  @Get('context')
  @Public()
  @ApiOperation({ summary: 'Get sanitized app runtime context' })
  async context(@Req() request: Request) {
    const token = this.getRuntimeToken(request);
    const session = await this.sessionService.authorize(token, 'context.read', {
      requestId: this.header(request, 'x-request-id', 100),
      ip: String(request.ip || '').slice(0, 80),
      userAgent: this.header(request, 'user-agent', 500),
    });
    const context = await this.contextService.buildAuthorizedContext(session);
    if (!context) throw new ServiceUnavailableException('App runtime context is unavailable');
    return ResultData.ok(context);
  }

  private getRuntimeToken(request: Request) {
    const rawHeaders = Array.isArray(request.rawHeaders) ? request.rawHeaders : [];
    let count = 0;
    for (let index = 0; index < rawHeaders.length; index += 2) {
      if (String(rawHeaders[index] || '').toLowerCase() === 'x-app-runtime-token') count += 1;
    }
    const value = request.headers?.['x-app-runtime-token'];
    if (count !== 1 || Array.isArray(value) || typeof value !== 'string') {
      throw new BadRequestException('A single app runtime token header is required');
    }
    const token = value.trim();
    if (!token || token.length > 256 || token.includes(',')) {
      throw new BadRequestException('Invalid app runtime token header');
    }
    return token;
  }

  private header(request: Request, name: string, maxLength: number) {
    const value = request.headers?.[name];
    return (Array.isArray(value) ? value[0] : String(value || '')).slice(0, maxLength);
  }
}
