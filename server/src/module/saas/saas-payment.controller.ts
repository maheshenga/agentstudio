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
import type { SaasPaymentOrderType } from './services/saas-payment.service';
import { SaasResourcePackOrderService } from './services/saas-resource-pack-order.service';

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
    const result = await this.saasPaymentService.handleAlipayNotify(body);
    return result.ack;
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
