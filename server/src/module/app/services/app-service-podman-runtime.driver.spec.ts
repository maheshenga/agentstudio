import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { AppServiceLogRedactor } from './app-service-log-redactor';
import { PodmanAppServiceRuntimeDriver } from './app-service-podman-runtime.driver';
import { createAppServiceProcessName } from './app-service-process-manager';

describe('PodmanAppServiceRuntimeDriver', () => {
  const imageDigest = `sha256:${'a'.repeat(64)}`;
  const image = `registry.example/agentstudio-service-runtime@${imageDigest}`;
  const appCode = 'demo_service';
  const version = '1.0.0';
  const processName = createAppServiceProcessName(appCode, version);

  let tempRoot: string;
  let runtimeRoot: string;
  let releaseDir: string;
  let podmanHome: string;
  let xdgRuntimeDir: string;
  let socketRoot: string;
  let configValues: Record<string, unknown>;
  let runner: { run: jest.Mock };
  let driver: PodmanAppServiceRuntimeDriver;

  const spec = () => ({
    appCode,
    version,
    processName,
    releaseDir,
    entryFile: 'dist/index.js' as const,
    healthPath: '/health',
    loopbackPort: 21000,
    memoryMb: 256,
  });

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'app-service-podman-'));
    runtimeRoot = path.join(tempRoot, 'runtime');
    releaseDir = path.join(runtimeRoot, appCode, version);
    podmanHome = path.join(tempRoot, 'podman-home');
    xdgRuntimeDir = path.join(tempRoot, 'xdg-runtime');
    socketRoot = path.join(podmanHome, 'sockets');

    fs.mkdirSync(path.join(releaseDir, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(releaseDir, 'agentstudio-host.cjs'), 'host');
    fs.writeFileSync(path.join(releaseDir, 'dist', 'index.js'), 'exports.health=()=>({});');
    fs.mkdirSync(socketRoot, { recursive: true });
    fs.mkdirSync(xdgRuntimeDir, { recursive: true });
    makeReadOnly(runtimeRoot);
    fs.chmodSync(podmanHome, 0o700);
    fs.chmodSync(socketRoot, 0o700);
    fs.chmodSync(xdgRuntimeDir, 0o700);

    configValues = {
      'app.env': 'production',
      'appMarketplace.serviceRuntime.enabled': true,
      'appMarketplace.serviceRuntime.rootDir': runtimeRoot,
      'appMarketplace.serviceRuntime.user': 'agentstudio_app',
      'appMarketplace.serviceRuntime.podmanCommand': '/usr/bin/podman',
      'appMarketplace.serviceRuntime.podmanImage': image,
      'appMarketplace.serviceRuntime.podmanHome': podmanHome,
      'appMarketplace.serviceRuntime.podmanXdgRuntimeDir': xdgRuntimeDir,
      'appMarketplace.serviceRuntime.socketDir': socketRoot,
      'appMarketplace.serviceRuntime.memoryMb': 256,
      'appMarketplace.serviceRuntime.cpuLimit': 1,
      'appMarketplace.serviceRuntime.pidsLimit': 64,
      'appMarketplace.serviceRuntime.tmpfsMb': 16,
      'appMarketplace.serviceRuntime.containerUid': 65532,
    };
    runner = { run: jest.fn(defaultCommandResult) };
    driver = createDriver();
  });

  afterEach(() => {
    makeWritable(tempRoot);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('exposes the Podman identity and derives a platform-owned Unix socket endpoint', () => {
    expect(driver.name).toBe('podman');
    expect(driver.endpoint({ processName, loopbackPort: 21000 })).toEqual({
      kind: 'unix',
      socketPath: path.join(socketRoot, processName, 'service.sock'),
    });
  });

  it('starts a digest-pinned rootless container with fixed isolation arguments and environment', async () => {
    process.env.DATABASE_PASSWORD = 'must-not-leak';

    await expect(driver.start(spec())).resolves.toEqual({
      processName,
      status: 'online',
      pid: 4321,
      restartCount: 2,
      memoryBytes: 123456,
      cpuPercent: 1.5,
    });

    const socketDir = path.join(socketRoot, processName);
    expect(fs.statSync(socketDir).isDirectory()).toBe(true);
    const runCall = runner.run.mock.calls.find((call) => call[1].includes('run'));
    expect(runCall).toBeDefined();
    const [file, args, options] = runCall!;
    expect(file).toBe('runuser');
    expect(args).toEqual([
      '-u',
      'agentstudio_app',
      '--',
      '/usr/bin/podman',
      'run',
      '--detach',
      '--replace',
      '--pull=never',
      '--name',
      processName,
      '--label',
      'io.agentstudio.managed=true',
      '--label',
      `io.agentstudio.app-code=${appCode}`,
      '--label',
      `io.agentstudio.version=${version}`,
      '--read-only',
      '--network=none',
      '--cap-drop=ALL',
      '--security-opt=no-new-privileges',
      '--pids-limit=64',
      '--memory=256M',
      '--cpus=1',
      '--user=65532:65532',
      '--tmpfs',
      '/tmp:rw,noexec,nosuid,nodev,size=16m',
      '--volume',
      `${releaseDir}:/app:ro`,
      '--volume',
      `${socketDir}:/run/agentstudio:rw,U`,
      '--env',
      'APP_SERVICE_SOCKET=/run/agentstudio/service.sock',
      '--env',
      'APP_SERVICE_ENTRY=/app/dist/index.js',
      '--env',
      'APP_SERVICE_HEALTH_PATH=/health',
      image,
      'node',
      '/app/agentstudio-host.cjs',
    ]);
    expect(options).toEqual({
      cwd: releaseDir,
      env: {
        PATH: '/usr/local/bin:/usr/bin:/bin',
        HOME: podmanHome,
        XDG_RUNTIME_DIR: xdgRuntimeDir,
        NODE_ENV: 'production',
      },
      shell: false,
      timeoutMs: 30_000,
      maxBufferBytes: 1024 * 1024,
    });
    expect(JSON.stringify(options.env)).not.toContain('must-not-leak');
    delete process.env.DATABASE_PASSWORD;
  });

  it.each([
    ['disabled runtime', { 'appMarketplace.serviceRuntime.enabled': false }, 'disabled'],
    ['Windows host', {}, 'Linux', 'win32'],
    ['root runtime user', { 'appMarketplace.serviceRuntime.user': 'root' }, 'non-root'],
    ['relative release root', { 'appMarketplace.serviceRuntime.rootDir': 'runtime' }, 'absolute'],
    [
      'relative Podman command',
      { 'appMarketplace.serviceRuntime.podmanCommand': 'podman' },
      'command',
    ],
    [
      'tagged image',
      { 'appMarketplace.serviceRuntime.podmanImage': 'registry.example/runtime:latest' },
      'digest',
    ],
    [
      'credential-bearing image',
      {
        'appMarketplace.serviceRuntime.podmanImage': `user:secret@registry.example/runtime@${imageDigest}`,
      },
      'image',
    ],
    ['relative Podman home', { 'appMarketplace.serviceRuntime.podmanHome': 'home' }, 'absolute'],
    [
      'relative XDG directory',
      { 'appMarketplace.serviceRuntime.podmanXdgRuntimeDir': 'run' },
      'absolute',
    ],
    ['relative socket root', { 'appMarketplace.serviceRuntime.socketDir': 'sockets' }, 'absolute'],
    ['overlapping release and socket roots', {}, 'overlap', 'linux', 'overlap'],
    ['CPU below minimum', { 'appMarketplace.serviceRuntime.cpuLimit': 0.09 }, 'CPU'],
    ['CPU above maximum', { 'appMarketplace.serviceRuntime.cpuLimit': 8.01 }, 'CPU'],
    ['PIDs below minimum', { 'appMarketplace.serviceRuntime.pidsLimit': 15 }, 'PIDs'],
    ['PIDs above maximum', { 'appMarketplace.serviceRuntime.pidsLimit': 513 }, 'PIDs'],
    ['tmpfs below minimum', { 'appMarketplace.serviceRuntime.tmpfsMb': 7 }, 'tmpfs'],
    ['tmpfs above maximum', { 'appMarketplace.serviceRuntime.tmpfsMb': 257 }, 'tmpfs'],
    ['root container UID', { 'appMarketplace.serviceRuntime.containerUid': 0 }, 'UID'],
  ])(
    'fails closed for %s',
    async (_label, overrides, message, platform = 'linux', setup?: string) => {
      Object.assign(configValues, overrides);
      if (setup === 'overlap') {
        configValues['appMarketplace.serviceRuntime.socketDir'] = path.join(runtimeRoot, 'sockets');
      }
      driver = createDriver(platform);

      await expect(driver.start(spec())).rejects.toThrow(String(message));
      expect(runner.run).not.toHaveBeenCalled();
    },
  );

  it.each([
    [{ appCode: 'Bad' }, 'app code'],
    [{ version: 'latest' }, 'version'],
    [{ processName: 'agentstudio-app-unmanaged-1-0-0' }, 'identity'],
    [{ entryFile: '../index.js' }, 'entry'],
    [{ healthPath: 'health' }, 'health path'],
    [{ loopbackPort: 0 }, 'port'],
    [{ memoryMb: 4096 }, 'memory'],
  ])('rejects invalid runtime specs', async (overrides, message) => {
    await expect(driver.start({ ...spec(), ...overrides } as any)).rejects.toThrow(message);
    expect(runner.run).not.toHaveBeenCalled();
  });

  it('rejects release escapes and symbolic-link path segments', async () => {
    const outside = path.join(tempRoot, 'outside');
    fs.mkdirSync(path.join(outside, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(outside, 'agentstudio-host.cjs'), 'host');
    fs.writeFileSync(path.join(outside, 'dist', 'index.js'), 'entry');
    await expect(driver.start({ ...spec(), releaseDir: outside })).rejects.toThrow('runtime root');

    makeWritable(runtimeRoot);
    const realAppDir = path.join(runtimeRoot, 'real-app');
    const linkedAppDir = path.join(runtimeRoot, 'linked-app');
    fs.mkdirSync(path.join(realAppDir, version, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(realAppDir, version, 'agentstudio-host.cjs'), 'host');
    fs.writeFileSync(path.join(realAppDir, version, 'dist', 'index.js'), 'entry');
    makeReadOnly(realAppDir);
    fs.symlinkSync(realAppDir, linkedAppDir, process.platform === 'win32' ? 'junction' : 'dir');
    fs.chmodSync(runtimeRoot, 0o555);

    await expect(
      driver.start({ ...spec(), releaseDir: path.join(linkedAppDir, version) }),
    ).rejects.toThrow('symbolic link');
    expect(runner.run).not.toHaveBeenCalled();
  });

  it('normalizes a uniquely managed inspect record and bounded stats', async () => {
    await expect(driver.describe(processName)).resolves.toEqual({
      processName,
      status: 'online',
      pid: 4321,
      restartCount: 2,
      memoryBytes: 123456,
      cpuPercent: 1.5,
    });
  });

  it('refuses to replace a same-name container until its platform ownership is verified', async () => {
    runner.run.mockImplementation(async (_file: string, args: string[]) => {
      if (args.includes('ps')) {
        return { stdout: JSON.stringify([{ Names: [processName] }]), stderr: '' };
      }
      if (args.includes('inspect')) {
        return {
          stdout: JSON.stringify([
            inspectRecord({ labels: { 'io.agentstudio.managed': 'false' } }),
          ]),
          stderr: '',
        };
      }
      return defaultCommandResult(_file, args);
    });

    await expect(driver.start(spec())).rejects.toThrow('managed');
    expect(runner.run.mock.calls.some((call) => call[1].includes('run'))).toBe(false);
  });

  it('removes a newly started container when post-start inspection fails closed', async () => {
    runner.run.mockImplementation(async (_file: string, args: string[]) => {
      if (args.includes('ps')) return { stdout: '[]', stderr: '' };
      if (args.includes('inspect')) return { stdout: 'not-json', stderr: '' };
      return { stdout: '', stderr: '' };
    });

    await expect(driver.start(spec())).rejects.toThrow('state');
    expect(runner.run.mock.calls.map((call) => call[1].slice(4))).toContainEqual([
      'rm',
      '--force',
      processName,
    ]);
    expect(fs.existsSync(path.join(socketRoot, processName))).toBe(false);
  });

  it('preserves an existing managed container when the replacement command itself fails', async () => {
    runner.run.mockImplementation(async (_file: string, args: string[]) => {
      if (args.includes('ps')) {
        return { stdout: JSON.stringify([{ Names: [processName] }]), stderr: '' };
      }
      if (args.includes('inspect')) {
        return { stdout: JSON.stringify([inspectRecord()]), stderr: '' };
      }
      if (args.includes('run')) throw new Error('replacement failed');
      return defaultCommandResult(_file, args);
    });

    await expect(driver.start(spec())).rejects.toThrow('command failed');
    expect(runner.run.mock.calls.map((call) => call[1].slice(4))).not.toContainEqual([
      'rm',
      '--force',
      processName,
    ]);
  });

  it.each([
    ['malformed inspect JSON', 'not-json', 'state'],
    ['duplicate inspect records', JSON.stringify([inspectRecord(), inspectRecord()]), 'state'],
    [
      'unmanaged labels',
      JSON.stringify([inspectRecord({ labels: { 'io.agentstudio.managed': 'false' } })]),
      'managed',
    ],
    [
      'unexpected AgentStudio labels',
      JSON.stringify([inspectRecord({ labels: { 'io.agentstudio.extra': 'value' } })]),
      'labels',
    ],
    [
      'mismatched image digest',
      JSON.stringify([inspectRecord({ imageDigest: `sha256:${'b'.repeat(64)}` })]),
      'image',
    ],
  ])('fails closed for %s', async (_label, inspectOutput, message) => {
    runner.run.mockImplementation(async (_file: string, args: string[]) => {
      if (args.includes('inspect')) return { stdout: inspectOutput, stderr: '' };
      return defaultCommandResult(_file, args);
    });

    await expect(driver.describe(processName)).rejects.toThrow(String(message));
  });

  it('uses fixed lifecycle commands and returns bounded redacted logs', async () => {
    runner.run.mockImplementation(async (_file: string, args: string[]) => {
      if (args.includes('logs')) {
        return {
          stdout: 'Authorization: Bearer private-token',
          stderr: 'Set-Cookie: sid=private',
        };
      }
      return defaultCommandResult(_file, args);
    });

    await driver.stop(processName);
    await driver.delete(processName);
    const logs = await driver.logs(processName, 999);

    const podmanCommands = runner.run.mock.calls.map((call) => call[1].slice(4));
    expect(podmanCommands).toContainEqual(['stop', '--time', '10', processName]);
    expect(podmanCommands).toContainEqual(['rm', '--force', processName]);
    expect(podmanCommands).toContainEqual(['logs', '--tail', '200', processName]);
    expect(logs.stdout).not.toContain('private-token');
    expect(logs.stderr).not.toContain('sid=private');
    expect(fs.existsSync(path.join(socketRoot, processName))).toBe(false);
  });

  it('does not expose raw command failures or command output', async () => {
    runner.run.mockRejectedValue(
      new Error('podman failed: password=private command=/usr/bin/podman'),
    );

    await expect(driver.stop(processName)).rejects.toThrow('Service container command failed');
    await expect(driver.stop(processName)).rejects.not.toThrow('private');
  });

  function createDriver(platform = 'linux') {
    return new PodmanAppServiceRuntimeDriver(
      { get: jest.fn((key: string, fallback?: unknown) => configValues[key] ?? fallback) } as any,
      runner as any,
      new AppServiceLogRedactor(),
      { platform: jest.fn(() => platform) } as any,
    );
  }

  async function defaultCommandResult(_file: string, args: string[]) {
    if (args.includes('ps')) return { stdout: '[]', stderr: '' };
    if (args.includes('inspect')) {
      return { stdout: JSON.stringify([inspectRecord()]), stderr: '' };
    }
    if (args.includes('stats')) {
      return {
        stdout: JSON.stringify([
          { name: processName, mem_usage_bytes: 123456, cpu_percent: '1.5%' },
        ]),
        stderr: '',
      };
    }
    return { stdout: '', stderr: '' };
  }

  function inspectRecord(
    overrides: {
      labels?: Record<string, string>;
      imageDigest?: string;
    } = {},
  ) {
    return {
      Name: processName,
      ImageDigest: overrides.imageDigest ?? imageDigest,
      RestartCount: 2,
      State: { Status: 'running', Pid: 4321 },
      Config: {
        Labels: {
          'io.agentstudio.managed': 'true',
          'io.agentstudio.app-code': appCode,
          'io.agentstudio.version': version,
          ...overrides.labels,
        },
      },
    };
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
    if (entry.isDirectory() && !entry.isSymbolicLink()) makeWritable(target);
    else if (!entry.isSymbolicLink()) fs.chmodSync(target, 0o644);
  }
}
