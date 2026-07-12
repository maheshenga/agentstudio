import { BadRequestException } from '@nestjs/common';
import type { Repository } from 'typeorm';

import { normalizeAppCapabilities } from '../app-runtime.constants';
import { AppCapabilityGrantEntity } from '../entities/app-capability-grant.entity';
import { AppCapabilityPolicyService } from './app-capability-policy.service';

describe('AppCapabilityPolicyService', () => {
  const grantRepo = {
    find: jest.fn(),
    delete: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
  };

  let service: AppCapabilityPolicyService;

  beforeEach(() => {
    jest.resetAllMocks();
    grantRepo.delete.mockResolvedValue({ affected: 0 });
    service = new AppCapabilityPolicyService(
      grantRepo as unknown as Repository<AppCapabilityGrantEntity>,
    );
  });

  it('normalizes legacy context permission to the canonical capability', () => {
    expect(normalizeAppCapabilities({ permissions: ['job:view', 'runtime:context:read'] })).toEqual([
      'context.read',
    ]);
    expect(normalizeAppCapabilities({ capabilities: ['context.read', 'context.read'] })).toEqual([
      'context.read',
    ]);
  });

  it('rejects unknown manifest capabilities', () => {
    expect(() => normalizeAppCapabilities({ capabilities: ['database.raw'] })).toThrow(
      'Unsupported app capability: database.raw',
    );
  });

  it('does not let a tenant consent to a capability absent from platform approval', async () => {
    grantRepo.find.mockResolvedValue([]);

    await expect(
      service.setTenantCapabilities({
        tenantId: 23,
        appId: 10,
        versionId: 20,
        capabilities: ['context.read'],
        operatorId: 7,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(grantRepo.delete).not.toHaveBeenCalled();
    expect(grantRepo.save).not.toHaveBeenCalled();
  });

  it('returns only the intersection for the requested tenant', async () => {
    grantRepo.find
      .mockResolvedValueOnce([
        { capability: 'context.read', subjectType: 'platform', subjectId: 0, status: 'approved' },
      ])
      .mockResolvedValueOnce([
        { capability: 'context.read', subjectType: 'tenant', subjectId: 23, status: 'approved' },
      ]);

    await expect(service.resolveGrantedCapabilities(23, 20)).resolves.toEqual(['context.read']);
    expect(grantRepo.find).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ subjectType: 'tenant', subjectId: 23 }),
      }),
    );
  });
});
