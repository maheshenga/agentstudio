import { buildFactoryAppManifest } from './app-factory-template-contract';

describe('factory template manifest contract', () => {
  it('materializes a complete static manifest from versioned defaults', () => {
    expect(
      buildFactoryAppManifest({
        runtimeTarget: 'static',
        code: 'factory_job_board',
        name: '招聘中心',
        version: '2.0.0',
        category: '招聘',
        summary: '招聘与职位发布',
        description: '面向租户的招聘页面',
        icon: 'ri:briefcase-line',
        defaults: { tenant_scoped: true, permissions: ['context.read'] },
      }),
    ).toEqual({
      code: 'factory_job_board',
      name: '招聘中心',
      version: '2.0.0',
      type: 'static',
      entry: 'dist/index.html',
      category: '招聘',
      summary: '招聘与职位发布',
      description: '面向租户的招聘页面',
      icon: 'ri:briefcase-line',
      tenant_scoped: true,
      permissions: ['context.read'],
      serviceTargets: [],
      allowedOrigins: [],
    });
  });

  it('materializes a constrained service manifest without executable configuration', () => {
    expect(
      buildFactoryAppManifest({
        runtimeTarget: 'service',
        code: 'factory_classifieds',
        name: '分类信息服务',
        version: '1.0.0',
        defaults: { healthPath: '/health', capabilities: ['context.read'] },
      }),
    ).toEqual({
      manifestVersion: 2,
      code: 'factory_classifieds',
      version: '1.0.0',
      runtime: 'service',
      entry: 'dist/index.js',
      healthPath: '/health',
      capabilities: ['context.read'],
      serviceTargets: [],
      allowedOrigins: [],
      runtimeConfig: {},
    });
  });

  it('rejects static service invocation without a governed target', () => {
    expect(() =>
      buildFactoryAppManifest({
        runtimeTarget: 'static',
        code: 'factory_job_board',
        name: 'Job Board',
        version: '2.0.0',
        defaults: { permissions: ['service.invoke'] },
      }),
    ).toThrow('Factory static manifests cannot request service.invoke without a service target');
  });
});
