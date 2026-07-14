import { BadRequestException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { AppServiceLogRedactor } from './app-service-log-redactor';
import {
  AppServiceRuntimeDriver,
  type AppServiceCommandResult,
  type AppServiceProcessSnapshot,
  type AppServiceRuntimeEndpoint,
  type AppServiceRuntimeSpec,
} from './app-service-runtime-driver';

export type { AppServiceCommandResult, AppServiceProcessSnapshot } from './app-service-runtime-driver';

export interface AppServiceProcessSpec
  extends Omit<AppServiceRuntimeSpec, 'appCode' | 'version' | 'entryFile'> {
  appCode?: string;
  version?: string;
  processName: string;
  releaseDir: string;
  entryFile: string;
  healthPath: string;
  loopbackPort: number;
  memoryMb: number;
}

export interface AppServiceCommandOptions {
  cwd: string;
  env: Record<string, string>;
  shell: false;
  timeoutMs?: number;
  maxBufferBytes?: number;
}

export abstract class AppServiceCommandRunner {
  abstract run(
    file: string,
    args: string[],
    options: AppServiceCommandOptions,
  ): Promise<AppServiceCommandResult>;
}

@Injectable()
export class NodeAppServiceCommandRunner implements AppServiceCommandRunner {
  run(file: string, args: string[], options: AppServiceCommandOptions) {
    return new Promise<AppServiceCommandResult>((resolve, reject) => {
      execFile(
        file,
        args,
        {
          cwd: options.cwd,
          env: options.env,
          shell: false,
          windowsHide: true,
          timeout: options.timeoutMs ?? 15_000,
          maxBuffer: options.maxBufferBytes ?? 1024 * 1024,
          encoding: 'utf8',
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(error);
            return;
          }
          resolve({ stdout: String(stdout || ''), stderr: String(stderr || '') });
        },
      );
    });
  }
}

@Injectable()
export class AppServiceHostEnvironment {
  platform() {
    return process.platform;
  }
}

interface RuntimeConfig {
  appEnv: string;
  enabled: boolean;
  rootDir: string;
  user: string;
  pm2Home: string;
  pm2Command: string;
  interpreter: 'node' | 'bun';
  memoryMb: number;
  portMin: number;
  portMax: number;
}

interface Pm2ProcessRecord {
  name?: unknown;
  pid?: unknown;
  pm2_env?: {
    status?: unknown;
    restart_time?: unknown;
  };
  monit?: {
    memory?: unknown;
    cpu?: unknown;
  };
}

const PROCESS_NAME_PATTERN = /^agentstudio-app-[a-z0-9-]{3,90}$/;
const RUNTIME_USER_PATTERN = /^[a-z_][a-z0-9_-]{0,31}$/;
const FIXED_PATH = '/usr/local/bin:/usr/bin:/bin';

export function createAppServiceProcessName(appCode: string, version: string) {
  const code = String(appCode || '').trim();
  const normalizedVersion = String(version || '').trim();
  if (!/^[a-z][a-z0-9_]{2,79}$/.test(code) || !/^\d+\.\d+\.\d+$/.test(normalizedVersion)) {
    throw new BadRequestException('Invalid service process identity');
  }
  const processName = `agentstudio-app-${code.replace(/_/g, '-')}-${normalizedVersion.replace(/\./g, '-')}`;
  if (!PROCESS_NAME_PATTERN.test(processName)) {
    throw new BadRequestException('Invalid service process name');
  }
  return processName;
}

@Injectable()
export class AppServiceProcessManager implements AppServiceRuntimeDriver {
  readonly name = 'pm2' as const;

  constructor(
    private readonly configService: ConfigService,
    @Inject(AppServiceCommandRunner)
    private readonly commandRunner: AppServiceCommandRunner,
    private readonly logRedactor: AppServiceLogRedactor,
    private readonly hostEnvironment: AppServiceHostEnvironment,
  ) {}

  async start(spec: AppServiceProcessSpec) {
    const config = this.validateProcessSpec(spec);
    const env = {
      ...this.managementEnv(config),
      APP_SERVICE_HOST: '127.0.0.1',
      APP_SERVICE_PORT: String(spec.loopbackPort),
      APP_SERVICE_ENTRY: spec.entryFile,
      APP_SERVICE_HEALTH_PATH: spec.healthPath,
    };
    await this.runPm2(
      config,
      [
        'start',
        'agentstudio-host.cjs',
        '--name',
        spec.processName,
        '--cwd',
        path.resolve(spec.releaseDir),
        '--interpreter',
        config.interpreter,
        '--max-memory-restart',
        `${spec.memoryMb}M`,
        '--time',
        '--update-env',
      ],
      path.resolve(spec.releaseDir),
      env,
    );
    const snapshot = await this.describe(spec.processName);
    if (!snapshot) {
      throw new ServiceUnavailableException('PM2 process state is unavailable');
    }
    return snapshot;
  }

  async stop(processName: string) {
    const config = this.validateManagementInput(processName);
    await this.runPm2(config, ['stop', processName, '--silent']);
  }

  async delete(processName: string) {
    const config = this.validateManagementInput(processName);
    await this.runPm2(config, ['delete', processName, '--silent']);
  }

  async describe(processName: string): Promise<AppServiceProcessSnapshot | null> {
    const config = this.validateManagementInput(processName);
    const result = await this.runPm2(config, ['jlist']);
    let records: Pm2ProcessRecord[];
    try {
      const parsed = JSON.parse(result.stdout) as unknown;
      if (!Array.isArray(parsed)) throw new Error('invalid_pm2_state');
      records = parsed as Pm2ProcessRecord[];
    } catch {
      throw new ServiceUnavailableException('Invalid PM2 process state');
    }
    const matches = records.filter((record) => record?.name === processName);
    if (matches.length === 0) return null;
    if (matches.length !== 1) {
      throw new ServiceUnavailableException('Invalid PM2 process state');
    }
    return this.toSnapshot(matches[0], processName);
  }

  async logs(processName: string, lines: number) {
    const config = this.validateManagementInput(processName);
    const boundedLines = Math.min(200, Math.max(1, Math.trunc(Number(lines) || 100)));
    const result = await this.runPm2(config, [
      'logs',
      processName,
      '--nostream',
      '--raw',
      '--lines',
      String(boundedLines),
    ]);
    return this.logRedactor.redactStreams(result);
  }

  endpoint(input: { processName: string; loopbackPort: number }): AppServiceRuntimeEndpoint {
    this.assertProcessName(input.processName);
    if (!Number.isInteger(input.loopbackPort) || input.loopbackPort < 1 || input.loopbackPort > 65535) {
      throw new BadRequestException('Invalid service loopback port');
    }
    return { kind: 'tcp', port: input.loopbackPort };
  }

  private validateProcessSpec(spec: AppServiceProcessSpec) {
    const config = this.runtimeConfig();
    this.assertBaseConfig(config, true);
    this.assertProcessName(spec.processName);
    if (
      !Number.isInteger(spec.loopbackPort) ||
      spec.loopbackPort < config.portMin ||
      spec.loopbackPort > config.portMax
    ) {
      throw new BadRequestException('Invalid service loopback port');
    }
    if (spec.entryFile !== 'dist/index.js') {
      throw new BadRequestException('Invalid service entry');
    }
    if (!/^\/[A-Za-z0-9/_-]*$/.test(spec.healthPath) || spec.healthPath.startsWith('//')) {
      throw new BadRequestException('Invalid service health path');
    }
    if (!Number.isInteger(spec.memoryMb) || spec.memoryMb < 128 || spec.memoryMb > 2048) {
      throw new BadRequestException('Invalid service memory limit');
    }
    if (spec.memoryMb > config.memoryMb) {
      throw new BadRequestException('Service memory exceeds the configured limit');
    }
    this.assertReleaseBoundary(config, spec.releaseDir, spec.entryFile);
    return config;
  }

  private validateManagementInput(processName: string) {
    const config = this.runtimeConfig();
    this.assertBaseConfig(config, false);
    this.assertProcessName(processName);
    return config;
  }

  private runtimeConfig(): RuntimeConfig {
    return {
      appEnv: String(this.configService.get<string>('app.env') || 'development').toLowerCase(),
      enabled: Boolean(this.configService.get<boolean>('appMarketplace.serviceRuntime.enabled')),
      rootDir: String(
        this.configService.get<string>('appMarketplace.serviceRuntime.rootDir') || '',
      ),
      user: String(this.configService.get<string>('appMarketplace.serviceRuntime.user') || ''),
      pm2Home: String(
        this.configService.get<string>('appMarketplace.serviceRuntime.pm2Home') || '',
      ),
      pm2Command: String(
        this.configService.get<string>('appMarketplace.serviceRuntime.pm2Command') || 'pm2',
      ),
      interpreter: String(
        this.configService.get<string>('appMarketplace.serviceRuntime.interpreter') || 'node',
      ) as RuntimeConfig['interpreter'],
      memoryMb: Number(
        this.configService.get<number>('appMarketplace.serviceRuntime.memoryMb') ?? 256,
      ),
      portMin: Number(
        this.configService.get<number>('appMarketplace.serviceRuntime.portMin') ?? 20000,
      ),
      portMax: Number(
        this.configService.get<number>('appMarketplace.serviceRuntime.portMax') ?? 39999,
      ),
    };
  }

  private assertBaseConfig(config: RuntimeConfig, starting: boolean) {
    if (!config.enabled) {
      throw new ServiceUnavailableException('Service runtime is disabled');
    }
    if (starting && config.appEnv === 'production') {
      throw new ServiceUnavailableException('Production service runtime requires per-app isolation');
    }
    if (this.hostEnvironment.platform() !== 'linux') {
      throw new ServiceUnavailableException('Service runtime requires Linux');
    }
    if (!RUNTIME_USER_PATTERN.test(config.user) || config.user === 'root') {
      throw new ServiceUnavailableException('Service runtime requires a configured non-root user');
    }
    if (!path.isAbsolute(config.rootDir)) {
      throw new ServiceUnavailableException('Service runtime root must be absolute');
    }
    if (!path.isAbsolute(config.pm2Home)) {
      throw new ServiceUnavailableException('PM2 home must be absolute');
    }
    if (!/^(?:[A-Za-z0-9_.-]+|\/[A-Za-z0-9_./-]+)$/.test(config.pm2Command)) {
      throw new ServiceUnavailableException('Invalid PM2 command');
    }
    if (config.interpreter !== 'node' && config.interpreter !== 'bun') {
      throw new ServiceUnavailableException('Invalid service runtime interpreter');
    }
    if (!Number.isInteger(config.memoryMb) || config.memoryMb < 128 || config.memoryMb > 2048) {
      throw new ServiceUnavailableException('Invalid configured service memory limit');
    }
    if (
      !Number.isInteger(config.portMin) ||
      !Number.isInteger(config.portMax) ||
      config.portMin < 1 ||
      config.portMax > 65535 ||
      config.portMax - config.portMin < 99
    ) {
      throw new ServiceUnavailableException('Invalid service port range');
    }
  }

  private assertProcessName(processName: string) {
    if (!PROCESS_NAME_PATTERN.test(String(processName || ''))) {
      throw new BadRequestException('Invalid service process name');
    }
  }

  private assertReleaseBoundary(config: RuntimeConfig, releaseDirValue: string, entryFile: string) {
    const rootDir = path.resolve(config.rootDir);
    const releaseDir = path.resolve(String(releaseDirValue || ''));
    if (!this.isInside(releaseDir, rootDir)) {
      throw new BadRequestException('Service release is outside the configured runtime root');
    }
    const rootStat = this.safeLstat(rootDir);
    const releaseStat = this.safeLstat(releaseDir);
    if (
      rootStat.isSymbolicLink() ||
      releaseStat.isSymbolicLink() ||
      !rootStat.isDirectory() ||
      !releaseStat.isDirectory()
    ) {
      throw new BadRequestException('Invalid service release directory');
    }
    this.assertNoSymbolicLinkSegments(rootDir, releaseDir, rootStat.uid);
    const realRoot = fs.realpathSync(rootDir);
    const realRelease = fs.realpathSync(releaseDir);
    if (!this.isInside(realRelease, realRoot)) {
      throw new BadRequestException('Service release is outside the configured runtime root');
    }
    if (rootStat.uid !== releaseStat.uid) {
      throw new BadRequestException('Service release ownership does not match the runtime root');
    }
    if ((rootStat.mode & 0o022) !== 0) {
      throw new BadRequestException('Service runtime root is group or world writable');
    }

    const targets = [
      { path: releaseDir, directory: true },
      { path: path.join(releaseDir, 'dist'), directory: true },
      { path: path.join(releaseDir, 'agentstudio-host.cjs'), directory: false },
      { path: path.join(releaseDir, ...entryFile.split('/')), directory: false },
    ];
    for (const target of targets) {
      const stat = this.safeLstat(target.path);
      if (
        stat.isSymbolicLink() ||
        (target.directory ? !stat.isDirectory() : !stat.isFile())
      ) {
        throw new BadRequestException('Invalid service release files');
      }
      if (stat.uid !== releaseStat.uid) {
        throw new BadRequestException('Service release ownership does not match the runtime root');
      }
      if ((stat.mode & 0o022) !== 0) {
        throw new BadRequestException('Service release files are group or world writable');
      }
    }
  }

  private safeLstat(target: string) {
    try {
      return fs.lstatSync(target);
    } catch {
      throw new BadRequestException('Service release files are unavailable');
    }
  }

  private isInside(candidateValue: string, rootValue: string) {
    const candidate = path.resolve(candidateValue);
    const root = path.resolve(rootValue);
    const relative = path.relative(root, candidate);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
  }

  private assertNoSymbolicLinkSegments(rootDir: string, releaseDir: string, expectedUid: number) {
    const relative = path.relative(rootDir, releaseDir);
    let current = rootDir;
    for (const segment of relative.split(path.sep).filter(Boolean)) {
      current = path.join(current, segment);
      const stat = this.safeLstat(current);
      if (stat.isSymbolicLink()) {
        throw new BadRequestException('Service release path contains a symbolic link');
      }
      if (stat.uid !== expectedUid) {
        throw new BadRequestException('Service release ownership does not match the runtime root');
      }
      if ((stat.mode & 0o022) !== 0) {
        throw new BadRequestException('Service release path is group or world writable');
      }
    }
  }

  private managementEnv(config: RuntimeConfig) {
    return {
      PATH: FIXED_PATH,
      HOME: path.dirname(config.pm2Home),
      PM2_HOME: config.pm2Home,
      NODE_ENV: 'production',
    };
  }

  private async runPm2(
    config: RuntimeConfig,
    args: string[],
    cwd = config.rootDir,
    env: Record<string, string> = this.managementEnv(config),
  ) {
    try {
      return await this.commandRunner.run(
        'runuser',
        ['-u', config.user, '--', config.pm2Command, ...args],
        {
          cwd,
          env,
          shell: false,
          timeoutMs: 15_000,
          maxBufferBytes: 1024 * 1024,
        },
      );
    } catch {
      throw new ServiceUnavailableException('Service process command failed');
    }
  }

  private toSnapshot(record: Pm2ProcessRecord, processName: string): AppServiceProcessSnapshot {
    const rawStatus = String(record.pm2_env?.status || '').toLowerCase();
    const status: AppServiceProcessSnapshot['status'] =
      rawStatus === 'online'
        ? 'online'
        : rawStatus === 'launching' || rawStatus === 'waiting restart'
          ? 'starting'
          : rawStatus === 'stopped' || rawStatus === 'stopping'
            ? 'stopped'
            : 'failed';
    const pid = Number(record.pid);
    return {
      processName,
      status,
      pid: Number.isInteger(pid) && pid > 0 ? pid : null,
      restartCount: this.nonNegativeNumber(record.pm2_env?.restart_time, true),
      memoryBytes: this.nonNegativeNumber(record.monit?.memory, true),
      cpuPercent: this.nonNegativeNumber(record.monit?.cpu, false),
    };
  }

  private nonNegativeNumber(value: unknown, integer: boolean) {
    const normalized = Number(value);
    if (!Number.isFinite(normalized) || normalized < 0) return 0;
    return integer ? Math.trunc(normalized) : normalized;
  }
}
