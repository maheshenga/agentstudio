import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';

import { AppRuntimeHttpService, type AppRuntimeHttpTransport } from './app-runtime-http.service';

jest.mock('dns/promises', () => ({ lookup: jest.fn() }));

const { lookup } = jest.requireMock('dns/promises') as { lookup: jest.Mock };

describe('AppRuntimeHttpService', () => {
  const versionRepo = { findOne: jest.fn() };
  const transport: jest.Mocked<AppRuntimeHttpTransport> = { execute: jest.fn() };
  const session = {
    id: 1,
    tenantId: 23,
    userId: 91,
    appId: 10,
    versionId: 20,
    installId: 30,
    capabilities: ['http.request'],
  } as any;
  let service: AppRuntimeHttpService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AppRuntimeHttpService(versionRepo as any, transport);
    versionRepo.findOne.mockResolvedValue({
      id: 20,
      appId: 10,
      manifest: { allowedOrigins: ['https://api.example.com', 'https://hooks.example.com'] },
    });
    lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    transport.execute.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json', 'set-cookie': 'secret=1' },
      body: Buffer.from('{"ok":true}'),
    });
  });

  it('pins validated DNS addresses and exposes only approved response headers', async () => {
    await expect(
      service.request(session, {
        url: 'https://api.example.com/v1/data',
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-client-id': 'public' },
        body: { hello: 'world' },
      }),
    ).resolves.toEqual({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: '{"ok":true}',
      truncated: false,
    });
    expect(transport.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://api.example.com/v1/data',
        hostname: 'api.example.com',
        addresses: [{ address: '93.184.216.34', family: 4 }],
        maxResponseBytes: 5 * 1024 * 1024,
      }),
    );
    expect(transport.execute.mock.calls[0][0].timeoutMs).toBeGreaterThan(0);
    expect(transport.execute.mock.calls[0][0].timeoutMs).toBeLessThanOrEqual(15_000);
    expect(versionRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 20, appId: 10 }) }),
    );
  });

  it.each([
    ['HTTP URL', { url: 'http://api.example.com/data', method: 'GET' }],
    ['unapproved origin', { url: 'https://evil.example.com/data', method: 'GET' }],
    ['URL credentials', { url: 'https://user:pass@api.example.com/data', method: 'GET' }],
    [
      'forbidden authorization header',
      { url: 'https://api.example.com/data', method: 'GET', headers: { authorization: 'secret' } },
    ],
    [
      'forbidden forwarding header',
      {
        url: 'https://api.example.com/data',
        method: 'GET',
        headers: { 'x-forwarded-for': '127.0.0.1' },
      },
    ],
  ])('rejects %s before transport', async (_label, input) => {
    await expect(service.request(session, input as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(transport.execute).not.toHaveBeenCalled();
  });

  it('rejects mixed public/private DNS answers before transport', async () => {
    lookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.7', family: 4 },
    ]);

    await expect(
      service.request(session, { url: 'https://api.example.com/data', method: 'GET' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transport.execute).not.toHaveBeenCalled();
  });

  it('revalidates and repins every redirect and caps redirects at three', async () => {
    transport.execute
      .mockResolvedValueOnce({
        status: 302,
        headers: { location: 'https://hooks.example.com/2' },
        body: Buffer.alloc(0),
      })
      .mockResolvedValueOnce({ status: 307, headers: { location: '/3' }, body: Buffer.alloc(0) })
      .mockResolvedValueOnce({ status: 308, headers: { location: '/4' }, body: Buffer.alloc(0) })
      .mockResolvedValueOnce({ status: 302, headers: { location: '/5' }, body: Buffer.alloc(0) });

    await expect(
      service.request(session, { url: 'https://api.example.com/1', method: 'GET' }),
    ).rejects.toThrow('redirect limit');
    expect(lookup).toHaveBeenCalledTimes(4);
    expect(transport.execute).toHaveBeenCalledTimes(4);
    expect(transport.execute.mock.calls[1][0]).toMatchObject({
      url: 'https://hooks.example.com/2',
      hostname: 'hooks.example.com',
    });
  });

  it('shares one 15-second timeout budget across redirects', async () => {
    const clock = jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(6_000);
    transport.execute
      .mockResolvedValueOnce({
        status: 302,
        headers: { location: 'https://hooks.example.com/final' },
        body: Buffer.alloc(0),
      })
      .mockResolvedValueOnce({ status: 200, headers: {}, body: Buffer.from('ok') });

    await service.request(session, { url: 'https://api.example.com/start', method: 'GET' });

    expect(transport.execute.mock.calls.map(([input]) => input.timeoutMs)).toEqual([
      15_000, 10_000,
    ]);
    clock.mockRestore();
  });

  it('rejects oversized requests and redacts transport failures', async () => {
    await expect(
      service.request(session, {
        url: 'https://api.example.com/data',
        method: 'POST',
        body: 'x'.repeat(2 * 1024 * 1024 + 1),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    transport.execute.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.1 with credential'));
    await expect(
      service.request(session, { url: 'https://api.example.com/data', method: 'GET' }),
    ).rejects.toEqual(new ServiceUnavailableException('Upstream request failed'));
  });

  it('emits bounded POST JSON webhooks with a validated event name', async () => {
    await service.emitWebhook(session, {
      url: 'https://hooks.example.com/events',
      event: 'candidate.created',
      payload: { id: 42 },
    });

    expect(transport.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'content-type': 'application/json' }),
        body: Buffer.from(JSON.stringify({ event: 'candidate.created', payload: { id: 42 } })),
      }),
    );
    await expect(
      service.emitWebhook(session, {
        url: 'https://hooks.example.com/events',
        event: '../invalid',
        payload: {},
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.emitWebhook(session, {
        url: 'https://hooks.example.com/events',
        event: 'candidate.created',
        payload: undefined,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.emitWebhook(session, {
        url: 'https://hooks.example.com/events',
        event: 'candidate.created',
        payload: null,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
