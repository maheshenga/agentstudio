<template>
  <div class="art-full-height p-5 tenant-plan-page">
    <section class="tenant-plan-page__header">
      <div>
        <h1 class="tenant-plan-page__title">租户套餐概览</h1>
        <p class="tenant-plan-page__subtitle">查看当前订阅，选择套餐并完成本地模拟支付。</p>
      </div>
      <ElButton :loading="loading" @click="loadPageData">刷新</ElButton>
    </section>

    <ElSkeleton v-if="loading && !subscriptionInfo" animated :rows="6" />

    <ElResult v-else-if="errorMessage" icon="error" :title="errorMessage" sub-title="请稍后重试。">
      <template #extra>
        <ElButton type="primary" :loading="loading" @click="loadPageData">重试</ElButton>
      </template>
    </ElResult>

    <template v-else>
      <section v-if="subscriptionInfo" class="tenant-plan-page__summary">
        <ElDescriptions :column="1" border>
          <ElDescriptionsItem label="当前套餐">{{ currentPlanText }}</ElDescriptionsItem>
          <ElDescriptionsItem label="试用结束时间">{{ trialEndTimeText }}</ElDescriptionsItem>
          <ElDescriptionsItem label="订阅状态">
            <ElTag :type="subscriptionTagType" effect="light">{{ subscriptionStatusText }}</ElTag>
          </ElDescriptionsItem>
        </ElDescriptions>
      </section>

      <section class="tenant-plan-page__plans">
        <div class="tenant-plan-page__toolbar">
          <h2 class="tenant-plan-page__section-title">升级套餐</h2>
          <ElRadioGroup v-model="billingCycle" size="small">
            <ElRadioButton value="monthly">月付</ElRadioButton>
            <ElRadioButton value="yearly">年付</ElRadioButton>
          </ElRadioGroup>
        </div>

        <div v-if="!plans.length" class="tenant-plan-page__state">
          <ElEmpty description="暂无可用套餐" />
        </div>

        <div v-else class="tenant-plan-page__grid">
          <article v-for="plan in plans" :key="plan.code" class="tenant-plan-page__plan-card">
            <div class="tenant-plan-page__plan-main">
              <div class="tenant-plan-page__plan-title-row">
                <h3>{{ plan.name }}</h3>
                <ElTag v-if="plan.code === currentPlanCode" type="success" effect="light">当前</ElTag>
              </div>
              <p class="tenant-plan-page__plan-code">{{ plan.code }}</p>
              <p class="tenant-plan-page__plan-price">{{ formatPlanPrice(plan) }}</p>
            </div>
            <ElButton
              type="primary"
              :disabled="plan.code === currentPlanCode || getPlanAmount(plan) <= 0"
              :loading="creatingPlanCode === plan.code"
              @click="createOrder(plan)"
            >
              {{ plan.code === currentPlanCode ? '当前套餐' : '创建升级订单' }}
            </ElButton>
          </article>
        </div>
      </section>

      <section v-if="currentOrder" class="tenant-plan-page__order">
        <div>
          <h2 class="tenant-plan-page__section-title">待处理订单</h2>
          <p class="tenant-plan-page__order-meta">
            {{ currentOrder.order_no }} · {{ currentOrder.plan_code }} · {{ formatMoney(currentOrder.amount_cents) }}
          </p>
          <ElTag :type="currentOrder.status === 'paid' ? 'success' : 'warning'" effect="light">
            {{ currentOrder.status === 'paid' ? '已支付' : '待支付' }}
          </ElTag>
        </div>
        <div class="tenant-plan-page__order-actions">
          <div v-if="alipayConfigStatus" class="tenant-plan-page__payment-status">
            <ElTag :type="alipayConfigStatus.configured ? 'success' : 'warning'" effect="light">
              {{ alipayConfigStatus.configured ? '支付宝已配置' : '支付宝未配置' }}
            </ElTag>
            <span v-if="pollingPayment">正在同步支付结果...</span>
            <span v-if="!alipayConfigStatus.configured">{{ alipayMissingKeysText }}</span>
          </div>
          <ElButton
            type="primary"
            :disabled="currentOrder.status === 'paid'"
            :loading="creatingAlipayPayment"
            @click="startAlipayPayment"
          >
            去支付宝支付
          </ElButton>
          <ElButton
            type="success"
            :disabled="currentOrder.status === 'paid'"
            :loading="confirmingPayment"
            @click="confirmDevPayment"
          >
            本地模拟支付成功
          </ElButton>
          <p class="tenant-plan-page__payment-note">支付宝沙箱/正式支付将在接入密钥后启用。</p>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import {
    createAlipayPayment,
    createTenantUpgradeOrder,
    devConfirmTenantPayment,
    fetchAlipayConfigStatus,
    fetchTenantOrder,
    fetchTenantPlans,
    fetchTenantSubscription,
    type AlipayConfigStatus,
    type SaasOrderRecord,
    type SaasPlanOption,
    type TenantSubscriptionSummary
  } from '@/api/saas'

  defineOptions({ name: 'SaasTenantPlanPage' })

  const LAST_UPGRADE_ORDER_KEY = 'saas:last-upgrade-order-no'
  const PAYMENT_POLL_INTERVAL_MS = 5000
  const PAYMENT_POLL_TIMEOUT_MS = 120000

  const subscriptionInfo = ref<TenantSubscriptionSummary | null>(null)
  const alipayConfigStatus = ref<AlipayConfigStatus | null>(null)
  const plans = ref<SaasPlanOption[]>([])
  const currentOrder = ref<SaasOrderRecord | null>(null)
  const billingCycle = ref<'monthly' | 'yearly'>('yearly')
  const loading = ref(false)
  const creatingPlanCode = ref('')
  const creatingAlipayPayment = ref(false)
  const confirmingPayment = ref(false)
  const pollingPayment = ref(false)
  const errorMessage = ref('')
  let paymentPollingTimer: number | undefined
  let paymentPollingStartedAt = 0

  const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })

  const currentPlanCode = computed(() =>
    formatText(pickValue(subscriptionInfo.value, ['current_plan', 'currentPlan']))
  )

  const currentPlanText = computed(() =>
    formatText(
      pickValue(subscriptionInfo.value, ['current_plan', 'currentPlan', 'plan_name', 'planName'])
    )
  )

  const trialEndTimeText = computed(() =>
    formatDateTime(
      pickValue(subscriptionInfo.value, ['trial_end_time', 'trialEndTime', 'trial_end_at', 'trialEndAt'])
    )
  )

  const subscriptionStatus = computed(() => {
    const rawStatus = pickValue(subscriptionInfo.value, [
      'subscription_status',
      'subscriptionStatus',
      'status'
    ])

    if (rawStatus === undefined) {
      return { text: '-', type: 'info' as const }
    }

    const normalized = String(rawStatus).trim().toLowerCase()
    const statusMap: Record<string, { text: string; type: 'success' | 'warning' | 'info' | 'danger' }> = {
      active: { text: '正常', type: 'success' },
      trialing: { text: '试用中', type: 'warning' },
      trial: { text: '试用中', type: 'warning' },
      expired: { text: '已过期', type: 'info' },
      cancelled: { text: '已取消', type: 'danger' },
      canceled: { text: '已取消', type: 'danger' },
      pending: { text: '待生效', type: 'warning' },
      inactive: { text: '未开通', type: 'info' },
      frozen: { text: '已冻结', type: 'danger' },
      '1': { text: '正常', type: 'success' },
      '2': { text: '试用中', type: 'warning' },
      '0': { text: '未开通', type: 'info' }
    }

    return statusMap[normalized] ?? {
      text: formatText(rawStatus),
      type:
        normalized.includes('fail') || normalized.includes('cancel') || normalized.includes('disable')
          ? 'danger'
          : normalized.includes('trial') || normalized.includes('pending')
            ? 'warning'
            : 'info'
    }
  })

  const subscriptionStatusText = computed(() => subscriptionStatus.value.text)
  const subscriptionTagType = computed(() => subscriptionStatus.value.type)
  const alipayMissingKeysText = computed(() => {
    const missingKeys = alipayConfigStatus.value?.missing_keys || []
    return missingKeys.length ? `缺少：${missingKeys.join('、')}` : ''
  })

  function pickValue(source: Record<string, any> | null, keys: string[]) {
    if (!source) return undefined

    for (const key of keys) {
      const value = source[key]
      if (value !== undefined && value !== null && value !== '') {
        return value
      }
    }

    return undefined
  }

  function normalizePayload<T>(payload: any): T | null {
    if (!payload) return null
    if (typeof payload === 'object' && 'data' in payload && payload.data) {
      return payload.data
    }

    return payload
  }

  function formatText(value: unknown) {
    if (value === undefined || value === null || value === '') {
      return '-'
    }

    return String(value)
  }

  function formatDateTime(value: unknown) {
    if (value === undefined || value === null || value === '') {
      return '-'
    }

    const asDate =
      value instanceof Date
        ? value
        : new Date(typeof value === 'number' ? value : String(value))

    return Number.isNaN(asDate.getTime()) ? String(value) : dateFormatter.format(asDate)
  }

  function formatMoney(amountCents: number) {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY'
    }).format((Number(amountCents) || 0) / 100)
  }

  function getPlanAmount(plan: SaasPlanOption) {
    return Number(billingCycle.value === 'yearly' ? plan.price_yearly : plan.price_monthly) || 0
  }

  function formatPlanPrice(plan: SaasPlanOption) {
    const amount = getPlanAmount(plan)
    if (amount <= 0) {
      return '免费'
    }

    return `${formatMoney(amount)} / ${billingCycle.value === 'yearly' ? '年' : '月'}`
  }

  async function loadPageData() {
    loading.value = true
    errorMessage.value = ''

    try {
      const [subscriptionPayload, planPayload, alipayConfigPayload] = await Promise.all([
        fetchTenantSubscription(),
        fetchTenantPlans(),
        fetchAlipayConfigStatus()
      ])
      subscriptionInfo.value = normalizePayload<TenantSubscriptionSummary>(subscriptionPayload)
      plans.value = normalizePayload<SaasPlanOption[]>(planPayload) || []
      alipayConfigStatus.value = normalizePayload<AlipayConfigStatus>(alipayConfigPayload)
      await restoreLastOrder()
    } catch (error) {
      console.error('[SaasTenantPlanPage] load page data failed:', error)
      errorMessage.value = '加载套餐信息失败'
      subscriptionInfo.value = null
      alipayConfigStatus.value = null
      plans.value = []
    } finally {
      loading.value = false
    }
  }

  async function createOrder(plan: SaasPlanOption) {
    creatingPlanCode.value = plan.code

    try {
      currentOrder.value = await createTenantUpgradeOrder({
        plan_code: plan.code,
        billing_cycle: billingCycle.value,
        payment_method: 'alipay'
      })
      rememberOrder(currentOrder.value)
      ElMessage.success('升级订单已创建')
    } catch (error) {
      console.error('[SaasTenantPlanPage] create order failed:', error)
    } finally {
      creatingPlanCode.value = ''
    }
  }

  async function confirmDevPayment() {
    if (!currentOrder.value) return

    confirmingPayment.value = true

    try {
      stopPaymentPolling()
      currentOrder.value = await devConfirmTenantPayment(currentOrder.value.order_no)
      forgetRememberedOrder(currentOrder.value)
      ElMessage.success('本地模拟支付成功，套餐已更新')
      await loadPageData()
    } catch (error) {
      console.error('[SaasTenantPlanPage] confirm payment failed:', error)
    } finally {
      confirmingPayment.value = false
    }
  }

  async function startAlipayPayment() {
    if (!currentOrder.value) return

    creatingAlipayPayment.value = true

    try {
      const result = await createAlipayPayment(currentOrder.value.order_no)
      if (result.configured && result.pay_url) {
        rememberOrder(currentOrder.value)
        window.open(result.pay_url, '_blank', 'noopener,noreferrer')
        startPaymentPolling()
        ElMessage.success('支付宝支付页面已打开')
        return
      }

      ElMessage.warning(result.message || '支付宝沙箱配置未完成')
    } catch (error) {
      console.error('[SaasTenantPlanPage] create alipay payment failed:', error)
    } finally {
      creatingAlipayPayment.value = false
    }
  }

  async function restoreLastOrder() {
    const orderNo = currentOrder.value?.order_no || sessionStorage.getItem(LAST_UPGRADE_ORDER_KEY)
    if (!orderNo) return

    try {
      const order = await fetchTenantOrder(orderNo)
      currentOrder.value = order
      forgetRememberedOrder(order)
      if (order.status !== 'paid' && alipayConfigStatus.value?.configured) {
        startPaymentPolling()
      }
    } catch (error) {
      sessionStorage.removeItem(LAST_UPGRADE_ORDER_KEY)
      console.error('[SaasTenantPlanPage] restore last order failed:', error)
    }
  }

  function rememberOrder(order: SaasOrderRecord | null) {
    if (!order?.order_no || order.status === 'paid') return
    sessionStorage.setItem(LAST_UPGRADE_ORDER_KEY, order.order_no)
  }

  function forgetRememberedOrder(order: SaasOrderRecord | null) {
    if (order?.status === 'paid') {
      sessionStorage.removeItem(LAST_UPGRADE_ORDER_KEY)
    }
  }

  function startPaymentPolling() {
    if (!currentOrder.value || currentOrder.value.status === 'paid' || paymentPollingTimer) return

    pollingPayment.value = true
    paymentPollingStartedAt = Date.now()
    paymentPollingTimer = window.setInterval(() => {
      pollPaymentStatus()
    }, PAYMENT_POLL_INTERVAL_MS)
  }

  function stopPaymentPolling() {
    if (paymentPollingTimer) {
      window.clearInterval(paymentPollingTimer)
      paymentPollingTimer = undefined
    }
    pollingPayment.value = false
    paymentPollingStartedAt = 0
  }

  async function pollPaymentStatus() {
    const orderNo = currentOrder.value?.order_no
    if (!orderNo) {
      stopPaymentPolling()
      return
    }

    if (Date.now() - paymentPollingStartedAt > PAYMENT_POLL_TIMEOUT_MS) {
      stopPaymentPolling()
      return
    }

    try {
      const order = await fetchTenantOrder(orderNo)
      currentOrder.value = order

      if (order.status === 'paid') {
        stopPaymentPolling()
        forgetRememberedOrder(order)
        ElMessage.success('支付成功，套餐已更新')
        await loadPageData()
      }
    } catch (error) {
      console.error('[SaasTenantPlanPage] poll payment status failed:', error)
    }
  }

  onMounted(() => {
    loadPageData()
  })

  onBeforeUnmount(() => {
    stopPaymentPolling()
  })
</script>

<style scoped>
  .tenant-plan-page {
    display: grid;
    align-content: start;
    gap: 20px;
  }

  .tenant-plan-page__header,
  .tenant-plan-page__toolbar,
  .tenant-plan-page__order {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .tenant-plan-page__title,
  .tenant-plan-page__section-title,
  .tenant-plan-page__plan-title-row h3 {
    margin: 0;
    line-height: 1.4;
    letter-spacing: 0;
  }

  .tenant-plan-page__title {
    font-size: 20px;
    font-weight: 600;
  }

  .tenant-plan-page__subtitle,
  .tenant-plan-page__plan-code,
  .tenant-plan-page__order-meta,
  .tenant-plan-page__payment-note {
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.5;
  }

  .tenant-plan-page__subtitle,
  .tenant-plan-page__plan-code,
  .tenant-plan-page__order-meta,
  .tenant-plan-page__payment-note {
    margin: 6px 0 0;
  }

  .tenant-plan-page__summary,
  .tenant-plan-page__plans,
  .tenant-plan-page__order {
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
    background: var(--el-bg-color);
    padding: 20px;
  }

  .tenant-plan-page__plans {
    display: grid;
    gap: 16px;
  }

  .tenant-plan-page__section-title {
    font-size: 16px;
    font-weight: 600;
  }

  .tenant-plan-page__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
  }

  .tenant-plan-page__plan-card {
    display: grid;
    gap: 18px;
    min-height: 190px;
    border: 1px solid var(--el-border-color);
    border-radius: 8px;
    padding: 18px;
  }

  .tenant-plan-page__plan-main {
    display: grid;
    align-content: start;
    gap: 8px;
  }

  .tenant-plan-page__plan-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .tenant-plan-page__plan-title-row h3 {
    font-size: 17px;
    font-weight: 600;
  }

  .tenant-plan-page__plan-price {
    margin: 4px 0 0;
    font-size: 26px;
    font-weight: 700;
    line-height: 1.25;
    letter-spacing: 0;
  }

  .tenant-plan-page__state {
    padding: 24px 0;
  }

  .tenant-plan-page__order-actions {
    display: grid;
    justify-items: end;
    gap: 8px;
  }

  .tenant-plan-page__payment-status {
    display: flex;
    max-width: 360px;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    color: var(--el-text-color-secondary);
    font-size: 12px;
    line-height: 1.5;
    text-align: right;
  }

  @media (max-width: 768px) {
    .tenant-plan-page__header,
    .tenant-plan-page__toolbar,
    .tenant-plan-page__order {
      display: grid;
    }

    .tenant-plan-page__order-actions {
      justify-items: start;
    }

    .tenant-plan-page__payment-status {
      justify-content: flex-start;
      text-align: left;
    }
  }
</style>
