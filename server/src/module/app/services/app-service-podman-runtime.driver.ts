import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

import { AppServiceLogRedactor } from './app-service-log-redactor';
import {
  AppServiceCommandRunner,
  AppServiceHostEnvironment,
  createAppServiceProcessName,
} from './app-service-process-manager';
import {
  AppServiceRuntimeDriver,
  type AppServiceCommandResult,
  type AppServiceProcessSnapshot,
  type AppServiceRuntimeEndpoint,
  type AppServiceRuntimeSpec,
} from './app-service-runtime-driver';

interface PodmanRuntimeConfig {
  enabled: boolean;
  rootDir: string;
  user: string;
  podmanCommand: string;
  podmanImage: string;
  podmanHome: string;
  podmanXdgRuntimeDir: string;
  socketDir: string;
  memoryMb: number;
  cpuLimit: number;
  pidsLimit: number;
  tmpfsMb: number;
  containerUid: number;
}

interface PodmanInspectRecord {
  Name?: unknown;
  ImageDigest?: unknown;
  RestartCount?: unknown;
  State?: {
    Status?: unknown;
    Pid?: unknown;
  };
  Config?: {
    Labels?: unknown;
  };
}

interface PodmanStatsRecord {
  name?: unknown;
  Name?: unknown;
  mem_usage_bytes?: unknown;
  MemUsageBytes?: unknown;
  cpu_percent?: unknown;
  CPUPerc?: unknown;
}

const FIXED_PATH = '/usr/local/bin:/usr/bin:/bin';
const PROCESS_NAME_PATTERN = /^agentstudio-app-[a-z0-9-]{3,90}$/;
const APP_CODE_PATTERN = /^[a-z][a-z0-9_]{2,79}$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const RUNTIME_USER_PATTERN = /^[a-z_][a-z0-9_-]{0,31}$/;
const PODMAN_COMMAND_PATTERN = /^\/[A-Za-z0-9_./-]+$/;
const IMAGE_PATTERN =
  /^(?:[a-z0-9]+(?:[._-][a-z0-9]+)*(?::\d+)?\/)*(?:[a-z0-9]+(?:[._-][a-z0-9]+)*)@sha256:[a-f0-9]{64}$/;
const AGENTSTUDIO_LABEL_PREFIX = 'io.agentstudio.';
const MANAGED_LABELS = [
  'io.agentstudio.app-code',
  'io.agentstudio.managed',
  'io.agentstudio.runtime-image',
  'io.agentstudio.version',
];

@Injectable()
export class PodmanAppServiceRuntimeDriver implements AppServiceRuntimeDriver {
  readonly name = 'podman' as const;

  constructor(
    private readonly configService: ConfigService,
    @Inject(AppServiceCommandRunner)
    private readonly commandRunner: AppServiceCommandRunner,
    private readonly logRedactor: AppServiceLogRedactor,
    private readonly hostEnvironment: AppServiceHostEnvironment,
  ) {}

  async start(spec: AppServiceRuntimeSpec): Promise<AppServiceProcessSnapshot> {
    const config = this.validateRuntimeSpec(spec);
    await this.assertReplaceableContainer(config, spec.processName);
    const socketDir = this.prepareSocketDirectory(config, spec.processName);
    let startCompleted = false;
    try {
      await this.runPodman(
        config,
        [
          'run',
          '--detach',
          '--replace',
          '--pull=never',
          '--name',
          spec.processName,
          '--label',
          'io.agentstudio.managed=true',
          '--label',
          `io.agentstudio.app-code=${spec.appCode}`,
          '--label',
          `io.agentstudio.version=${spec.version}`,
          '--label',
          `io.agentstudio.runtime-image=${config.podmanImage}`,
          '--read-only',
          '--network=none',
          '--cap-drop=ALL',
          '--security-opt=no-new-privileges',
          `--pids-limit=${config.pidsLimit}`,
          `--memory=${spec.memoryMb}M`,
          `--cpus=${config.cpuLimit}`,
          `--user=${config.containerUid}:${config.containerUid}`,
          '--tmpfs',
          `/tmp:rw,noexec,nosuid,nodev,size=${config.tmpfsMb}m`,
          '--volume',
          `${path.resolve(spec.releaseDir)}:/app:ro`,
          '--volume',
          `${socketDir}:/run/agentstudio:rw,U`,
          '--env',
          'APP_SERVICE_SOCKET=/run/agentstudio/service.sock',
          '--env',
          'APP_SERVICE_ENTRY=/app/dist/index.js',
          '--env',
          `APP_SERVICE_HEALTH_PATH=${spec.healthPath}`,
          config.podmanImage,
          'node',
          '/app/agentstudio-host.cjs',
        ],
        path.resolve(spec.releaseDir),
        30_000,
      );
      startCompleted = true;
      const snapshot = await this.describe(spec.processName);
      if (!snapshot) {
        throw new ServiceUnavailableException('Service container state is unavailable');
      }
      return snapshot;
    } catch (error) {
      if (startCompleted) {
        await this.bestEffortContainerCleanup(config, spec.processName);
      }
      this.bestEffortSocketCleanup(config, spec.processName);
      throw error;
    }
  }

  async stop(processName: string): Promise<void> {
    const config = this.validateManagementInput(processName);
    const record = await this.inspectManaged(config, processName);
    if (!record) return;
    await this.runPodman(config, ['stop', '--time', '10', processName]);
  }

  async delete(processName: string): Promise<void> {
    const config = this.validateManagementInput(processName);
    const record = await this.inspectManaged(config, processName);
    if (record) {
      await this.runPodman(config, ['rm', '--force', processName]);
    }
    this.removeSocketDirectory(config, processName);
  }

  async describe(processName: string): Promise<AppServiceProcessSnapshot | null> {
    const config = this.validateManagementInput(processName);
    const record = await this.inspectManaged(config, processName);
    if (!record) return null;

    const status = this.normalizeStatus(record.State?.Status);
    const metrics = status === 'online' ? await this.readStats(config, processName) : null;
    const pid = Number(record.State?.Pid);
    return {
      processName,
      status,
      pid: Number.isInteger(pid) && pid > 0 ? pid : null,
      restartCount: this.nonNegativeNumber(record.RestartCount, true),
      memoryBytes: metrics?.memoryBytes ?? 0,
      cpuPercent: metrics?.cpuPercent ?? 0,
    };
  }

  async logs(processName: string, lines: number): Promise<AppServiceCommandResult> {
    const config = this.validateManagementInput(processName);
    const record = await this.inspectManaged(config, processName);
    if (!record) {
      throw new ServiceUnavailableException('Service container state is unavailable');
    }
    const boundedLines = Math.max(1, Math.min(200, Math.trunc(Number(lines) || 1)));
    const result = await this.runPodman(config, [
      'logs',
      '--tail',
      String(boundedLines),
      processName,
    ]);
    return this.logRedactor.redactStreams(result);
  }

  endpoint(input: { processName: string; loopbackPort: number }): AppServiceRuntimeEndpoint {
    const config = this.validateManagementInput(input.processName);
    if (
      !Number.isInteger(input.loopbackPort) ||
      input.loopbackPort < 1 ||
      input.loopbackPort > 65535
    ) {
      throw new BadRequestException('Invalid service loopback port');
    }
    return {
      kind: 'unix',
      socketPath: path.join(path.resolve(config.socketDir), input.processName, 'service.sock'),
    };
  }

  private runtimeConfig(): PodmanRuntimeConfig {
    return {
      enabled: Boolean(this.configService.get<boolean>('appMarketplace.serviceRuntime.enabled')),
      rootDir: String(
        this.configService.get<string>('appMarketplace.serviceRuntime.rootDir') || '',
      ),
      user: String(this.configService.get<string>('appMarketplace.serviceRuntime.user') || ''),
      podmanCommand: String(
        this.configService.get<string>('appMarketplace.serviceRuntime.podmanCommand') || '',
      ),
      podmanImage: String(
        this.configService.get<string>('appMarketplace.serviceRuntime.podmanImage') || '',
      ),
      podmanHome: String(
        this.configService.get<string>('appMarketplace.serviceRuntime.podmanHome') || '',
      ),
      podmanXdgRuntimeDir: String(
        this.configService.get<string>('appMarketplace.serviceRuntime.podmanXdgRuntimeDir') || '',
      ),
      socketDir: String(
        this.configService.get<string>('appMarketplace.serviceRuntime.socketDir') || '',
      ),
      memoryMb: Number(
        this.configService.get<number>('appMarketplace.serviceRuntime.memoryMb') ?? 256,
      ),
      cpuLimit: Number(
        this.configService.get<number>('appMarketplace.serviceRuntime.cpuLimit') ?? 1,
      ),
      pidsLimit: Number(
        this.configService.get<number>('appMarketplace.serviceRuntime.pidsLimit') ?? 64,
      ),
      tmpfsMb: Number(
        this.configService.get<number>('appMarketplace.serviceRuntime.tmpfsMb') ?? 16,
      ),
      containerUid: Number(
        this.configService.get<number>('appMarketplace.serviceRuntime.containerUid') ?? 65532,
      ),
    };
  }

  private validateRuntimeSpec(spec: AppServiceRuntimeSpec) {
    const config = this.runtimeConfig();
    this.assertBaseConfig(config);
    if (!APP_CODE_PATTERN.test(String(spec.appCode || ''))) {
      throw new BadRequestException('Invalid service app code');
    }
    if (!VERSION_PATTERN.test(String(spec.version || ''))) {
      throw new BadRequestException('Invalid service version');
    }
    if (spec.processName !== createAppServiceProcessName(spec.appCode, spec.version)) {
      throw new BadRequestException('Invalid service process identity');
    }
    if (spec.entryFile !== 'dist/index.js') {
      throw new BadRequestException('Invalid service entry');
    }
    if (!/^\/[A-Za-z0-9/_-]*$/.test(spec.healthPath) || spec.healthPath.startsWith('//')) {
      throw new BadRequestException('Invalid service health path');
    }
    if (
      !Number.isInteger(spec.loopbackPort) ||
      spec.loopbackPort < 1 ||
      spec.loopbackPort > 65535
    ) {
      throw new BadRequestException('Invalid service loopback port');
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
    this.assertBaseConfig(config);
    this.assertProcessName(processName);
    return config;
  }

  private assertBaseConfig(config: PodmanRuntimeConfig) {
    if (!config.enabled) {
      throw new ServiceUnavailableException('Service runtime is disabled');
    }
    if (this.hostEnvironment.platform() !== 'linux') {
      throw new ServiceUnavailableException('Service runtime requires Linux');
    }
    if (!RUNTIME_USER_PATTERN.test(config.user) || config.user === 'root') {
      throw new ServiceUnavailableException('Service runtime requires a configured non-root user');
    }
    if (!path.isAbsolute(config.podmanCommand)) {
      throw new ServiceUnavailableException('Podman command must be absolute');
    }
    if (!PODMAN_COMMAND_PATTERN.test(config.podmanCommand)) {
      throw new ServiceUnavailableException('Invalid Podman command');
    }
    if (!IMAGE_PATTERN.test(config.podmanImage)) {
      throw new ServiceUnavailableException('Invalid digest-pinned Podman image');
    }

    const configuredPaths = [
      ['service runtime root', config.rootDir],
      ['Podman home', config.podmanHome],
      ['Podman XDG runtime directory', config.podmanXdgRuntimeDir],
      ['service socket root', config.socketDir],
    ] as const;
    for (const [label, value] of configuredPaths) {
      if (!path.isAbsolute(value)) {
        throw new ServiceUnavailableException(`${label} must be absolute`);
      }
      if (this.pathsOverlap(value, process.cwd())) {
        throw new ServiceUnavailableException(`${label} must be outside the repository`);
      }
    }

    if (
      this.pathsOverlap(config.rootDir, config.podmanHome) ||
      this.pathsOverlap(config.rootDir, config.podmanXdgRuntimeDir) ||
      this.pathsOverlap(config.podmanHome, config.podmanXdgRuntimeDir) ||
      !this.isInside(config.socketDir, config.podmanHome) ||
      path.resolve(config.socketDir) === path.resolve(config.podmanHome)
    ) {
      throw new ServiceUnavailableException('Podman runtime paths overlap incorrectly');
    }
    for (const [label, value] of configuredPaths) {
      this.assertDirectory(value, label);
    }
    if (!Number.isInteger(config.memoryMb) || config.memoryMb < 128 || config.memoryMb > 2048) {
      throw new ServiceUnavailableException('Invalid configured service memory limit');
    }
    if (!Number.isFinite(config.cpuLimit) || config.cpuLimit < 0.1 || config.cpuLimit > 8) {
      throw new ServiceUnavailableException('Invalid Podman CPU limit');
    }
    if (!Number.isInteger(config.pidsLimit) || config.pidsLimit < 16 || config.pidsLimit > 512) {
      throw new ServiceUnavailableException('Invalid Podman PIDs limit');
    }
    if (!Number.isInteger(config.tmpfsMb) || config.tmpfsMb < 8 || config.tmpfsMb > 256) {
      throw new ServiceUnavailableException('Invalid Podman tmpfs limit');
    }
    if (
      !Number.isInteger(config.containerUid) ||
      config.containerUid < 1 ||
      config.containerUid > 2_147_483_647
    ) {
      throw new ServiceUnavailableException('Invalid Podman container UID');
    }
  }

  private assertReleaseBoundary(
    config: PodmanRuntimeConfig,
    releaseDirValue: string,
    entryFile: string,
  ) {
    const rootDir = path.resolve(config.rootDir);
    const releaseDir = path.resolve(String(releaseDirValue || ''));
    if (!this.isInside(releaseDir, rootDir)) {
      throw new BadRequestException('Service release is outside the configured runtime root');
    }
    const rootStat = this.safeLstat(rootDir, 'Service release files are unavailable');
    const releaseStat = this.safeLstat(releaseDir, 'Service release files are unavailable');
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
      { target: releaseDir, directory: true },
      { target: path.join(releaseDir, 'dist'), directory: true },
      { target: path.join(releaseDir, 'agentstudio-host.cjs'), directory: false },
      { target: path.join(releaseDir, ...entryFile.split('/')), directory: false },
    ];
    for (const item of targets) {
      const stat = this.safeLstat(item.target, 'Service release files are unavailable');
      if (stat.isSymbolicLink() || (item.directory ? !stat.isDirectory() : !stat.isFile())) {
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

  private assertDirectory(target: string, label: string) {
    const stat = this.safeLstat(target, `${label} is unavailable`);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new ServiceUnavailableException(`Invalid ${label}`);
    }
    if (process.platform !== 'win32' && (stat.mode & 0o022) !== 0) {
      throw new ServiceUnavailableException(`${label} is group or world writable`);
    }
    if (fs.realpathSync(target) !== path.resolve(target)) {
      throw new ServiceUnavailableException(`${label} contains a symbolic link`);
    }
  }

  private assertNoSymbolicLinkSegments(rootDir: string, releaseDir: string, expectedUid: number) {
    const relative = path.relative(rootDir, releaseDir);
    let current = rootDir;
    for (const segment of relative.split(path.sep).filter(Boolean)) {
      current = path.join(current, segment);
      const stat = this.safeLstat(current, 'Service release files are unavailable');
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

  private prepareSocketDirectory(config: PodmanRuntimeConfig, processName: string) {
    const socketDir = this.socketDirectory(config, processName);
    if (fs.existsSync(socketDir)) {
      const stat = this.safeLstat(socketDir, 'Service socket directory is unavailable');
      if (stat.isSymbolicLink() || !stat.isDirectory()) {
        throw new ServiceUnavailableException('Invalid service socket directory');
      }
      fs.rmSync(socketDir, { recursive: true, force: true });
    }
    fs.mkdirSync(socketDir, { mode: 0o700 });
    fs.chmodSync(socketDir, 0o700);
    return socketDir;
  }

  private removeSocketDirectory(config: PodmanRuntimeConfig, processName: string) {
    const socketDir = this.socketDirectory(config, processName);
    if (!fs.existsSync(socketDir)) return;
    const stat = this.safeLstat(socketDir, 'Service socket directory is unavailable');
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new ServiceUnavailableException('Invalid service socket directory');
    }
    fs.rmSync(socketDir, { recursive: true, force: true });
  }

  private socketDirectory(config: PodmanRuntimeConfig, processName: string) {
    this.assertProcessName(processName);
    const root = path.resolve(config.socketDir);
    const target = path.resolve(root, processName);
    if (!this.isInside(target, root) || target === root) {
      throw new BadRequestException('Invalid service socket path');
    }
    return target;
  }

  private async inspectManaged(config: PodmanRuntimeConfig, processName: string) {
    const result = await this.runPodman(config, ['inspect', '--format', 'json', processName]);
    const records = this.parseArray<PodmanInspectRecord>(result.stdout);
    if (records.length === 0) return null;
    if (records.length !== 1) {
      throw new ServiceUnavailableException('Service container state is invalid');
    }
    const record = records[0];
    if (record.Name !== processName) {
      throw new ServiceUnavailableException('Service container identity is invalid');
    }
    const labels = this.asLabels(record.Config?.Labels);
    const agentstudioLabels = Object.keys(labels)
      .filter((key) => key.startsWith(AGENTSTUDIO_LABEL_PREFIX))
      .sort();
    if (agentstudioLabels.join('\n') !== MANAGED_LABELS.join('\n')) {
      throw new ServiceUnavailableException('Service container labels are invalid');
    }
    if (labels['io.agentstudio.managed'] !== 'true') {
      throw new ServiceUnavailableException('Service container is not platform managed');
    }
    const appCode = labels['io.agentstudio.app-code'];
    const version = labels['io.agentstudio.version'];
    if (
      !APP_CODE_PATTERN.test(appCode || '') ||
      !VERSION_PATTERN.test(version || '') ||
      createAppServiceProcessName(appCode, version) !== processName
    ) {
      throw new ServiceUnavailableException('Service container identity is invalid');
    }
    const runtimeImage = labels['io.agentstudio.runtime-image'];
    if (
      !IMAGE_PATTERN.test(runtimeImage || '') ||
      this.extractDigest(record.ImageDigest) !== this.extractDigest(runtimeImage)
    ) {
      throw new ServiceUnavailableException('Service container image is invalid');
    }
    return record;
  }

  private async assertReplaceableContainer(config: PodmanRuntimeConfig, processName: string) {
    const result = await this.runPodman(config, [
      'ps',
      '--all',
      '--filter',
      `name=^${processName}$`,
      '--format',
      'json',
    ]);
    const records = this.parseArray<Record<string, unknown>>(result.stdout);
    if (records.length === 0) return;
    if (records.length !== 1 || this.listedContainerName(records[0]) !== processName) {
      throw new ServiceUnavailableException('Service container identity is invalid');
    }
    const managed = await this.inspectManaged(config, processName);
    if (!managed) {
      throw new ServiceUnavailableException('Service container state is invalid');
    }
  }

  private listedContainerName(record: Record<string, unknown>) {
    const names = record.Names ?? record.Name;
    if (typeof names === 'string') return names;
    if (Array.isArray(names) && names.length === 1 && typeof names[0] === 'string') {
      return names[0];
    }
    return '';
  }

  private async bestEffortContainerCleanup(config: PodmanRuntimeConfig, processName: string) {
    try {
      await this.runPodman(config, ['rm', '--force', processName]);
    } catch {
      // Reconciliation will retry cleanup without replacing the original failure.
    }
  }

  private bestEffortSocketCleanup(config: PodmanRuntimeConfig, processName: string) {
    try {
      this.removeSocketDirectory(config, processName);
    } catch {
      // Reconciliation will retry cleanup without replacing the original failure.
    }
  }

  private async readStats(config: PodmanRuntimeConfig, processName: string) {
    const result = await this.runPodman(config, [
      'stats',
      '--no-stream',
      '--format',
      'json',
      processName,
    ]);
    const records = this.parseArray<PodmanStatsRecord>(result.stdout);
    if (records.length !== 1) {
      throw new ServiceUnavailableException('Service container metrics are invalid');
    }
    const record = records[0];
    if (String(record.name ?? record.Name ?? '') !== processName) {
      throw new ServiceUnavailableException('Service container metrics are invalid');
    }
    return {
      memoryBytes: this.nonNegativeNumber(record.mem_usage_bytes ?? record.MemUsageBytes, true),
      cpuPercent: this.nonNegativeNumber(
        String(record.cpu_percent ?? record.CPUPerc ?? '').replace(/%$/, ''),
        false,
      ),
    };
  }

  private parseArray<T>(value: string): T[] {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (!Array.isArray(parsed)) throw new Error('invalid_json_shape');
      return parsed as T[];
    } catch {
      throw new ServiceUnavailableException('Service container state is invalid');
    }
  }

  private asLabels(value: unknown): Record<string, string> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new ServiceUnavailableException('Service container labels are invalid');
    }
    const labels: Record<string, string> = {};
    for (const [key, item] of Object.entries(value)) {
      if (typeof item !== 'string') {
        throw new ServiceUnavailableException('Service container labels are invalid');
      }
      labels[key] = item;
    }
    return labels;
  }

  private extractDigest(value: unknown) {
    const match = String(value || '').match(/(?:^|@)(sha256:[a-f0-9]{64})$/);
    if (!match) {
      throw new ServiceUnavailableException('Service container image is invalid');
    }
    return match[1];
  }

  private normalizeStatus(value: unknown): AppServiceProcessSnapshot['status'] {
    const status = String(value || '').toLowerCase();
    if (status === 'running') return 'online';
    if (status === 'created' || status === 'configured' || status === 'restarting') {
      return 'starting';
    }
    if (status === 'stopped' || status === 'exited') return 'stopped';
    return 'failed';
  }

  private async runPodman(
    config: PodmanRuntimeConfig,
    args: string[],
    cwd = config.rootDir,
    timeoutMs = 15_000,
  ) {
    try {
      return await this.commandRunner.run(
        'runuser',
        ['-u', config.user, '--', config.podmanCommand, ...args],
        {
          cwd,
          env: {
            PATH: FIXED_PATH,
            HOME: config.podmanHome,
            XDG_RUNTIME_DIR: config.podmanXdgRuntimeDir,
            NODE_ENV: 'production',
          },
          shell: false,
          timeoutMs,
          maxBufferBytes: 1024 * 1024,
        },
      );
    } catch {
      throw new ServiceUnavailableException('Service container command failed');
    }
  }

  private assertProcessName(processName: string) {
    if (!PROCESS_NAME_PATTERN.test(String(processName || ''))) {
      throw new BadRequestException('Invalid service process name');
    }
  }

  private safeLstat(target: string, message: string) {
    try {
      return fs.lstatSync(target);
    } catch {
      throw new ServiceUnavailableException(message);
    }
  }

  private pathsOverlap(left: string, right: string) {
    return this.isInside(left, right) || this.isInside(right, left);
  }

  private isInside(candidateValue: string, rootValue: string) {
    const candidate = path.resolve(candidateValue);
    const root = path.resolve(rootValue);
    const relative = path.relative(root, candidate);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
  }

  private nonNegativeNumber(value: unknown, integer: boolean) {
    const normalized = Number(value);
    if (!Number.isFinite(normalized) || normalized < 0) return 0;
    return integer ? Math.trunc(normalized) : normalized;
  }
}
