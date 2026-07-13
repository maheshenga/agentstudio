import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThanOrEqual, MoreThan, Repository } from 'typeorm';

import { AppPackageEntity } from '../../app/entities/app-package.entity';
import { SAAS_SUBSCRIPTION_ACTIVE } from '../../saas/constants';
import { SaasPlanEntity } from '../../saas/entities/saas-plan.entity';
import { SaasSubscriptionEntity } from '../../saas/entities/saas-subscription.entity';
import { AppPricePlanEntity } from '../entities/app-price-plan.entity';
import { TenantAppLicenseEntity } from '../entities/tenant-app-license.entity';
import {
  AppPricePlanService,
  type TenantVisibleAppPricePlan,
} from './app-price-plan.service';

export type TenantAppCommerceAccessStatus =
  | 'legacy_free'
  | 'free'
  | 'included'
  | 'trialing'
  | 'licensed'
  | 'purchase_required'
  | 'expired'
  | 'revoked';

export type TenantAppCommerceAction =
  | 'install'
  | 'open'
  | 'start_trial'
  | 'purchase'
  | 'renew'
  | 'contact_admin';

export interface TenantAppCommerceAccess {
  commerce_enabled: boolean;
  access_status: TenantAppCommerceAccessStatus;
  can_install: boolean;
  can_open: boolean;
  action: TenantAppCommerceAction;
  license_expires_at: string | null;
  plans: TenantVisibleAppPricePlan[];
}

export type AppCommerceSubject = Pick<AppPackageEntity, 'id' | 'code'> & {
  installed?: boolean;
};

@Injectable()
export class AppLicenseAccessService {
  constructor(
    private readonly configService: ConfigService,
    private readonly pricePlanService: AppPricePlanService,
    @InjectRepository(TenantAppLicenseEntity)
    private readonly licenseRepo: Repository<TenantAppLicenseEntity>,
    @InjectRepository(SaasSubscriptionEntity)
    private readonly subscriptionRepo: Repository<SaasSubscriptionEntity>,
    @InjectRepository(SaasPlanEntity)
    private readonly saasPlanRepo: Repository<SaasPlanEntity>,
  ) {}

  async getAccessState(
    tenantId: number,
    app: AppCommerceSubject,
  ): Promise<TenantAppCommerceAccess> {
    const installed = Boolean(app.installed);
    if (!this.configService.get<boolean>('appMarketplace.commerce.enabled', false)) {
      return this.entitledAccess('legacy_free', installed, [], null, false);
    }

    const plans = await this.pricePlanService.listApplicablePlans(Number(app.id), Number(tenantId));
    const tenantPlans = this.pricePlanService.toTenantVisiblePlans(plans);
    if (plans.length === 0) {
      return this.entitledAccess('legacy_free', installed, tenantPlans);
    }

    if (plans.some((plan) => plan.pricingModel === 'free')) {
      return this.entitledAccess('free', installed, tenantPlans);
    }

    const includedPlans = plans.filter((plan) => plan.pricingModel === 'included');
    if (includedPlans.length > 0 && (await this.hasIncludedSubscription(tenantId, includedPlans))) {
      return this.entitledAccess('included', installed, tenantPlans);
    }

    const licenses = await this.licenseRepo.find({
      where: {
        tenantId: Number(tenantId),
        appId: Number(app.id),
        status: In(['active', 'trialing', 'expired', 'revoked', 'refunded']),
      },
      order: { createTime: 'DESC', id: 'DESC' },
    });
    const now = new Date();
    const current = licenses.find((license) => this.isCurrentLicense(license, now));
    if (current) {
      return this.entitledAccess(
        current.status === 'trialing' ? 'trialing' : 'licensed',
        installed,
        tenantPlans,
        this.toIsoString(current.expiresAt),
      );
    }

    const historical = licenses.find((license) => this.isHistoricalDenial(license, now));
    if (historical) {
      if (historical.status === 'expired' || this.isExpiredByTime(historical, now)) {
        return this.deniedAccess(
          'expired',
          'renew',
          tenantPlans,
          this.toIsoString(historical.expiresAt),
        );
      }
      return this.deniedAccess(
        'revoked',
        'contact_admin',
        tenantPlans,
        this.toIsoString(historical.expiresAt),
      );
    }

    const hasTrial = plans.some(
      (plan) => ['subscription', 'one_time'].includes(plan.pricingModel) && Number(plan.trialDays) > 0,
    );
    return this.deniedAccess(
      'purchase_required',
      hasTrial ? 'start_trial' : 'purchase',
      tenantPlans,
    );
  }

  private async hasIncludedSubscription(tenantId: number, plans: AppPricePlanEntity[]) {
    const now = new Date();
    const subscription = await this.subscriptionRepo.findOne({
      where: [
        {
          tenantId: Number(tenantId),
          status: SAAS_SUBSCRIPTION_ACTIVE,
          startTime: LessThanOrEqual(now),
          endTime: IsNull(),
        },
        {
          tenantId: Number(tenantId),
          status: SAAS_SUBSCRIPTION_ACTIVE,
          startTime: LessThanOrEqual(now),
          endTime: MoreThan(now),
        },
      ],
      order: { createTime: 'DESC', id: 'DESC' },
    });
    if (!subscription) return false;

    const saasPlan = await this.saasPlanRepo.findOne({
      where: { id: Number(subscription.planId), status: 1 },
    });
    if (!saasPlan?.code) return false;

    const currentCode = String(saasPlan.code).trim().toLowerCase();
    return plans.some((plan) =>
      (plan.includedPlanCodes || []).some(
        (code) => String(code).trim().toLowerCase() === currentCode,
      ),
    );
  }

  private isCurrentLicense(license: TenantAppLicenseEntity, now: Date) {
    if (license.status !== 'active' && license.status !== 'trialing') return false;
    const effectiveAt = new Date(license.effectiveAt);
    if (Number.isNaN(effectiveAt.getTime()) || effectiveAt.getTime() > now.getTime()) return false;
    return !this.isExpiredByTime(license, now);
  }

  private isExpiredByTime(license: TenantAppLicenseEntity, now: Date) {
    if (!license.expiresAt) return false;
    const expiresAt = new Date(license.expiresAt);
    return !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= now.getTime();
  }

  private isHistoricalDenial(license: TenantAppLicenseEntity, now: Date) {
    return (
      ['expired', 'revoked', 'refunded'].includes(license.status) ||
      this.isExpiredByTime(license, now)
    );
  }

  private entitledAccess(
    accessStatus: Extract<
      TenantAppCommerceAccessStatus,
      'legacy_free' | 'free' | 'included' | 'trialing' | 'licensed'
    >,
    installed: boolean,
    plans: TenantVisibleAppPricePlan[],
    licenseExpiresAt: string | null = null,
    commerceEnabled = true,
  ): TenantAppCommerceAccess {
    return {
      commerce_enabled: commerceEnabled,
      access_status: accessStatus,
      can_install: true,
      can_open: true,
      action: installed ? 'open' : 'install',
      license_expires_at: licenseExpiresAt,
      plans,
    };
  }

  private deniedAccess(
    accessStatus: Extract<TenantAppCommerceAccessStatus, 'purchase_required' | 'expired' | 'revoked'>,
    action: Extract<TenantAppCommerceAction, 'start_trial' | 'purchase' | 'renew' | 'contact_admin'>,
    plans: TenantVisibleAppPricePlan[],
    licenseExpiresAt: string | null = null,
  ): TenantAppCommerceAccess {
    return {
      commerce_enabled: true,
      access_status: accessStatus,
      can_install: false,
      can_open: false,
      action,
      license_expires_at: licenseExpiresAt,
      plans,
    };
  }

  private toIsoString(value?: Date | null) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
}
