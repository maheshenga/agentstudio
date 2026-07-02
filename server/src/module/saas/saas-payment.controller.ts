import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/auth.decorator';
import { ResultData } from '../../common/utils/result';
import { getTenantId } from '../../common/utils/tenant.util';
import { SaasOrderEntity } from './entities/saas-order.entity';
import { SaasOrderService } from './services/saas-order.service';
import { SaasPaymentService } from './services/saas-payment.service';

const ALIPAY_PAID_TRADE_STATUSES = new Set(['TRADE_SUCCESS', 'TRADE_FINISHED']);

@ApiTags('SaaS Payment')
@ApiBearerAuth('Authorization')
@Controller('api/saas/payment')
export class SaasPaymentController {
  constructor(
    private readonly saasOrderService: SaasOrderService,
    private readonly saasPaymentService: SaasPaymentService,
  ) {}

  @Post('dev-confirm')
  @ApiOperation({ summary: 'Development-only SaaS payment confirmation' })
  async devConfirm(@Body() body: { order_no: string }) {
    const tenantId = getTenantId();
    if (!tenantId) {
      return ResultData.fail(401, 'Tenant context is required');
    }

    return ResultData.ok(this.toOrderResponse(await this.saasOrderService.confirmDevPayment(tenantId, body.order_no)));
  }

  @Post('alipay/create')
  @ApiOperation({ summary: 'Create Alipay SaaS payment' })
  async createAlipayPayment(@Body() body: { order_no: string }) {
    const tenantId = getTenantId();
    if (!tenantId) {
      return ResultData.fail(401, 'Tenant context is required');
    }

    return ResultData.ok(await this.saasPaymentService.createAlipayPayment(tenantId, body.order_no));
  }

  @Public()
  @Post('alipay/notify')
  @ApiOperation({ summary: 'Handle Alipay notify endpoint' })
  async alipayNotify(@Body() body: Record<string, any>) {
    if (!this.saasPaymentService.verifyAlipayNotify(body)) {
      return 'fail';
    }

    const tradeStatus = String(body.trade_status || '');
    if (!ALIPAY_PAID_TRADE_STATUSES.has(tradeStatus)) {
      return 'success';
    }

    try {
      await this.saasOrderService.confirmAlipayPayment(String(body.out_trade_no || ''), String(body.trade_no || ''));
      return 'success';
    } catch {
      return 'fail';
    }
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
}
