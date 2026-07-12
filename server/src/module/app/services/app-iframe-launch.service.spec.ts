import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { createHash, createHmac } from 'crypto';

import { AppIframeLaunchService } from './app-iframe-launch.service';

describe('AppIframeLaunchService', () => {
  const redisClient = { set: jest.fn(), eval: jest.fn() };
  const redisService = { getClient: jest.fn(() => redisClient) };
  const runtimeSessionService = { isEnabled: jest.fn(), issue: jest.fn() };
  const originalEnabled = process.env.APP_RUNTIME_IFRAME_LAUNCH_ENABLED;
  const originalSecret = process.env.APP_RUNTIME_LAUNCH_SECRET;
  let service: AppIframeLaunchService;

  const input = {
    tenantId: 23,
    userId: 91,
    appId: 10,
    versionId: 20,
    installId: 30,
    entryUrl: 'https://external.example.com/app',
    allowedOrigins: ['https://external.example.com'],
    capabilities: ['context.read', 'kv.read'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.APP_RUNTIME_IFRAME_LAUNCH_ENABLED = 'true';
    process.env.APP_RUNTIME_LAUNCH_SECRET = 'test-only-iframe-launch-secret-32-bytes';
    redisClient.set.mockResolvedValue('OK');
    redisClient.eval.mockResolvedValue(1);
    runtimeSessionService.issue.mockResolvedValue({
      token: 'host-only-runtime-token',
      expires_at: '2026-07-12T08:00:00.000Z',
      capabilities: ['context.read', 'kv.read'],
    });
    runtimeSessionService.isEnabled.mockReturnValue(true);
    service = new AppIframeLaunchService(redisService as any, runtimeSessionService as any);
  });

  afterAll(() => {
    if (originalEnabled === undefined) delete process.env.APP_RUNTIME_IFRAME_LAUNCH_ENABLED;
    else process.env.APP_RUNTIME_IFRAME_LAUNCH_ENABLED = originalEnabled;
    if (originalSecret === undefined) delete process.env.APP_RUNTIME_LAUNCH_SECRET;
    else process.env.APP_RUNTIME_LAUNCH_SECRET = originalSecret;
  });

  it('creates an exact-origin launch token only in a URL fragment', async () => {
    const launch = await service.create(input);

    expect(launch).toMatchObject({
      fragment: expect.stringMatching(/^#agentstudio_launch=[A-Za-z0-9_.~-]+$/),
      expires_at: expect.any(String),
      origin: 'https://external.example.com',
    });
    expect(launch.fragment).not.toContain('?');
    expect(launch.fragment).not.toContain('host-only-runtime-token');
    expect(redisClient.set).toHaveBeenCalledWith(
      expect.stringMatching(/^app-runtime:iframe-launch:[a-f0-9]{64}$/),
      '1',
      'EX',
      60,
      'NX',
    );
  });

  it('atomically consumes a launch once and issues the runtime session to the host', async () => {
    const launch = await service.create(input);
    const launchToken = launch.fragment.slice('#agentstudio_launch='.length);

    await expect(
      service.exchange({ tenantId: 23, userId: 91, launchToken }),
    ).resolves.toMatchObject({ token: 'host-only-runtime-token' });
    expect(redisClient.eval).toHaveBeenCalledWith(
      expect.stringContaining('redis.call'),
      1,
      expect.stringMatching(/^app-runtime:iframe-launch:/),
    );
    expect(runtimeSessionService.issue).toHaveBeenCalledWith({
      tenantId: 23,
      userId: 91,
      appId: 10,
      versionId: 20,
      installId: 30,
      capabilities: ['context.read', 'kv.read'],
    });

    redisClient.eval.mockResolvedValueOnce(0);
    await expect(
      service.exchange({ tenantId: 23, userId: 91, launchToken }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(runtimeSessionService.issue).toHaveBeenCalledTimes(1);
  });

  it('rejects tampering, expiry, and JWT tenant or user mismatches with fixed errors', async () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(1_000);
    const launch = await service.create(input);
    const launchToken = launch.fragment.slice('#agentstudio_launch='.length);
    const tampered = `${launchToken.slice(0, -1)}${launchToken.endsWith('a') ? 'b' : 'a'}`;

    await expect(
      service.exchange({ tenantId: 23, userId: 91, launchToken: tampered }),
    ).rejects.toEqual(new UnauthorizedException('Iframe launch is invalid or expired'));
    await expect(service.exchange({ tenantId: 24, userId: 91, launchToken })).rejects.toEqual(
      new UnauthorizedException('Iframe launch is invalid or expired'),
    );
    await expect(service.exchange({ tenantId: 23, userId: 92, launchToken })).rejects.toEqual(
      new UnauthorizedException('Iframe launch is invalid or expired'),
    );
    expect(redisClient.eval).not.toHaveBeenCalled();

    clock.mockReturnValue(61_001);
    await expect(service.exchange({ tenantId: 23, userId: 91, launchToken })).rejects.toEqual(
      new UnauthorizedException('Iframe launch is invalid or expired'),
    );
    expect(JSON.stringify(await rejectionMessage(service, launchToken))).not.toContain(launchToken);
    clock.mockRestore();
  });

  it('rejects signed malformed origins and future-issued claims with the same fixed error', async () => {
    const now = Math.floor(Date.now() / 1000);
    const baseClaims = {
      version: 1,
      tenantId: 23,
      userId: 91,
      appId: 10,
      versionId: 20,
      installId: 30,
      origin: 'https://external.example.com',
      capabilities: ['context.read'],
      issuedAt: now,
      expiresAt: now + 60,
      nonce: 'a'.repeat(32),
    };
    const malformedOrigin = signClaims({ ...baseClaims, origin: 'http://internal.example.com' });
    const futureIssued = signClaims({
      ...baseClaims,
      issuedAt: now + 120,
      expiresAt: now + 180,
      nonce: 'b'.repeat(32),
    });

    for (const launchToken of [malformedOrigin, futureIssued]) {
      await expect(service.exchange({ tenantId: 23, userId: 91, launchToken })).rejects.toEqual(
        new UnauthorizedException('Iframe launch is invalid or expired'),
      );
    }
    expect(redisClient.eval).not.toHaveBeenCalled();
  });

  it('rejects an entry origin outside the exact approved HTTPS origins', async () => {
    await expect(
      service.create({ ...input, allowedOrigins: ['https://other.example.com'] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.create({ ...input, entryUrl: 'http://external.example.com/app' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(redisClient.set).not.toHaveBeenCalled();
  });

  it('fails closed when disabled, misconfigured, or Redis is unavailable', async () => {
    process.env.APP_RUNTIME_IFRAME_LAUNCH_ENABLED = 'false';
    await expect(service.create(input)).rejects.toBeInstanceOf(ForbiddenException);

    process.env.APP_RUNTIME_IFRAME_LAUNCH_ENABLED = 'true';
    process.env.APP_RUNTIME_LAUNCH_SECRET = 'too-short';
    await expect(service.create(input)).rejects.toBeInstanceOf(ForbiddenException);

    process.env.APP_RUNTIME_LAUNCH_SECRET = 'test-only-iframe-launch-secret-32-bytes';
    runtimeSessionService.isEnabled.mockReturnValue(false);
    await expect(service.create(input)).rejects.toBeInstanceOf(ForbiddenException);

    runtimeSessionService.isEnabled.mockReturnValue(true);
    redisClient.set.mockRejectedValue(new Error('redis connection details'));
    await expect(service.create(input)).rejects.toEqual(
      new UnauthorizedException('Iframe launch is invalid or expired'),
    );
  });
});

async function rejectionMessage(service: AppIframeLaunchService, launchToken: string) {
  try {
    await service.exchange({ tenantId: 23, userId: 91, launchToken });
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return '';
}

function signClaims(claims: Record<string, unknown>) {
  const payload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  const key = createHash('sha256')
    .update('test-only-iframe-launch-secret-32-bytes', 'utf8')
    .digest();
  const signature = createHmac('sha256', key).update(payload, 'utf8').digest('base64url');
  return `${payload}.${signature}`;
}
