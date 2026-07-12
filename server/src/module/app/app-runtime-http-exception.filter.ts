import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Response } from 'express';

@Catch(HttpException)
export class AppRuntimeHttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();
    const body =
      typeof exceptionResponse === 'object' && exceptionResponse ? exceptionResponse : {};
    const rawMessage = (body as { message?: string | string[] }).message;
    const message = String(
      Array.isArray(rawMessage) ? rawMessage[0] : rawMessage || 'Service Error',
    ).slice(0, 200);
    const rawRetryAfter = Number((body as { retry_after?: unknown }).retry_after);
    const retryAfter = Number.isFinite(rawRetryAfter)
      ? Math.min(status === 503 ? 3600 : 60, Math.max(1, Math.trunc(rawRetryAfter)))
      : undefined;

    response.status(status).json({
      code: status,
      msg: message,
      message,
      data: null,
      ...((status === 429 || status === 503) && retryAfter
        ? { retry_after: retryAfter }
        : {}),
    });
  }
}
