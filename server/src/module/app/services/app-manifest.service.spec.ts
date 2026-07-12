import { AppManifestService } from './app-manifest.service';

describe('AppManifestService', () => {
  const service = new AppManifestService();
  const validManifest = {
    code: 'job_board',
    name: 'Job Board',
    version: '1.0.0',
    type: 'static',
    entry: 'dist/index.html',
    category: 'Industry',
    summary: 'Publish jobs and collect resumes',
    description: 'A lightweight recruitment module for tenant teams.',
    icon: 'ri:briefcase-line',
    tenant_scoped: true,
    permissions: ['job:view', 'job:manage'],
  };
  const entries = ['manifest.json', 'dist/index.html', 'dist/assets/app.js', 'README.md'];

  it('accepts a valid static manifest and package entry list', () => {
    expect(service.validateStaticManifest({ manifest: validManifest, entries })).toMatchObject({
      code: 'job_board',
      name: 'Job Board',
      version: '1.0.0',
      type: 'static',
      entry: 'dist/index.html',
      tenant_scoped: true,
      permissions: ['job:view', 'job:manage'],
    });
  });

  it('normalizes declared service targets for a static service.invoke caller', () => {
    expect(
      service.validateStaticManifest({
        manifest: {
          ...validManifest,
          permissions: ['service.invoke'],
          serviceTargets: ['workflow_service', 'reporting_service'],
        },
        entries,
      }),
    ).toMatchObject({
      permissions: ['service.invoke'],
      serviceTargets: ['workflow_service', 'reporting_service'],
    });
  });

  it('rejects non-array service target declarations', () => {
    expect(() =>
      service.validateStaticManifest({
        manifest: {
          ...validManifest,
          permissions: ['service.invoke'],
          serviceTargets: 'workflow_service',
        },
        entries,
      }),
    ).toThrow('Service targets must be an array');
  });

  it('rejects malformed service target app codes', () => {
    expect(() =>
      service.validateStaticManifest({
        manifest: {
          ...validManifest,
          permissions: ['service.invoke'],
          serviceTargets: ['../workflow_service'],
        },
        entries,
      }),
    ).toThrow('Invalid service target code');
  });

  it('rejects duplicate service target app codes', () => {
    expect(() =>
      service.validateStaticManifest({
        manifest: {
          ...validManifest,
          permissions: ['service.invoke'],
          serviceTargets: ['workflow_service', 'workflow_service'],
        },
        entries,
      }),
    ).toThrow('Duplicate service target code');
  });

  it('rejects self-referential service targets', () => {
    expect(() =>
      service.validateStaticManifest({
        manifest: {
          ...validManifest,
          permissions: ['service.invoke'],
          serviceTargets: ['job_board'],
        },
        entries,
      }),
    ).toThrow('App cannot target itself as a service');
  });

  it('limits service target declarations to twenty apps', () => {
    expect(() =>
      service.validateStaticManifest({
        manifest: {
          ...validManifest,
          permissions: ['service.invoke'],
          serviceTargets: Array.from({ length: 21 }, (_, index) => `target_${index}`),
        },
        entries,
      }),
    ).toThrow('Service targets exceed the limit');
  });

  it('rejects service targets without the service.invoke capability', () => {
    expect(() =>
      service.validateStaticManifest({
        manifest: {
          ...validManifest,
          permissions: ['context.read'],
          serviceTargets: ['workflow_service'],
        },
        entries,
      }),
    ).toThrow('Service targets require service.invoke');
  });

  it('rejects service.invoke without a declared target', () => {
    expect(() =>
      service.validateStaticManifest({
        manifest: {
          ...validManifest,
          permissions: ['service.invoke'],
          serviceTargets: [],
        },
        entries,
      }),
    ).toThrow('service.invoke requires a service target');
  });

  it('rejects invalid app codes', () => {
    expect(() =>
      service.validateStaticManifest({
        manifest: { ...validManifest, code: '../bad' },
        entries,
      }),
    ).toThrow('Invalid app code');
  });

  it('rejects invalid semantic versions', () => {
    expect(() =>
      service.validateStaticManifest({
        manifest: { ...validManifest, version: '1' },
        entries,
      }),
    ).toThrow('Invalid app version');
  });

  it('rejects path traversal entries', () => {
    expect(() =>
      service.validateStaticManifest({
        manifest: { ...validManifest, entry: '../index.html' },
        entries,
      }),
    ).toThrow('Invalid app entry');
  });

  it('rejects manifests whose entry file is missing from the package', () => {
    expect(() =>
      service.validateStaticManifest({
        manifest: validManifest,
        entries: ['manifest.json', 'README.md'],
      }),
    ).toThrow('App entry file not found');
  });

  it('rejects executable server-side files in static packages', () => {
    expect(() =>
      service.validateStaticManifest({
        manifest: validManifest,
        entries: [...entries, 'dist/server.php'],
      }),
    ).toThrow('Executable files are not allowed');
  });

  it('rejects non-static package manifests in the P0 upload flow', () => {
    expect(() =>
      service.validateStaticManifest({
        manifest: { ...validManifest, type: 'service_plugin' },
        entries,
      }),
    ).toThrow('Static app packages must use type static');
  });

  describe('Manifest V2 service packages', () => {
    const serviceManifest = {
      manifestVersion: 2,
      code: 'admin_echo_service',
      version: '1.0.0',
      runtime: 'service',
      entry: 'dist/index.js',
      healthPath: '/health',
      capabilities: ['context.read', 'kv.read'],
      allowedOrigins: [],
    };

    it('normalizes the fixed P10 service contract', () => {
      expect(service.validateServiceManifest(serviceManifest)).toEqual({
        manifestVersion: 2,
        code: 'admin_echo_service',
        version: '1.0.0',
        runtime: 'service',
        entry: 'dist/index.js',
        healthPath: '/health',
        capabilities: ['context.read', 'kv.read'],
        serviceTargets: [],
        allowedOrigins: [],
        runtimeConfig: {},
      });
    });

    it('rejects service.invoke without a declared service target', () => {
      expect(() =>
        service.validateServiceManifest({
          ...serviceManifest,
          capabilities: ['service.invoke'],
          serviceTargets: [],
        }),
      ).toThrow('service.invoke requires a service target');
    });

    it('rejects declared service targets without service.invoke', () => {
      expect(() =>
        service.validateServiceManifest({
          ...serviceManifest,
          serviceTargets: ['workflow_service'],
        }),
      ).toThrow('Service targets require service.invoke');
    });

    it.each([
      [{ ...serviceManifest, manifestVersion: 1 }, 'Service manifestVersion must be 2'],
      [{ ...serviceManifest, runtime: 'static' }, 'Service manifest runtime must be service'],
      [{ ...serviceManifest, entry: '../index.js' }, 'Invalid service entry'],
      [{ ...serviceManifest, entry: 'server.js' }, 'Service entry must be dist/index.js'],
      [{ ...serviceManifest, healthPath: 'health' }, 'Invalid service health path'],
      [{ ...serviceManifest, healthPath: '/health?secret=1' }, 'Invalid service health path'],
      [{ ...serviceManifest, capabilities: ['unknown.capability'] }, 'Unsupported app capability'],
      [
        { ...serviceManifest, allowedOrigins: ['https://api.example.com'] },
        'Direct service origins are not available in P10',
      ],
      [{ ...serviceManifest, runtimeConfig: { command: 'node server.js' } }, 'Invalid runtime config'],
    ])('rejects invalid service manifests', (manifest, message) => {
      expect(() => service.validateServiceManifest(manifest)).toThrow(message);
    });
  });
});
