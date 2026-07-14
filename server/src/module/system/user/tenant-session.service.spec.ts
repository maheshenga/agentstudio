import { TenantSessionService } from './tenant-session.service';

describe('TenantSessionService', () => {
  it('removes matching access and refresh sessions without affecting another tenant', async () => {
    const redisService = {
      scanKeys: jest
        .fn()
        .mockResolvedValueOnce(['login_tokens:a', 'login_tokens:b'])
        .mockResolvedValueOnce(['refresh_tokens:c', 'refresh_tokens:d']),
      mget: jest
        .fn()
        .mockResolvedValueOnce([
          { userId: 7, tenantId: 12 },
          { userId: 7, tenantId: 13 },
        ])
        .mockResolvedValueOnce([
          { userId: 7, tenantId: 12 },
          { userId: 8, tenantId: 12 },
        ]),
      keys: jest.fn().mockResolvedValue([]),
      del: jest.fn().mockResolvedValue(2),
    };
    const service = new TenantSessionService(redisService as any);

    await service.revokeTenantSessions(7, 12);

    expect(redisService.scanKeys).toHaveBeenNthCalledWith(1, 'login_tokens:*');
    expect(redisService.scanKeys).toHaveBeenNthCalledWith(2, 'refresh_tokens:*');
    expect(redisService.del).toHaveBeenCalledWith(['login_tokens:a', 'refresh_tokens:c']);
  });
});
