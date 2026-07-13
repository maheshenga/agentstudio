import { BadRequestException, Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';

import { AppOrderEntity } from '../entities/app-order.entity';
import { AppRevenueLedgerEntity } from '../entities/app-revenue-ledger.entity';
import { TenantAppLicenseEntity } from '../entities/tenant-app-license.entity';

@Injectable()
export class AppRevenueLedgerService {
  async recordCharge(
    manager: EntityManager,
    order: AppOrderEntity,
    license: TenantAppLicenseEntity,
  ): Promise<AppRevenueLedgerEntity> {
    this.assertChargeSource(order, license);
    const ledgerRepo = manager.getRepository(AppRevenueLedgerEntity);
    const eventKey = `charge:${order.orderNo}`;
    const existing = await ledgerRepo.findOne({ where: { eventKey } });
    if (existing) return existing;

    const grossAmountCents = Number(order.amountCents);
    const developerShareBps = Number(order.developerShareBps);
    const developerAmountCents = Math.floor(
      (grossAmountCents * developerShareBps) / 10_000,
    );
    const platformAmountCents = grossAmountCents - developerAmountCents;
    const ledger = ledgerRepo.create({
      eventKey,
      eventType: 'charge',
      orderId: order.id,
      licenseId: license.id,
      tenantId: order.tenantId,
      appId: order.appId,
      developerId: order.developerId ?? null,
      grossAmountCents,
      platformAmountCents,
      developerAmountCents,
      currency: 'CNY',
      settlementBatchId: null,
      createdBy: order.createdBy ?? null,
      note: `Application order ${order.orderNo} paid`,
    });
    return ledgerRepo.save(ledger);
  }

  private assertChargeSource(order: AppOrderEntity, license: TenantAppLicenseEntity) {
    if (order.status !== 'paid') {
      throw new BadRequestException('Only paid application orders can create charge ledger rows');
    }
    if (!['subscription', 'one_time'].includes(order.pricingModel)) {
      throw new BadRequestException('Only paid application pricing models can create charge ledger rows');
    }
    if (
      !Number.isInteger(Number(order.amountCents)) ||
      Number(order.amountCents) <= 0 ||
      order.currency !== 'CNY'
    ) {
      throw new BadRequestException('Application order price snapshot is invalid');
    }
    if (
      !Number.isInteger(Number(order.developerShareBps)) ||
      Number(order.developerShareBps) < 0 ||
      Number(order.developerShareBps) > 10_000
    ) {
      throw new BadRequestException('Application order developer share is invalid');
    }
    if (
      license.source !== 'order' ||
      license.status !== 'active' ||
      Number(license.orderId) !== Number(order.id) ||
      Number(license.tenantId) !== Number(order.tenantId) ||
      Number(license.appId) !== Number(order.appId)
    ) {
      throw new BadRequestException('Application license does not match the paid order');
    }
  }
}
