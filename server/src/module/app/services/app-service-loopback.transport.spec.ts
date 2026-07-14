import {
  BadGatewayException,
  BadRequestException,
  PayloadTooLargeException,
  RequestTimeoutException,
} from '@nestjs/common';
import * as fs from 'fs';
import { AddressInfo } from 'net';
import { createServer, type RequestListener, type Server } from 'http';
import * as os from 'os';
import * as path from 'path';

import { AppServiceLoopbackTransport } from './app-service-loopback.transport';
import { APP_SERVICE_HOST_SOURCE } from '../runtime/app-service-host';

describe('AppServiceLoopbackTransport', () => {
  let server: Server;
  let transport: AppServiceLoopbackTransport;
  let timeoutMs: number;
  let maxBodyMb: number;
  let tempRoot: string;
  let socketRoot: string;

  beforeEach(() => {
    timeoutMs = 1000;
    maxBodyMb = 1;
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'app-service-loopback-'));
    socketRoot = path.join(tempRoot, 'sockets');
    fs.mkdirSync(socketRoot, { mode: 0o700 });
    fs.chmodSync(socketRoot, 0o700);
    transport = new AppServiceLoopbackTransport({
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'appMarketplace.serviceRuntime.requestTimeoutMs') return timeoutMs;
        if (key === 'appMarketplace.serviceRuntime.maxBodyMb') return maxBodyMb;
        if (key === 'appMarketplace.serviceRuntime.socketDir') return socketRoot;
        return fallback;
      }),
    } as any);
  });

  afterEach(async () => {
    await transport.onModuleDestroy();
    if (server?.listening) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('keeps direct probe input while reserved gateway envelopes pass context separately', () => {
    expect(APP_SERVICE_HOST_SOURCE).toContain('body.__agentstudio_runtime === 1');
    expect(APP_SERVICE_HOST_SOURCE).toContain('service.invoke(body.input, body.context)');
    expect(APP_SERVICE_HOST_SOURCE).toContain('service.invoke(body, {})');
  });

  it('generates a host that accepts exactly one endpoint mode and cleans only its Unix socket', () => {
    expect(APP_SERVICE_HOST_SOURCE).toContain('APP_SERVICE_SOCKET');
    expect(APP_SERVICE_HOST_SOURCE).toContain('Boolean(socketPath) === Boolean(port)');
    expect(APP_SERVICE_HOST_SOURCE).toContain('server.listen(socketPath)');
    expect(APP_SERVICE_HOST_SOURCE).toContain('stat.isSocket()');
    expect(APP_SERVICE_HOST_SOURCE).toContain("process.on('SIGTERM'");
    expect(APP_SERVICE_HOST_SOURCE).toContain("process.on('SIGINT'");
  });

  it('uses a short-lived Unix socket dispatcher and closes it after the request', async () => {
    const socketPath = path.join(socketRoot, 'agentstudio-app-demo-service-1-0-0', 'service.sock');
    const close = jest.fn().mockResolvedValue(undefined);
    const dispatcher = { close };
    jest.spyOn(transport as any, 'validateUnixEndpoint').mockReturnValue(socketPath);
    jest.spyOn(transport as any, 'createUnixDispatcher').mockReturnValue(dispatcher);
    const request = jest
      .spyOn(transport as any, 'request')
      .mockResolvedValue(responseOf(200, { status: 'ok' }, { 'content-type': 'application/json' }));

    await expect(transport.invoke({ kind: 'unix', socketPath }, { value: 1 })).resolves.toEqual({
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: { status: 'ok' },
    });
    expect(request).toHaveBeenCalledWith(
      'http://localhost/invoke',
      expect.objectContaining({ dispatcher, method: 'POST' }),
    );
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('rejects relative, escaped, symlinked, and non-socket Unix targets', async () => {
    const processDir = path.join(socketRoot, 'agentstudio-app-demo-service-1-0-0');
    fs.mkdirSync(processDir, { mode: 0o700 });
    fs.chmodSync(processDir, 0o700);
    const regularFile = path.join(processDir, 'service.sock');
    fs.writeFileSync(regularFile, 'not-a-socket');

    await expect(
      transport.health({ kind: 'unix', socketPath: 'service.sock' }, '/health'),
    ).rejects.toThrow('socket path');
    await expect(
      transport.health(
        { kind: 'unix', socketPath: path.join(tempRoot, 'outside.sock') },
        '/health',
      ),
    ).rejects.toThrow('socket path');
    await expect(
      transport.health({ kind: 'unix', socketPath: regularFile }, '/health'),
    ).rejects.toThrow('socket');

    fs.rmSync(processDir, { recursive: true, force: true });
    const realDir = path.join(tempRoot, 'real-process');
    fs.mkdirSync(realDir, { mode: 0o700 });
    fs.symlinkSync(realDir, processDir, process.platform === 'win32' ? 'junction' : 'dir');
    await expect(
      transport.health(
        { kind: 'unix', socketPath: path.join(processDir, 'service.sock') },
        '/health',
      ),
    ).rejects.toThrow('symbolic link');
  });

  it('clears its deadline when Unix endpoint validation fails before a request', async () => {
    jest.useFakeTimers();
    try {
      await expect(
        transport.health({ kind: 'unix', socketPath: 'service.sock' }, '/health'),
      ).rejects.toThrow('socket path');
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
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
        response.end(
          JSON.stringify({ status: 'ok', echo: observedBody ? JSON.parse(observedBody) : null }),
        );
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

  function responseOf(statusCode: number, body: unknown, headers: Record<string, string>) {
    const encoded = Buffer.from(JSON.stringify(body));
    return {
      statusCode,
      headers,
      body: {
        async *[Symbol.asyncIterator]() {
          yield encoded;
        },
        on: jest.fn(),
        destroy: jest.fn(),
      },
    };
  }
});
