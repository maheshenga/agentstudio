import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager } from 'typeorm';
import { Repository } from 'typeorm';

import type { AppRevenueQueryDto } from '../dto/app-settlement.dto';
import { AppOrderEntity } from '../entities/app-order.entity';
import { AppRevenueLedgerEntity } from '../entities/app-revenue-ledger.entity';
import { TenantAppLicenseEntity } from '../entities/tenant-app-license.entity';

@Injectable()
export class AppRevenueLedgerService {
  constructor(
    @InjectRepository(AppRevenueLedgerEntity)
    private readonly ledgerRepo: Repository<AppRevenueLedgerEntity>,
  ) {}

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

  async recordRefund(
    manager: EntityManager,
    order: AppOrderEntity,
    license: TenantAppLicenseEntity,
  ): Promise<AppRevenueLedgerEntity> {
    this.assertRefundSource(order, license);
    const ledgerRepo = manager.getRepository(AppRevenueLedgerEntity);
    const eventKey = `refund:${order.orderNo}`;
    const existing = await ledgerRepo.findOne({ where: { eventKey } });
    if (existing) return existing;

    const charge = await ledgerRepo.findOne({ where: { eventKey: `charge:${order.orderNo}` } });
    if (
      !charge ||
      charge.eventType !== 'charge' ||
      Number(charge.orderId) !== Number(order.id) ||
      charge.currency !== 'CNY' ||
      Number(charge.grossAmountCents) <= 0
    ) {
      throw new BadRequestException('Application order charge ledger is unavailable');
    }
    const ledger = ledgerRepo.create({
      eventKey,
      eventType: 'refund',
      orderId: order.id,
      licenseId: license.id,
      tenantId: order.tenantId,
      appId: order.appId,
      developerId: order.developerId ?? null,
      grossAmountCents: -Number(charge.grossAmountCents),
      platformAmountCents: -Number(charge.platformAmountCents),
      developerAmountCents: -Number(charge.developerAmountCents),
      currency: 'CNY',
      settlementBatchId: null,
      createdBy: order.refundedBy ?? null,
      note: `Application order ${order.orderNo} refunded`,
    });
    return ledgerRepo.save(ledger);
  }

  getPlatformOverview(query: AppRevenueQueryDto = {}) {
    return this.getOverview(query, null, true);
  }

  getDeveloperOverview(developerId: number, query: AppRevenueQueryDto = {}) {
    this.requirePositiveId(developerId, 'Developer');
    return this.getOverview(query, Number(developerId), false);
  }

  private async getOverview(
    query: AppRevenueQueryDto,
    developerId: number | null,
    includeDeveloperId: boolean,
  ) {
    const period = this.normalizePeriod(query);
    const clauses = ['1 = 1'];
    const params: Array<string | number | Date> = [];
    if (developerId !== null) {
      clauses.push('ledger.developer_id = ?');
      params.push(developerId);
    }
    if (period.start) {
      clauses.push('ledger.create_time >= ?');
      params.push(period.start);
    }
    if (period.endExclusive) {
      clauses.push('ledger.create_time < ?');
      params.push(period.endExclusive);
    }
    if (period.appCode) {
      clauses.push('app.code = ?');
      params.push(period.appCode);
    }

    const rows = (await this.ledgerRepo.query(
      `SELECT ledger.app_id,
              COALESCE(app.code, '') AS app_code,
              COALESCE(app.name, '') AS app_name,
              ledger.developer_id,
              SUM(CASE WHEN ledger.event_type = 'charge' THEN ledger.gross_amount_cents ELSE 0 END) AS gross_amount_cents,
              -SUM(CASE WHEN ledger.event_type = 'refund' THEN ledger.gross_amount_cents ELSE 0 END) AS refund_amount_cents,
              SUM(ledger.platform_amount_cents) AS platform_amount_cents,
              SUM(ledger.developer_amount_cents) AS developer_amount_cents,
              SUM(CASE WHEN ledger.settlement_batch_id IS NULL THEN ledger.developer_amount_cents ELSE 0 END) AS unsettled_developer_amount_cents,
              COUNT(DISTINCT ledger.order_id) AS order_count
         FROM app_revenue_ledger ledger
         LEFT JOIN app_package app ON app.id = ledger.app_id AND app.delete_time IS NULL
        WHERE ${clauses.join(' AND ')}
        GROUP BY ledger.app_id, app.code, app.name, ledger.developer_id
        ORDER BY app.name ASC, ledger.app_id ASC`,
      params,
    )) as Array<Record<string, unknown>>;

    const apps = rows.map((row) => ({
        app_id: this.toInteger(row.app_id),
        app_code: String(row.app_code || ''),
        app_name: String(row.app_name || ''),
        gross_amount_cents: this.toInteger(row.gross_amount_cents),
        refund_amount_cents: this.toInteger(row.refund_amount_cents),
        platform_amount_cents: this.toInteger(row.platform_amount_cents),
        developer_amount_cents: this.toInteger(row.developer_amount_cents),
        unsettled_developer_amount_cents: this.toInteger(
          row.unsettled_developer_amount_cents,
        ),
        order_count: this.toInteger(row.order_count),
        developer_id:
          row.developer_id == null ? null : this.toInteger(row.developer_id),
      }));
    const totals = apps.reduce(
      (total, app) => ({
        gross_amount_cents: total.gross_amount_cents + app.gross_amount_cents,
        refund_amount_cents: total.refund_amount_cents + app.refund_amount_cents,
        platform_amount_cents: total.platform_amount_cents + app.platform_amount_cents,
        developer_amount_cents: total.developer_amount_cents + app.developer_amount_cents,
        unsettled_developer_amount_cents:
          total.unsettled_developer_amount_cents + app.unsettled_developer_amount_cents,
        order_count: total.order_count + app.order_count,
      }),
      {
        gross_amount_cents: 0,
        refund_amount_cents: 0,
        platform_amount_cents: 0,
        developer_amount_cents: 0,
        unsettled_developer_amount_cents: 0,
        order_count: 0,
      },
    );
    if (!includeDeveloperId) {
      const developerApps = apps.map((app) => ({
        app_id: app.app_id,
        app_code: app.app_code,
        app_name: app.app_name,
        gross_amount_cents: app.gross_amount_cents,
        refund_amount_cents: app.refund_amount_cents,
        developer_amount_cents: app.developer_amount_cents,
        unsettled_developer_amount_cents: app.unsettled_developer_amount_cents,
        order_count: app.order_count,
      }));
      const developerTotals = {
        gross_amount_cents: totals.gross_amount_cents,
        refund_amount_cents: totals.refund_amount_cents,
        developer_amount_cents: totals.developer_amount_cents,
        unsettled_developer_amount_cents: totals.unsettled_developer_amount_cents,
        order_count: totals.order_count,
      };
      return {
        period: { start_date: query.start_date || null, end_date: query.end_date || null },
        currency: 'CNY' as const,
        totals: developerTotals,
        apps: developerApps,
      };
    }
    return {
      period: { start_date: query.start_date || null, end_date: query.end_date || null },
      currency: 'CNY' as const,
      totals,
      apps,
    };
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

  private assertRefundSource(order: AppOrderEntity, license: TenantAppLicenseEntity) {
    if (order.status !== 'refunded') {
      throw new BadRequestException('Only refunded application orders can create refund ledger rows');
    }
    if (
      license.source !== 'order' ||
      license.status !== 'refunded' ||
      Number(license.orderId) !== Number(order.id) ||
      Number(license.tenantId) !== Number(order.tenantId) ||
      Number(license.appId) !== Number(order.appId)
    ) {
      throw new BadRequestException('Application license does not match the refunded order');
    }
  }

  private normalizePeriod(query: AppRevenueQueryDto) {
    const start = query.start_date ? this.parseDate(query.start_date, 'Revenue start date') : null;
    const end = query.end_date ? this.parseDate(query.end_date, 'Revenue end date') : null;
    const endExclusive = end ? new Date(end.getTime() + 24 * 60 * 60 * 1000) : null;
    if (start && endExclusive && start.getTime() >= endExclusive.getTime()) {
      throw new BadRequestException('Revenue start date must not be after end date');
    }
    const appCode = String(query.app_code || '').trim().toLowerCase();
    if (appCode.length > 80) throw new BadRequestException('Application code is too long');
    return { start, endExclusive, appCode };
  }

  private parseDate(value: string, label: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) {
      throw new BadRequestException(`${label} is invalid`);
    }
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      throw new BadRequestException(`${label} is invalid`);
    }
    return date;
  }

  private requirePositiveId(value: number, label: string) {
    if (!Number.isInteger(Number(value)) || Number(value) <= 0) {
      throw new BadRequestException(`${label} id is required`);
    }
  }

  private toInteger(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
  }
}
