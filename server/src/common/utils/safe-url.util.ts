import { BadRequestException } from '@nestjs/common';
import { lookup } from 'dns/promises';
import { isIP } from 'net';

export interface SafeExternalUrlOptions {
  label?: string;
  stripTrailingSlash?: boolean;
  allowQuery?: boolean;
  httpsOnly?: boolean;
}

export type SafeResolvedAddress = {
  address: string;
  family: 4 | 6;
};

export interface ResolvedPublicExternalUrl {
  url: string;
  origin: string;
  hostname: string;
  addresses: SafeResolvedAddress[];
}

export function normalizeExternalHttpUrl(
  raw: string,
  options: SafeExternalUrlOptions = {},
): string {
  const label = options.label || 'URL';
  const value = String(raw || '').trim();
  if (!value) {
    throw new BadRequestException(`${label} is required`);
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new BadRequestException(`${label} must be a valid URL`);
  }

  if (
    options.httpsOnly
      ? parsed.protocol !== 'https:'
      : !['http:', 'https:'].includes(parsed.protocol)
  ) {
    if (options.httpsOnly) {
      throw new BadRequestException(`${label} must use https`);
    }
    throw new BadRequestException(`${label} must use http or https`);
  }
  if (parsed.username || parsed.password) {
    throw new BadRequestException(`${label} must not contain credentials`);
  }
  if (options.allowQuery === false && parsed.search) {
    throw new BadRequestException(`${label} must not contain query parameters`);
  }

  assertPublicHostname(parsed.hostname, label);
  parsed.hash = '';

  if (options.stripTrailingSlash) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  }

  let normalized = parsed.toString();
  if (options.stripTrailingSlash && parsed.pathname === '/' && !parsed.search) {
    normalized = normalized.replace(/\/$/, '');
  }
  return normalized;
}

export async function assertPublicResolvedUrl(
  raw: string,
  options: SafeExternalUrlOptions = {},
): Promise<string> {
  return (await resolvePublicExternalUrl(raw, options)).url;
}

export async function resolvePublicExternalUrl(
  raw: string,
  options: SafeExternalUrlOptions = {},
): Promise<ResolvedPublicExternalUrl> {
  const label = options.label || 'URL';
  const normalized = normalizeExternalHttpUrl(raw, options);
  const parsed = new URL(normalized);
  const hostname = normalizeHostname(parsed.hostname);

  const literalFamily = isIP(hostname);
  if (literalFamily) {
    assertPublicIp(hostname, label);
    return {
      url: normalized,
      origin: parsed.origin,
      hostname,
      addresses: [{ address: hostname, family: literalFamily as 4 | 6 }],
    };
  }

  let records: Array<{ address: string; family: number }>;
  try {
    records = (await lookup(hostname, { all: true, verbatim: true })) as Array<{
      address: string;
      family: number;
    }>;
  } catch {
    throw new BadRequestException(`${label} host could not be resolved`);
  }

  if (!records.length) {
    throw new BadRequestException(`${label} host could not be resolved`);
  }

  const addresses: SafeResolvedAddress[] = [];
  const seen = new Set<string>();
  for (const record of records) {
    assertPublicIp(record.address, label);
    const family = isIP(record.address);
    if (
      (family !== 4 && family !== 6) ||
      (record.family !== 4 && record.family !== 6) ||
      family !== record.family
    ) {
      throw new BadRequestException(`${label} host is not allowed`);
    }
    const key = `${family}:${record.address.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      addresses.push({ address: record.address, family });
    }
  }

  return {
    url: normalized,
    origin: parsed.origin,
    hostname,
    addresses,
  };
}

function assertPublicHostname(hostname: string, label: string): void {
  const normalized = normalizeHostname(hostname);
  if (!normalized) {
    throw new BadRequestException(`${label} host is required`);
  }
  if (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.internal')
  ) {
    throw new BadRequestException(`${label} host is not allowed`);
  }

  if (isIP(normalized)) {
    assertPublicIp(normalized, label);
  }
}

function normalizeHostname(hostname: string): string {
  return String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/^\[(.*)]$/, '$1');
}

function assertPublicIp(address: string, label: string): void {
  const family = isIP(address);
  const allowed =
    family === 4 ? isPublicIpv4(address) : family === 6 ? isPublicIpv6(address) : false;
  if (!allowed) {
    throw new BadRequestException(`${label} host is not allowed`);
  }
}

function isPublicIpv4(address: string): boolean {
  const parts = address.split('.').map((part) => Number(part));
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }
  const value = ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];

  return ![
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.0.0.0', 24],
    ['192.0.2.0', 24],
    ['192.168.0.0', 16],
    ['198.18.0.0', 15],
    ['198.51.100.0', 24],
    ['203.0.113.0', 24],
    ['224.0.0.0', 4],
    ['240.0.0.0', 4],
  ].some(([range, bits]) => ipv4InRange(value, range as string, bits as number));
}

function ipv4InRange(value: number, range: string, bits: number): boolean {
  const baseParts = range.split('.').map((part) => Number(part));
  const base =
    ((baseParts[0] << 24) >>> 0) + (baseParts[1] << 16) + (baseParts[2] << 8) + baseParts[3];
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (value & mask) === (base & mask);
}

function isPublicIpv6(address: string): boolean {
  const value = parseIpv6(address);
  if (value === null || !ipv6InRange(value, '2000::', 3)) return false;

  return ![
    ['2001::', 32],
    ['2001:2::', 48],
    ['2001:10::', 28],
    ['2001:20::', 28],
    ['2001:db8::', 32],
    ['2002::', 16],
    ['3fff::', 20],
  ].some(([range, bits]) => ipv6InRange(value, range as string, bits as number));
}

function parseIpv6(address: string): bigint | null {
  let normalized = String(address || '')
    .trim()
    .toLowerCase()
    .replace(/^\[(.*)]$/, '$1');
  if (!normalized || normalized.includes('%')) return null;

  if (normalized.includes('.')) {
    const separator = normalized.lastIndexOf(':');
    if (separator < 0) return null;
    const ipv4 = normalized.slice(separator + 1);
    if (!isIP(ipv4) || !ipv4.split('.').every((part) => /^\d{1,3}$/.test(part))) return null;
    const bytes = ipv4.split('.').map(Number);
    normalized = `${normalized.slice(0, separator)}:${((bytes[0] << 8) | bytes[1]).toString(16)}:${(
      (bytes[2] << 8) |
      bytes[3]
    ).toString(16)}`;
  }

  const halves = normalized.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null;
  const segments = [...left, ...Array<string>(Math.max(0, missing)).fill('0'), ...right];
  if (segments.length !== 8 || segments.some((segment) => !/^[0-9a-f]{1,4}$/.test(segment)))
    return null;

  return segments.reduce((value, segment) => (value << 16n) | BigInt(parseInt(segment, 16)), 0n);
}

function ipv6InRange(value: bigint, range: string, bits: number): boolean {
  const base = parseIpv6(range);
  if (base === null || bits < 0 || bits > 128) return false;
  if (bits === 0) return true;
  const shift = BigInt(128 - bits);
  return value >> shift === base >> shift;
}
