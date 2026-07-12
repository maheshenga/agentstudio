import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createServer } from 'net';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { AppPackageEntity } from '../entities/app-package.entity';
import { AppPackageVersionEntity } from '../entities/app-package-version.entity';
import { AppReviewLogEntity, type AppReviewAction } from '../entities/app-review-log.entity';
import { AppServiceInstanceEntity } from '../entities/app-service-instance.entity';
import { AppDeveloperCertificationService } from './app-developer-certification.service';
import { AppReviewSnapshotService } from './app-review-snapshot.service';
import { AppServiceLogRedactor } from './app-service-log-redactor';
import {
  AppServiceLoopbackTransport,
  type AppServiceLoopbackResponse,
} from './app-service-loopback.transport';
import {
  AppServiceProcessManager,
  createAppServiceProcessName,
  type AppServiceProcessSpec,
  type AppServiceProcessSnapshot,
} from './app-service-process-manager';
import { AppServicePackageService } from './app-service-package.service';

export interface AppServicePortAllocationInput {
  min: number;
  max: number;
  used: number[];
}

export abstract class AppServicePortAllocator {
  abstract allocate(input: AppServicePortAllocationInput): Promise<number>;
}

@Injectable()
export class NodeAppServicePortAllocator implements AppServicePortAllocator {
  async allocate(input: AppServicePortAllocationInput) {
    const used = new Set(input.used.map(Number));
    for (let port = input.min; port <= input.max; port += 1) {
      if (used.has(port)) continue;
      if (await this.isAvailable(port)) return port;
    }
    throw new ServiceUnavailableException('No service loopback port is available');
  }

  private isAvailable(port: number) {
    return new Promise<boolean>((resolve) => {
      const server = createServer();
      server.unref();
      server.once('error', () => resolve(false));
      server.listen({ host: '127.0.0.1', port, exclusive: true }, () => {
        server.close(() => resolve(true));
      });
    });
  }
}

export abstract class AppServiceDelay {
  abstract wait(milliseconds: number): Promise<void>;
}

@Injectable()
export class NodeAppServiceDelay implements AppServiceDelay {
  wait(milliseconds: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
  }
}

interface PreparedCandidate {
  app: AppPackageEntity;
  version: AppPackageVersionEntity;
  instance: AppServiceInstanceEntity;
  spec: AppServiceProcessSpec;
}

export interface ReconcileSummary {
  inspected: number;
  restarted: number;
  stopped: number;
  failed: number;
}

export interface AppServiceRuntimeListQuery {
  app_code?: string;
  role?: AppServiceInstanceEntity['role'];
  process_status?: AppServiceInstanceEntity['processStatus'];
  health_status?: AppServiceInstanceEntity['healthStatus'];
}

@Injectable()
export class AppServiceRuntimeService {
  constructor(
    @InjectRepository(AppPackageEntity)
    private readonly appRepo: Repository<AppPackageEntity>,
    @InjectRepository(AppPackageVersionEntity)
    private readonly versionRepo: Repository<AppPackageVersionEntity>,
    @InjectRepository(AppServiceInstanceEntity)
    private readonly instanceRepo: Repository<AppServiceInstanceEntity>,
    @InjectRepository(AppReviewLogEntity)
    private readonly reviewLogRepo: Repository<AppReviewLogEntity>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly processManager: AppServiceProcessManager,
    private readonly loopbackTransport: AppServiceLoopbackTransport,
    @Inject(AppServicePortAllocator)
    private readonly portAllocator: AppServicePortAllocator,
    @Inject(AppServiceDelay)
    private readonly delay: AppServiceDelay,
    private readonly logRedactor: AppServiceLogRedactor,
    private readonly certificationService: AppDeveloperCertificationService,
    private readonly snapshotService: AppReviewSnapshotService,
    private readonly packageService: AppServicePackageService,
  ) {}

  async startCandidate(appCode: string, versionValue: string, operatorId: number) {
    this.assertEnabled();
    this.assertOperator(operatorId);
    const prepared = await this.dataSource.transaction((manager) =>
      this.prepareCandidate(manager, appCode, versionValue, operatorId),
    );

    let snapshot: AppServiceProcessSnapshot;
    try {
      snapshot = await this.processManager.start(prepared.spec);
      if (snapshot.status !== 'online' && snapshot.status !== 'starting') {
        throw new Error('candidate_not_online');
      }
    } catch {
      await this.cleanupProcess(prepared.instance.processName);
      await this.markCandidateFailed(
        prepared.instance.id,
        prepared.version.id,
        'candidate_start_failed',
        'Candidate process failed to start',
      );
      throw new ServiceUnavailableException('Candidate process failed to start');
    }

    const healthy = await this.awaitCandidateHealth(prepared);
    if (!healthy) {
      await this.cleanupProcess(prepared.instance.processName);
      await this.markCandidateFailed(
        prepared.instance.id,
        prepared.version.id,
        'candidate_health_failed',
        'Candidate health verification failed',
      );
      throw new ServiceUnavailableException('Candidate health verification failed');
    }

    return this.markCandidateHealthy(
      prepared.instance.id,
      prepared.version.id,
      snapshot,
      operatorId,
      prepared.app.trustLevel === 'developer_restricted',
    );
  }

  async publishCandidate(appCode: string, versionValue: string, operatorId: number) {
    this.assertEnabled();
    this.assertOperator(operatorId);
    const verifiedCandidateId = await this.verifyLiveRole(
      appCode,
      versionValue,
      'candidate',
      'Service version requires a healthy candidate',
    );
    const retired = await this.dataSource.transaction(async (manager) => {
      const { app, version } = await this.lockAppVersion(manager, appCode, versionValue);
      await this.assertReviewedServiceVersion(app, version);
      if (app.trustLevel === 'developer_restricted') {
        this.assertIndependentCandidateReview(version);
      }
      const instances = await this.lockInstances(manager, app.id);
      const candidate = instances.find(
        (item) =>
          Number(item.id) === Number(verifiedCandidateId) &&
          Number(item.versionId) === Number(version.id) &&
          item.role === 'candidate',
      );
      if (
        !candidate ||
        candidate.healthStatus !== 'healthy' ||
        candidate.processStatus !== 'online' ||
        version.candidateHealthStatus !== 'healthy'
      ) {
        throw new BadRequestException('Service version requires a healthy candidate');
      }

      const active = instances.filter((item) => item.role === 'active');
      if (active.length > 1) {
        throw new ServiceUnavailableException('Service runtime has multiple active instances');
      }
      const previousActive = active[0];
      const retiredInstances = instances.filter(
        (item) => item.role === 'standby' && Number(item.id) !== Number(previousActive?.id),
      );
      for (const item of retiredInstances) item.role = 'retired';
      if (previousActive) previousActive.role = 'standby';
      candidate.role = 'active';

      const versionRepo = manager.getRepository(AppPackageVersionEntity);
      if (previousActive) {
        const previousVersion = await versionRepo.findOne({
          where: { id: previousActive.versionId },
          lock: { mode: 'pessimistic_write' },
        });
        if (previousVersion) {
          previousVersion.publishStatus = 'unpublished_retired';
          await versionRepo.save(previousVersion);
        }
      }
      version.publishStatus = 'published';
      version.releasedBy = operatorId;
      version.releasedTime = new Date();
      app.status = 'published';
      app.entryMode = 'service';
      app.entryUrl = '';

      const instanceRepo = manager.getRepository(AppServiceInstanceEntity);
      for (const instance of [
        ...retiredInstances,
        ...(previousActive ? [previousActive] : []),
        candidate,
      ]) {
        await instanceRepo.save(instance);
      }
      await versionRepo.save(version);
      await manager.getRepository(AppPackageEntity).save(app);
      await this.recordEvent(
        manager,
        app.id,
        version.id,
        'publish',
        `Published service version ${version.version}`,
        operatorId,
      );
      return retiredInstances.map((item) => ({ id: item.id, processName: item.processName }));
    });

    await this.cleanupRetired(retired);
    return this.getRuntimeApp(appCode);
  }

  async rollback(
    appCode: string,
    targetVersionValue: string,
    reason: string,
    operatorId: number,
  ) {
    this.assertEnabled();
    this.assertOperator(operatorId);
    const normalizedReason = this.requiredReason(reason);
    const verifiedStandbyId = await this.verifyLiveRole(
      appCode,
      targetVersionValue,
      'standby',
      'Rollback requires a healthy standby',
    );
    const retired = await this.dataSource.transaction(async (manager) => {
      const { app, version: targetVersion } = await this.lockAppVersion(
        manager,
        appCode,
        targetVersionValue,
      );
      await this.assertReviewedServiceVersion(app, targetVersion);
      if (app.trustLevel === 'developer_restricted') {
        this.assertIndependentCandidateReview(targetVersion);
      }
      const instances = await this.lockInstances(manager, app.id);
      const target = instances.find(
        (item) =>
          Number(item.id) === Number(verifiedStandbyId) &&
          Number(item.versionId) === Number(targetVersion.id) &&
          item.role === 'standby',
      );
      if (!target || target.healthStatus !== 'healthy' || target.processStatus !== 'online') {
        throw new BadRequestException('Rollback requires a healthy standby');
      }
      const active = instances.filter((item) => item.role === 'active');
      if (active.length !== 1) {
        throw new ServiceUnavailableException('Rollback requires exactly one active service');
      }
      const previousActive = active[0];
      const retiredInstances = instances.filter(
        (item) => item.role === 'standby' && Number(item.id) !== Number(target.id),
      );
      for (const item of retiredInstances) item.role = 'retired';
      previousActive.role = 'standby';
      target.role = 'active';

      const versionRepo = manager.getRepository(AppPackageVersionEntity);
      const previousVersion = await versionRepo.findOne({
        where: { id: previousActive.versionId },
        lock: { mode: 'pessimistic_write' },
      });
      if (previousVersion) {
        previousVersion.publishStatus = 'unpublished_retired';
        await versionRepo.save(previousVersion);
      }
      targetVersion.publishStatus = 'published';
      targetVersion.rollbackFromVersionId = previousActive.versionId;
      targetVersion.releasedBy = operatorId;
      targetVersion.releasedTime = new Date();
      app.status = 'published';
      app.entryMode = 'service';
      app.entryUrl = '';

      const instanceRepo = manager.getRepository(AppServiceInstanceEntity);
      for (const instance of [
        ...retiredInstances,
        previousActive,
        target,
      ]) {
        await instanceRepo.save(instance);
      }
      await versionRepo.save(targetVersion);
      await manager.getRepository(AppPackageEntity).save(app);
      await this.recordEvent(
        manager,
        app.id,
        targetVersion.id,
        'rollback',
        normalizedReason,
        operatorId,
        { previousVersionId: previousActive.versionId },
      );
      return retiredInstances.map((item) => ({ id: item.id, processName: item.processName }));
    });

    await this.cleanupRetired(retired);
    return this.getRuntimeApp(appCode);
  }

  async stopCandidate(
    appCode: string,
    versionValue: string,
    reason: string,
    operatorId: number,
  ) {
    this.assertEnabled();
    this.assertOperator(operatorId);
    const normalizedReason = this.requiredReason(reason);
    const prepared = await this.dataSource.transaction(async (manager) => {
      const { app, version } = await this.lockAppVersion(manager, appCode, versionValue);
      const instances = await this.lockInstances(manager, app.id);
      const candidate = instances.find(
        (item) => Number(item.versionId) === Number(version.id) && item.role === 'candidate',
      );
      if (!candidate) throw new NotFoundException('Service candidate not found');
      candidate.role = 'retired';
      candidate.healthStatus = 'unknown';
      version.candidateHealthStatus = 'unknown';
      await manager.getRepository(AppServiceInstanceEntity).save(candidate);
      await manager.getRepository(AppPackageVersionEntity).save(version);
      await this.recordEvent(
        manager,
        app.id,
        version.id,
        'candidate_stop',
        normalizedReason,
        operatorId,
      );
      return { appId: app.id, versionId: version.id, instanceId: candidate.id, candidate };
    });

    try {
      await this.processManager.stop(prepared.candidate.processName);
      await this.processManager.delete(prepared.candidate.processName);
    } catch {
      await this.markReconcileFailure(prepared.candidate, 'candidate_stop_failed');
      throw new ServiceUnavailableException('Candidate process failed to stop');
    }

    await this.instanceRepo.update(
      { id: prepared.instanceId },
      {
        processStatus: 'stopped',
        stoppedTime: new Date(),
        lastErrorCode: '',
        lastErrorMessage: '',
      },
    );
    return this.getRuntimeApp(appCode);
  }

  async reconcile(operatorId?: number): Promise<ReconcileSummary> {
    this.assertEnabled();
    if (operatorId !== undefined) this.assertOperator(operatorId);
    const instances = await this.instanceRepo.find({ order: { id: 'ASC' } });
    const versions = await this.versionRepo.find();
    const versionById = new Map(versions.map((version) => [Number(version.id), version]));
    const summary: ReconcileSummary = {
      inspected: instances.length,
      restarted: 0,
      stopped: 0,
      failed: 0,
    };

    for (const instance of instances) {
      if (instance.role === 'retired') {
        try {
          const snapshot = await this.processManager.describe(instance.processName);
          const cleaned = snapshot ? await this.cleanupProcess(instance.processName) : true;
          if (!cleaned) throw new Error('retired_cleanup_failed');
          await this.instanceRepo.update(
            { id: instance.id },
            {
              processStatus: 'stopped',
              stoppedTime: new Date(),
              lastErrorCode: '',
              lastErrorMessage: '',
            },
          );
          summary.stopped += 1;
        } catch {
          await this.markReconcileFailure(instance, 'retired_cleanup_failed');
          summary.failed += 1;
        }
        continue;
      }
      if (instance.role === 'candidate' && instance.healthStatus === 'unhealthy') continue;

      const version = versionById.get(Number(instance.versionId));
      if (!version) {
        await this.markReconcileFailure(instance, 'version_missing');
        summary.failed += 1;
        continue;
      }
      try {
        const snapshot = await this.processManager.describe(instance.processName);
        if (instance.lastErrorCode === 'restart_drift') {
          await this.instanceRepo.update(
            { id: instance.id },
            {
              processStatus: 'failed',
              restartCount: snapshot?.restartCount ?? instance.restartCount,
              lastErrorCode: 'restart_drift',
              lastErrorMessage: this.fixedDiagnostic('Repeated service restart drift detected'),
            },
          );
          summary.failed += 1;
          continue;
        }
        if (
          snapshot &&
          snapshot.restartCount - Number(instance.restartCount || 0) >= 3
        ) {
          await this.instanceRepo.update(
            { id: instance.id },
            {
              processStatus: 'failed',
              restartCount: snapshot.restartCount,
              lastErrorCode: 'restart_drift',
              lastErrorMessage: this.fixedDiagnostic('Repeated service restart drift detected'),
            },
          );
          summary.failed += 1;
          continue;
        }
        if (snapshot?.status === 'online' || snapshot?.status === 'starting') {
          await this.instanceRepo.update(
            { id: instance.id },
            {
              processStatus: snapshot.status,
              restartCount: snapshot.restartCount,
              lastErrorCode: '',
              lastErrorMessage: '',
            },
          );
          continue;
        }

        const restarted = await this.processManager.start(this.processSpec(instance, version));
        await this.instanceRepo.update(
          { id: instance.id },
          {
            processStatus: restarted.status,
            restartCount: restarted.restartCount,
            startedTime: new Date(),
            lastErrorCode: '',
            lastErrorMessage: '',
          },
        );
        summary.restarted += 1;
      } catch {
        await this.markReconcileFailure(instance, 'process_reconcile_failed');
        summary.failed += 1;
      }
    }
    return summary;
  }

  async probeActive(
    appCode: string,
    input: unknown,
    operatorId?: number,
  ): Promise<AppServiceLoopbackResponse> {
    this.assertEnabled();
    if (operatorId !== undefined) this.assertOperator(operatorId);
    const app = await this.findApp(appCode);
    const instances = await this.instanceRepo.find({ where: { appId: app.id } });
    const active = instances.filter((item) => item.role === 'active');
    if (
      active.length !== 1 ||
      active[0].processStatus !== 'online' ||
      active[0].healthStatus !== 'healthy'
    ) {
      throw new ServiceUnavailableException('Service requires one healthy active instance');
    }
    const response = await this.loopbackTransport.invoke(active[0].loopbackPort, input);
    await this.reviewLogRepo.save(
      this.reviewLogRepo.create({
        appId: app.id,
        versionId: active[0].versionId,
        action: 'probe',
        message: 'Probed active service instance',
        operatorId: operatorId ?? null,
        metadata: { statusCode: response.statusCode },
      }),
    );
    return response;
  }

  async listRuntimeInstances(query: AppServiceRuntimeListQuery = {}) {
    const [apps, versions, instances] = await Promise.all([
      this.appRepo.find(),
      this.versionRepo.find(),
      this.instanceRepo.find({ order: { id: 'DESC' } }),
    ]);
    const appById = new Map(apps.map((app) => [Number(app.id), app]));
    const versionById = new Map(versions.map((version) => [Number(version.id), version]));
    return instances
      .map((instance) => {
        const app = appById.get(Number(instance.appId));
        const version = versionById.get(Number(instance.versionId));
        if (!app || !version || app.type !== 'service') return null;
        return this.toInstanceResponse(app, version, instance);
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .filter((item) => {
        if (query.app_code && item.app_code !== query.app_code) return false;
        if (query.role && item.role !== query.role) return false;
        if (query.process_status && item.process_status !== query.process_status) return false;
        if (query.health_status && item.health_status !== query.health_status) return false;
        return true;
      });
  }

  async getRuntimeApp(appCode: string) {
    const app = await this.findApp(appCode);
    if (app.type !== 'service') throw new BadRequestException('App is not a service runtime');
    const instances = await this.listRuntimeInstances({ app_code: app.code });
    return {
      app_code: app.code,
      app_name: app.name,
      app_status: app.status,
      active_version: instances.find((item) => item.role === 'active')?.version || '',
      candidate_version: instances.find((item) => item.role === 'candidate')?.version || '',
      standby_version: instances.find((item) => item.role === 'standby')?.version || '',
      instances,
    };
  }

  async getRuntimeLogs(appCode: string, lines = 100) {
    const app = await this.findApp(appCode);
    if (app.type !== 'service') throw new BadRequestException('App is not a service runtime');
    const instances = await this.instanceRepo.find({
      where: { appId: app.id },
      order: { id: 'DESC' },
    });
    const instance =
      instances.find((item) => item.role === 'active') ||
      instances.find((item) => item.role === 'candidate') ||
      instances.find((item) => item.role === 'standby');
    if (!instance) throw new NotFoundException('Service runtime instance not found');
    const logs = await this.processManager.logs(instance.processName, lines);
    return {
      app_code: app.code,
      process_name: instance.processName,
      role: instance.role,
      stdout: logs.stdout,
      stderr: logs.stderr,
    };
  }

  private async prepareCandidate(
    manager: EntityManager,
    appCode: string,
    versionValue: string,
    operatorId: number,
  ): Promise<PreparedCandidate> {
    const { app, version } = await this.lockAppVersion(manager, appCode, versionValue);
    await this.assertReviewedServiceVersion(app, version);
    if (
      app.trustLevel === 'developer_restricted' &&
      (Number(version.submittedBy) === Number(operatorId) ||
        Number(version.reviewerId) === Number(operatorId))
    ) {
      throw new BadRequestException(
        'Candidate review requires a different platform operator',
      );
    }
    const instances = await this.lockInstances(manager, app.id);
    if (
      instances.some(
        (item) =>
          Number(item.versionId) === Number(version.id) &&
          (item.role === 'active' || item.role === 'standby'),
      )
    ) {
      throw new BadRequestException('Service version is already active or standby');
    }
    const conflicting = instances.find(
      (item) => item.role === 'candidate' && Number(item.versionId) !== Number(version.id),
    );
    if (conflicting) {
      throw new BadRequestException('Another service candidate already exists');
    }

    const instanceRepo = manager.getRepository(AppServiceInstanceEntity);
    let candidate = instances.find(
      (item) => item.role === 'candidate' && Number(item.versionId) === Number(version.id),
    );
    if (candidate?.healthStatus === 'healthy' && candidate.processStatus === 'online') {
      throw new BadRequestException('Service candidate is already healthy');
    }
    if (!candidate) {
      const port = await this.portAllocator.allocate({
        min: this.portMin(),
        max: this.portMax(),
        used: instances.map((item) => Number(item.loopbackPort)).filter(Boolean),
      });
      candidate = instanceRepo.create({
        appId: app.id,
        versionId: version.id,
        releaseDir: version.packagePath,
        processName: createAppServiceProcessName(app.code, version.version),
        loopbackPort: port,
        role: 'candidate',
        processStatus: 'starting',
        healthStatus: 'checking',
        restartCount: 0,
        lastErrorCode: '',
        lastErrorMessage: '',
      });
    } else {
      candidate.releaseDir = version.packagePath;
      candidate.processStatus = 'starting';
      candidate.healthStatus = 'checking';
      candidate.lastErrorCode = '';
      candidate.lastErrorMessage = '';
      candidate.stoppedTime = null;
    }
    version.candidateHealthStatus = 'checking';
    if (app.trustLevel === 'developer_restricted') {
      version.candidateReviewedBy = null;
      version.candidateReviewedTime = null;
    }
    candidate = await instanceRepo.save(candidate);
    await manager.getRepository(AppPackageVersionEntity).save(version);
    await this.recordEvent(
      manager,
      app.id,
      version.id,
      'candidate_start',
      `Started candidate checks for service version ${version.version}`,
      operatorId,
    );
    return {
      app,
      version,
      instance: candidate,
      spec: this.processSpec(candidate, version),
    };
  }

  private async awaitCandidateHealth(prepared: PreparedCandidate) {
    const required = this.healthSuccessCount();
    const maxAttempts = required * 3;
    let consecutive = 0;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const response = await this.loopbackTransport.health(
          prepared.instance.loopbackPort,
          this.healthPath(prepared.app, prepared.version),
        );
        consecutive = this.isHealthy(response) ? consecutive + 1 : 0;
      } catch {
        consecutive = 0;
      }
      if (consecutive >= required) return true;
      if (attempt < maxAttempts - 1) await this.delay.wait(250);
    }
    return false;
  }

  private isHealthy(response: AppServiceLoopbackResponse) {
    if (response.statusCode !== 200 || !response.body || typeof response.body !== 'object') {
      return false;
    }
    const body = response.body as Record<string, unknown>;
    const status = String(body.status || '').toLowerCase();
    return status === 'ok' || status === 'healthy' || body.healthy === true;
  }

  private async markCandidateHealthy(
    instanceId: number,
    versionId: number,
    snapshot: AppServiceProcessSnapshot,
    operatorId: number,
    recordCandidateReview: boolean,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const instanceRepo = manager.getRepository(AppServiceInstanceEntity);
      const versionRepo = manager.getRepository(AppPackageVersionEntity);
      const instance = await instanceRepo.findOne({
        where: { id: instanceId },
        lock: { mode: 'pessimistic_write' },
      });
      const version = await versionRepo.findOne({
        where: { id: versionId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!instance || !version || instance.role !== 'candidate') {
        throw new BadRequestException('Service candidate state changed');
      }
      instance.processStatus = 'online';
      instance.healthStatus = 'healthy';
      instance.restartCount = snapshot.restartCount;
      instance.lastHealthTime = new Date();
      instance.startedTime = new Date();
      instance.lastErrorCode = '';
      instance.lastErrorMessage = '';
      version.candidateHealthStatus = 'healthy';
      if (recordCandidateReview) {
        version.candidateReviewedBy = operatorId;
        version.candidateReviewedTime = new Date();
      }
      await instanceRepo.save(instance);
      await versionRepo.save(version);
      return instance;
    });
  }

  private async markCandidateFailed(
    instanceId: number,
    versionId: number,
    code: string,
    message: string,
  ) {
    await this.dataSource.transaction(async (manager) => {
      const instanceRepo = manager.getRepository(AppServiceInstanceEntity);
      const versionRepo = manager.getRepository(AppPackageVersionEntity);
      const instance = await instanceRepo.findOne({
        where: { id: instanceId },
        lock: { mode: 'pessimistic_write' },
      });
      const version = await versionRepo.findOne({
        where: { id: versionId },
        lock: { mode: 'pessimistic_write' },
      });
      if (instance) {
        instance.processStatus = 'failed';
        instance.healthStatus = 'unhealthy';
        instance.lastErrorCode = code;
        instance.lastErrorMessage = this.fixedDiagnostic(message);
        instance.stoppedTime = new Date();
        await instanceRepo.save(instance);
      }
      if (version) {
        version.candidateHealthStatus = 'unhealthy';
        await versionRepo.save(version);
      }
    });
  }

  private async lockAppVersion(
    manager: EntityManager,
    appCode: string,
    versionValue: string,
  ) {
    const app = await manager.getRepository(AppPackageEntity).findOne({
      where: { code: String(appCode || '').trim() },
      lock: { mode: 'pessimistic_write' },
    });
    if (!app) throw new NotFoundException(`App ${appCode} not found`);
    const version = await manager.getRepository(AppPackageVersionEntity).findOne({
      where: { appId: app.id, version: String(versionValue || '').trim() },
      lock: { mode: 'pessimistic_write' },
    });
    if (!version) throw new NotFoundException(`App version ${versionValue} not found`);
    return { app, version };
  }

  private lockInstances(manager: EntityManager, appId: number) {
    return manager
      .getRepository(AppServiceInstanceEntity)
      .createQueryBuilder('instance')
      .setLock('pessimistic_write')
      .where('instance.app_id = :appId', { appId })
      .getMany();
  }

  private async assertReviewedServiceVersion(
    app: AppPackageEntity,
    version: AppPackageVersionEntity,
  ) {
    if (app.type !== 'service' || app.runtimeType !== 'service') {
      throw new BadRequestException('App is not an executable service runtime');
    }
    if (
      version.reviewStatus !== 'approved' ||
      version.packageFormat !== 'service_zip' ||
      version.manifestVersion !== 2 ||
      version.scanResult?.passed !== true
    ) {
      throw new BadRequestException('Service version is not approved for runtime');
    }
    if (
      version.submittedBy === null ||
      version.submittedBy === undefined ||
      version.reviewerId === null ||
      version.reviewerId === undefined ||
      Number(version.submittedBy) === Number(version.reviewerId)
    ) {
      throw new BadRequestException('Service version requires independent review');
    }
    if (!version.packagePath || version.entryFile !== 'dist/index.js') {
      throw new BadRequestException('Service version release is unavailable');
    }
    if (app.trustLevel === 'platform_trusted') return;
    if (app.trustLevel !== 'developer_restricted') {
      throw new BadRequestException('Service trust level is not executable');
    }
    if (!app.developerId) {
      throw new BadRequestException('Developer service owner is unavailable');
    }
    await this.certificationService.assertRuntimeApproved(Number(app.developerId), 'service');
    this.snapshotService.verify(version);
    await this.packageService.verifyInstalledEntry(version);
  }

  private assertIndependentCandidateReview(version: AppPackageVersionEntity) {
    if (
      version.candidateReviewedBy === null ||
      version.candidateReviewedBy === undefined ||
      !version.candidateReviewedTime ||
      Number(version.candidateReviewedBy) === Number(version.submittedBy) ||
      Number(version.candidateReviewedBy) === Number(version.reviewerId)
    ) {
      throw new BadRequestException('Service candidate requires independent review');
    }
  }

  private processSpec(
    instance: AppServiceInstanceEntity,
    version: AppPackageVersionEntity,
  ): AppServiceProcessSpec {
    return {
      processName: instance.processName,
      releaseDir: instance.releaseDir,
      entryFile: version.entryFile,
      healthPath: this.manifestHealthPath(version),
      loopbackPort: instance.loopbackPort,
      memoryMb: this.memoryMb(),
    };
  }

  private manifestHealthPath(version: AppPackageVersionEntity) {
    const value = version.manifest?.healthPath;
    return typeof value === 'string' && value ? value : '/health';
  }

  private healthPath(app: AppPackageEntity, version: AppPackageVersionEntity) {
    return this.manifestHealthPath(version) || app.serviceHealthPath || '/health';
  }

  private async cleanupRetired(values: Array<{ id: number; processName: string }>) {
    for (const value of values) {
      const cleaned = await this.cleanupProcess(value.processName);
      const instance = await this.instanceRepo.findOne({ where: { id: value.id } });
      if (!instance) continue;
      if (cleaned) {
        await this.instanceRepo.update(
          { id: instance.id },
          {
            processStatus: 'stopped',
            stoppedTime: new Date(),
            lastErrorCode: '',
            lastErrorMessage: '',
          },
        );
      } else {
        await this.markReconcileFailure(instance, 'retired_cleanup_failed');
      }
    }
  }

  private async cleanupProcess(processName: string) {
    try {
      await this.processManager.stop(processName);
    } catch {
      // Delete remains safe and idempotent when stop reports a missing process.
    }
    try {
      await this.processManager.delete(processName);
      return true;
    } catch {
      return false;
    }
  }

  private async markReconcileFailure(instance: AppServiceInstanceEntity, code: string) {
    await this.instanceRepo.update(
      { id: instance.id },
      {
        processStatus: 'failed',
        lastErrorCode: code,
        lastErrorMessage: this.fixedDiagnostic('Service process reconciliation failed'),
      },
    );
  }

  private async findApp(appCode: string) {
    const app = await this.appRepo.findOne({ where: { code: String(appCode || '').trim() } });
    if (!app) throw new NotFoundException(`App ${appCode} not found`);
    return app;
  }

  private async verifyLiveRole(
    appCode: string,
    versionValue: string,
    role: 'candidate' | 'standby',
    errorMessage: string,
  ) {
    const app = await this.findApp(appCode);
    const version = await this.versionRepo.findOne({
      where: { appId: app.id, version: String(versionValue || '').trim() },
    });
    if (!version) throw new NotFoundException(`App version ${versionValue} not found`);
    const instances = await this.instanceRepo.find({ where: { appId: app.id } });
    const instance = instances.find(
      (item) => Number(item.versionId) === Number(version.id) && item.role === role,
    );
    if (
      !instance ||
      instance.processStatus !== 'online' ||
      instance.healthStatus !== 'healthy' ||
      (role === 'candidate' && version.candidateHealthStatus !== 'healthy')
    ) {
      throw new BadRequestException(errorMessage);
    }
    try {
      const snapshot = await this.processManager.describe(instance.processName);
      if (!snapshot || snapshot.status !== 'online') throw new Error('process_not_online');
      const health = await this.loopbackTransport.health(
        instance.loopbackPort,
        this.healthPath(app, version),
      );
      if (!this.isHealthy(health)) throw new Error('service_not_healthy');
    } catch {
      throw new BadRequestException(errorMessage);
    }
    return instance.id;
  }

  private toInstanceResponse(
    app: AppPackageEntity,
    version: AppPackageVersionEntity,
    instance: AppServiceInstanceEntity,
  ) {
    return {
      id: String(instance.id),
      app_code: app.code,
      version: version.version,
      process_name: instance.processName,
      loopback_port: Number(instance.loopbackPort),
      role: instance.role,
      process_status: instance.processStatus,
      health_status: instance.healthStatus,
      restart_count: Number(instance.restartCount) || 0,
      last_health_at: instance.lastHealthTime?.toISOString?.() || null,
      diagnostic_code: instance.lastErrorCode || '',
      diagnostic_message: this.fixedDiagnostic(instance.lastErrorMessage || ''),
    };
  }

  private recordEvent(
    manager: EntityManager,
    appId: number,
    versionId: number,
    action: AppReviewAction,
    message: string,
    operatorId?: number,
    metadata?: Record<string, unknown>,
  ) {
    const repo = manager.getRepository(AppReviewLogEntity);
    return repo.save(
      repo.create({
        appId,
        versionId,
        action,
        message: this.fixedDiagnostic(message),
        operatorId: operatorId ?? null,
        metadata: metadata || null,
      }),
    );
  }

  private fixedDiagnostic(message: string) {
    return this.logRedactor.redact(String(message || '')).slice(0, 500);
  }

  private requiredReason(value: string) {
    const reason = String(value || '').trim();
    if (reason.length < 3 || reason.length > 500) {
      throw new BadRequestException('A service lifecycle reason is required');
    }
    return this.fixedDiagnostic(reason);
  }

  private assertOperator(operatorId: number) {
    if (!Number.isSafeInteger(Number(operatorId)) || Number(operatorId) <= 0) {
      throw new BadRequestException('A platform operator is required');
    }
  }

  private assertEnabled() {
    if (!this.configService.get<boolean>('appMarketplace.serviceRuntime.enabled')) {
      throw new ServiceUnavailableException('Service runtime is disabled');
    }
  }

  private healthSuccessCount() {
    const value = Number(
      this.configService.get<number>('appMarketplace.serviceRuntime.healthSuccessCount') ?? 3,
    );
    return Math.min(10, Math.max(1, Math.trunc(value) || 3));
  }

  private memoryMb() {
    const value = Number(
      this.configService.get<number>('appMarketplace.serviceRuntime.memoryMb') ?? 256,
    );
    return Math.min(2048, Math.max(128, Math.trunc(value) || 256));
  }

  private portMin() {
    return Number(this.configService.get<number>('appMarketplace.serviceRuntime.portMin') ?? 20000);
  }

  private portMax() {
    return Number(this.configService.get<number>('appMarketplace.serviceRuntime.portMax') ?? 39999);
  }
}
