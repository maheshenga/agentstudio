import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  Res,
  ServiceUnavailableException,
  StreamableFile,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { Response } from 'express';
import { memoryStorage } from 'multer';

import { Public } from '../../common/decorators/auth.decorator';
import { ResultData } from '../../common/utils/result';
import { AppRuntimeHttpExceptionFilter } from './app-runtime-http-exception.filter';
import { SetAppRuntimeKvDto } from './dto/app-runtime-kv.dto';
import { AppRuntimeFileParamsDto } from './dto/app-runtime-file.dto';
import { AppRuntimeHttpRequestDto, AppRuntimeWebhookDto } from './dto/app-runtime-http.dto';
import {
  AppServiceInvokeDto,
  assertBoundedAppRuntimeJson,
} from './dto/app-service-invoke.dto';
import { AppRuntimeContextService } from './services/app-runtime-context.service';
import { AppRuntimeFileService } from './services/app-runtime-file.service';
import { AppRuntimeKvService } from './services/app-runtime-kv.service';
import { AppRuntimeHttpService } from './services/app-runtime-http.service';
import { AppRuntimeSessionService } from './services/app-runtime-session.service';
import { AppServiceInvocationPolicyService } from './services/app-service-invocation-policy.service';

@ApiTags('App Runtime')
@Controller('api/app-runtime')
@UseFilters(AppRuntimeHttpExceptionFilter)
export class AppRuntimeController {
  constructor(
    private readonly sessionService: AppRuntimeSessionService,
    private readonly contextService: AppRuntimeContextService,
    private readonly kvService: AppRuntimeKvService,
    private readonly fileService: AppRuntimeFileService,
    private readonly httpService: AppRuntimeHttpService,
    private readonly invocationPolicy: AppServiceInvocationPolicyService,
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

  @Post('files')
  @Public()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { files: 1, fileSize: 50 * 1024 * 1024 },
    }),
  )
  async filesUpload(@Req() request: Request, @UploadedFile() file: Express.Multer.File) {
    const session = await this.authorize(request, 'files.write');
    return ResultData.ok(await this.fileService.upload(session, file));
  }

  @Get('files/:objectId')
  @Public()
  async filesRead(
    @Req() request: Request,
    @Param() params: AppRuntimeFileParamsDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.authorize(request, 'files.read');
    const file = await this.fileService.open(session, params.objectId);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Length', String(file.size));
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.name.replace(/["\\\r\n]/g, '_')}"`,
    );
    return new StreamableFile(file.stream);
  }

  @Delete('files/:objectId')
  @Public()
  async filesDelete(@Req() request: Request, @Param() params: AppRuntimeFileParamsDto) {
    const session = await this.authorize(request, 'files.write');
    return ResultData.ok(await this.fileService.delete(session, params.objectId));
  }

  @Get('kv/:namespace/:key')
  @Public()
  async kvGet(
    @Req() request: Request,
    @Param('namespace') namespace: string,
    @Param('key') key: string,
  ) {
    const session = await this.authorize(request, 'kv.read');
    return ResultData.ok(await this.kvService.get(session, namespace, key));
  }

  @Put('kv/:namespace/:key')
  @Public()
  async kvSet(
    @Req() request: Request,
    @Param('namespace') namespace: string,
    @Param('key') key: string,
    @Body() body: SetAppRuntimeKvDto,
  ) {
    const session = await this.authorize(request, 'kv.write');
    return ResultData.ok(await this.kvService.set(session, namespace, key, body));
  }

  @Delete('kv/:namespace/:key')
  @Public()
  async kvDelete(
    @Req() request: Request,
    @Param('namespace') namespace: string,
    @Param('key') key: string,
  ) {
    const session = await this.authorize(request, 'kv.delete');
    return ResultData.ok(await this.kvService.delete(session, namespace, key));
  }

  @Post('http')
  @Public()
  async httpRequest(@Req() request: Request, @Body() body: AppRuntimeHttpRequestDto) {
    const session = await this.authorize(request, 'http.request');
    return ResultData.ok(await this.httpService.request(session, body));
  }

  @Post('webhooks')
  @Public()
  async webhookEmit(@Req() request: Request, @Body() body: AppRuntimeWebhookDto) {
    const session = await this.authorize(request, 'webhook.emit');
    return ResultData.ok(await this.httpService.emitWebhook(session, body));
  }

  @Post('services/:code/invoke')
  @Public()
  @ApiOperation({ summary: 'Invoke an authorized tenant service' })
  async invokeService(
    @Req() request: Request,
    @Param('code') code: string,
    @Body() body: AppServiceInvokeDto,
  ) {
    const targetCode = String(code || '').trim();
    if (!/^[a-z][a-z0-9_]{2,79}$/.test(targetCode)) {
      throw new BadRequestException('Invalid service target code');
    }
    const session = await this.authorize(request, 'service.invoke');
    assertBoundedAppRuntimeJson(body?.input);
    return ResultData.ok(await this.invocationPolicy.invoke(session, targetCode, body.input));
  }

  private authorize(
    request: Request,
    capability:
      | 'kv.read'
      | 'kv.write'
      | 'kv.delete'
      | 'files.read'
      | 'files.write'
      | 'http.request'
      | 'webhook.emit'
      | 'service.invoke',
  ) {
    return this.sessionService.authorize(this.getRuntimeToken(request), capability, {
      requestId: this.header(request, 'x-request-id', 100),
      ip: String(request.ip || '').slice(0, 80),
      userAgent: this.header(request, 'user-agent', 500),
    });
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
