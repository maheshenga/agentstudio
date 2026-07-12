import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { LookupFunction } from 'node:net';
import { Agent, request as undiciRequest } from 'undici';
import { IsNull, Repository } from 'typeorm';

import {
  resolvePublicExternalUrl,
  type SafeResolvedAddress,
} from '../../../common/utils/safe-url.util';
import {
  APP_RUNTIME_HTTP_METHODS,
  type AppRuntimeHttpMethod,
  type AppRuntimeHttpRequestDto,
  type AppRuntimeWebhookDto,
} from '../dto/app-runtime-http.dto';
import { AppPackageVersionEntity } from '../entities/app-package-version.entity';
import type { AuthorizedAppRuntimeSession } from './app-runtime-session.service';

const MAX_REQUEST_BYTES = 2 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;
const WEBHOOK_EVENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const RESPONSE_HEADER_ALLOWLIST = new Set([
  'cache-control',
  'content-language',
  'content-type',
  'etag',
  'last-modified',
  'retry-after',
  'x-request-id',
]);
const FORBIDDEN_REQUEST_HEADERS = new Set([
  'authorization',
  'connection',
  'content-length',
  'cookie',
  'expect',
  'forwarded',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'via',
  'x-real-ip',
]);

export interface AppRuntimeHttpTransportInput {
  url: string;
  hostname: string;
  addresses: SafeResolvedAddress[];
  method: AppRuntimeHttpMethod;
  headers: Record<string, string>;
  body?: Buffer;
  timeoutMs: number;
  maxResponseBytes: number;
}

export interface AppRuntimeHttpTransportResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
  truncated?: boolean;
}

export interface AppRuntimeHttpTransport {
  execute(input: AppRuntimeHttpTransportInput): Promise<AppRuntimeHttpTransportResponse>;
}

@Injectable()
export class UndiciAppRuntimeHttpTransport implements AppRuntimeHttpTransport {
  async execute(input: AppRuntimeHttpTransportInput): Promise<AppRuntimeHttpTransportResponse> {
    const dispatcher = new Agent({
      connect: { lookup: this.pinnedLookup(input.hostname, input.addresses) },
    });
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), input.timeoutMs);
    try {
      const response = await undiciRequest(input.url, {
        dispatcher,
        method: input.method,
        headers: input.headers,
        body: input.body,
        headersTimeout: input.timeoutMs,
        bodyTimeout: input.timeoutMs,
        signal: abortController.signal,
      });
      const chunks: Buffer[] = [];
      let size = 0;
      let truncated = false;
      for await (const rawChunk of response.body as AsyncIterable<Uint8Array>) {
        const chunk = Buffer.from(rawChunk);
        const remaining = input.maxResponseBytes - size;
        if (remaining <= 0) {
          truncated = true;
          response.body.destroy();
          break;
        }
        if (chunk.length > remaining) {
          chunks.push(chunk.subarray(0, remaining));
          size += remaining;
          truncated = true;
          response.body.destroy();
          break;
        }
        chunks.push(chunk);
        size += chunk.length;
      }
      return {
        status: response.statusCode,
        headers: response.headers as Record<string, string | string[] | undefined>,
        body: Buffer.concat(chunks, size),
        truncated,
      };
    } finally {
      clearTimeout(timeout);
      await dispatcher.close();
    }
  }

  private pinnedLookup(hostname: string, addresses: SafeResolvedAddress[]): LookupFunction {
    return (requestedHost, options, callback) => {
      const requested = String(requestedHost || '')
        .toLowerCase()
        .replace(/^\[(.*)]$/, '$1');
      if (requested !== hostname || addresses.length === 0) {
        callback(new Error('Pinned DNS host mismatch'), '');
        return;
      }
      const requestedFamily =
        options.family === 4 || options.family === 'IPv4'
          ? 4
          : options.family === 6 || options.family === 'IPv6'
            ? 6
            : 0;
      const candidates = requestedFamily
        ? addresses.filter((entry) => entry.family === requestedFamily)
        : addresses;
      if (candidates.length === 0) {
        callback(new Error('Pinned DNS family unavailable'), '');
        return;
      }
      if (options.all) {
        callback(null, candidates);
        return;
      }
      callback(null, candidates[0].address, candidates[0].family);
    };
  }
}

@Injectable()
export class AppRuntimeHttpService {
  constructor(
    @InjectRepository(AppPackageVersionEntity)
    private readonly versionRepo: Repository<AppPackageVersionEntity>,
    @Inject(UndiciAppRuntimeHttpTransport)
    private readonly transport: AppRuntimeHttpTransport,
  ) {}

  async request(session: AuthorizedAppRuntimeSession, input: AppRuntimeHttpRequestDto) {
    const allowedOrigins = await this.loadAllowedOrigins(session);
    const method = this.normalizeMethod(input?.method);
    const headers = this.normalizeRequestHeaders(input?.headers);
    const body = this.serializeBody(input?.body);
    if ((method === 'GET' || method === 'HEAD') && body) {
      throw new BadRequestException('GET and HEAD requests must not contain a body');
    }
    return this.execute(allowedOrigins, String(input?.url || ''), method, headers, body);
  }

  async emitWebhook(session: AuthorizedAppRuntimeSession, input: AppRuntimeWebhookDto) {
    const event = String(input?.event || '').trim();
    if (!WEBHOOK_EVENT_PATTERN.test(event)) {
      throw new BadRequestException('Invalid webhook event');
    }
    if (input?.payload === undefined || input.payload === null) {
      throw new BadRequestException('Webhook payload is required');
    }
    const allowedOrigins = await this.loadAllowedOrigins(session);
    const body = this.serializeBody({ event, payload: input?.payload });
    return this.execute(
      allowedOrigins,
      String(input?.url || ''),
      'POST',
      { 'content-type': 'application/json' },
      body,
    );
  }

  private async execute(
    allowedOrigins: Set<string>,
    rawUrl: string,
    initialMethod: AppRuntimeHttpMethod,
    initialHeaders: Record<string, string>,
    initialBody?: Buffer,
  ) {
    let currentUrl = rawUrl;
    let method = initialMethod;
    let headers = initialHeaders;
    let body = initialBody;
    let redirectCount = 0;
    const deadline = Date.now() + REQUEST_TIMEOUT_MS;

    while (true) {
      const target = await resolvePublicExternalUrl(currentUrl, {
        label: 'Runtime request URL',
        httpsOnly: true,
      });
      if (!allowedOrigins.has(target.origin)) {
        throw new BadRequestException('Runtime request origin is not approved');
      }
      const timeoutMs = deadline - Date.now();
      if (timeoutMs <= 0) {
        throw new ServiceUnavailableException('Upstream request failed');
      }

      let response: AppRuntimeHttpTransportResponse;
      try {
        response = await this.transport.execute({
          url: target.url,
          hostname: target.hostname,
          addresses: target.addresses,
          method,
          headers,
          body,
          timeoutMs,
          maxResponseBytes: MAX_RESPONSE_BYTES,
        });
      } catch {
        throw new ServiceUnavailableException('Upstream request failed');
      }

      const location = this.headerValue(response.headers, 'location');
      if (REDIRECT_STATUSES.has(response.status) && location) {
        if (redirectCount >= MAX_REDIRECTS) {
          throw new BadRequestException('Upstream redirect limit exceeded');
        }
        redirectCount += 1;
        try {
          currentUrl = new URL(location, target.url).toString();
        } catch {
          throw new BadRequestException('Upstream redirect is invalid');
        }
        if (
          response.status === 303 ||
          ((response.status === 301 || response.status === 302) && method === 'POST')
        ) {
          method = 'GET';
          body = undefined;
          headers = { ...headers };
          delete headers['content-type'];
        }
        continue;
      }

      return {
        status: response.status,
        headers: this.filterResponseHeaders(response.headers),
        body: response.body.toString('utf8'),
        truncated: Boolean(response.truncated),
      };
    }
  }

  private async loadAllowedOrigins(session: AuthorizedAppRuntimeSession) {
    const version = await this.versionRepo.findOne({
      where: {
        id: session.versionId,
        appId: session.appId,
        reviewStatus: 'approved',
        publishStatus: 'published',
        deleteTime: IsNull(),
      },
      select: { id: true, appId: true, manifest: true },
    });
    if (!version) throw new UnauthorizedException('App runtime version is inactive');
    const values = version.manifest?.allowedOrigins;
    if (!Array.isArray(values) || values.length === 0) {
      throw new BadRequestException('App runtime has no approved outbound origins');
    }
    const origins = new Set<string>();
    for (const value of values) origins.add(this.normalizeApprovedOrigin(value));
    return origins;
  }

  private normalizeApprovedOrigin(value: unknown) {
    let parsed: URL;
    try {
      parsed = new URL(String(value || '').trim());
    } catch {
      throw new BadRequestException('Invalid approved runtime origin');
    }
    if (
      parsed.protocol !== 'https:' ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== '/' ||
      parsed.search ||
      parsed.hash
    ) {
      throw new BadRequestException('Invalid approved runtime origin');
    }
    return parsed.origin;
  }

  private normalizeMethod(value: unknown): AppRuntimeHttpMethod {
    const method = String(value || '')
      .trim()
      .toUpperCase() as AppRuntimeHttpMethod;
    if (!APP_RUNTIME_HTTP_METHODS.includes(method)) {
      throw new BadRequestException('Unsupported runtime HTTP method');
    }
    return method;
  }

  private normalizeRequestHeaders(input?: Record<string, string>) {
    if (input === undefined) return {};
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid runtime request headers');
    }
    const output: Record<string, string> = {};
    let totalBytes = 0;
    for (const [rawName, rawValue] of Object.entries(input)) {
      const name = String(rawName || '')
        .trim()
        .toLowerCase();
      if (
        !HEADER_NAME_PATTERN.test(name) ||
        FORBIDDEN_REQUEST_HEADERS.has(name) ||
        name.startsWith('x-forwarded-') ||
        name.startsWith('proxy-')
      ) {
        throw new BadRequestException('Runtime request header is not allowed');
      }
      if (typeof rawValue !== 'string' || /[\r\n\0]/.test(rawValue)) {
        throw new BadRequestException('Invalid runtime request header');
      }
      totalBytes += Buffer.byteLength(name) + Buffer.byteLength(rawValue);
      if (totalBytes > 16 * 1024) {
        throw new BadRequestException('Runtime request headers are too large');
      }
      output[name] = rawValue;
    }
    return output;
  }

  private serializeBody(value: unknown): Buffer | undefined {
    if (value === undefined || value === null) return undefined;
    let body: Buffer;
    try {
      body = Buffer.from(typeof value === 'string' ? value : JSON.stringify(value), 'utf8');
    } catch {
      throw new BadRequestException('Runtime request body must be JSON serializable');
    }
    if (body.length > MAX_REQUEST_BYTES) {
      throw new BadRequestException('Runtime request body exceeds the limit');
    }
    return body;
  }

  private filterResponseHeaders(headers: Record<string, string | string[] | undefined>) {
    const output: Record<string, string> = {};
    for (const [rawName, rawValue] of Object.entries(headers || {})) {
      const name = rawName.toLowerCase();
      if (!RESPONSE_HEADER_ALLOWLIST.has(name) || rawValue === undefined) continue;
      const value = Array.isArray(rawValue) ? rawValue.join(', ') : String(rawValue);
      if (!/[\r\n\0]/.test(value)) output[name] = value.slice(0, 4096);
    }
    return output;
  }

  private headerValue(headers: Record<string, string | string[] | undefined>, name: string) {
    const entry = Object.entries(headers || {}).find(([key]) => key.toLowerCase() === name);
    const value = entry?.[1];
    return Array.isArray(value) ? String(value[0] || '') : String(value || '');
  }
}
