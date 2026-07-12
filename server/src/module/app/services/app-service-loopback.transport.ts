import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  Injectable,
  OnModuleDestroy,
  PayloadTooLargeException,
  RequestTimeoutException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LookupFunction } from 'node:net';
import { Agent, request as undiciRequest } from 'undici';

export interface AppServiceLoopbackResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
}

interface AppServiceLoopbackRequest {
  port: number;
  path: string;
  method: 'GET' | 'POST';
  body?: unknown;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const RESPONSE_HEADER_ALLOWLIST = new Set(['content-type', 'retry-after', 'x-request-id']);

@Injectable()
export class AppServiceLoopbackTransport implements OnModuleDestroy {
  private readonly dispatcher = new Agent({
    connect: { lookup: this.loopbackLookup() },
    connections: 10,
    pipelining: 0,
  });

  constructor(private readonly configService: ConfigService) {}

  health(port: number, healthPath: string) {
    return this.execute({ port, path: healthPath, method: 'GET' });
  }

  invoke(port: number, body: unknown) {
    return this.execute({ port, path: '/invoke', method: 'POST', body });
  }

  async onModuleDestroy() {
    await this.dispatcher.close();
  }

  private async execute(input: AppServiceLoopbackRequest): Promise<AppServiceLoopbackResponse> {
    this.validateTarget(input.port, input.path);
    const maxBodyBytes = this.maxBodyBytes();
    const requestBody = input.body === undefined ? undefined : this.serializeBody(input.body);
    if (requestBody && requestBody.length > maxBodyBytes) {
      throw new PayloadTooLargeException('Service loopback request body is too large');
    }

    const timeoutMs = this.timeoutMs();
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), timeoutMs);
    try {
      const response = await undiciRequest(
        `http://127.0.0.1:${input.port}${input.path}`,
        {
          dispatcher: this.dispatcher,
          method: input.method,
          headers: requestBody
            ? { 'content-type': 'application/json', accept: 'application/json' }
            : { accept: 'application/json' },
          body: requestBody,
          headersTimeout: timeoutMs,
          bodyTimeout: timeoutMs,
          signal: abortController.signal,
        },
      );
      if (REDIRECT_STATUSES.has(response.statusCode)) {
        this.destroyBody(response.body);
        throw new BadGatewayException('Service loopback redirects are not allowed');
      }

      const contentLength = Number(this.headerValue(response.headers['content-length']));
      if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
        this.destroyBody(response.body);
        throw new PayloadTooLargeException('Service loopback response body is too large');
      }

      const chunks: Buffer[] = [];
      let size = 0;
      for await (const rawChunk of response.body as AsyncIterable<Uint8Array>) {
        const chunk = Buffer.from(rawChunk);
        size += chunk.length;
        if (size > maxBodyBytes) {
          this.destroyBody(response.body);
          throw new PayloadTooLargeException('Service loopback response body is too large');
        }
        chunks.push(chunk);
      }
      const rawBody = Buffer.concat(chunks, size).toString('utf8');
      let body: unknown = null;
      if (rawBody) {
        try {
          body = JSON.parse(rawBody) as unknown;
        } catch {
          throw new BadGatewayException('Service loopback response is not valid JSON');
        }
      }

      return {
        statusCode: response.statusCode,
        headers: this.responseHeaders(response.headers),
        body,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (abortController.signal.aborted) {
        throw new RequestTimeoutException('Service loopback request timed out');
      }
      throw new BadGatewayException('Service loopback request failed');
    } finally {
      clearTimeout(timeout);
    }
  }

  private validateTarget(port: number, targetPath: string) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new BadRequestException('Invalid service loopback port');
    }
    if (
      !/^\/[A-Za-z0-9/_-]*$/.test(String(targetPath || '')) ||
      targetPath.startsWith('//')
    ) {
      throw new BadRequestException('Invalid service loopback path');
    }
  }

  private serializeBody(value: unknown) {
    try {
      const serialized = JSON.stringify(value);
      if (serialized === undefined) throw new Error('not_json');
      return Buffer.from(serialized, 'utf8');
    } catch {
      throw new BadRequestException('Service loopback request body must be JSON');
    }
  }

  private timeoutMs() {
    const value = Number(
      this.configService.get<number>('appMarketplace.serviceRuntime.requestTimeoutMs') ?? 15_000,
    );
    return Math.min(30_000, Math.max(1, Math.trunc(value) || 15_000));
  }

  private maxBodyBytes() {
    const value = Number(
      this.configService.get<number>('appMarketplace.serviceRuntime.maxBodyMb') ?? 2,
    );
    return Math.min(10, Math.max(1, Math.trunc(value) || 2)) * 1024 * 1024;
  }

  private responseHeaders(headers: Record<string, string | string[] | undefined>) {
    const output: Record<string, string> = {};
    for (const name of RESPONSE_HEADER_ALLOWLIST) {
      const value = this.headerValue(headers[name]);
      if (value) output[name] = value;
    }
    return output;
  }

  private headerValue(value: string | string[] | undefined) {
    if (Array.isArray(value)) return value[0] || '';
    return String(value || '');
  }

  private destroyBody(body: { on: (event: string, listener: () => void) => unknown; destroy: () => void }) {
    body.on('error', () => undefined);
    body.destroy();
  }

  private loopbackLookup(): LookupFunction {
    return (hostname, options, callback) => {
      const normalized = String(hostname || '')
        .toLowerCase()
        .replace(/^\[(.*)]$/, '$1');
      if (normalized !== '127.0.0.1' || options.family === 6 || options.family === 'IPv6') {
        callback(new Error('Loopback host mismatch'), '');
        return;
      }
      if (options.all) {
        callback(null, [{ address: '127.0.0.1', family: 4 }]);
        return;
      }
      callback(null, '127.0.0.1', 4);
    };
  }
}
