import { BadRequestException } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../../common/constant';

import { AppRuntimeController } from './app-runtime.controller';

describe('AppRuntimeController', () => {
  const sessionService = { authorize: jest.fn() };
  const contextService = { buildAuthorizedContext: jest.fn() };
  const kvService = { get: jest.fn(), set: jest.fn(), delete: jest.fn() };
  let controller: AppRuntimeController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AppRuntimeController(
      sessionService as any,
      contextService as any,
      kvService as any,
    );
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
