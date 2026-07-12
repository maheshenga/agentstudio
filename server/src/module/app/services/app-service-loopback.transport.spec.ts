import {
  BadGatewayException,
  BadRequestException,
  PayloadTooLargeException,
  RequestTimeoutException,
} from '@nestjs/common';
import { AddressInfo } from 'net';
import { createServer, type RequestListener, type Server } from 'http';

import { AppServiceLoopbackTransport } from './app-service-loopback.transport';
import { APP_SERVICE_HOST_SOURCE } from '../runtime/app-service-host';

describe('AppServiceLoopbackTransport', () => {
  let server: Server;
  let transport: AppServiceLoopbackTransport;
  let timeoutMs: number;
  let maxBodyMb: number;

  beforeEach(() => {
    timeoutMs = 1000;
    maxBodyMb = 1;
    transport = new AppServiceLoopbackTransport({
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'appMarketplace.serviceRuntime.requestTimeoutMs') return timeoutMs;
        if (key === 'appMarketplace.serviceRuntime.maxBodyMb') return maxBodyMb;
        return fallback;
      }),
    } as any);
  });

  afterEach(async () => {
    await transport.onModuleDestroy();
    if (server?.listening) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('keeps direct probe input while reserved gateway envelopes pass context separately', () => {
    expect(APP_SERVICE_HOST_SOURCE).toContain("body.__agentstudio_runtime === 1");
    expect(APP_SERVICE_HOST_SOURCE).toContain('service.invoke(body.input, body.context)');
    expect(APP_SERVICE_HOST_SOURCE).toContain('service.invoke(body, {})');
  });

  it('pins health and invoke requests to loopback and returns only allowlisted headers', async () => {
    let observedHost = '';
    let observedBody = '';
    const port = await listen((request, response) => {
      observedHost = request.headers.host || '';
      request.on('data', (chunk) => (observedBody += chunk.toString('utf8')));
      request.on('end', () => {
        response.setHeader('content-type', 'application/json');
        response.setHeader('x-request-id', 'request-1');
        response.setHeader('set-cookie', 'private=1');
        response.end(JSON.stringify({ status: 'ok', echo: observedBody ? JSON.parse(observedBody) : null }));
      });
    });

    await expect(transport.health(port, '/health')).resolves.toEqual({
      statusCode: 200,
      headers: {
        'content-type': 'application/json',
        'x-request-id': 'request-1',
      },
      body: { status: 'ok', echo: null },
    });
    await expect(transport.invoke(port, { value: 1 })).resolves.toMatchObject({
      statusCode: 200,
      body: { status: 'ok', echo: { value: 1 } },
    });
    expect(observedHost).toBe(`127.0.0.1:${port}`);
  });

  it('rejects redirects without following the Location target', async () => {
    const port = await listen((_request, response) => {
      response.writeHead(302, { location: 'https://example.com/private' });
      response.end();
    });

    await expect(transport.health(port, '/health')).rejects.toEqual(
      new BadGatewayException('Service loopback redirects are not allowed'),
    );
  });

  it('rejects request and response bodies over the configured limit', async () => {
    const port = await listen((_request, response) => {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ value: 'x'.repeat(1024 * 1024) }));
    });

    await expect(transport.health(port, '/health')).rejects.toBeInstanceOf(
      PayloadTooLargeException,
    );
    await expect(transport.invoke(port, { value: 'x'.repeat(1024 * 1024) })).rejects.toBeInstanceOf(
      PayloadTooLargeException,
    );
  });

  it('rejects values that cannot be serialized as bounded JSON', async () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    await expect(transport.invoke(21000, circular)).rejects.toEqual(
      new BadRequestException('Service loopback request body must be JSON'),
    );
  });

  it('uses one deadline for headers and body streaming', async () => {
    timeoutMs = 50;
    const port = await listen((_request, response) => {
      response.setHeader('content-type', 'application/json');
      response.write('{"status":');
      setTimeout(() => response.end('"ok"}'), 200);
    });

    await expect(transport.health(port, '/health')).rejects.toBeInstanceOf(RequestTimeoutException);
  });

  it.each([
    [0, '/health', 'port'],
    [70000, '/health', 'port'],
    [21000, 'health', 'path'],
    [21000, '/health?secret=1', 'path'],
  ])('rejects invalid loopback targets', async (port, healthPath, message) => {
    await expect(transport.health(port, healthPath)).rejects.toThrow(message);
  });

  async function listen(handler: RequestListener): Promise<number> {
    server = createServer(handler);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    return (server.address() as AddressInfo).port;
  }
});
