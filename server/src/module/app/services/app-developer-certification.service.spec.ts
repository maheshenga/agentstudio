import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { UserEntity } from '../../system/user/entities/sys-user.entity';
import { AppDeveloperProfileEntity } from '../entities/app-developer-profile.entity';
import { AppDeveloperCertificationService } from './app-developer-certification.service';

describe('AppDeveloperCertificationService', () => {
  let service: AppDeveloperCertificationService;

  const profileRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(),
  };
  const userRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppDeveloperCertificationService,
        { provide: getRepositoryToken(AppDeveloperProfileEntity), useValue: profileRepo },
        { provide: getRepositoryToken(UserEntity), useValue: userRepo },
      ],
    }).compile();

    service = module.get(AppDeveloperCertificationService);
  });

  it('creates one normalized pending self-application', async () => {
    userRepo.findOne.mockResolvedValue({ id: 17, status: 1 });
    profileRepo.findOne.mockResolvedValue(null);
    profileRepo.save.mockImplementation(async (value) => ({ id: 9, ...value }));

    await expect(
      service.apply(17, {
        display_name: '  Alice Studio  ',
        website: '  https://studio.example.com  ',
        statement: '  We build reviewed tenant workflow services.  ',
        requested_runtime_types: ['service', 'static', 'service'],
      }),
    ).resolves.toMatchObject({
      id: '9',
      user_id: '17',
      display_name: 'Alice Studio',
      website: 'https://studio.example.com',
      certification_status: 'pending',
      requested_runtime_types: ['service', 'static'],
      approved_runtime_types: [],
      disabled: false,
    });

    expect(profileRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 17,
        displayName: 'Alice Studio',
        website: 'https://studio.example.com',
        applicationStatement: 'We build reviewed tenant workflow services.',
        certificationStatus: 'pending',
        requestedRuntimeTypes: ['service', 'static'],
        approvedRuntimeTypes: [],
        riskLevel: 'medium',
        reviewerId: null,
        disabled: 0,
      }),
    );
  });

  it('reopens a rejected application without changing user ownership', async () => {
    userRepo.findOne.mockResolvedValue({ id: 17, status: 1 });
    profileRepo.findOne.mockResolvedValue({
      id: 9,
      userId: 17,
      certificationStatus: 'rejected',
      requestedRuntimeTypes: ['static'],
      approvedRuntimeTypes: [],
      riskLevel: 'high',
      reviewMessage: 'Insufficient evidence',
      reviewerId: 2,
      disabled: 0,
    });
    profileRepo.save.mockImplementation(async (value) => value);

    await expect(
      service.apply(17, {
        display_name: 'Alice Studio',
        website: 'https://studio.example.com',
        statement: 'We now provide the required service review evidence.',
        requested_runtime_types: ['service'],
      }),
    ).resolves.toMatchObject({
      id: '9',
      user_id: '17',
      certification_status: 'pending',
      requested_runtime_types: ['service'],
      approved_runtime_types: [],
      reviewer_id: null,
      review_message: '',
    });

    expect(profileRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 9,
        userId: 17,
        certificationStatus: 'pending',
        reviewerId: null,
        certificationTime: null,
        certificationExpiry: null,
      }),
    );
  });

  it('reopens a certified application after its effective expiry', async () => {
    userRepo.findOne.mockResolvedValue({ id: 17, status: 1 });
    profileRepo.findOne.mockResolvedValue({
      id: 9,
      userId: 17,
      certificationStatus: 'certified',
      certificationExpiry: new Date('2025-12-31T00:00:00.000Z'),
      requestedRuntimeTypes: ['service'],
      approvedRuntimeTypes: ['service'],
      riskLevel: 'low',
      reviewerId: 2,
      disabled: 0,
    });
    profileRepo.save.mockImplementation(async (value) => value);

    await expect(
      service.apply(17, {
        display_name: 'Alice Studio',
        website: 'https://studio.example.com',
        statement: 'We are renewing the reviewed service certification.',
        requested_runtime_types: ['service'],
      }),
    ).resolves.toMatchObject({
      id: '9',
      certification_status: 'pending',
      approved_runtime_types: [],
      certification_expiry: null,
    });
  });

  it('does not let an expired profile bypass a platform disabled state', async () => {
    userRepo.findOne.mockResolvedValue({ id: 17, status: 1 });
    profileRepo.findOne.mockResolvedValue({
      id: 9,
      userId: 17,
      certificationStatus: 'certified',
      certificationExpiry: new Date('2025-12-31T00:00:00.000Z'),
      requestedRuntimeTypes: ['service'],
      approvedRuntimeTypes: ['service'],
      riskLevel: 'high',
      reviewerId: 2,
      disabled: 1,
    });

    await expect(
      service.apply(17, {
        display_name: 'Alice Studio',
        statement: 'We are renewing the reviewed service certification.',
        requested_runtime_types: ['service'],
      }),
    ).rejects.toThrow('Developer certification is disabled');
    expect(profileRepo.save).not.toHaveBeenCalled();
  });

  it('reports a certified profile as expired after its certification expiry', async () => {
    profileRepo.findOne.mockResolvedValue({
      id: 9,
      userId: 17,
      displayName: 'Alice Studio',
      website: '',
      applicationStatement: 'Reviewed service developer profile.',
      certificationStatus: 'certified',
      requestedRuntimeTypes: ['service'],
      approvedRuntimeTypes: ['service'],
      riskLevel: 'low',
      reviewerId: 2,
      reviewMessage: 'Approved',
      certificationTime: new Date('2025-01-01T00:00:00.000Z'),
      certificationExpiry: new Date('2025-12-31T00:00:00.000Z'),
      disabled: 0,
    });

    await expect(service.getOwnProfile(17)).resolves.toMatchObject({
      id: '9',
      user_id: '17',
      certification_status: 'expired',
      approved_runtime_types: ['service'],
    });
  });

  it('returns the authoritative profile for an approved service developer', async () => {
    const profile = {
      id: 9,
      userId: 17,
      certificationStatus: 'certified',
      approvedRuntimeTypes: ['service'],
      certificationExpiry: new Date('2099-12-31T00:00:00.000Z'),
      disabled: 0,
    };
    profileRepo.findOne.mockResolvedValue(profile);

    await expect(service.assertRuntimeApproved(17, 'service')).resolves.toBe(profile);
  });

  it('rejects a disabled developer runtime profile', async () => {
    profileRepo.findOne.mockResolvedValue({
      id: 9,
      userId: 17,
      certificationStatus: 'certified',
      approvedRuntimeTypes: ['service'],
      certificationExpiry: new Date('2099-12-31T00:00:00.000Z'),
      disabled: 1,
    });

    await expect(service.assertRuntimeApproved(17, 'service')).rejects.toThrow(
      'Developer runtime is disabled',
    );
  });

  it('rejects a developer whose certification is not approved', async () => {
    profileRepo.findOne.mockResolvedValue({
      id: 9,
      userId: 17,
      certificationStatus: 'pending',
      approvedRuntimeTypes: [],
      certificationExpiry: null,
      disabled: 0,
    });

    await expect(service.assertRuntimeApproved(17, 'service')).rejects.toThrow(
      'Developer runtime is not certified',
    );
  });

  it('rejects an expired certified developer at authorization time', async () => {
    profileRepo.findOne.mockResolvedValue({
      id: 9,
      userId: 17,
      certificationStatus: 'certified',
      approvedRuntimeTypes: ['service'],
      certificationExpiry: new Date('2025-12-31T00:00:00.000Z'),
      disabled: 0,
    });

    await expect(service.assertRuntimeApproved(17, 'service')).rejects.toThrow(
      'Developer certification has expired',
    );
  });

  it('rejects a runtime type outside the approved certification scope', async () => {
    profileRepo.findOne.mockResolvedValue({
      id: 9,
      userId: 17,
      certificationStatus: 'certified',
      approvedRuntimeTypes: ['static'],
      certificationExpiry: new Date('2099-12-31T00:00:00.000Z'),
      disabled: 0,
    });

    await expect(service.assertRuntimeApproved(17, 'service')).rejects.toThrow(
      'Developer runtime type is not approved',
    );
  });

  it('rejects certification review by the applicant', async () => {
    profileRepo.findOne.mockResolvedValue({
      id: 9,
      userId: 17,
      certificationStatus: 'pending',
      requestedRuntimeTypes: ['service'],
      disabled: 0,
    });

    await expect(
      service.decide(9, 17, {
        decision: 'certified',
        approved_runtime_types: ['service'],
        risk_level: 'low',
        certification_expiry: '2099-12-31T00:00:00.000Z',
        message: 'Approved',
      }),
    ).rejects.toThrow('Certification requires an independent reviewer');
  });

  it('certifies a pending profile with an approved runtime subset and future expiry', async () => {
    profileRepo.findOne.mockResolvedValue({
      id: 9,
      userId: 17,
      displayName: 'Alice Studio',
      website: '',
      applicationStatement: 'Reviewed service developer profile.',
      certificationStatus: 'pending',
      requestedRuntimeTypes: ['static', 'service'],
      approvedRuntimeTypes: [],
      riskLevel: 'medium',
      reviewerId: null,
      reviewMessage: '',
      certificationTime: null,
      certificationExpiry: null,
      disabled: 0,
    });
    profileRepo.save.mockImplementation(async (value) => value);

    await expect(
      service.decide(9, 2, {
        decision: 'certified',
        approved_runtime_types: ['service'],
        risk_level: 'low',
        certification_expiry: '2099-12-31T00:00:00.000Z',
        message: ' Approved for restricted services. ',
      }),
    ).resolves.toMatchObject({
      certification_status: 'certified',
      approved_runtime_types: ['service'],
      risk_level: 'low',
      reviewer_id: '2',
      review_message: 'Approved for restricted services.',
      certification_expiry: new Date('2099-12-31T00:00:00.000Z'),
    });

    expect(profileRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        certificationStatus: 'certified',
        approvedRuntimeTypes: ['service'],
        riskLevel: 'low',
        reviewerId: 2,
        certificationTime: expect.any(Date),
        certificationExpiry: new Date('2099-12-31T00:00:00.000Z'),
      }),
    );
  });

  it('rejects a pending profile with a structured review result', async () => {
    profileRepo.findOne.mockResolvedValue({
      id: 9,
      userId: 17,
      displayName: 'Alice Studio',
      website: '',
      applicationStatement: 'Reviewed service developer profile.',
      certificationStatus: 'pending',
      requestedRuntimeTypes: ['service'],
      approvedRuntimeTypes: [],
      riskLevel: 'medium',
      reviewerId: null,
      reviewMessage: '',
      certificationTime: null,
      certificationExpiry: null,
      disabled: 0,
    });
    profileRepo.save.mockImplementation(async (value) => value);

    await expect(
      service.decide(9, 2, {
        decision: 'rejected',
        approved_runtime_types: [],
        risk_level: 'high',
        message: ' Missing operational evidence. ',
      }),
    ).resolves.toMatchObject({
      certification_status: 'rejected',
      approved_runtime_types: [],
      risk_level: 'high',
      reviewer_id: '2',
      review_message: 'Missing operational evidence.',
      certification_time: null,
      certification_expiry: null,
    });
  });

  it('disables a certification profile without mutating user roles', async () => {
    profileRepo.findOne.mockResolvedValue({
      id: 9,
      userId: 17,
      displayName: 'Alice Studio',
      website: '',
      applicationStatement: 'Reviewed service developer profile.',
      certificationStatus: 'certified',
      requestedRuntimeTypes: ['service'],
      approvedRuntimeTypes: ['service'],
      riskLevel: 'low',
      reviewerId: 2,
      reviewMessage: 'Approved',
      certificationTime: new Date('2026-01-01T00:00:00.000Z'),
      certificationExpiry: new Date('2099-12-31T00:00:00.000Z'),
      disabled: 0,
    });
    profileRepo.save.mockImplementation(async (value) => value);

    await expect(
      service.setDisabled(9, 3, {
        disabled: true,
        message: ' Security review required. ',
      }),
    ).resolves.toMatchObject({
      id: '9',
      disabled: true,
      reviewer_id: '3',
      review_message: 'Security review required.',
    });
  });

  it('lists sanitized certification profiles with governance filters', async () => {
    profileRepo.find.mockResolvedValue([
      {
        id: 9,
        userId: 17,
        displayName: 'Alice Studio',
        website: '',
        applicationStatement: 'Reviewed service developer profile.',
        certificationStatus: 'certified',
        requestedRuntimeTypes: ['service'],
        approvedRuntimeTypes: ['service'],
        riskLevel: 'low',
        reviewerId: 2,
        reviewMessage: 'Approved',
        certificationTime: new Date('2026-01-01T00:00:00.000Z'),
        certificationExpiry: new Date('2099-12-31T00:00:00.000Z'),
        disabled: 0,
      },
      {
        id: 10,
        userId: 18,
        displayName: 'Static Only',
        certificationStatus: 'certified',
        requestedRuntimeTypes: ['static'],
        approvedRuntimeTypes: ['static'],
        riskLevel: 'low',
        disabled: 0,
      },
    ]);

    await expect(
      service.list({
        certification_status: 'certified',
        risk_level: 'low',
        runtime_type: 'service',
        disabled: false,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: '9',
        user_id: '17',
        approved_runtime_types: ['service'],
        disabled: false,
      }),
    ]);
  });

  it('returns one sanitized certification profile by platform id', async () => {
    profileRepo.findOne.mockResolvedValue({
      id: 9,
      userId: 17,
      displayName: 'Alice Studio',
      website: 'https://studio.example.com',
      applicationStatement: 'Reviewed service developer profile.',
      certificationStatus: 'pending',
      requestedRuntimeTypes: ['service'],
      approvedRuntimeTypes: [],
      riskLevel: 'medium',
      reviewerId: null,
      reviewMessage: '',
      certificationTime: null,
      certificationExpiry: null,
      disabled: 0,
    });

    await expect(service.getProfile(9)).resolves.toMatchObject({
      id: '9',
      user_id: '17',
      display_name: 'Alice Studio',
      requested_runtime_types: ['service'],
    });
  });
});
