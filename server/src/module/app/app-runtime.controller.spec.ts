import { BadRequestException } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../../common/constant';

import { AppRuntimeController } from './app-runtime.controller';

describe('AppRuntimeController', () => {
  const sessionService = { authorize: jest.fn() };
  const contextService = { buildAuthorizedContext: jest.fn() };
  const kvService = { get: jest.fn(), set: jest.fn(), delete: jest.fn() };
  const fileService = { upload: jest.fn(), open: jest.fn(), delete: jest.fn() };
  const httpService = { request: jest.fn(), emitWebhook: jest.fn() };
  const invocationPolicy = { invoke: jest.fn() };
  let controller: AppRuntimeController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AppRuntimeController(
      sessionService as any,
      contextService as any,
      kvService as any,
      fileService as any,
      httpService as any,
      invocationPolicy as any,
    );
  });

  it('authorizes service.invoke and delegates only the authorized session and bounded input', async () => {
    const session = { id: 1, tenantId: 23, userId: 91, appId: 10, versionId: 20 };
    sessionService.authorize.mockResolvedValue(session);
    invocationPolicy.invoke.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: { ok: true },
    });

    await expect(
      controller.invokeService(
        runtimeRequest('req-service'),
        'workflow_service',
        { input: { job: 'run' } },
      ),
    ).resolves.toMatchObject({ data: { status: 200, data: { ok: true } } });

    expect(sessionService.authorize).toHaveBeenCalledWith(
      'runtime-token',
      'service.invoke',
      expect.objectContaining({ requestId: 'req-service' }),
    );
    expect(invocationPolicy.invoke).toHaveBeenCalledWith(
      session,
      'workflow_service',
      { job: 'run' },
    );
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, AppRuntimeController.prototype.invokeService),
    ).toBe(true);
  });

  it('rejects malformed target codes and deeply nested runtime input', async () => {
    sessionService.authorize.mockResolvedValue({
      id: 1,
      tenantId: 23,
      userId: 91,
      appId: 10,
      versionId: 20,
    });
    await expect(
      controller.invokeService(runtimeRequest('req-service'), '../target', { input: {} }),
    ).rejects.toBeInstanceOf(BadRequestException);

    let input: unknown = 'leaf';
    for (let index = 0; index < 21; index += 1) input = { child: input };
    await expect(
      controller.invokeService(runtimeRequest('req-service'), 'workflow_service', {
        input: input as any,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(invocationPolicy.invoke).not.toHaveBeenCalled();
  });

  it('authorizes file upload with files.write and never returns a storage path', async () => {
    const session = { id: 1, tenantId: 23, userId: 91, appId: 10, versionId: 20 };
    const file = { originalname: 'notes.txt', buffer: Buffer.from('hello') } as any;
    const metadata = { id: 'a'.repeat(43), name: 'notes.txt', size: 5 };
    sessionService.authorize.mockResolvedValue(session);
    fileService.upload.mockResolvedValue(metadata);
    const request = runtimeRequest('req-file');
    request.appRuntimeSession = session;

    await expect(controller.filesUpload(request, file)).resolves.toMatchObject({ data: metadata });
    expect(sessionService.authorize).not.toHaveBeenCalled();
    expect(fileService.upload).toHaveBeenCalledWith(session, file);
    expect(JSON.stringify(metadata)).not.toMatch(/storage|path|token/i);
  });

  it('refuses file upload when the pre-body guard did not attach a session', async () => {
    await expect(
      controller.filesUpload(runtimeRequest('req-file'), {
        originalname: 'notes.txt',
        buffer: Buffer.from('hello'),
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fileService.upload).not.toHaveBeenCalled();
  });

  it('authorizes file read and emits bounded attachment headers', async () => {
    const session = { id: 1, tenantId: 23, userId: 91, appId: 10, versionId: 20 };
    const stream = { pipe: jest.fn() };
    sessionService.authorize.mockResolvedValue(session);
    fileService.open.mockResolvedValue({
      stream,
      name: 'notes\r\nInjected.txt',
      mimeType: 'text/plain',
      size: 5,
    });
    const response = { setHeader: jest.fn() } as any;

    const result = await controller.filesRead(
      runtimeRequest('req-read'),
      { objectId: 'a'.repeat(43) },
      response,
    );

    expect(sessionService.authorize).toHaveBeenCalledWith(
      'runtime-token',
      'files.read',
      expect.any(Object),
    );
    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'text/plain');
    expect(response.setHeader).toHaveBeenCalledWith('Content-Length', '5');
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
    expect(
      response.setHeader.mock.calls.find(([name]) => name === 'Content-Disposition')[1],
    ).not.toMatch(/[\r\n]/);
    expect(result.getStream()).toBe(stream);
  });

  it('authorizes file deletion with files.write', async () => {
    const session = { id: 1, tenantId: 23, userId: 91, appId: 10, versionId: 20 };
    sessionService.authorize.mockResolvedValue(session);
    fileService.delete.mockResolvedValue({ deleted: true });
    await controller.filesDelete(runtimeRequest('req-delete'), { objectId: 'a'.repeat(43) });
    expect(sessionService.authorize).toHaveBeenCalledWith(
      'runtime-token',
      'files.write',
      expect.any(Object),
    );
    expect(fileService.delete).toHaveBeenCalledWith(session, 'a'.repeat(43));
  });

  it.each([
    ['kvGet', 'kv.read', 'get', undefined],
    ['kvSet', 'kv.write', 'set', { value: { enabled: true } }],
    ['kvDelete', 'kv.delete', 'delete', undefined],
  ])(
    'authorizes %s with its dedicated capability',
    async (method, capability, serviceMethod, body) => {
      const session = { id: 1, tenantId: 23, userId: 91, appId: 10, versionId: 20 };
      sessionService.authorize.mockResolvedValue(session);
      kvService[serviceMethod].mockResolvedValue({ key: 'theme' });
      const request = {
        headers: { 'x-app-runtime-token': 'runtime-token', 'x-request-id': 'req-kv' },
        rawHeaders: ['X-App-Runtime-Token', 'runtime-token'],
        ip: '127.0.0.1',
      } as any;

      await controller[method](request, 'settings', 'theme', body);

      expect(sessionService.authorize).toHaveBeenCalledWith('runtime-token', capability, {
        requestId: 'req-kv',
        ip: '127.0.0.1',
        userAgent: '',
      });
      expect(kvService[serviceMethod]).toHaveBeenCalledWith(
        session,
        'settings',
        'theme',
        ...(body ? [body] : []),
      );
    },
  );

  it.each([
    [
      'httpRequest',
      'http.request',
      'request',
      { url: 'https://api.example.com/data', method: 'GET' },
    ],
    [
      'webhookEmit',
      'webhook.emit',
      'emitWebhook',
      { url: 'https://hooks.example.com/events', event: 'candidate.created', payload: { id: 42 } },
    ],
  ])(
    'authorizes %s with its dedicated capability',
    async (method, capability, serviceMethod, body) => {
      const session = { id: 1, tenantId: 23, userId: 91, appId: 10, versionId: 20 };
      sessionService.authorize.mockResolvedValue(session);
      httpService[serviceMethod].mockResolvedValue({ status: 202 });

      await expect(controller[method](runtimeRequest('req-http'), body)).resolves.toMatchObject({
        data: { status: 202 },
      });
      expect(sessionService.authorize).toHaveBeenCalledWith(
        'runtime-token',
        capability,
        expect.objectContaining({ requestId: 'req-http' }),
      );
      expect(httpService[serviceMethod]).toHaveBeenCalledWith(session, body);
    },
  );

  it('is public to the JWT guard but authorizes the dedicated runtime token', async () => {
    const session = { id: 1, tenantId: 23, userId: 91, appId: 10, versionId: 20 };
    sessionService.authorize.mockResolvedValue(session);
    contextService.buildAuthorizedContext.mockResolvedValue({ tenant: { id: '23', name: 'Acme' } });
    const request = {
      headers: {
        'x-app-runtime-token': 'runtime-token',
        'x-request-id': 'req-1',
        'user-agent': 'jest',
      },
      rawHeaders: ['X-App-Runtime-Token', 'runtime-token'],
      ip: '127.0.0.1',
    } as any;

    await expect(controller.context(request)).resolves.toMatchObject({
      code: 200,
      data: { tenant: { id: '23', name: 'Acme' } },
    });
    expect(sessionService.authorize).toHaveBeenCalledWith('runtime-token', 'context.read', {
      requestId: 'req-1',
      ip: '127.0.0.1',
      userAgent: 'jest',
    });
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, AppRuntimeController.prototype.context)).toBe(true);
  });

  it.each([
    ['missing', { headers: {}, rawHeaders: [] }],
    [
      'duplicated',
      {
        headers: { 'x-app-runtime-token': 'first, second' },
        rawHeaders: ['X-App-Runtime-Token', 'first', 'x-app-runtime-token', 'second'],
      },
    ],
    [
      'oversized',
      {
        headers: { 'x-app-runtime-token': 'x'.repeat(257) },
        rawHeaders: ['X-App-Runtime-Token', 'x'.repeat(257)],
      },
    ],
  ])('rejects a %s runtime token header before authorization', async (_label, request) => {
    await expect(controller.context(request as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(sessionService.authorize).not.toHaveBeenCalled();
  });
});

function runtimeRequest(requestId: string) {
  return {
    headers: { 'x-app-runtime-token': 'runtime-token', 'x-request-id': requestId },
    rawHeaders: ['X-App-Runtime-Token', 'runtime-token'],
    ip: '127.0.0.1',
  } as any;
}
