import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, In, Repository } from 'typeorm';

import type { AppPackageEntity } from '../../app/entities/app-package.entity';
import type {
  AppLicenseListQueryDto,
  AppOrderListQueryDto,
  CreateAppOrderDto,
} from '../dto/app-order.dto';
import { AppOrderEntity } from '../entities/app-order.entity';
import type { AppPricePlanEntity } from '../entities/app-price-plan.entity';
import { TenantAppLicenseEntity } from '../entities/tenant-app-license.entity';
import { AppLicenseAccessService } from './app-license-access.service';
import { AppPricePlanService } from './app-price-plan.service';
import { AppRevenueLedgerService } from './app-revenue-ledger.service';

@Injectable()
export class AppOrderService {
  constructor(
    private readonly configService: ConfigService,
    private readonly pricePlanService: AppPricePlanService,
    private readonly appLicenseAccessService: AppLicenseAccessService,
    @InjectRepository(AppOrderEntity)
    private readonly orderRepo: Repository<AppOrderEntity>,
    @InjectRepository(TenantAppLicenseEntity)
    private readonly licenseRepo: Repository<TenantAppLicenseEntity>,
    private readonly dataSource: DataSource,
    private readonly revenueLedgerService: AppRevenueLedgerService,
  ) {}

  async createTenantOrder(
    tenantId: number,
    userId: number,
    appCode: string,
    dto: CreateAppOrderDto,
  ): Promise<AppOrderEntity> {
    this.assertCommerceEnabled();
    this.requirePositiveId(tenantId, 'Tenant');
    this.requirePositiveId(userId, 'User');
    const app = await this.pricePlanService.findTenantApp(appCode);
    await this.appLicenseAccessService.assertAppAcquisitionAvailable(tenantId, app, 'purchase');
    const plan = await this.findPurchasablePlan(tenantId, app, dto.price_plan_code);
    if (plan.pricingModel === 'one_time') {
      await this.assertOneTimePurchaseAvailable(tenantId, app.id);
    }
    if (!app.developerId && Number(plan.developerShareBps) > 0) {
      throw new BadRequestException('Platform-owned applications must use zero developer share');
    }

    const paymentMethod = dto.payment_method || 'alipay';
    if (paymentMethod !== 'alipay') {
      throw new BadRequestException('Only Alipay application orders are supported');
    }
    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(AppOrderEntity);
      const existingOrder = await orderRepo.findOne({
        where: {
          tenantId: Number(tenantId),
          appId: Number(app.id),
          pricePlanId: Number(plan.id),
          paymentMethod,
          status: 'pending',
        },
        order: { id: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (existingOrder) return existingOrder;

      const order = orderRepo.create({
        orderNo: this.generateOrderNo(),
        tenantId: Number(tenantId),
        appId: Number(app.id),
        pricePlanId: Number(plan.id),
        appCode: app.code,
        appName: app.name,
        pricePlanCode: plan.code,
        pricingModel: plan.pricingModel as AppOrderEntity['pricingModel'],
        billingPeriod: plan.billingPeriod,
        amountCents: Number(plan.amountCents),
        currency: 'CNY',
        developerId: app.developerId ?? null,
        developerShareBps: Number(plan.developerShareBps),
        paymentMethod,
        status: 'pending',
        alipayTradeNo: null,
        paidAt: null,
        paymentRequestedAt: null,
        createdBy: Number(userId),
        refundReason: '',
        refundReference: '',
        closeReason: '',
        remark: `Purchase application ${app.code} plan ${plan.code}`,
      });
      return orderRepo.save(order);
    });
  }

  async startTrial(
    tenantId: number,
    userId: number,
    appCode: string,
    planCode: string,
  ): Promise<TenantAppLicenseEntity> {
    this.assertCommerceEnabled();
    this.requirePositiveId(tenantId, 'Tenant');
    this.requirePositiveId(userId, 'User');
    const app = await this.pricePlanService.findTenantApp(appCode);
    await this.appLicenseAccessService.assertAppAcquisitionAvailable(tenantId, app, 'start_trial');
    const plan = await this.findTrialPlan(tenantId, app, planCode);

    return this.dataSource.transaction(async (manager) => {
      const licenseRepo = manager.getRepository(TenantAppLicenseEntity);
      const trialHistory = await licenseRepo.findOne({
        where: { tenantId: Number(tenantId), appId: Number(app.id), source: 'trial' },
        withDeleted: true,
        lock: { mode: 'pessimistic_write' },
      });
      if (trialHistory) {
        throw new BadRequestException('Application trial has already been used');
      }

      const currentLicense = await licenseRepo.findOne({
        where: {
          tenantId: Number(tenantId),
          appId: Number(app.id),
          status: In(['active', 'trialing']),
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (currentLicense) {
        throw new BadRequestException('Application already has a current license');
      }

      const effectiveAt = new Date();
      const expiresAt = this.addDays(effectiveAt, Number(plan.trialDays));
      const license = licenseRepo.create({
        tenantId: Number(tenantId),
        appId: Number(app.id),
        pricePlanId: Number(plan.id),
        orderId: null,
        source: 'trial',
        status: 'trialing',
        effectiveAt,
        expiresAt,
        revokedAt: null,
        revokeReason: '',
        createdBy: Number(userId),
      });
      return licenseRepo.save(license);
    });
  }

  async confirmDevPayment(tenantId: number, orderNo: string): Promise<AppOrderEntity> {
    return this.confirmPaidOrder({
      where: { tenantId: Number(tenantId), orderNo },
      resolveTradeNo: (order) => `DEV-${order.orderNo}`,
    });
  }

  async confirmAlipayPayment(orderNo: string, tradeNo: string): Promise<AppOrderEntity> {
    const normalizedTradeNo = this.normalizeTradeNo(tradeNo);
    return this.confirmPaidOrder({
      where: { orderNo },
      resolveTradeNo: () => normalizedTradeNo,
    });
  }

  async findTenantOrder(tenantId: number, orderNo: string) {
    return this.orderRepo.findOne({ where: { tenantId: Number(tenantId), orderNo } });
  }

  async findPlatformOrder(orderNo: string) {
    return this.orderRepo.findOne({ where: { orderNo } });
  }

  async getTenantOrder(tenantId: number, orderNo: string) {
    const order = await this.findTenantOrder(tenantId, orderNo);
    if (!order) throw new NotFoundException('Application order not found');
    return this.toResponse(order);
  }

  async listTenantOrders(tenantId: number, query: AppOrderListQueryDto = {}) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const where: FindOptionsWhere<AppOrderEntity> = { tenantId: Number(tenantId) };
    if (query.order_no) where.orderNo = String(query.order_no).trim();
    if (query.app_code) where.appCode = String(query.app_code).trim();
    if (query.status) where.status = query.status;

    const [list, total] = await this.orderRepo.findAndCount({
      where,
      order: { createTime: 'DESC', id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { list: list.map((order) => this.toResponse(order)), total, page, limit };
  }

  async listPlatformOrders(query: AppOrderListQueryDto = {}) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const where: FindOptionsWhere<AppOrderEntity> = {};
    if (query.order_no) where.orderNo = String(query.order_no).trim();
    if (query.app_code) where.appCode = String(query.app_code).trim().toLowerCase();
    if (query.status) where.status = query.status;
    if (query.tenant_id) where.tenantId = Number(query.tenant_id);
    if (query.developer_id) where.developerId = Number(query.developer_id);
    const [list, total] = await this.orderRepo.findAndCount({
      where,
      order: { createTime: 'DESC', id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { list: list.map((order) => this.toResponse(order)), total, page, limit };
  }

  async listPlatformLicenses(query: AppLicenseListQueryDto = {}) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const where: FindOptionsWhere<TenantAppLicenseEntity> = {};
    if (query.tenant_id) where.tenantId = Number(query.tenant_id);
    if (query.app_id) where.appId = Number(query.app_id);
    if (query.status) where.status = query.status;
    const [list, total] = await this.licenseRepo.findAndCount({
      where,
      order: { createTime: 'DESC', id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { list: list.map((license) => this.toLicenseResponse(license)), total, page, limit };
  }

  async recordFullRefund(
    orderNo: string,
    operatorId: number,
    reason: string,
    providerReference: string,
  ): Promise<AppOrderEntity> {
    this.assertCommerceEnabled();
    this.requirePositiveId(operatorId, 'Operator');
    const normalizedOrderNo = this.normalizeRequiredText(orderNo, 32, 'Application order number');
    const normalizedReason = this.normalizeRequiredText(reason, 255, 'Refund reason');
    const normalizedReference = this.normalizeRequiredText(
      providerReference,
      100,
      'Refund reference',
    );
    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(AppOrderEntity);
      const licenseRepo = manager.getRepository(TenantAppLicenseEntity);
      const order = await orderRepo.findOne({
        where: { orderNo: normalizedOrderNo },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('Application order not found');
      if (order.status === 'refunded') return order;
      if (order.status !== 'paid') {
        throw new BadRequestException('Only paid application orders can be refunded');
      }
      const license = await licenseRepo.findOne({
        where: { orderId: Number(order.id) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!license || license.source !== 'order') {
        throw new BadRequestException('Application order license is unavailable');
      }

      const refundedAt = new Date();
      license.status = 'refunded';
      license.expiresAt = refundedAt;
      license.revokedAt = refundedAt;
      license.revokeReason = normalizedReason;
      await licenseRepo.save(license);

      order.status = 'refunded';
      order.refundedAt = refundedAt;
      order.refundedBy = Number(operatorId);
      order.refundReason = normalizedReason;
      order.refundReference = normalizedReference;
      const savedOrder = await orderRepo.save(order);
      await this.revenueLedgerService.recordRefund(manager, savedOrder, license);
      return savedOrder;
    });
  }

  async revokeLicense(licenseId: number, operatorId: number, reason: string) {
    this.assertCommerceEnabled();
    this.requirePositiveId(licenseId, 'License');
    this.requirePositiveId(operatorId, 'Operator');
    const normalizedReason = this.normalizeRequiredText(reason, 255, 'License revoke reason');
    return this.dataSource.transaction(async (manager) => {
      const licenseRepo = manager.getRepository(TenantAppLicenseEntity);
      const license = await licenseRepo.findOne({
        where: { id: Number(licenseId) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!license) throw new NotFoundException('Application license not found');
      if (license.status === 'revoked') return license;
      if (license.status !== 'active' && license.status !== 'trialing') {
        throw new BadRequestException('Only current application licenses can be revoked');
      }
      const revokedAt = new Date();
      license.status = 'revoked';
      license.revokedAt = revokedAt;
      license.expiresAt = revokedAt;
      license.revokeReason = normalizedReason;
      return licenseRepo.save(license);
    });
  }

  async markTenantPaymentRequested(
    tenantId: number,
    orderNo: string,
    now = new Date(),
  ): Promise<AppOrderEntity> {
    const updateResult = await this.orderRepo.update(
      { tenantId: Number(tenantId), orderNo, status: 'pending' },
      { paymentRequestedAt: now },
    );
    const order = await this.findTenantOrder(tenantId, orderNo);
    if (!order) throw new NotFoundException('Application order not found');
    if ((updateResult.affected ?? 0) > 0) return order;
    throw new BadRequestException('Only pending application orders can be paid');
  }

  toResponse(order: Partial<AppOrderEntity>) {
    return {
      id: order.id,
      order_no: order.orderNo,
      tenant_id: order.tenantId,
      app_id: order.appId,
      app_code: order.appCode,
      app_name: order.appName,
      price_plan_id: order.pricePlanId,
      price_plan_code: order.pricePlanCode,
      pricing_model: order.pricingModel,
      billing_period: order.billingPeriod,
      amount_cents: Number(order.amountCents) || 0,
      currency: order.currency,
      payment_method: order.paymentMethod,
      status: order.status,
      alipay_trade_no: order.alipayTradeNo ?? null,
      paid_at: order.paidAt ?? null,
      refunded_at: order.refundedAt ?? null,
      payment_requested_at: order.paymentRequestedAt ?? null,
      closed_at: order.closedAt ?? null,
      close_reason: order.closeReason || '',
      create_time: order.createTime,
    };
  }

  toLicenseResponse(license: Partial<TenantAppLicenseEntity>) {
    return {
      id: license.id,
      tenant_id: license.tenantId,
      app_id: license.appId,
      price_plan_id: license.pricePlanId ?? null,
      order_id: license.orderId ?? null,
      source: license.source,
      status: license.status,
      effective_at: license.effectiveAt,
      expires_at: license.expiresAt ?? null,
      revoked_at: license.revokedAt ?? null,
      create_time: license.createTime,
    };
  }

  private async confirmPaidOrder(options: {
    where: Record<string, string | number>;
    resolveTradeNo: (order: AppOrderEntity) => string;
  }): Promise<AppOrderEntity> {
    this.assertCommerceEnabled();
    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(AppOrderEntity);
      const licenseRepo = manager.getRepository(TenantAppLicenseEntity);
      const order = await orderRepo.findOne({
        where: options.where,
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('Application order not found');
      if (order.status === 'paid') return order;
      if (order.status !== 'pending') {
        throw new BadRequestException('Only pending application orders can be paid');
      }
      this.assertPaidOrderSnapshot(order);

      const paidAt = new Date();
      const currentLicense = await licenseRepo.findOne({
        where: {
          tenantId: Number(order.tenantId),
          appId: Number(order.appId),
          status: In(['active', 'trialing']),
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (currentLicense) {
        await this.assertActivationCanReplaceCurrent(orderRepo, order, currentLicense);
        currentLicense.status = 'expired';
        currentLicense.expiresAt = paidAt;
        await licenseRepo.save(currentLicense);
      }

      order.status = 'paid';
      order.paidAt = paidAt;
      order.alipayTradeNo = this.normalizeTradeNo(options.resolveTradeNo(order));
      const savedOrder = await orderRepo.save(order);
      const license = licenseRepo.create({
        tenantId: Number(order.tenantId),
        appId: Number(order.appId),
        pricePlanId: Number(order.pricePlanId),
        orderId: Number(order.id),
        source: 'order',
        status: 'active',
        effectiveAt: paidAt,
        expiresAt: this.calculateLicenseExpiry(paidAt, order),
        revokedAt: null,
        revokeReason: '',
        createdBy: order.createdBy ?? null,
      });
      const savedLicense = await licenseRepo.save(license);
      await this.revenueLedgerService.recordCharge(manager, savedOrder, savedLicense);
      return savedOrder;
    });
  }

  private async findPurchasablePlan(
    tenantId: number,
    app: AppPackageEntity,
    planCode: string,
  ) {
    const plan = await this.findApplicablePlan(tenantId, app, planCode);
    if (!['subscription', 'one_time'].includes(plan.pricingModel)) {
      throw new BadRequestException('Free or included application plans cannot be purchased');
    }
    this.assertPaidPlanSnapshot(plan);
    return plan;
  }

  private async findTrialPlan(tenantId: number, app: AppPackageEntity, planCode: string) {
    const plan = await this.findApplicablePlan(tenantId, app, planCode);
    if (!['subscription', 'one_time'].includes(plan.pricingModel)) {
      throw new BadRequestException('Only paid application plans can offer a trial');
    }
    if (!Number.isInteger(Number(plan.trialDays)) || Number(plan.trialDays) < 1 || Number(plan.trialDays) > 365) {
      throw new BadRequestException('Application price plan does not offer a valid trial');
    }
    return plan;
  }

  private async findApplicablePlan(
    tenantId: number,
    app: AppPackageEntity,
    planCode: string,
  ) {
    const normalizedCode = String(planCode || '').trim().toLowerCase();
    const plans = await this.pricePlanService.listApplicablePlans(Number(app.id), Number(tenantId));
    const plan = plans.find((item) => item.code === normalizedCode && Number(item.status) === 1);
    if (!plan) throw new NotFoundException(`Application price plan ${normalizedCode} is unavailable`);
    return plan;
  }

  private async assertOneTimePurchaseAvailable(tenantId: number, appId: number) {
    const currentLicense = await this.licenseRepo.findOne({
      where: { tenantId: Number(tenantId), appId: Number(appId), source: 'order', status: 'active' },
    });
    if (!currentLicense?.orderId) return;
    const currentOrder = await this.orderRepo.findOne({
      where: { id: Number(currentLicense.orderId), status: 'paid' },
    });
    if (currentOrder?.pricingModel === 'one_time') {
      throw new BadRequestException('Application already has a current one-time license');
    }
  }

  private async assertActivationCanReplaceCurrent(
    orderRepo: Repository<AppOrderEntity>,
    order: AppOrderEntity,
    currentLicense: TenantAppLicenseEntity,
  ) {
    if (order.pricingModel !== 'one_time' || currentLicense.source !== 'order') return;
    if (!currentLicense.orderId) {
      throw new BadRequestException('Current application license cannot be verified');
    }
    const currentOrder = await orderRepo.findOne({ where: { id: Number(currentLicense.orderId) } });
    if (!currentOrder || currentOrder.pricingModel === 'one_time') {
      throw new BadRequestException('Application already has a current one-time license');
    }
  }

  private assertPaidPlanSnapshot(plan: AppPricePlanEntity) {
    if (
      !Number.isInteger(Number(plan.amountCents)) ||
      Number(plan.amountCents) <= 0 ||
      plan.currency !== 'CNY'
    ) {
      throw new BadRequestException('Application price plan amount is invalid');
    }
    if (
      !Number.isInteger(Number(plan.developerShareBps)) ||
      Number(plan.developerShareBps) < 0 ||
      Number(plan.developerShareBps) > 10_000
    ) {
      throw new BadRequestException('Application price plan developer share is invalid');
    }
    if (plan.pricingModel === 'subscription' && !['monthly', 'yearly'].includes(plan.billingPeriod)) {
      throw new BadRequestException('Application subscription billing period is invalid');
    }
    if (plan.pricingModel === 'one_time' && plan.billingPeriod !== 'none') {
      throw new BadRequestException('Application one-time billing period is invalid');
    }
  }

  private assertPaidOrderSnapshot(order: AppOrderEntity) {
    this.assertPaidPlanSnapshot({
      pricingModel: order.pricingModel,
      billingPeriod: order.billingPeriod,
      amountCents: order.amountCents,
      currency: order.currency,
      developerShareBps: order.developerShareBps,
    } as AppPricePlanEntity);
  }

  private calculateLicenseExpiry(paidAt: Date, order: AppOrderEntity) {
    if (order.pricingModel === 'one_time') return null;
    const expiresAt = new Date(paidAt);
    const originalDay = expiresAt.getDate();
    expiresAt.setDate(1);
    if (order.billingPeriod === 'yearly') {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    } else {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    }
    const lastDayOfTargetMonth = new Date(
      expiresAt.getFullYear(),
      expiresAt.getMonth() + 1,
      0,
    ).getDate();
    expiresAt.setDate(Math.min(originalDay, lastDayOfTargetMonth));
    return expiresAt;
  }

  private addDays(date: Date, days: number) {
    const expiresAt = new Date(date);
    expiresAt.setDate(expiresAt.getDate() + days);
    return expiresAt;
  }

  private normalizeTradeNo(value: string) {
    const normalized = String(value || '').trim();
    if (!normalized || normalized.length > 64) {
      throw new BadRequestException('Application payment trade number is invalid');
    }
    return normalized;
  }

  private normalizeRequiredText(value: string, maxLength: number, label: string) {
    const normalized = String(value || '').trim();
    if (!normalized || normalized.length > maxLength) {
      throw new BadRequestException(`${label} is invalid`);
    }
    return normalized;
  }

  private assertCommerceEnabled() {
    if (!this.configService.get<boolean>('appMarketplace.commerce.enabled', false)) {
      throw new BadRequestException('Application commerce is disabled');
    }
  }

  private requirePositiveId(value: number, label: string) {
    if (!Number.isInteger(Number(value)) || Number(value) <= 0) {
      throw new BadRequestException(`${label} id is required`);
    }
  }

  private generateOrderNo() {
    const now = new Date();
    const timestamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
      String(now.getMilliseconds()).padStart(3, '0'),
    ].join('');
    const suffix = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
    return `AO${timestamp}${suffix}`;
  }
}
