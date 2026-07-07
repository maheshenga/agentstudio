import { Body, Controller, Get, NotFoundException, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/auth.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ResultData } from '../../common/utils/result';
import { getTenantId } from '../../common/utils/tenant.util';
import { SaasOrderEntity } from './entities/saas-order.entity';
import { SaasOrderService } from './services/saas-order.service';
import { SaasPaymentService } from './services/saas-payment.service';
import type { SaasAlipayExpectedOrder, SaasPaymentOrderType } from './services/saas-payment.service';
import { SaasResourcePackOrderService } from './services/saas-resource-pack-order.service';

const ALIPAY_PAID_TRADE_STATUSES = new Set(['TRADE_SUCCESS', 'TRADE_FINISHED']);

@ApiTags('SaaS Payment')
@ApiBearerAuth('Authorization')
@Controller('api/saas/payment')
export class SaasPaymentController {
  constructor(
    private readonly saasOrderService: SaasOrderService,
    private readonly saasPaymentService: SaasPaymentService,
    private readonly saasResourcePackOrderService: SaasResourcePackOrderService,
    private readonly configService: ConfigService,
  ) {}

  @Post('dev-confirm')
  @ApiOperation({ summary: 'Development-only SaaS payment confirmation' })
  async devConfirm(@Body() body: { order_no: string; order_type?: SaasPaymentOrderType }) {
    this.assertDevPaymentConfirmationAllowed();

    const tenantId = getTenantId();
    if (!tenantId) {
      return ResultData.fail(401, 'Tenant context is required');
    }

    if (body.order_type === 'resource_pack') {
      return ResultData.ok(
        this.saasResourcePackOrderService.toResponse(
          await this.saasResourcePackOrderService.confirmDevPayment(tenantId, body.order_no),
        ),
      );
    }

    return ResultData.ok(this.toOrderResponse(await this.saasOrderService.confirmDevPayment(tenantId, body.order_no)));
  }

  @Post('alipay/create')
  @RequirePermission('tenant:billing:upgrade', 'tenant:resource-pack-order:pay')
  @ApiOperation({ summary: 'Create Alipay SaaS payment' })
  async createAlipayPayment(@Body() body: { order_no: string; order_type?: SaasPaymentOrderType }) {
    const tenantId = getTenantId();
    if (!tenantId) {
      return ResultData.fail(401, 'Tenant context is required');
    }

    return ResultData.ok(await this.saasPaymentService.createAlipayPayment(tenantId, body.order_no, body.order_type || 'plan'));
  }

  @Get('alipay/config-status')
  @RequirePermission('tenant:billing:view')
  @ApiOperation({ summary: 'Get Alipay SaaS payment config status' })
  async getAlipayConfigStatus() {
    const tenantId = getTenantId();
    if (!tenantId) {
      return ResultData.fail(401, 'Tenant context is required');
    }

    return ResultData.ok(await this.saasPaymentService.getAlipayConfigStatus());
  }

  @Public()
  @Post('alipay/notify')
  @ApiOperation({ summary: 'Handle Alipay notify endpoint' })
  async alipayNotify(@Body() body: Record<string, any>) {
    const tradeStatus = String(body.trade_status || '');
    if (!ALIPAY_PAID_TRADE_STATUSES.has(tradeStatus)) {
      if (!(await this.saasPaymentService.verifyAlipayNotify(body))) {
        return 'fail';
      }
      return 'success';
    }

    try {
      const orderNo = String(body.out_trade_no || '');
      if (!orderNo) {
        return 'fail';
      }
      if (orderNo.startsWith('RPO')) {
        const order = await this.saasResourcePackOrderService.findPlatformOrder(orderNo);
        const expectedOrder = this.toAlipayExpectedOrder(order);
        if (!expectedOrder) {
          return 'fail';
        }
        const validation = await this.saasPaymentService.verifyAlipayPaidNotify(body, expectedOrder);
        if (!validation.valid) {
          return 'fail';
        }
        await this.saasResourcePackOrderService.confirmAlipayPayment(orderNo, validation.tradeNo || String(body.trade_no || ''));
        return 'success';
      }

      const order = await this.saasOrderService.findPlatformOrder(orderNo);
      const expectedOrder = this.toAlipayExpectedOrder(order);
      if (!expectedOrder) {
        return 'fail';
      }
      const validation = await this.saasPaymentService.verifyAlipayPaidNotify(body, expectedOrder);
      if (!validation.valid) {
        return 'fail';
      }

      await this.saasOrderService.confirmAlipayPayment(orderNo, validation.tradeNo || String(body.trade_no || ''));
      return 'success';
    } catch {
      return 'fail';
    }
  }

  private toAlipayExpectedOrder(order: Record<string, any> | null | undefined): SaasAlipayExpectedOrder | null {
    if (!order) {
      return null;
    }
    const orderNo = String(order.order_no || order.orderNo || '');
    const amountCents = Number(order.amount_cents ?? order.amountCents);
    if (!orderNo || !Number.isFinite(amountCents)) {
      return null;
    }
    return { orderNo, amountCents };
  }

  private toOrderResponse(order: Partial<SaasOrderEntity>) {
    return {
      order_no: order.orderNo,
      plan_code: order.planCode,
      amount_cents: order.amountCents,
      status: order.status,
      payment_method: order.paymentMethod,
      alipay_trade_no: order.alipayTradeNo,
      paid_at: order.paidAt,
    };
  }

  private assertDevPaymentConfirmationAllowed(): void {
    const configured = this.configService.get<boolean | string | undefined>('payment.devConfirmEnabled');
    const enabled =
      configured === undefined
        ? String(this.configService.get<string>('app.env') || process.env.NODE_ENV || 'development').toLowerCase() !==
          'production'
        : configured === true || String(configured).toLowerCase() === 'true';

    if (!enabled) {
      throw new NotFoundException('Development payment confirmation is not available');
    }
  }
}
