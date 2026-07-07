import { BadRequestException } from '@nestjs/common';
import { lookup } from 'dns/promises';
import { isIP } from 'net';

export interface SafeExternalUrlOptions {
  label?: string;
  stripTrailingSlash?: boolean;
  allowQuery?: boolean;
}

type DnsLookupRecord = {
  address: string;
  family: number;
};

export function normalizeExternalHttpUrl(raw: string, options: SafeExternalUrlOptions = {}): string {
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

  if (!['http:', 'https:'].includes(parsed.protocol)) {
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

export async function assertPublicResolvedUrl(raw: string, options: SafeExternalUrlOptions = {}): Promise<string> {
  const label = options.label || 'URL';
  const normalized = normalizeExternalHttpUrl(raw, options);
  const hostname = normalizeHostname(new URL(normalized).hostname);

  if (isIP(hostname)) {
    assertPublicIp(hostname, label);
    return normalized;
  }

  let records: DnsLookupRecord[];
  try {
    records = (await lookup(hostname, { all: true, verbatim: true })) as DnsLookupRecord[];
  } catch {
    throw new BadRequestException(`${label} host could not be resolved`);
  }

  if (!records.length) {
    throw new BadRequestException(`${label} host could not be resolved`);
  }

  for (const record of records) {
    assertPublicIp(record.address, label);
  }

  return normalized;
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
  const allowed = family === 4 ? isPublicIpv4(address) : family === 6 ? isPublicIpv6(address) : false;
  if (!allowed) {
    throw new BadRequestException(`${label} host is not allowed`);
  }
}

function isPublicIpv4(address: string): boolean {
  const parts = address.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
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
  const base = ((baseParts[0] << 24) >>> 0) + (baseParts[1] << 16) + (baseParts[2] << 8) + baseParts[3];
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (value & mask) === (base & mask);
}

function isPublicIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  const mappedIpv4 = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (mappedIpv4) {
    return isPublicIpv4(mappedIpv4);
  }
  if (normalized === '::' || normalized === '::1') {
    return false;
  }

  const segments = normalized.split(':');
  const first = parseInt(segments[0] || '0', 16);
  const second = parseInt(segments[1] || '0', 16);
  if (!Number.isFinite(first)) {
    return false;
  }

  if ((first & 0xfe00) === 0xfc00) return false;
  if ((first & 0xffc0) === 0xfe80) return false;
  if ((first & 0xff00) === 0xff00) return false;
  if (first === 0x2001 && second === 0x0db8) return false;
  return true;
}
