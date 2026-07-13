import fs from 'node:fs';
import path from 'node:path';

describe('legacy plugin retirement', () => {
  const repositoryRoot = path.resolve(__dirname, '../../../../');
  const serverRoot = path.join(repositoryRoot, 'server');
  const webRoot = path.join(repositoryRoot, 'web');

  it('removes the legacy backend plugin module and API contract', () => {
    expect(fs.existsSync(path.join(serverRoot, 'src/module/system/plugin'))).toBe(false);

    const systemModule = fs.readFileSync(
      path.join(serverRoot, 'src/module/system/system.module.ts'),
      'utf8',
    );
    expect(systemModule).not.toContain("'./plugin/plugin.module'");
    expect(systemModule).not.toContain('PluginModule');

    const openApi = fs.readFileSync(path.join(serverRoot, 'public/openApi.json'), 'utf8');
    expect(openApi).not.toContain('/api/system/plugin/');
  });

  it('removes the legacy frontend route, API client, and view', () => {
    expect(fs.existsSync(path.join(webRoot, 'src/api/system/plugin.ts'))).toBe(false);
    expect(fs.existsSync(path.join(webRoot, 'src/views/system/plugin'))).toBe(false);

    const systemRoutes = fs.readFileSync(
      path.join(webRoot, 'src/router/modules/system.ts'),
      'utf8',
    );
    expect(systemRoutes).not.toContain("path: 'plugin'");
    expect(systemRoutes).not.toContain("component: '/system/plugin'");
    expect(systemRoutes).not.toContain("name: 'PluginManager'");
  });
});
