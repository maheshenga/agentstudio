import { existsSync } from 'fs';
import { resolve } from 'path';

describe('AppServiceRuntimeDriverRegistry', () => {
  const registryPath = resolve(__dirname, 'app-service-runtime-driver-registry.ts');

  function loadRegistry() {
    expect(existsSync(registryPath)).toBe(true);
    if (!existsSync(registryPath)) return null;
    return require('./app-service-runtime-driver-registry') as any;
  }

  function createRegistry(values: Record<string, unknown> = {}) {
    const loaded = loadRegistry();
    if (!loaded) return null;
    const pm2 = { name: 'pm2' };
    const podman = { name: 'podman' };
    const registry = new loaded.AppServiceRuntimeDriverRegistry(
      { get: jest.fn((key: string, fallback?: unknown) => values[key] ?? fallback) },
      pm2,
      podman,
    );
    return { registry, pm2, podman };
  }

  it('selects PM2 by default and routes persisted driver identities exactly', () => {
    const created = createRegistry();
    if (!created) return;

    expect(created.registry.configuredName()).toBe('pm2');
    expect(created.registry.forInstance('pm2')).toBe(created.pm2);
    expect(created.registry.forInstance('podman')).toBe(created.podman);
    expect(() => created.registry.forInstance('unknown')).toThrow(
      'Unsupported service runtime driver',
    );
  });

  it('fails closed for new production PM2 instances', () => {
    const created = createRegistry({
      'app.env': 'production',
      'appMarketplace.serviceRuntime.driver': 'pm2',
    });
    if (!created) return;

    expect(() => created.registry.forNewInstance()).toThrow(
      'Production service runtime requires Podman isolation',
    );
  });

  it('selects Podman for new production instances when explicitly configured', () => {
    const created = createRegistry({
      'app.env': 'production',
      'appMarketplace.serviceRuntime.driver': 'podman',
    });
    if (!created) return;

    expect(created.registry.configuredName()).toBe('podman');
    expect(created.registry.forNewInstance()).toBe(created.podman);
  });
});
