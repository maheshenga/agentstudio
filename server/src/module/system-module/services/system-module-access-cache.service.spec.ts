import { SystemModuleAccessCacheService } from './system-module-access-cache.service';

describe('SystemModuleAccessCacheService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('deduplicates concurrent loads and returns cached values within the TTL', async () => {
    const cache = new SystemModuleAccessCacheService();
    const loader = jest.fn().mockResolvedValue({ allowed: true });

    const [first, second] = await Promise.all([
      cache.getOrLoad('tenant:23:module:crm', loader),
      cache.getOrLoad('tenant:23:module:crm', loader),
    ]);
    const third = await cache.getOrLoad('tenant:23:module:crm', loader);

    expect(first).toEqual({ allowed: true });
    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('invalidates all compiled entitlement snapshots explicitly', async () => {
    const cache = new SystemModuleAccessCacheService();
    const loader = jest.fn().mockResolvedValue({ allowed: true });
    await cache.getOrLoad('tenant:23:module:crm', loader);

    cache.invalidateAll();
    await cache.getOrLoad('tenant:23:module:crm', loader);

    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('sweeps expired entries before caching new tenant snapshots', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000);
    const cache = new SystemModuleAccessCacheService();

    await cache.getOrLoad('tenant:1:module:crm', async () => ({ allowed: true }));
    now.mockReturnValue(12_000);
    await cache.getOrLoad('tenant:2:module:crm', async () => ({ allowed: true }));

    expect((cache as any).entries.size).toBe(1);
  });
});
