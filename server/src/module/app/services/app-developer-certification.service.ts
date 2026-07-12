import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { UserEntity } from '../../system/user/entities/sys-user.entity';
import {
  ApplyDeveloperCertificationDto,
  DeveloperCertificationListDto,
  DecideDeveloperCertificationDto,
  SetDeveloperCertificationDisabledDto,
} from '../dto/app-developer-certification.dto';
import {
  AppDeveloperProfileEntity,
  type AppDeveloperRuntimeType,
} from '../entities/app-developer-profile.entity';

@Injectable()
export class AppDeveloperCertificationService {
  constructor(
    @InjectRepository(AppDeveloperProfileEntity)
    private readonly profileRepo: Repository<AppDeveloperProfileEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async getOwnProfile(userId: number) {
    const profile = await this.profileRepo.findOne({ where: { userId } });
    return profile ? this.toResponse(profile) : null;
  }

  async getProfile(profileId: number) {
    const profile = await this.profileRepo.findOne({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('Developer certification profile not found');
    return this.toResponse(profile);
  }

  async assertRuntimeApproved(userId: number, runtimeType: AppDeveloperRuntimeType) {
    const profile = await this.profileRepo.findOne({ where: { userId } });
    if (!profile) throw new BadRequestException('Developer runtime is not certified');
    if (profile.disabled === 1) {
      throw new BadRequestException('Developer runtime is disabled');
    }
    if (profile.certificationStatus !== 'certified') {
      throw new BadRequestException('Developer runtime is not certified');
    }
    if (
      !profile.certificationExpiry ||
      profile.certificationExpiry.getTime() <= Date.now()
    ) {
      throw new BadRequestException('Developer certification has expired');
    }
    if (!profile.approvedRuntimeTypes.includes(runtimeType)) {
      throw new BadRequestException('Developer runtime type is not approved');
    }
    return profile;
  }

  async decide(profileId: number, operatorId: number, dto: DecideDeveloperCertificationDto) {
    const profile = await this.profileRepo.findOne({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('Developer certification profile not found');
    if (Number(profile.userId) === Number(operatorId)) {
      throw new BadRequestException('Certification requires an independent reviewer');
    }
    if (profile.certificationStatus !== 'pending') {
      throw new BadRequestException('Only pending certification profiles can be reviewed');
    }
    if (dto.decision === 'rejected') {
      Object.assign(profile, {
        certificationStatus: 'rejected',
        approvedRuntimeTypes: [],
        riskLevel: dto.risk_level,
        reviewerId: operatorId,
        reviewMessage: dto.message.trim(),
        certificationTime: null,
        certificationExpiry: null,
        disabled: 0,
      } satisfies Partial<AppDeveloperProfileEntity>);
      return this.toResponse(await this.profileRepo.save(profile));
    }

    const approvedRuntimeTypes = this.normalizeRuntimeTypes(dto.approved_runtime_types);
    if (
      approvedRuntimeTypes.length === 0 ||
      approvedRuntimeTypes.some((value) => !profile.requestedRuntimeTypes.includes(value))
    ) {
      throw new BadRequestException('Approved runtime types must match the application scope');
    }
    const certificationExpiry = dto.certification_expiry
      ? new Date(dto.certification_expiry)
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    if (
      Number.isNaN(certificationExpiry.getTime()) ||
      certificationExpiry.getTime() <= Date.now()
    ) {
      throw new BadRequestException('Certification expiry must be in the future');
    }

    Object.assign(profile, {
      certificationStatus: 'certified',
      approvedRuntimeTypes,
      riskLevel: dto.risk_level,
      reviewerId: operatorId,
      reviewMessage: dto.message.trim(),
      certificationTime: new Date(),
      certificationExpiry,
      disabled: 0,
    } satisfies Partial<AppDeveloperProfileEntity>);
    return this.toResponse(await this.profileRepo.save(profile));
  }

  async setDisabled(
    profileId: number,
    operatorId: number,
    dto: SetDeveloperCertificationDisabledDto,
  ) {
    const profile = await this.profileRepo.findOne({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('Developer certification profile not found');
    profile.disabled = dto.disabled ? 1 : 0;
    profile.reviewerId = operatorId;
    profile.reviewMessage = dto.message.trim();
    return this.toResponse(await this.profileRepo.save(profile));
  }

  async list(query: DeveloperCertificationListDto = {}) {
    const profiles = await this.profileRepo.find({ order: { id: 'DESC' } });
    return profiles
      .filter((profile) => {
        if (
          query.certification_status &&
          this.effectiveStatus(profile) !== query.certification_status
        ) {
          return false;
        }
        if (query.risk_level && profile.riskLevel !== query.risk_level) return false;
        if (
          query.runtime_type &&
          !profile.requestedRuntimeTypes.includes(query.runtime_type) &&
          !profile.approvedRuntimeTypes.includes(query.runtime_type)
        ) {
          return false;
        }
        if (query.disabled !== undefined && (profile.disabled === 1) !== query.disabled) {
          return false;
        }
        return true;
      })
      .map((profile) => this.toResponse(profile));
  }

  async apply(userId: number, dto: ApplyDeveloperCertificationDto) {
    const user = await this.userRepo.findOne({
      where: { id: userId, status: 1, deleteTime: IsNull() },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('Developer user not found');

    const existing = await this.profileRepo.findOne({ where: { userId } });
    if (existing) {
      if (existing.disabled === 1) {
        throw new BadRequestException('Developer certification is disabled');
      }
      if (!['rejected', 'expired'].includes(this.effectiveStatus(existing))) {
        throw new BadRequestException('Developer certification application already exists');
      }
      Object.assign(existing, {
        displayName: dto.display_name.trim(),
        website: dto.website?.trim() || '',
        applicationStatement: dto.statement.trim(),
        certificationStatus: 'pending',
        requestedRuntimeTypes: this.normalizeRuntimeTypes(dto.requested_runtime_types),
        approvedRuntimeTypes: [],
        riskLevel: 'medium',
        reviewerId: null,
        reviewMessage: '',
        certificationTime: null,
        certificationExpiry: null,
        disabled: 0,
      } satisfies Partial<AppDeveloperProfileEntity>);
      return this.toResponse(await this.profileRepo.save(existing));
    }

    const profile = this.profileRepo.create({
      userId,
      displayName: dto.display_name.trim(),
      website: dto.website?.trim() || '',
      applicationStatement: dto.statement.trim(),
      certificationStatus: 'pending',
      requestedRuntimeTypes: this.normalizeRuntimeTypes(dto.requested_runtime_types),
      approvedRuntimeTypes: [],
      riskLevel: 'medium',
      reviewerId: null,
      reviewMessage: '',
      certificationTime: null,
      certificationExpiry: null,
      disabled: 0,
    });
    return this.toResponse(await this.profileRepo.save(profile));
  }

  private normalizeRuntimeTypes(values: AppDeveloperRuntimeType[]) {
    return [...new Set(values)].filter((value): value is AppDeveloperRuntimeType =>
      ['static', 'iframe', 'service'].includes(value),
    );
  }

  private toResponse(profile: AppDeveloperProfileEntity) {
    return {
      id: String(profile.id),
      user_id: String(profile.userId),
      display_name: profile.displayName,
      website: profile.website || '',
      statement: profile.applicationStatement,
      certification_status: this.effectiveStatus(profile),
      requested_runtime_types: profile.requestedRuntimeTypes || [],
      approved_runtime_types: profile.approvedRuntimeTypes || [],
      risk_level: profile.riskLevel,
      reviewer_id: profile.reviewerId == null ? null : String(profile.reviewerId),
      review_message: profile.reviewMessage || '',
      certification_time: profile.certificationTime ?? null,
      certification_expiry: profile.certificationExpiry ?? null,
      disabled: profile.disabled === 1,
      create_time: profile.createTime ?? null,
      update_time: profile.updateTime ?? null,
    };
  }

  private effectiveStatus(profile: AppDeveloperProfileEntity) {
    if (
      profile.certificationStatus === 'certified' &&
      profile.certificationExpiry &&
      profile.certificationExpiry.getTime() <= Date.now()
    ) {
      return 'expired' as const;
    }
    return profile.certificationStatus;
  }
}
