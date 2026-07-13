import { getMetadataArgsStorage } from 'typeorm';

import { AppOrderEntity } from './app-order.entity';
import { AppPricePlanEntity } from './app-price-plan.entity';
import { AppRevenueLedgerEntity } from './app-revenue-ledger.entity';
import { AppSettlementBatchEntity } from './app-settlement-batch.entity';
import { TenantAppLicenseEntity } from './tenant-app-license.entity';

describe('Application commerce entities', () => {
  const indexNames = (target: Function) =>
    getMetadataArgsStorage()
      .indices.filter((item) => item.target === target)
      .map((item) => item.name);

  const columnNames = (target: Function) =>
    getMetadataArgsStorage()
      .columns.filter((item) => item.target === target)
      .map((item) => String(item.options.name || item.propertyName));

  it('stores backend-owned price plans with explicit developer share basis points', () => {
    expect(indexNames(AppPricePlanEntity)).toEqual(
      expect.arrayContaining([
        'uk_app_price_plan_app_code',
        'idx_app_price_plan_app_status',
      ]),
    );
    expect(columnNames(AppPricePlanEntity)).toEqual(
      expect.arrayContaining([
        'app_id',
        'code',
        'name',
        'pricing_model',
        'billing_period',
        'amount_cents',
        'currency',
        'trial_days',
        'developer_share_bps',
        'included_plan_codes',
        'sale_scope',
        'tenant_ids',
        'status',
      ]),
    );
  });

  it('stores immutable application order price snapshots', () => {
    expect(indexNames(AppOrderEntity)).toEqual(
      expect.arrayContaining([
        'uk_app_order_order_no',
        'uk_app_order_trade_no',
        'idx_app_order_tenant_status',
        'idx_app_order_app_status',
      ]),
    );
    expect(columnNames(AppOrderEntity)).toEqual(
      expect.arrayContaining([
        'order_no',
        'tenant_id',
        'app_id',
        'price_plan_id',
        'app_code',
        'app_name',
        'price_plan_code',
        'pricing_model',
        'billing_period',
        'amount_cents',
        'currency',
        'developer_id',
        'developer_share_bps',
        'payment_method',
        'status',
        'alipay_trade_no',
        'paid_at',
        'refunded_at',
        'payment_requested_at',
        'created_by',
      ]),
    );
  });

  it('stores one current license per tenant and application with historical rows', () => {
    expect(indexNames(TenantAppLicenseEntity)).toEqual(
      expect.arrayContaining([
        'uk_tenant_app_license_order',
        'idx_tenant_app_license_tenant_app_status',
        'idx_tenant_app_license_expiry',
      ]),
    );
    expect(columnNames(TenantAppLicenseEntity)).toEqual(
      expect.arrayContaining([
        'tenant_id',
        'app_id',
        'price_plan_id',
        'order_id',
        'source',
        'status',
        'effective_at',
        'expires_at',
        'revoked_at',
        'revoke_reason',
        'created_by',
      ]),
    );
  });

  it('stores immutable revenue events without provider payloads or mutable timestamps', () => {
    expect(indexNames(AppRevenueLedgerEntity)).toEqual(
      expect.arrayContaining([
        'uk_app_revenue_ledger_event',
        'idx_app_revenue_ledger_developer_time',
        'idx_app_revenue_ledger_settlement',
      ]),
    );
    const columns = columnNames(AppRevenueLedgerEntity);
    expect(columns).toEqual(
      expect.arrayContaining([
        'event_key',
        'event_type',
        'order_id',
        'license_id',
        'tenant_id',
        'app_id',
        'developer_id',
        'gross_amount_cents',
        'platform_amount_cents',
        'developer_amount_cents',
        'settlement_batch_id',
        'create_time',
      ]),
    );
    expect(columns).not.toEqual(
      expect.arrayContaining([
        'provider_payload',
        'notify_payload',
        'token',
        'secret',
        'update_time',
        'delete_time',
      ]),
    );
  });

  it('stores one manual settlement batch per developer and period', () => {
    expect(indexNames(AppSettlementBatchEntity)).toEqual(
      expect.arrayContaining([
        'uk_app_settlement_developer_period',
        'idx_app_settlement_status_period',
      ]),
    );
    expect(columnNames(AppSettlementBatchEntity)).toEqual(
      expect.arrayContaining([
        'batch_no',
        'developer_id',
        'period_start',
        'period_end',
        'gross_amount_cents',
        'refund_amount_cents',
        'developer_amount_cents',
        'status',
        'reviewed_by',
        'reviewed_at',
        'paid_by',
        'paid_at',
        'payment_reference',
      ]),
    );
  });
});
