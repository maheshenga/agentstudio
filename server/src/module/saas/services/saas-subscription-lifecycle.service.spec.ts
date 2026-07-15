import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Between, In, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';

import {
  SAAS_SUBSCRIPTION_ACTIVE,
  SAAS_SUBSCRIPTION_EXPIRED,
  SAAS_SUBSCRIPTION_FROZEN,
  SAAS_SUBSCRIPTION_TRIALING,
} from '../constants';
import { SaasSubscriptionEntity } from '../entities/saas-subscription.entity';
import { SaasSubscriptionLifecycleService } from './saas-subscription-lifecycle.service';

describe('SaasSubscriptionLifecycleService', () => {
  let service: SaasSubscriptionLifecycleService;

  const subscriptionRepo = {
    find: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaasSubscriptionLifecycleService,
        { provide: getRepositoryToken(SaasSubscriptionEntity), useValue: subscriptionRepo },
      ],
    }).compile();

    service = module.get(SaasSubscriptionLifecycleService);
  });

  it('expires active or trialing subscriptions whose end time has passed', async () => {
    const now = new Date('2026-07-03T00:00:00.000Z');
    subscriptionRepo.find.mockResolvedValue([
      { id: 1, status: SAAS_SUBSCRIPTION_ACTIVE, endTime: new Date('2026-07-02T23:59:59.000Z') },
      { id: 2, status: SAAS_SUBSCRIPTION_ACTIVE, endTime: now },
    ]);
    subscriptionRepo.update.mockResolvedValue({ affected: 2 });

    const result = await service.sweepExpiredSubscriptions(now);

    expect(subscriptionRepo.find).toHaveBeenCalledWith({
      where: {
        status: In([SAAS_SUBSCRIPTION_ACTIVE, SAAS_SUBSCRIPTION_TRIALING]),
        endTime: LessThanOrEqual(now),
      },
      select: ['id'],
    });
    expect(subscriptionRepo.update).toHaveBeenCalledWith(
      [1, 2],
      expect.objectContaining({
        status: SAAS_SUBSCRIPTION_EXPIRED,
        remark: 'Expired by SaaS lifecycle sweep at 2026-07-03T00:00:00.000Z',
      }),
    );
    expect(result).toEqual({
      checked_at: now,
      expired_count: 2,
      expired_subscription_ids: [1, 2],
    });
  });

  it('does not update when no subscriptions are expired by time', async () => {
    const now = new Date('2026-07-03T00:00:00.000Z');
    subscriptionRepo.find.mockResolvedValue([]);

    await expect(service.sweepExpiredSubscriptions(now)).resolves.toEqual({
      checked_at: now,
      expired_count: 0,
      expired_subscription_ids: [],
    });
    expect(subscriptionRepo.update).not.toHaveBeenCalled();
  });

  it('decorates subscriptions with remaining days and warning flags', () => {
    const now = new Date('2026-07-03T00:00:00.000Z');

    expect(
      service.decorateSubscription(
        {
          status: SAAS_SUBSCRIPTION_ACTIVE,
          endTime: new Date('2026-07-05T00:00:00.000Z'),
        },
        now,
        7,
      ),
    ).toEqual({
      days_until_expiry: 2,
      is_expiring_soon: true,
      is_expired_by_time: false,
    });
  });

  it('marks active subscriptions with past end time as expired by time', () => {
    const now = new Date('2026-07-03T00:00:00.000Z');

    expect(
      service.decorateSubscription(
        {
          status: SAAS_SUBSCRIPTION_ACTIVE,
          endTime: new Date('2026-07-02T00:00:00.000Z'),
        },
        now,
        7,
      ),
    ).toEqual({
      days_until_expiry: -1,
      is_expiring_soon: false,
      is_expired_by_time: true,
    });
  });

  it('marks active subscriptions that expired less than a day ago as expired by time', () => {
    const now = new Date('2026-07-03T12:00:00.000Z');

    expect(
      service.decorateSubscription(
        {
          status: SAAS_SUBSCRIPTION_ACTIVE,
          endTime: new Date('2026-07-03T11:59:00.000Z'),
        },
        now,
        7,
      ),
    ).toEqual({
      days_until_expiry: -1,
      is_expiring_soon: false,
      is_expired_by_time: true,
    });
  });

  it('does not mark null-end or frozen subscriptions as expiring soon but treats trialing as current', () => {
    const now = new Date('2026-07-03T00:00:00.000Z');

    expect(service.decorateSubscription({ status: SAAS_SUBSCRIPTION_ACTIVE }, now, 7)).toEqual({
      days_until_expiry: null,
      is_expiring_soon: false,
      is_expired_by_time: false,
    });
    expect(
      service.decorateSubscription(
        {
          status: SAAS_SUBSCRIPTION_FROZEN,
          endTime: new Date('2026-07-05T00:00:00.000Z'),
        },
        now,
        7,
      ),
    ).toEqual({
      days_until_expiry: 2,
      is_expiring_soon: false,
      is_expired_by_time: false,
    });
    expect(
      service.decorateSubscription(
        {
          status: SAAS_SUBSCRIPTION_TRIALING,
          endTime: new Date('2026-07-05T00:00:00.000Z'),
        },
        now,
        7,
      ),
    ).toEqual({
      days_until_expiry: 2,
      is_expiring_soon: true,
      is_expired_by_time: false,
    });
  });

  it('calculates lifecycle overview counts', async () => {
    const now = new Date('2026-07-03T00:00:00.000Z');
    subscriptionRepo.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(3);

    await expect(service.getLifecycleOverview(now)).resolves.toEqual({
      active_count: 10,
      expiring_7_days_count: 2,
      expiring_30_days_count: 5,
      expired_count: 3,
    });

    expect(subscriptionRepo.count).toHaveBeenNthCalledWith(1, { where: { status: SAAS_SUBSCRIPTION_ACTIVE } });
    expect(subscriptionRepo.count).toHaveBeenNthCalledWith(4, { where: { status: SAAS_SUBSCRIPTION_EXPIRED } });
  });

  it('builds expired-since where with an expired status and a lower bound date', () => {
    const now = new Date('2026-07-03T00:00:00.000Z');

    expect(service.buildExpiredSinceWhere(now, 30)).toEqual({
      status: SAAS_SUBSCRIPTION_EXPIRED,
      endTime: MoreThanOrEqual(new Date('2026-06-03T00:00:00.000Z')),
    });
  });

  it('clamps expiring query days to 365', () => {
    const now = new Date('2026-07-03T00:00:00.000Z');

    expect(service.buildExpiringWhere(now, 9999)).toEqual({
      status: In([SAAS_SUBSCRIPTION_ACTIVE, SAAS_SUBSCRIPTION_TRIALING]),
      endTime: Between(now, new Date('2027-07-03T00:00:00.000Z')),
    });
  });

  it('falls back to the default expiring window for invalid day input', () => {
    const now = new Date('2026-07-03T00:00:00.000Z');

    expect(service.buildExpiringWhere(now, 'bad' as any)).toEqual({
      status: In([SAAS_SUBSCRIPTION_ACTIVE, SAAS_SUBSCRIPTION_TRIALING]),
      endTime: Between(now, new Date('2026-07-10T00:00:00.000Z')),
    });
  });
});
