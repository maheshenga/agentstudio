import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { AppServiceLogRedactor } from './app-service-log-redactor';
import {
  AppServiceProcessManager,
  createAppServiceProcessName,
} from './app-service-process-manager';

describe('AppServiceProcessManager', () => {
  let tempRoot: string;
  let runtimeRoot: string;
  let releaseDir: string;
  let configValues: Record<string, unknown>;
  let runner: { run: jest.Mock };
  let manager: AppServiceProcessManager;

  const processName = 'agentstudio-app-admin-echo-service-1-0-0';
  const spec = () => ({
    processName,
    releaseDir,
    entryFile: 'dist/index.js',
    healthPath: '/health',
    loopbackPort: 21000,
    memoryMb: 256,
  });

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'app-service-process-'));
    runtimeRoot = path.join(tempRoot, 'runtime');
    releaseDir = path.join(runtimeRoot, 'admin_echo_service', '1.0.0');
    fs.mkdirSync(path.join(releaseDir, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(releaseDir, 'agentstudio-host.cjs'), 'host');
    fs.writeFileSync(path.join(releaseDir, 'dist', 'index.js'), 'exports.health=()=>({});');
    makeReadOnly(runtimeRoot);

    configValues = {
      'appMarketplace.serviceRuntime.enabled': true,
      'appMarketplace.serviceRuntime.rootDir': runtimeRoot,
      'appMarketplace.serviceRuntime.user': 'agentstudio_app',
      'appMarketplace.serviceRuntime.pm2Home': path.join(tempRoot, 'home', '.pm2'),
      'appMarketplace.serviceRuntime.pm2Command': '/usr/local/bin/pm2',
      'appMarketplace.serviceRuntime.interpreter': 'node',
      'appMarketplace.serviceRuntime.memoryMb': 256,
      'appMarketplace.serviceRuntime.portMin': 20000,
      'appMarketplace.serviceRuntime.portMax': 39999,
    };
    runner = { run: jest.fn() };
    manager = createManager();
  });

  afterEach(() => {
    makeWritable(tempRoot);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('creates stable process names from an app code and semantic version', () => {
    expect(createAppServiceProcessName('admin_echo_service', '1.0.0')).toBe(processName);
  });

  it('starts through fixed runuser and PM2 arguments with only allowlisted environment values', async () => {
    runner.run.mockImplementation(async (_file: string, args: string[]) => {
      if (args.includes('start')) return { stdout: '', stderr: '' };
      return {
        stdout: JSON.stringify([
          {
            name: processName,
            pid: 321,
            pm2_env: { status: 'online', restart_time: 2 },
            monit: { memory: 123456, cpu: 1.5 },
          },
        ]),
        stderr: '',
      };
    });
    process.env.DATABASE_PASSWORD = 'must-not-leak';

    await expect(manager.start(spec())).resolves.toEqual({
      processName,
      status: 'online',
      pid: 321,
      restartCount: 2,
      memoryBytes: 123456,
      cpuPercent: 1.5,
    });

    const [file, args, options] = runner.run.mock.calls[0];
    expect(file).toBe('runuser');
    expect(args).toEqual([
      '-u',
      'agentstudio_app',
      '--',
      '/usr/local/bin/pm2',
      'start',
      'agentstudio-host.cjs',
      '--name',
      processName,
      '--cwd',
      releaseDir,
      '--interpreter',
      'node',
      '--max-memory-restart',
      '256M',
      '--time',
      '--update-env',
    ]);
    expect(options).toMatchObject({ cwd: releaseDir, shell: false });
    expect(Object.keys(options.env).sort()).toEqual(
      [
        'APP_SERVICE_ENTRY',
        'APP_SERVICE_HEALTH_PATH',
        'APP_SERVICE_HOST',
        'APP_SERVICE_PORT',
        'HOME',
        'NODE_ENV',
        'PATH',
        'PM2_HOME',
      ].sort(),
    );
    expect(options.env).toMatchObject({
      APP_SERVICE_HOST: '127.0.0.1',
      APP_SERVICE_PORT: '21000',
      APP_SERVICE_ENTRY: 'dist/index.js',
      APP_SERVICE_HEALTH_PATH: '/health',
      NODE_ENV: 'production',
    });
    expect(JSON.stringify(options.env)).not.toContain('must-not-leak');
    delete process.env.DATABASE_PASSWORD;
  });

  it.each([
    ['disabled runtime', { 'appMarketplace.serviceRuntime.enabled': false }, 'disabled'],
    ['root runtime user', { 'appMarketplace.serviceRuntime.user': 'root' }, 'non-root'],
    ['relative PM2 home', { 'appMarketplace.serviceRuntime.pm2Home': '.pm2' }, 'absolute'],
    ['invalid interpreter', { 'appMarketplace.serviceRuntime.interpreter': 'python' }, 'interpreter'],
  ])('fails closed for %s', async (_label, overrides, message) => {
    Object.assign(configValues, overrides);
    manager = createManager();

    await expect(manager.start(spec())).rejects.toThrow(message);
    expect(runner.run).not.toHaveBeenCalled();
  });

  it('rejects non-Linux process execution', async () => {
    manager = createManager('win32');

    await expect(manager.start(spec())).rejects.toThrow('Linux');
    expect(runner.run).not.toHaveBeenCalled();
  });

  it.each([
    [{ processName: 'bad name' }, 'process name'],
    [{ loopbackPort: 80 }, 'port'],
    [{ entryFile: '../index.js' }, 'entry'],
    [{ healthPath: 'health' }, 'health path'],
    [{ memoryMb: 4096 }, 'memory'],
  ])('rejects invalid process specs', async (overrides, message) => {
    await expect(manager.start({ ...spec(), ...overrides })).rejects.toThrow(message);
    expect(runner.run).not.toHaveBeenCalled();
  });

  it('rejects releases outside the configured runtime root or with writable ownership boundaries', async () => {
    const outside = path.join(tempRoot, 'outside');
    fs.mkdirSync(path.join(outside, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(outside, 'agentstudio-host.cjs'), 'host');
    fs.writeFileSync(path.join(outside, 'dist', 'index.js'), 'entry');

    await expect(manager.start({ ...spec(), releaseDir: outside })).rejects.toThrow('runtime root');

    fs.chmodSync(releaseDir, 0o777);
    await expect(manager.start(spec())).rejects.toThrow('writable');

    fs.chmodSync(releaseDir, 0o555);
    fs.chmodSync(path.dirname(releaseDir), 0o777);
    await expect(manager.start(spec())).rejects.toThrow('writable');
    expect(runner.run).not.toHaveBeenCalled();
  });

  it('rejects symbolic links in intermediate release path segments', async () => {
    fs.chmodSync(runtimeRoot, 0o755);
    const realAppDir = path.join(runtimeRoot, 'real-app');
    const linkedAppDir = path.join(runtimeRoot, 'linked-app');
    const linkedRelease = path.join(linkedAppDir, '1.0.0');
    fs.mkdirSync(path.join(realAppDir, '1.0.0', 'dist'), { recursive: true });
    fs.writeFileSync(path.join(realAppDir, '1.0.0', 'agentstudio-host.cjs'), 'host');
    fs.writeFileSync(path.join(realAppDir, '1.0.0', 'dist', 'index.js'), 'entry');
    makeReadOnly(realAppDir);
    fs.symlinkSync(realAppDir, linkedAppDir, process.platform === 'win32' ? 'junction' : 'dir');
    fs.chmodSync(runtimeRoot, 0o555);

    await expect(manager.start({ ...spec(), releaseDir: linkedRelease })).rejects.toThrow(
      'symbolic link',
    );
    expect(runner.run).not.toHaveBeenCalled();
  });

  it('fails closed on malformed or duplicate PM2 process descriptions', async () => {
    runner.run.mockResolvedValueOnce({ stdout: 'not-json', stderr: '' });
    await expect(manager.describe(processName)).rejects.toThrow('PM2 process state');

    runner.run.mockResolvedValueOnce({
      stdout: JSON.stringify([{ name: processName }, { name: processName }]),
      stderr: '',
    });
    await expect(manager.describe(processName)).rejects.toThrow('PM2 process state');
  });

  it('uses fixed stop/delete/log commands and returns bounded redacted streams', async () => {
    runner.run
      .mockResolvedValueOnce({ stdout: '', stderr: '' })
      .mockResolvedValueOnce({ stdout: '', stderr: '' })
      .mockResolvedValueOnce({
        stdout: 'Authorization: Bearer private-token',
        stderr: 'Set-Cookie: sid=private',
      });

    await manager.stop(processName);
    await manager.delete(processName);
    const logs = await manager.logs(processName, 999);

    expect(runner.run.mock.calls.map((call) => call[1].slice(4))).toEqual([
      ['stop', processName, '--silent'],
      ['delete', processName, '--silent'],
      ['logs', processName, '--nostream', '--raw', '--lines', '200'],
    ]);
    expect(logs.stdout).not.toContain('private-token');
    expect(logs.stderr).not.toContain('sid=private');
  });

  it('does not expose raw command failures or their output', async () => {
    runner.run.mockRejectedValue(
      new Error('pm2 failed: password=private command=/usr/local/bin/pm2'),
    );

    await expect(manager.stop(processName)).rejects.toThrow('Service process command failed');
    await expect(manager.stop(processName)).rejects.not.toThrow('private');
  });

  function createManager(platform = 'linux') {
    return new AppServiceProcessManager(
      { get: jest.fn((key: string, fallback?: unknown) => configValues[key] ?? fallback) } as any,
      runner as any,
      new AppServiceLogRedactor(),
      { platform: jest.fn(() => platform) } as any,
    );
  }
});

function makeReadOnly(root: string) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) {
      makeReadOnly(target);
      fs.chmodSync(target, 0o555);
    } else {
      fs.chmodSync(target, 0o444);
    }
  }
  fs.chmodSync(root, 0o555);
}

function makeWritable(root: string) {
  if (!fs.existsSync(root)) return;
  fs.chmodSync(root, 0o755);
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) makeWritable(target);
    else fs.chmodSync(target, 0o644);
  }
}
