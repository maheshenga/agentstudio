import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';

import { Task } from '../../../common/decorators/task.decorator';
import { SAAS_SUBSCRIPTION_ACTIVE, SAAS_SUBSCRIPTION_EXPIRED } from '../constants';
import { SaasSubscriptionEntity } from '../entities/saas-subscription.entity';

export interface LifecycleSweepResult {
  checked_at: Date;
  expired_count: number;
  expired_subscription_ids: number[];
}

export interface LifecycleOverview {
  active_count: number;
  expiring_7_days_count: number;
  expiring_30_days_count: number;
  expired_count: number;
}

export interface SubscriptionLifecycleFields {
  days_until_expiry: number | null;
  is_expiring_soon: boolean;
  is_expired_by_time: boolean;
}

@Injectable()
export class SaasSubscriptionLifecycleService {
  constructor(
    @InjectRepository(SaasSubscriptionEntity)
    private readonly subscriptionRepo: Repository<SaasSubscriptionEntity>,
  ) {}

  async sweepExpiredSubscriptions(now = new Date()): Promise<LifecycleSweepResult> {
    const expiredSubscriptions = await this.subscriptionRepo.find({
      where: {
        status: SAAS_SUBSCRIPTION_ACTIVE,
        endTime: LessThanOrEqual(now),
      },
      select: ['id'] as any,
    });

    const expiredSubscriptionIds = expiredSubscriptions
      .map((item) => Number(item.id))
      .filter((id) => Number.isFinite(id) && id > 0);

    if (expiredSubscriptionIds.length > 0) {
      await this.subscriptionRepo.update(expiredSubscriptionIds, {
        status: SAAS_SUBSCRIPTION_EXPIRED,
        remark: `Expired by SaaS lifecycle sweep at ${now.toISOString()}`,
      });
    }

    return {
      checked_at: now,
      expired_count: expiredSubscriptionIds.length,
      expired_subscription_ids: expiredSubscriptionIds,
    };
  }

  async getLifecycleOverview(now = new Date()): Promise<LifecycleOverview> {
    const [activeCount, expiring7DaysCount, expiring30DaysCount, expiredCount] = await Promise.all([
      this.subscriptionRepo.count({ where: { status: SAAS_SUBSCRIPTION_ACTIVE } }),
      this.subscriptionRepo.count({ where: this.buildExpiringWhere(now, 7) }),
      this.subscriptionRepo.count({ where: this.buildExpiringWhere(now, 30) }),
      this.subscriptionRepo.count({ where: { status: SAAS_SUBSCRIPTION_EXPIRED } }),
    ]);

    return {
      active_count: activeCount,
      expiring_7_days_count: expiring7DaysCount,
      expiring_30_days_count: expiring30DaysCount,
      expired_count: expiredCount,
    };
  }

  clampDays(value: unknown, fallback = 7): number {
    const fallbackDays = Number.isFinite(fallback) ? Math.floor(fallback) : 7;
    const safeFallback = Math.min(365, Math.max(1, fallbackDays));
    const parsedValue = typeof value === 'number' ? value : Number(value);

    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      return safeFallback;
    }

    return Math.min(365, Math.max(1, Math.floor(parsedValue)));
  }

  addDays(date: Date, days: number): Date {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + days);
    return nextDate;
  }

  decorateSubscription(
    subscription: Pick<SaasSubscriptionEntity, 'status' | 'endTime'> | Partial<SaasSubscriptionEntity>,
    now = new Date(),
    thresholdDays = 7,
  ): SubscriptionLifecycleFields {
    const endTime = subscription.endTime ? new Date(subscription.endTime) : null;
    if (!endTime || Number.isNaN(endTime.getTime())) {
      return {
        days_until_expiry: null,
        is_expiring_soon: false,
        is_expired_by_time: false,
      };
    }

    const diffMs = endTime.getTime() - now.getTime();
    const daysUntilExpiry = diffMs <= 0 ? Math.floor(diffMs / 86_400_000) : Math.ceil(diffMs / 86_400_000);
    const isActive = subscription.status === SAAS_SUBSCRIPTION_ACTIVE;
    const isExpiredByTime = isActive && diffMs <= 0;

    return {
      days_until_expiry: daysUntilExpiry,
      is_expiring_soon: isActive && !isExpiredByTime && daysUntilExpiry <= thresholdDays,
      is_expired_by_time: isExpiredByTime,
    };
  }

  @Task({
    name: 'saas.subscriptionLifecycle.sweep',
    description: 'Expire ended SaaS subscriptions',
  })
  async sweepExpiredSubscriptionsTask() {
    return this.sweepExpiredSubscriptions();
  }

  buildExpiringWhere(now = new Date(), rawDays = 7) {
    const days = this.clampDays(rawDays, 7);
    const endTime = this.addDays(now, days);
    return {
      status: SAAS_SUBSCRIPTION_ACTIVE,
      endTime: Between(now, endTime),
    };
  }

  buildExpiredSinceWhere(now = new Date(), rawDays = 30) {
    const days = this.clampDays(rawDays, 30);
    return {
      status: SAAS_SUBSCRIPTION_EXPIRED,
      endTime: MoreThanOrEqual(this.addDays(now, -days)),
    };
  }
}
