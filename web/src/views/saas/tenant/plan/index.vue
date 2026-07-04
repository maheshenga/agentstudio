<template>
  <div class="art-full-height p-5 tenant-plan-page">
    <section class="tenant-plan-page__header">
      <div>
        <h1 class="tenant-plan-page__title">租户套餐</h1>
        <p class="tenant-plan-page__subtitle">查看当前订阅，选择可用套餐并完成支付。</p>
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
          <ElDescriptionsItem label="订阅结束时间">{{ subscriptionEndTimeText }}</ElDescriptionsItem>
          <ElDescriptionsItem label="剩余时间">
            <ElTag :type="renewalState.type" effect="light">{{ renewalState.text }}</ElTag>
          </ElDescriptionsItem>
          <ElDescriptionsItem label="订阅状态">
            <ElTag :type="subscriptionTagType" effect="light">{{ subscriptionStatusText }}</ElTag>
          </ElDescriptionsItem>
        </ElDescriptions>
      </section>

      <section class="tenant-plan-page__plans">
        <div class="tenant-plan-page__toolbar">
          <h2 class="tenant-plan-page__section-title">可用套餐</h2>
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
                <ElTag v-else-if="plan.code === 'free'" type="info" effect="light">默认</ElTag>
              </div>
              <p class="tenant-plan-page__plan-code">{{ plan.code }}</p>
              <p class="tenant-plan-page__plan-price">{{ formatPlanPrice(plan) }}</p>
              <ul v-if="plan.quotas?.length" class="tenant-plan-page__quota-list">
                <li v-for="quota in plan.quotas" :key="quota.quota_type">{{ formatQuotaItem(quota) }}</li>
              </ul>
            </div>
            <ElButton
              type="primary"
              :disabled="isPlanOrderDisabled(plan)"
              :loading="creatingPlanCode === plan.code"
              @click="createOrder(plan)"
            >
              {{ getPlanButtonText(plan) }}
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
          <ElTag :type="currentOrderStatusTagType" effect="light">
            {{ currentOrderStatusText }}
          </ElTag>
          <ElTag v-if="isCurrentOrderPaymentRequested" type="warning" effect="light">
            已发起支付
          </ElTag>
          <p v-if="hasPaymentRequestedAt(currentOrder.payment_requested_at)" class="tenant-plan-page__order-meta">
            发起支付时间：{{ formatDateTime(currentOrder.payment_requested_at) }}
          </p>
          <p v-if="currentOrder.status === 'closed'" class="tenant-plan-page__order-meta">
            {{ formatCloseReason(currentOrder.close_reason) }} · {{ formatDateTime(currentOrder.closed_at) }}
          </p>
        </div>
        <div class="tenant-plan-page__order-actions">
          <div v-if="alipayConfigStatus" class="tenant-plan-page__payment-status">
            <ElTag :type="alipayConfigStatus.configured ? 'success' : 'warning'" effect="light">
              {{ alipayConfigStatus.configured ? '支付宝已配置' : '支付宝未配置' }}
            </ElTag>
            <span v-if="pollingPayment">正在同步支付结果...</span>
            <span v-if="!alipayConfigStatus.configured">{{ alipayMissingKeysText }}</span>
          </div>
          <ElButton type="primary" :disabled="!isCurrentOrderPayable" :loading="creatingAlipayPayment" @click="startAlipayPayment">
            去支付宝支付
          </ElButton>
          <ElButton type="success" :disabled="!isCurrentOrderPayable" :loading="confirmingPayment" @click="confirmDevPayment">
            本地模拟支付成功
          </ElButton>
        </div>
      </section>

      <section class="tenant-plan-page__orders">
        <div class="tenant-plan-page__section-header">
          <div>
            <h2 class="tenant-plan-page__section-title">套餐订单记录</h2>
            <p class="tenant-plan-page__order-meta">查看历史升级、支付和关闭状态。</p>
          </div>
          <ElButton :loading="orderHistoryLoading" @click="loadOrderHistory">刷新</ElButton>
        </div>

        <ElTable v-loading="orderHistoryLoading" :data="orderHistory" border>
          <ElTableColumn prop="order_no" label="订单号" min-width="230" show-overflow-tooltip />
          <ElTableColumn prop="plan_code" label="套餐" width="140" show-overflow-tooltip />
          <ElTableColumn label="金额" width="130">
            <template #default="{ row }">{{ formatMoney(row.amount_cents) }}</template>
          </ElTableColumn>
          <ElTableColumn label="状态" width="110">
            <template #default="{ row }">
              <ElTag :type="getOrderStatusTagType(row.status)" effect="light">
                {{ formatOrderStatus(row.status) }}
              </ElTag>
              <ElTag v-if="isPaymentRequestedPendingOrder(row)" class="tenant-plan-page__inline-tag" type="warning" effect="light">
                已发起支付
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn label="发起支付时间" min-width="180">
            <template #default="{ row }">{{ formatDateTime(row.payment_requested_at) }}</template>
          </ElTableColumn>
          <ElTableColumn label="关闭原因" min-width="130">
            <template #default="{ row }">{{ formatCloseReason(row.close_reason) }}</template>
          </ElTableColumn>
          <ElTableColumn label="创建时间" min-width="180">
            <template #default="{ row }">{{ formatDateTime(row.create_time) }}</template>
          </ElTableColumn>
          <ElTableColumn label="关闭时间" min-width="180">
            <template #default="{ row }">{{ formatDateTime(row.closed_at) }}</template>
          </ElTableColumn>
          <ElTableColumn label="操作" width="180" fixed="right">
            <template #default="{ row }">
              <ElButton v-if="row.status === 'pending'" type="primary" link @click="resumePlanOrderPayment(row)">
                继续支付
              </ElButton>
              <ElButton
                v-if="row.status === 'pending' && !isPaymentRequestedPendingOrder(row)"
                type="danger"
                link
                :disabled="cancellingOrderNo === row.order_no"
                :loading="cancellingOrderNo === row.order_no"
                @click="cancelPlanOrder(row)"
              >
                取消
              </ElButton>
            </template>
          </ElTableColumn>
        </ElTable>

        <ElPagination
          v-model:current-page="orderPager.page"
          v-model:page-size="orderPager.limit"
          class="tenant-plan-page__pagination"
          layout="total, sizes, prev, pager, next"
          :page-sizes="[10, 20, 50]"
          :total="orderPager.total"
          @current-change="loadOrderHistory"
          @size-change="handleOrderHistorySizeChange"
        />
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import {
    cancelTenantSaasOrder,
    createAlipayPayment,
    createTenantUpgradeOrder,
    devConfirmTenantPayment,
    fetchAlipayConfigStatus,
    fetchTenantOrder,
    fetchTenantPlans,
    fetchTenantSaasOrders,
    fetchTenantSubscription,
    type AlipayConfigStatus,
    type SaasOrderRecord,
    type SaasPlatformOrderRecord,
    type SaasPlanOption,
    type SaasPlanQuotaRecord,
    type TenantSubscriptionSummary
  } from '@/api/saas'
  import { hasPaymentRequestedAt, isPaymentRequestedPendingOrder } from '@/utils/saas/payment-request-state'

  defineOptions({ name: 'SaasTenantPlanPage' })

  const LAST_UPGRADE_ORDER_KEY = 'saas:last-upgrade-order-no'
  const PAYMENT_POLL_INTERVAL_MS = 5000
  const PAYMENT_POLL_TIMEOUT_MS = 120000

  const subscriptionInfo = ref<TenantSubscriptionSummary | null>(null)
  const alipayConfigStatus = ref<AlipayConfigStatus | null>(null)
  const plans = ref<SaasPlanOption[]>([])
  const currentOrder = ref<SaasOrderRecord | SaasPlatformOrderRecord | null>(null)
  const billingCycle = ref<'monthly' | 'yearly'>('yearly')
  const loading = ref(false)
  const creatingPlanCode = ref('')
  const creatingAlipayPayment = ref(false)
  const confirmingPayment = ref(false)
  const pollingPayment = ref(false)
  const cancellingOrderNo = ref('')
  const orderHistory = ref<SaasPlatformOrderRecord[]>([])
  const orderHistoryLoading = ref(false)
  const orderPager = reactive({
    page: 1,
    limit: 10,
    total: 0
  })
  const errorMessage = ref('')
  let paymentPollingTimer: number | undefined
  let paymentPollingStartedAt = 0

  const dateFormatter = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

  const currentPlanCode = computed(() => formatText(pickValue(subscriptionInfo.value, ['current_plan', 'currentPlan'])))
  const currentPlanText = computed(() => formatText(pickValue(subscriptionInfo.value, ['plan_name', 'planName', 'current_plan', 'currentPlan'])))
  const trialEndTimeText = computed(() => formatDateTime(pickValue(subscriptionInfo.value, ['trial_end_time', 'trialEndTime', 'trial_end_at', 'trialEndAt'])))
  const subscriptionEndTimeText = computed(() => formatDateTime(pickValue(subscriptionInfo.value, ['end_time', 'endTime'])))
  const daysUntilExpiry = computed(() => {
    const value = pickValue(subscriptionInfo.value, ['days_until_expiry', 'daysUntilExpiry'])
    if (value === undefined) return null
    const days = Number(value)
    return Number.isFinite(days) ? days : null
  })
  const isExpiringSoon = computed(() => Boolean(pickValue(subscriptionInfo.value, ['is_expiring_soon', 'isExpiringSoon'])))
  const isExpiredByTime = computed(() => Boolean(pickValue(subscriptionInfo.value, ['is_expired_by_time', 'isExpiredByTime'])))
  const normalizedSubscriptionStatus = computed(() => String(pickValue(subscriptionInfo.value, ['subscription_status', 'subscriptionStatus', 'status']) ?? '').trim().toLowerCase())
  const isExpiredSubscription = computed(() => isExpiredByTime.value || normalizedSubscriptionStatus.value === 'expired')
  const subscriptionStatus = computed(() => {
    const rawStatus = pickValue(subscriptionInfo.value, ['subscription_status', 'subscriptionStatus', 'status'])
    const normalized = normalizedSubscriptionStatus.value
    if (!normalized) return { text: '-', type: 'info' as const }
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
    return statusMap[normalized] ?? { text: formatText(rawStatus), type: 'info' }
  })
  const subscriptionStatusText = computed(() => subscriptionStatus.value.text)
  const subscriptionTagType = computed(() => subscriptionStatus.value.type)
  const renewalState = computed(() => {
    if (isExpiredSubscription.value) {
      return { type: 'danger' as const, text: '订阅已过期，请续费或升级套餐' }
    }
    if (isExpiringSoon.value) {
      return { type: 'warning' as const, text: `订阅即将到期，剩余时间：${formatRemainingDays(daysUntilExpiry.value)}` }
    }
    return { type: 'success' as const, text: `订阅正常，剩余时间：${formatRemainingDays(daysUntilExpiry.value)}` }
  })
  const alipayMissingKeysText = computed(() => {
    const missingKeys = alipayConfigStatus.value?.missing_keys || []
    return missingKeys.length ? `缺少：${missingKeys.join('、')}` : ''
  })
  const isCurrentOrderPayable = computed(() => currentOrder.value?.status === 'pending')
  const isCurrentOrderPaymentRequested = computed(() => isPaymentRequestedPendingOrder(currentOrder.value))
  const currentOrderStatusText = computed(() => formatOrderStatus(currentOrder.value?.status || ''))
  const currentOrderStatusTagType = computed(() => getOrderStatusTagType(currentOrder.value?.status || ''))

  function pickValue(source: Record<string, any> | null, keys: string[]) {
    if (!source) return undefined
    for (const key of keys) {
      const value = source[key]
      if (value !== undefined && value !== null && value !== '') return value
    }
    return undefined
  }

  function normalizePayload<T>(payload: any): T | null {
    if (!payload) return null
    if (typeof payload === 'object' && 'data' in payload && payload.data) return payload.data
    return payload
  }

  function formatText(value: unknown) {
    return value === undefined || value === null || value === '' ? '-' : String(value)
  }

  function formatDateTime(value: unknown) {
    if (value === undefined || value === null || value === '') return '-'
    const asDate = value instanceof Date ? value : new Date(typeof value === 'number' ? value : String(value))
    return Number.isNaN(asDate.getTime()) ? String(value) : dateFormatter.format(asDate)
  }

  function formatRemainingDays(value: number | null) {
    if (value === null) return '-'
    if (value < 0) return `已过期 ${Math.abs(value)} 天`
    if (value === 0) return '今天到期'
    return `${value} 天`
  }

  function formatMoney(amountCents: number) {
    return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format((Number(amountCents) || 0) / 100)
  }

  function getPlanAmount(plan: SaasPlanOption) {
    return Number(billingCycle.value === 'yearly' ? plan.price_yearly : plan.price_monthly) || 0
  }

  function formatPlanPrice(plan: SaasPlanOption) {
    const amount = getPlanAmount(plan)
    if (amount <= 0) return '免费'
    return `${formatMoney(amount)} / ${billingCycle.value === 'yearly' ? '年' : '月'}`
  }

  function formatQuotaItem(item: SaasPlanQuotaRecord) {
    const amount = new Intl.NumberFormat('zh-CN').format(Number(item.total_quota) || 0)
    const labels: Record<string, string> = { users: '用户', storage_mb: '存储 MB', ai_calls: 'AI 调用', rag_documents: '知识库文档', tokens: 'Token' }
    return `${labels[item.quota_type] || item.quota_type}: ${amount}`
  }

  function isCurrentPlanRenewable(plan: SaasPlanOption) {
    return plan.code === currentPlanCode.value && plan.code !== 'free' && getPlanAmount(plan) > 0 && (isExpiringSoon.value || isExpiredSubscription.value)
  }

  function isPlanOrderDisabled(plan: SaasPlanOption) {
    if (isCurrentPlanRenewable(plan)) return false
    return plan.code === currentPlanCode.value || plan.code === 'free' || getPlanAmount(plan) <= 0
  }

  function getPlanButtonText(plan: SaasPlanOption) {
    if (isCurrentPlanRenewable(plan)) return '续费当前套餐'
    if (plan.code === currentPlanCode.value) return '当前套餐'
    if (plan.code === 'free') return '默认套餐'
    if (getPlanAmount(plan) <= 0) return '不可购买'
    return '创建升级订单'
  }

  async function loadPageData() {
    loading.value = true
    errorMessage.value = ''
    try {
      const [subscriptionPayload, planPayload, alipayConfigPayload] = await Promise.all([fetchTenantSubscription(), fetchTenantPlans(), fetchAlipayConfigStatus()])
      subscriptionInfo.value = normalizePayload<TenantSubscriptionSummary>(subscriptionPayload)
      plans.value = normalizePayload<SaasPlanOption[]>(planPayload) || []
      alipayConfigStatus.value = normalizePayload<AlipayConfigStatus>(alipayConfigPayload)
      await restoreLastOrder()
      await loadOrderHistory()
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
    if (isPlanOrderDisabled(plan)) return
    creatingPlanCode.value = plan.code
    try {
      currentOrder.value = await createTenantUpgradeOrder({ plan_code: plan.code, billing_cycle: billingCycle.value, payment_method: 'alipay' })
      rememberOrder(currentOrder.value)
      await loadOrderHistory()
      ElMessage.success('升级订单已创建')
    } catch (error) {
      console.error('[SaasTenantPlanPage] create order failed:', error)
    } finally {
      creatingPlanCode.value = ''
    }
  }

  async function confirmDevPayment() {
    const order = currentOrder.value
    if (!order || order.status !== 'pending') return
    confirmingPayment.value = true
    try {
      stopPaymentPolling()
      currentOrder.value = await devConfirmTenantPayment(order.order_no)
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
    if (!isCurrentOrderPayable.value || !currentOrder.value) return
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
      ElMessage.warning(result.message || '支付宝配置未完成')
    } catch (error) {
      console.error('[SaasTenantPlanPage] create alipay payment failed:', error)
    } finally {
      creatingAlipayPayment.value = false
    }
  }

  async function loadOrderHistory() {
    orderHistoryLoading.value = true
    try {
      const result = await fetchTenantSaasOrders({
        page: orderPager.page,
        limit: orderPager.limit
      })
      orderHistory.value = result.list || []
      orderPager.total = Number(result.total) || 0
    } catch (error) {
      console.error('[SaasTenantPlanPage] load order history failed:', error)
      orderHistory.value = []
      orderPager.total = 0
      ElMessage.error('加载订单记录失败')
    } finally {
      orderHistoryLoading.value = false
    }
  }

  function handleOrderHistorySizeChange() {
    orderPager.page = 1
    loadOrderHistory()
  }

  async function resumePlanOrderPayment(order: SaasPlatformOrderRecord) {
    currentOrder.value = order
    if (order.status === 'closed') {
      stopPaymentPolling()
      forgetRememberedOrder(order)
      return
    }
    await startAlipayPayment()
  }

  async function cancelPlanOrder(order: SaasPlatformOrderRecord) {
    if (order.status !== 'pending' || cancellingOrderNo.value) return
    cancellingOrderNo.value = order.order_no
    try {
      await cancelTenantSaasOrder(order.order_no)
      if (currentOrder.value?.order_no === order.order_no) {
        stopPaymentPolling()
        currentOrder.value = { ...currentOrder.value, status: 'closed', close_reason: 'tenant_cancelled', closed_at: new Date() }
        sessionStorage.removeItem(LAST_UPGRADE_ORDER_KEY)
      }
      ElMessage.success('订单已取消')
      await loadOrderHistory()
    } catch (error) {
      console.error('[SaasTenantPlanPage] cancel order failed:', error)
    } finally {
      cancellingOrderNo.value = ''
    }
  }

  async function restoreLastOrder() {
    const orderNo = currentOrder.value?.order_no || sessionStorage.getItem(LAST_UPGRADE_ORDER_KEY)
    if (!orderNo) return
    try {
      const order = await fetchTenantOrder(orderNo)
      currentOrder.value = order
      forgetRememberedOrder(order)
      if (order.status === 'closed') {
        stopPaymentPolling()
        sessionStorage.removeItem(LAST_UPGRADE_ORDER_KEY)
        return
      }
      if (order.status === 'pending' && alipayConfigStatus.value?.configured) startPaymentPolling()
    } catch (error) {
      sessionStorage.removeItem(LAST_UPGRADE_ORDER_KEY)
      console.error('[SaasTenantPlanPage] restore last order failed:', error)
    }
  }

  function rememberOrder(order: SaasOrderRecord | SaasPlatformOrderRecord | null) {
    if (!order?.order_no || order.status !== 'pending') return
    sessionStorage.setItem(LAST_UPGRADE_ORDER_KEY, order.order_no)
  }

  function forgetRememberedOrder(order: SaasOrderRecord | SaasPlatformOrderRecord | null) {
    if (order?.status === 'paid' || order?.status === 'closed') sessionStorage.removeItem(LAST_UPGRADE_ORDER_KEY)
  }

  function startPaymentPolling() {
    if (!isCurrentOrderPayable.value || paymentPollingTimer) return
    pollingPayment.value = true
    paymentPollingStartedAt = Date.now()
    paymentPollingTimer = window.setInterval(() => pollPaymentStatus(), PAYMENT_POLL_INTERVAL_MS)
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
    if (!orderNo) return stopPaymentPolling()
    if (Date.now() - paymentPollingStartedAt > PAYMENT_POLL_TIMEOUT_MS) return stopPaymentPolling()
    try {
      const order = await fetchTenantOrder(orderNo)
      currentOrder.value = order
      if (order.status === 'paid') {
        stopPaymentPolling()
        forgetRememberedOrder(order)
        ElMessage.success('支付成功，套餐已更新')
        await loadPageData()
        return
      }
      if (order.status === 'closed') {
        stopPaymentPolling()
        forgetRememberedOrder(order)
        await loadOrderHistory()
      }
    } catch (error) {
      console.error('[SaasTenantPlanPage] poll payment status failed:', error)
    }
  }

  function formatOrderStatus(status: string) {
    const labels: Record<string, string> = {
      pending: '待支付',
      paid: '已支付',
      closed: '已关闭'
    }
    return labels[status] || status
  }

  function getOrderStatusTagType(status: string) {
    if (status === 'paid') return 'success'
    if (status === 'pending') return 'warning'
    if (status === 'closed') return 'info'
    return 'info'
  }

  function formatCloseReason(value: unknown) {
    const labels: Record<string, string> = {
      timeout: '超时关闭',
      tenant_cancelled: '租户取消'
    }
    if (!value) return '-'
    const normalized = String(value)
    return labels[normalized] || normalized
  }

  onMounted(() => loadPageData())
  onBeforeUnmount(() => stopPaymentPolling())
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
  .tenant-plan-page__order-meta {
    margin: 6px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.5;
  }

  .tenant-plan-page__summary,
  .tenant-plan-page__plans,
  .tenant-plan-page__order,
  .tenant-plan-page__orders {
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
    background: var(--el-bg-color);
    padding: 20px;
  }

  .tenant-plan-page__plans,
  .tenant-plan-page__plan-main,
  .tenant-plan-page__orders {
    display: grid;
    gap: 16px;
  }

  .tenant-plan-page__section-header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .tenant-plan-page__pagination {
    justify-content: flex-end;
  }

  .tenant-plan-page__section-title {
    font-size: 16px;
    font-weight: 600;
  }

  .tenant-plan-page__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 16px;
  }

  .tenant-plan-page__plan-card {
    display: grid;
    gap: 18px;
    min-height: 230px;
    border: 1px solid var(--el-border-color);
    border-radius: 8px;
    padding: 18px;
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
    font-size: 24px;
    font-weight: 700;
    line-height: 1.25;
    letter-spacing: 0;
  }

  .tenant-plan-page__quota-list {
    display: grid;
    gap: 6px;
    margin: 4px 0 0;
    padding-left: 18px;
    color: var(--el-text-color-regular);
    font-size: 13px;
    line-height: 1.5;
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

  .tenant-plan-page__inline-tag {
    margin-left: 6px;
  }

  @media (max-width: 768px) {
    .tenant-plan-page__header,
    .tenant-plan-page__toolbar,
    .tenant-plan-page__order {
      display: grid;
    }

    .tenant-plan-page__order-actions,
    .tenant-plan-page__payment-status {
      justify-items: start;
      justify-content: flex-start;
      text-align: left;
    }
  }
</style>
