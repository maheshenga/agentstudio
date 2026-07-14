import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import {
  AppRuntimeAuthorizedRequest,
  getAppRuntimeRequestMetadata,
  getAppRuntimeToken,
} from '../app-runtime-request';
import { AppRuntimeSessionService } from '../services/app-runtime-session.service';

@Injectable()
export class AppRuntimeFileUploadGuard implements CanActivate {
  constructor(private readonly sessionService: AppRuntimeSessionService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AppRuntimeAuthorizedRequest>();
    request.appRuntimeSession = await this.sessionService.authorize(
      getAppRuntimeToken(request),
      'files.write',
      getAppRuntimeRequestMetadata(request),
    );
    return true;
  }
}
