import { ForbiddenException, HttpException } from '@nestjs/common';

import { AppRuntimeHttpExceptionFilter } from './app-runtime-http-exception.filter';

describe('AppRuntimeHttpExceptionFilter', () => {
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as any;

  beforeEach(() => jest.clearAllMocks());

  it('preserves the real HTTP status for runtime authorization failures', () => {
    new AppRuntimeHttpExceptionFilter().catch(new ForbiddenException('Runtime denied'), host);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({
      code: 403,
      msg: 'Runtime denied',
      message: 'Runtime denied',
      data: null,
    });
  });

  it('whitelists and bounds retry_after for rate-limit responses', () => {
    const exception = new HttpException(
      {
        message: 'App runtime capability rate limit exceeded',
        retry_after: 9999,
        token: 'must-not-leak',
      },
      429,
    );

    new AppRuntimeHttpExceptionFilter().catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(429);
    expect(response.json).toHaveBeenCalledWith({
      code: 429,
      msg: 'App runtime capability rate limit exceeded',
      message: 'App runtime capability rate limit exceeded',
      data: null,
      retry_after: 60,
    });
    expect(JSON.stringify(response.json.mock.calls)).not.toContain('must-not-leak');
  });
});
