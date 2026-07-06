import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';

import { SAAS_ORDER_PAID, SAAS_ORDER_PENDING, SAAS_PAYMENT_ALIPAY } from '../constants';
import { CreateResourcePackOrderDto } from '../dto/create-resource-pack-order.dto';
import { SaasResourcePackOrderEntity } from '../entities/saas-resource-pack-order.entity';
import { SaasResourcePackEntity } from '../entities/saas-resource-pack.entity';
import { SystemModuleAccessService } from '../../system-module/services/system-module-access.service';
import { SaasQuotaService } from './saas-quota.service';

export interface SaasResourcePackOrderListQuery {
  page?: string | number;
  limit?: string | number;
  tenant_id?: string | number;
  order_no?: string;
  resource_pack_code?: string;
  resource_type?: string;
  status?: string;
  close_reason?: string;
}

@Injectable()
export class SaasResourcePackOrderService {
  constructor(
    @InjectRepository(SaasResourcePackEntity)
    private readonly resourcePackRepo: Repository<SaasResourcePackEntity>,
    @InjectRepository(SaasResourcePackOrderEntity)
    private readonly resourcePackOrderRepo: Repository<SaasResourcePackOrderEntity>,
    private readonly dataSource: DataSource,
    private readonly systemModuleAccessService: SystemModuleAccessService,
    private readonly saasQuotaService: SaasQuotaService,
  ) {}

  async createTenantOrder(tenantId: number, dto: CreateResourcePackOrderDto): Promise<SaasResourcePackOrderEntity> {
    await this.assertTenantResourcePackAccess(tenantId);

    const pack = await this.resourcePackRepo.findOne({
      where: {
        code: dto.resource_pack_code,
        status: 1,
      },
    });
    if (!pack) {
      throw new NotFoundException(`Resource pack ${dto.resource_pack_code} is not configured`);
    }

    const order = this.resourcePackOrderRepo.create({
      orderNo: this.generateOrderNo(),
      tenantId,
      resourcePackId: pack.id,
      resourcePackCode: pack.code,
      resourcePackName: pack.name,
      resourceType: pack.resourceType,
      quotaAmount: Number(pack.quotaAmount) || 0,
      amountCents: Number(pack.priceCents) || 0,
      currency: pack.currency || 'CNY',
      paymentMethod: dto.payment_method || SAAS_PAYMENT_ALIPAY,
      status: SAAS_ORDER_PENDING,
      remark: `Purchase resource pack ${pack.code}`,
    });

    return this.resourcePackOrderRepo.save(order);
  }

  async findTenantOrder(tenantId: number, orderNo: string): Promise<SaasResourcePackOrderEntity | null> {
    await this.assertTenantResourcePackAccess(tenantId);

    return this.resourcePackOrderRepo.findOne({
      where: {
        tenantId,
        orderNo,
      },
    });
  }

  async markTenantPaymentRequested(
    tenantId: number,
    orderNo: string,
    now = new Date(),
  ): Promise<SaasResourcePackOrderEntity> {
    await this.assertTenantResourcePackAccess(tenantId);

    const updateResult = await this.resourcePackOrderRepo.update(
      { tenantId, orderNo, status: SAAS_ORDER_PENDING },
      { paymentRequestedAt: now },
    );
    const order = await this.resourcePackOrderRepo.findOne({ where: { tenantId, orderNo } });
    if (!order) {
      throw new NotFoundException('Resource pack order not found');
    }
    if ((updateResult.affected ?? 0) > 0) {
      return order;
    }
    if (order.status === SAAS_ORDER_PAID) {
      throw new BadRequestException('Only pending resource pack orders can be paid');
    }
    throw new BadRequestException('Only pending resource pack orders can be paid');
  }

  async listTenantOrders(tenantId: number, query: SaasResourcePackOrderListQuery = {}) {
    await this.assertTenantResourcePackAccess(tenantId);

    const { page, limit, skip } = this.resolvePagination(query);
    const where: FindOptionsWhere<SaasResourcePackOrderEntity> = { tenantId };
    if (query.resource_pack_code) {
      where.resourcePackCode = query.resource_pack_code;
    }
    if (query.order_no) {
      where.orderNo = query.order_no;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.close_reason) {
      where.closeReason = query.close_reason;
    }

    const [list, total] = await this.resourcePackOrderRepo.findAndCount({
      where,
      order: { createTime: 'DESC', id: 'DESC' },
      skip,
      take: limit,
    });

    return { list: list.map((order) => this.toResponse(order)), total, page, limit };
  }

  async confirmDevPayment(tenantId: number, orderNo: string): Promise<SaasResourcePackOrderEntity> {
    return this.confirmPaidOrder({
      where: { tenantId, orderNo },
      resolveTradeNo: (order) => `DEV-${order.orderNo}`,
    });
  }

  async confirmAlipayPayment(orderNo: string, alipayTradeNo: string): Promise<SaasResourcePackOrderEntity> {
    return this.confirmPaidOrder({
      where: { orderNo },
      resolveTradeNo: () => alipayTradeNo,
    });
  }

  async listPlatformOrders(query: SaasResourcePackOrderListQuery = {}) {
    const { page, limit, skip } = this.resolvePagination(query);
    const where: FindOptionsWhere<SaasResourcePackOrderEntity> = {};
    const tenantId = this.resolvePositiveNumber(query.tenant_id, 'tenant_id', true);
    if (tenantId !== undefined) {
      where.tenantId = tenantId;
    }
    if (query.order_no) {
      where.orderNo = query.order_no;
    }
    if (query.resource_pack_code) {
      where.resourcePackCode = query.resource_pack_code;
    }
    if (query.resource_type) {
      where.resourceType = query.resource_type;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.close_reason) {
      where.closeReason = query.close_reason;
    }

    const [list, total] = await this.resourcePackOrderRepo.findAndCount({
      where,
      order: { createTime: 'DESC', id: 'DESC' },
      skip,
      take: limit,
    });

    return { list: list.map((order) => this.toResponse(order)), total, page, limit };
  }

  async findPlatformOrder(orderNo: string) {
    const order = await this.resourcePackOrderRepo.findOne({ where: { orderNo } });
    return order ? this.toResponse(order) : null;
  }

  toResponse(order: Partial<SaasResourcePackOrderEntity>) {
    return {
      order_no: order.orderNo,
      tenant_id: order.tenantId,
      resource_pack_code: order.resourcePackCode,
      resource_pack_name: order.resourcePackName,
      resource_type: order.resourceType,
      quota_amount: Number(order.quotaAmount) || 0,
      amount_cents: Number(order.amountCents) || 0,
      currency: order.currency,
      payment_method: order.paymentMethod,
      status: order.status,
      alipay_trade_no: order.alipayTradeNo,
      paid_at: order.paidAt,
      payment_requested_at: order.paymentRequestedAt ?? null,
      delivered_at: order.deliveredAt,
      closed_at: order.closedAt ?? null,
      close_reason: order.closeReason ?? null,
      create_time: order.createTime,
    };
  }

  private async confirmPaidOrder(options: {
    where: Record<string, string | number>;
    resolveTradeNo: (order: SaasResourcePackOrderEntity) => string;
  }): Promise<SaasResourcePackOrderEntity> {
    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(SaasResourcePackOrderEntity);
      const order = await orderRepo.findOne({
        where: options.where,
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) {
        throw new NotFoundException('Resource pack order not found');
      }
      if (order.status === SAAS_ORDER_PAID && order.deliveredAt) {
        return order;
      }
      await this.assertTenantResourcePackAccess(order.tenantId);
      if (order.status !== SAAS_ORDER_PENDING) {
        throw new BadRequestException('Only pending resource pack orders can be paid');
      }

      const paidAt = new Date();
      const tradeNo = options.resolveTradeNo(order);

      await this.saasQuotaService.grantTenantQuota(
        order.tenantId,
        order.resourceType,
        Number(order.quotaAmount) || 0,
        {
          sourceType: 'resource_pack_order',
          sourceId: order.orderNo,
          remark: `Resource pack ${order.resourcePackCode} paid`,
        },
        manager,
      );

      order.status = SAAS_ORDER_PAID;
      order.paidAt = paidAt;
      order.deliveredAt = paidAt;
      order.alipayTradeNo = tradeNo;

      return orderRepo.save(order);
    });
  }

  private async assertTenantResourcePackAccess(tenantId: number): Promise<void> {
    await this.systemModuleAccessService.assertModuleAccess({
      tenantId,
      moduleCode: 'tenant_saas',
      requiredSaasModuleCode: 'resource_pack',
    });
  }

  private resolvePagination(query: SaasResourcePackOrderListQuery) {
    const page = this.resolvePaginationNumber(query.page, 1);
    const limit = this.resolvePaginationNumber(query.limit, 20, 100);
    return { page, limit, skip: (page - 1) * limit };
  }

  private resolvePositiveNumber(
    value: string | number | undefined,
    fieldName: string,
    rejectInvalid: boolean,
  ): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric;
    }
    if (rejectInvalid) {
      throw new BadRequestException(`${fieldName} must be a positive number`);
    }
    return undefined;
  }

  private resolvePaginationNumber(value: string | number | undefined, fallback: number, max?: number): number {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return fallback;
    }
    const clamped = Math.max(1, Math.floor(numeric));
    return max ? Math.min(max, clamped) : clamped;
  }

  private generateOrderNo(): string {
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
    return `RPO${timestamp}${suffix}`;
  }
}
