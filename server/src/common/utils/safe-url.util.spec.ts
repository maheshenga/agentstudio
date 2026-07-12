import { BadRequestException } from '@nestjs/common';
import { lookup } from 'dns/promises';

import {
  assertPublicResolvedUrl,
  normalizeExternalHttpUrl,
  resolvePublicExternalUrl,
} from './safe-url.util';

jest.mock('dns/promises', () => ({
  lookup: jest.fn(),
}));

describe('safe-url.util', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes external HTTP URLs', () => {
    expect(
      normalizeExternalHttpUrl(' https://api.example.com/v1/ ', { stripTrailingSlash: true }),
    ).toBe('https://api.example.com/v1');
  });

  it('rejects unsupported protocols and URL credentials', () => {
    expect(() => normalizeExternalHttpUrl('file:///etc/passwd')).toThrow(BadRequestException);
    expect(() => normalizeExternalHttpUrl('https://user:pass@example.com')).toThrow(
      BadRequestException,
    );
  });

  it('rejects local and private literal hosts', () => {
    expect(() => normalizeExternalHttpUrl('http://localhost:3000')).toThrow(BadRequestException);
    expect(() => normalizeExternalHttpUrl('http://127.0.0.1:11434/v1')).toThrow(
      BadRequestException,
    );
    expect(() => normalizeExternalHttpUrl('http://192.168.1.10/admin')).toThrow(
      BadRequestException,
    );
    expect(() => normalizeExternalHttpUrl('http://[::1]/admin')).toThrow(BadRequestException);
    expect(() => normalizeExternalHttpUrl('https://[::ffff:7f00:1]/admin')).toThrow(
      BadRequestException,
    );
    expect(() => normalizeExternalHttpUrl('https://[::c0a8:101]/admin')).toThrow(
      BadRequestException,
    );
    expect(() => normalizeExternalHttpUrl('https://[2002:7f00:1::]/admin')).toThrow(
      BadRequestException,
    );
  });

  it('rejects hostnames that resolve to private addresses', async () => {
    (lookup as jest.Mock).mockResolvedValue([{ address: '10.0.0.5', family: 4 }]);

    await expect(assertPublicResolvedUrl('https://internal.example.test')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('allows hostnames that resolve only to public addresses', async () => {
    (lookup as jest.Mock).mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);

    await expect(assertPublicResolvedUrl('https://example.com/docs')).resolves.toBe(
      'https://example.com/docs',
    );
  });

  it('returns the normalized HTTPS origin, hostname, and all validated public addresses', async () => {
    (lookup as jest.Mock).mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
    ]);

    await expect(
      resolvePublicExternalUrl(' HTTPS://Example.COM:443/hooks?event=ready#secret ', {
        label: 'Runtime URL',
        httpsOnly: true,
      }),
    ).resolves.toEqual({
      url: 'https://example.com/hooks?event=ready',
      origin: 'https://example.com',
      hostname: 'example.com',
      addresses: [
        { address: '93.184.216.34', family: 4 },
        { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
      ],
    });
  });

  it('rejects HTTP and mixed public/private DNS answers for HTTPS-only resolution', async () => {
    await expect(
      resolvePublicExternalUrl('http://example.com/hook', { httpsOnly: true }),
    ).rejects.toBeInstanceOf(BadRequestException);

    (lookup as jest.Mock).mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '169.254.169.254', family: 4 },
    ]);
    await expect(
      resolvePublicExternalUrl('https://example.com/hook', { httpsOnly: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects DNS records whose declared family does not match the resolved address', async () => {
    (lookup as jest.Mock).mockResolvedValue([{ address: '93.184.216.34', family: 6 }]);

    await expect(resolvePublicExternalUrl('https://example.com/hook')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
