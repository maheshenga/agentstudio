import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';

import type { AuthorizedAppRuntimeSession } from './services/app-runtime-session.service';

export type AppRuntimeAuthorizedRequest = Request & {
  appRuntimeSession?: AuthorizedAppRuntimeSession;
};

export function getAppRuntimeToken(request: Pick<Request, 'headers' | 'rawHeaders'>) {
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

export function getAppRuntimeRequestMetadata(request: Request) {
  return {
    requestId: getBoundedHeader(request, 'x-request-id', 100),
    ip: String(request.ip || '').slice(0, 80),
    userAgent: getBoundedHeader(request, 'user-agent', 500),
  };
}

function getBoundedHeader(request: Request, name: string, maxLength: number) {
  const value = request.headers?.[name];
  return (Array.isArray(value) ? value[0] : String(value || '')).slice(0, maxLength);
}
