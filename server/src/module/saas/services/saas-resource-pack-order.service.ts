import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';

import { SAAS_ORDER_PAID, SAAS_ORDER_PENDING, SAAS_PAYMENT_ALIPAY } from '../constants';
import { CreateResourcePackOrderDto } from '../dto/create-resource-pack-order.dto';
import { SaasResourcePackOrderEntity } from '../entities/saas-resource-pack-order.entity';
import { SaasResourcePackEntity } from '../entities/saas-resource-pack.entity';
import { SaasTenantResourceEntity } from '../entities/saas-tenant-resource.entity';

export interface SaasResourcePackOrderListQuery {
  page?: string | number;
  limit?: string | number;
  tenant_id?: string | number;
  resource_pack_code?: string;
  resource_type?: string;
  status?: string;
}

@Injectable()
export class SaasResourcePackOrderService {
  constructor(
    @InjectRepository(SaasResourcePackEntity)
    private readonly resourcePackRepo: Repository<SaasResourcePackEntity>,
    @InjectRepository(SaasResourcePackOrderEntity)
    private readonly resourcePackOrderRepo: Repository<SaasResourcePackOrderEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async createTenantOrder(tenantId: number, dto: CreateResourcePackOrderDto): Promise<SaasResourcePackOrderEntity> {
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
    return this.resourcePackOrderRepo.findOne({
      where: {
        tenantId,
        orderNo,
      },
    });
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
    const tenantId = this.resolvePositiveNumber(query.tenant_id);
    if (tenantId !== undefined) {
      where.tenantId = tenantId;
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

    const [list, total] = await this.resourcePackOrderRepo.findAndCount({
      where,
      order: { createTime: 'DESC', id: 'DESC' },
      skip,
      take: limit,
    });

    return { list: list.map((order) => this.toResponse(order)), total, page, limit };
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
      delivered_at: order.deliveredAt,
      create_time: order.createTime,
    };
  }

  private async confirmPaidOrder(options: {
    where: Record<string, string | number>;
    resolveTradeNo: (order: SaasResourcePackOrderEntity) => string;
  }): Promise<SaasResourcePackOrderEntity> {
    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(SaasResourcePackOrderEntity);
      const tenantResourceRepo = manager.getRepository(SaasTenantResourceEntity);
      const order = await orderRepo.findOne({ where: options.where });
      if (!order) {
        throw new NotFoundException('Resource pack order not found');
      }
      if (order.status === SAAS_ORDER_PAID && order.deliveredAt) {
        return order;
      }
      if (order.status !== SAAS_ORDER_PENDING) {
        throw new BadRequestException('Only pending resource pack orders can be paid');
      }

      const paidAt = new Date();
      order.status = SAAS_ORDER_PAID;
      order.paidAt = paidAt;
      order.deliveredAt = paidAt;
      order.alipayTradeNo = options.resolveTradeNo(order);

      const resource = await tenantResourceRepo.findOne({
        where: {
          tenantId: order.tenantId,
          resourceType: order.resourceType,
        },
      });
      if (resource) {
        resource.totalQuota = Number(resource.totalQuota || 0) + Number(order.quotaAmount || 0);
        resource.status = 1;
        await tenantResourceRepo.save(resource);
      } else {
        await tenantResourceRepo.save({
          tenantId: order.tenantId,
          resourceType: order.resourceType,
          totalQuota: Number(order.quotaAmount) || 0,
          usedQuota: 0,
          status: 1,
        });
      }

      return orderRepo.save(order);
    });
  }

  private resolvePagination(query: SaasResourcePackOrderListQuery) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    return { page, limit, skip: (page - 1) * limit };
  }

  private resolvePositiveNumber(value: string | number | undefined): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
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
