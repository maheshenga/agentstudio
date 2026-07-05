import { BadRequestException, NotFoundException } from '@nestjs/common';

import { BUILT_IN_SYSTEM_MODULES } from '../manifests/built-in-modules';
import { SystemModuleRegistryService } from './system-module-registry.service';

type EntityRecord = Record<string, any>;

class MemoryRepository<T extends EntityRecord> {
  public records: T[];
  private nextId: number;

  constructor(seed: T[] = []) {
    this.records = seed.map((record, index) => ({ id: record.id ?? index + 1, ...record })) as T[];
    this.nextId = this.records.length + 1;
  }

  create(input: Partial<T> | Partial<T>[]) {
    if (Array.isArray(input)) {
      return input.map((item) => ({ ...item })) as T[];
    }
    return { ...input } as T;
  }

  async save(input: T | T[]) {
    if (Array.isArray(input)) {
      return Promise.all(input.map((item) => this.save(item))) as Promise<T[]>;
    }

    const now = new Date('2026-07-05T00:00:00.000Z');
    const existingIndex =
      input.id !== undefined
        ? this.records.findIndex((record) => record.id === input.id)
        : this.records.findIndex((record) => record.code !== undefined && record.code === input.code);
    const record = {
      ...input,
      id: input.id ?? this.nextId++,
      createTime: input.createTime ?? now,
      updateTime: now,
    } as T;

    if (existingIndex >= 0) {
      this.records[existingIndex] = { ...this.records[existingIndex], ...record };
      return this.records[existingIndex];
    }

    this.records.push(record);
    return record;
  }

  async findOne(options: { where: EntityRecord }) {
    return this.records.find((record) => this.matchesWhere(record, options.where)) ?? null;
  }

  async find(options: { where?: EntityRecord | EntityRecord[]; order?: EntityRecord; take?: number } = {}) {
    const whereList = Array.isArray(options.where) ? options.where : options.where ? [options.where] : undefined;
    const filtered = whereList
      ? this.records.filter((record) => whereList.some((where) => this.matchesWhere(record, where)))
      : [...this.records];
    const ordered = this.orderBy(filtered, options.order);
    return options.take ? ordered.slice(0, options.take) : ordered;
  }

  async delete(where: EntityRecord) {
    this.records = this.records.filter((record) => !this.matchesWhere(record, where));
    return { affected: 1 };
  }

  private matchesWhere(record: EntityRecord, where: EntityRecord) {
    return Object.entries(where).every(([key, expected]) => {
      if (expected && typeof expected === 'object' && 'value' in expected) {
        if (expected.type === 'like') {
          return String(record[key] ?? '').includes(String(expected.value).replace(/%/g, ''));
        }
        if (expected.type === 'isNull') {
          return record[key] === null || record[key] === undefined;
        }
      }
      return record[key] === expected;
    });
  }

  private orderBy(records: T[], order: EntityRecord = {}) {
    return [...records].sort((left, right) => {
      for (const [key, direction] of Object.entries(order)) {
        const a = left[key] ?? 0;
        const b = right[key] ?? 0;
        if (a === b) continue;
        return direction === 'DESC' ? (a < b ? 1 : -1) : a > b ? 1 : -1;
      }
      return 0;
    });
  }
}

describe('SystemModuleRegistryService', () => {
  const createService = () => {
    const moduleRepo = new MemoryRepository();
    const dependencyRepo = new MemoryRepository();
    const permissionRepo = new MemoryRepository();
    const apiRepo = new MemoryRepository();
    const tenantModuleRepo = new MemoryRepository();
    const eventRepo = new MemoryRepository();
    const service = new SystemModuleRegistryService(
      moduleRepo as any,
      dependencyRepo as any,
      permissionRepo as any,
      apiRepo as any,
      tenantModuleRepo as any,
      eventRepo as any,
    );

    return { service, moduleRepo, dependencyRepo, permissionRepo, apiRepo, tenantModuleRepo, eventRepo };
  };

  it('imports built-in manifests idempotently and includes core system and SaaS platform modules', async () => {
    const { service, moduleRepo, dependencyRepo, eventRepo } = createService();

    await service.registerBuiltInModules();
    await service.registerBuiltInModules();

    const modules = await service.listModules();
    expect(modules.map((module) => module.code)).toEqual(
      expect.arrayContaining(['core_system', 'saas_platform']),
    );
    expect(moduleRepo.records).toHaveLength(BUILT_IN_SYSTEM_MODULES.length);
    expect(dependencyRepo.records.filter((row) => row.moduleCode === 'saas_platform')).toEqual([
      expect.objectContaining({ dependsOnCode: 'core_system', required: 1 }),
    ]);
    expect(eventRepo.records.filter((row) => row.eventType === 'install')).toHaveLength(
      BUILT_IN_SYSTEM_MODULES.length * 2,
    );
  });

  it('updates status and records an enable event with operator id', async () => {
    const { service, moduleRepo, eventRepo } = createService();
    await moduleRepo.save({
      code: 'ai_console',
      name: 'AI Console',
      source: 'built_in',
      version: '1.0.0',
      description: '',
      category: 'ai',
      icon: 'Bot',
      status: 'disabled',
      entryRoute: '/ai/chat',
      configSchema: {},
      healthStatus: 'unknown',
      sort: 40,
    });

    const result = await service.updateStatus('ai_console', 'enabled', 99);

    expect(result).toEqual(expect.objectContaining({ code: 'ai_console', status: 'enabled' }));
    expect(eventRepo.records).toEqual([
      expect.objectContaining({
        moduleCode: 'ai_console',
        eventType: 'enable',
        status: 'success',
        operatorId: 99,
      }),
    ]);
  });

  it('rejects invalid lifecycle state with BadRequestException', async () => {
    const { service } = createService();

    await expect(service.updateStatus('core_system', 'paused' as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unknown module lookups with NotFoundException', async () => {
    const { service } = createService();

    await expect(service.getModule('missing_module')).rejects.toBeInstanceOf(NotFoundException);
  });
});
