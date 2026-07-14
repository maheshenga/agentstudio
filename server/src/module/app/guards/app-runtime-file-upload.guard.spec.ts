import { BadRequestException, type ExecutionContext } from '@nestjs/common';

import { AppRuntimeFileUploadGuard } from './app-runtime-file-upload.guard';

describe('AppRuntimeFileUploadGuard', () => {
  const sessionService = { authorize: jest.fn() };
  let guard: AppRuntimeFileUploadGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new AppRuntimeFileUploadGuard(sessionService as any);
  });

  it('authorizes files.write before upload parsing and attaches the bounded session', async () => {
    const session = { id: 1, tenantId: 23, userId: 91, appId: 10, versionId: 20 };
    const request = runtimeRequest();
    sessionService.authorize.mockResolvedValue(session);

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);

    expect(sessionService.authorize).toHaveBeenCalledWith('runtime-token', 'files.write', {
      requestId: 'req-upload',
      ip: '127.0.0.1',
      userAgent: 'jest',
    });
    expect(request.appRuntimeSession).toBe(session);
  });

  it.each([
    [{ headers: {}, rawHeaders: [] }],
    [
      {
        headers: { 'x-app-runtime-token': 'first, second' },
        rawHeaders: ['X-App-Runtime-Token', 'first', 'x-app-runtime-token', 'second'],
      },
    ],
  ])('rejects malformed runtime authorization before invoking the session service', async (request) => {
    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(sessionService.authorize).not.toHaveBeenCalled();
  });
});

function runtimeRequest() {
  return {
    headers: {
      'x-app-runtime-token': 'runtime-token',
      'x-request-id': 'req-upload',
      'user-agent': 'jest',
    },
    rawHeaders: ['X-App-Runtime-Token', 'runtime-token'],
    ip: '127.0.0.1',
    appRuntimeSession: undefined,
  };
}

function contextFor(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}
