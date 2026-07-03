<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="saas-platform-page">
      <template #header>
        <div class="saas-platform-page__header">
          <div>
            <h1 class="saas-platform-page__title">SaaS 订阅运营</h1>
            <p class="saas-platform-page__subtitle">查看租户订阅、升级订单和支付状态。</p>
          </div>
          <ElButton :loading="loading" @click="refreshCurrentTab">刷新</ElButton>
        </div>
      </template>

      <div class="saas-platform-page__lifecycle-summary">
        <div class="saas-platform-page__summary-item">
          <span>正常订阅</span>
          <strong>{{ lifecycleOverview.active_count }}</strong>
        </div>
        <div class="saas-platform-page__summary-item">
          <span>7 天内到期</span>
          <strong>{{ lifecycleOverview.expiring_7_days_count }}</strong>
        </div>
        <div class="saas-platform-page__summary-item">
          <span>30 天内到期</span>
          <strong>{{ lifecycleOverview.expiring_30_days_count }}</strong>
        </div>
        <div class="saas-platform-page__summary-item">
          <span>已过期</span>
          <strong>{{ lifecycleOverview.expired_count }}</strong>
        </div>
      </div>

      <div class="saas-platform-page__filters">
        <ElInput v-model="filters.tenant_id" class="saas-platform-page__filter-item" clearable placeholder="租户 ID" @keyup.enter="refreshCurrentTab" />
        <ElInput v-model="filters.plan_id" class="saas-platform-page__filter-item" clearable placeholder="套餐 ID" @keyup.enter="refreshCurrentTab" />
        <ElInput v-model="filters.plan_code" class="saas-platform-page__filter-item" clearable placeholder="套餐编码" @keyup.enter="refreshCurrentTab" />
        <ElInput v-if="activeTab === 'orders'" v-model="filters.order_no" class="saas-platform-page__order-input" clearable placeholder="订单号" @keyup.enter="refreshCurrentTab" />
        <ElSelect v-model="filters.status" class="saas-platform-page__filter-item" clearable placeholder="状态" @change="handleStatusFilterChange">
          <ElOption v-for="status in statusOptions" :key="status" :label="status" :value="status" />
        </ElSelect>
        <ElButton type="primary" :loading="loading" @click="refreshCurrentTab">查询</ElButton>
        <ElButton @click="resetFilters">重置</ElButton>
      </div>

      <ElSegmented
        v-model="lifecycleFilter"
        class="saas-platform-page__lifecycle-filter"
        :options="[
          { label: '全部', value: 'all' },
          { label: '正常', value: 'active' },
          { label: '即将到期', value: 'expiring' },
          { label: '已过期', value: 'expired' }
        ]"
        @change="refreshCurrentTab"
      />

      <ElTabs v-model="activeTab" @tab-change="handleTabChange">
        <ElTabPane label="订阅" name="subscriptions">
          <ElTable v-loading="loading && activeTab === 'subscriptions'" :data="subscriptions" border>
            <ElTableColumn prop="tenant_id" label="租户 ID" width="110" />
            <ElTableColumn prop="plan_id" label="套餐 ID" width="110" />
            <ElTableColumn prop="billing_cycle" label="周期" width="110" />
            <ElTableColumn prop="status" label="状态" width="120">
              <template #default="{ row }">
                <ElTag :type="getStatusTagType(row.status)" effect="light">{{ row.status }}</ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn label="开始时间" min-width="180">
              <template #default="{ row }">{{ formatDateTime(row.start_time) }}</template>
            </ElTableColumn>
            <ElTableColumn label="结束时间" min-width="180">
              <template #default="{ row }">{{ formatDateTime(row.end_time) }}</template>
            </ElTableColumn>
            <ElTableColumn label="剩余天数" width="120">
              <template #default="{ row }">{{ formatRemainingDays(row.days_until_expiry) }}</template>
            </ElTableColumn>
            <ElTableColumn label="生命周期" width="130">
              <template #default="{ row }">
                <ElTag :type="getLifecycleTagType(row)" effect="light">{{ getLifecycleText(row) }}</ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn prop="remark" label="备注" min-width="220" show-overflow-tooltip />
            <ElTableColumn label="操作" fixed="right" width="100">
              <template #default="{ row }">
                <ElButton link type="primary" @click="openSubscriptionDetail(row)">详情</ElButton>
              </template>
            </ElTableColumn>
          </ElTable>
          <ElPagination
            v-model:current-page="subscriptionPager.page"
            v-model:page-size="subscriptionPager.limit"
            class="saas-platform-page__pagination"
            layout="total, sizes, prev, pager, next"
            :page-sizes="[10, 20, 50, 100]"
            :total="subscriptionPager.total"
            @current-change="loadSubscriptions"
            @size-change="handleSubscriptionSizeChange"
          />
        </ElTabPane>

        <ElTabPane label="订单" name="orders">
          <div class="saas-platform-page__order-risk-summary">
            <div class="saas-platform-page__summary-item">
              <span>待支付套餐订单</span>
              <strong>{{ orderRiskOverview.pending_plan_orders }}</strong>
            </div>
            <div class="saas-platform-page__summary-item">
              <span>7 天超时关闭套餐订单</span>
              <strong>{{ orderRiskOverview.timeout_closed_plan_orders_7d }}</strong>
            </div>
            <div class="saas-platform-page__summary-item">
              <span>7 天租户取消套餐订单</span>
              <strong>{{ orderRiskOverview.tenant_cancelled_plan_orders_7d }}</strong>
            </div>
          </div>

          <ElSegmented
            v-model="orderRiskFilter"
            class="saas-platform-page__order-risk-filter"
            :options="[
              { label: '全部', value: 'all' },
              { label: '待支付', value: 'pending' },
              { label: '超时关闭', value: 'timeout' },
              { label: '租户取消', value: 'tenant_cancelled' }
            ]"
            @change="handleOrderRiskFilterChange"
          />

          <ElTable v-loading="loading && activeTab === 'orders'" :data="orders" border>
            <ElTableColumn prop="order_no" label="订单号" min-width="230" show-overflow-tooltip />
            <ElTableColumn prop="tenant_id" label="租户 ID" width="110" />
            <ElTableColumn prop="plan_code" label="套餐" width="120" />
            <ElTableColumn label="金额" width="130">
              <template #default="{ row }">{{ formatMoney(row.amount_cents) }}</template>
            </ElTableColumn>
            <ElTableColumn prop="payment_method" label="支付方式" width="120" />
            <ElTableColumn prop="status" label="状态" width="120">
              <template #default="{ row }">
                <ElTag :type="getStatusTagType(row.status)" effect="light">{{ row.status }}</ElTag>
                <ElTag v-if="isPaymentRequestedPendingOrder(row)" class="saas-platform-page__inline-tag" type="warning" effect="light">
                  已发起支付
                </ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn prop="alipay_trade_no" label="支付宝交易号" min-width="210" show-overflow-tooltip />
            <ElTableColumn label="发起支付时间" min-width="180">
              <template #default="{ row }">{{ formatDateTime(row.payment_requested_at) }}</template>
            </ElTableColumn>
            <ElTableColumn label="支付时间" min-width="180">
              <template #default="{ row }">{{ formatDateTime(row.paid_at) }}</template>
            </ElTableColumn>
            <ElTableColumn label="关闭原因" min-width="130">
              <template #default="{ row }">{{ formatCloseReason(row.close_reason) }}</template>
            </ElTableColumn>
            <ElTableColumn label="关闭时间" min-width="180">
              <template #default="{ row }">{{ formatDateTime(row.closed_at) }}</template>
            </ElTableColumn>
            <ElTableColumn label="操作" fixed="right" width="100">
              <template #default="{ row }">
                <ElButton link type="primary" @click="openOrderDetail(row)">详情</ElButton>
              </template>
            </ElTableColumn>
          </ElTable>
          <ElPagination
            v-model:current-page="orderPager.page"
            v-model:page-size="orderPager.limit"
            class="saas-platform-page__pagination"
            layout="total, sizes, prev, pager, next"
            :page-sizes="[10, 20, 50, 100]"
            :total="orderPager.total"
            @current-change="loadOrders"
            @size-change="handleOrderSizeChange"
          />
        </ElTabPane>
      </ElTabs>
    </ElCard>

    <ElDrawer v-model="orderDetailVisible" title="订单详情" size="520px">
      <ElSkeleton v-if="detailLoading" animated :rows="8" />
      <ElDescriptions v-else-if="currentOrderDetail" :column="1" border>
        <ElDescriptionsItem label="订单号">{{ currentOrderDetail.order_no }}</ElDescriptionsItem>
        <ElDescriptionsItem label="租户 ID">{{ currentOrderDetail.tenant_id }}</ElDescriptionsItem>
        <ElDescriptionsItem label="套餐">{{ currentOrderDetail.plan_code }} / {{ currentOrderDetail.plan_id }}</ElDescriptionsItem>
        <ElDescriptionsItem label="周期">{{ currentOrderDetail.billing_cycle }}</ElDescriptionsItem>
        <ElDescriptionsItem label="金额">{{ formatMoney(currentOrderDetail.amount_cents) }}</ElDescriptionsItem>
        <ElDescriptionsItem label="状态">
          <ElTag :type="getStatusTagType(currentOrderDetail.status)" effect="light">{{ currentOrderDetail.status }}</ElTag>
          <ElTag v-if="isPaymentRequestedPendingOrder(currentOrderDetail)" class="saas-platform-page__inline-tag" type="warning" effect="light">
            已发起支付
          </ElTag>
        </ElDescriptionsItem>
        <ElDescriptionsItem label="支付方式">{{ currentOrderDetail.payment_method || '-' }}</ElDescriptionsItem>
        <ElDescriptionsItem label="支付宝交易号">{{ currentOrderDetail.alipay_trade_no || '-' }}</ElDescriptionsItem>
        <ElDescriptionsItem label="发起支付时间">{{ formatDateTime(currentOrderDetail.payment_requested_at) }}</ElDescriptionsItem>
        <ElDescriptionsItem label="支付时间">{{ formatDateTime(currentOrderDetail.paid_at) }}</ElDescriptionsItem>
        <ElDescriptionsItem label="关闭原因">{{ formatCloseReason(currentOrderDetail.close_reason) }}</ElDescriptionsItem>
        <ElDescriptionsItem label="关闭时间">{{ formatDateTime(currentOrderDetail.closed_at) }}</ElDescriptionsItem>
        <ElDescriptionsItem label="创建时间">{{ formatDateTime(currentOrderDetail.create_time) }}</ElDescriptionsItem>
      </ElDescriptions>
      <ElEmpty v-else description="未找到订单" />
    </ElDrawer>

    <ElDrawer v-model="subscriptionDetailVisible" title="订阅详情" size="520px">
      <ElSkeleton v-if="detailLoading" animated :rows="8" />
      <ElDescriptions v-else-if="currentSubscriptionDetail" :column="1" border>
        <ElDescriptionsItem label="订阅 ID">{{ currentSubscriptionDetail.id }}</ElDescriptionsItem>
        <ElDescriptionsItem label="租户 ID">{{ currentSubscriptionDetail.tenant_id }}</ElDescriptionsItem>
        <ElDescriptionsItem label="套餐 ID">{{ currentSubscriptionDetail.plan_id }}</ElDescriptionsItem>
        <ElDescriptionsItem label="周期">{{ currentSubscriptionDetail.billing_cycle }}</ElDescriptionsItem>
        <ElDescriptionsItem label="状态">
          <ElTag :type="getStatusTagType(currentSubscriptionDetail.status)" effect="light">{{ currentSubscriptionDetail.status }}</ElTag>
        </ElDescriptionsItem>
        <ElDescriptionsItem label="开始时间">{{ formatDateTime(currentSubscriptionDetail.start_time) }}</ElDescriptionsItem>
        <ElDescriptionsItem label="结束时间">{{ formatDateTime(currentSubscriptionDetail.end_time) }}</ElDescriptionsItem>
        <ElDescriptionsItem label="到期取消">{{ currentSubscriptionDetail.cancel_at_period_end ? '是' : '否' }}</ElDescriptionsItem>
        <ElDescriptionsItem label="备注">{{ currentSubscriptionDetail.remark || '-' }}</ElDescriptionsItem>
        <ElDescriptionsItem label="创建时间">{{ formatDateTime(currentSubscriptionDetail.create_time) }}</ElDescriptionsItem>
      </ElDescriptions>
      <ElEmpty v-else description="未找到订阅" />
    </ElDrawer>
  </div>
</template>

<script setup lang="ts">
  import {
    fetchPlatformOrder,
    fetchPlatformOrderRiskOverview,
    fetchPlatformOrders,
    fetchPlatformSubscription,
    fetchPlatformSubscriptionLifecycleOverview,
    fetchPlatformSubscriptions,
    type SaasOrderRiskOverview,
    type SaasPlatformOrderRecord,
    type SaasPlatformSubscriptionRecord,
    type SaasSubscriptionLifecycleOverview
  } from '@/api/saas'
  import { isPaymentRequestedPendingOrder } from '@/utils/saas/payment-request-state'

  defineOptions({ name: 'SaasPlatformSubscriptionPage' })

  const activeTab = ref<'subscriptions' | 'orders'>('subscriptions')
  const loading = ref(false)
  const detailLoading = ref(false)
  const lifecycleFilter = ref<'all' | 'active' | 'expiring' | 'expired'>('all')
  const orderRiskFilter = ref<'all' | 'pending' | 'timeout' | 'tenant_cancelled'>('all')
  const filters = reactive({ tenant_id: '', status: '', order_no: '', plan_code: '', plan_id: '' })
  const subscriptions = ref<SaasPlatformSubscriptionRecord[]>([])
  const orders = ref<SaasPlatformOrderRecord[]>([])
  const lifecycleOverview = ref<SaasSubscriptionLifecycleOverview>({
    active_count: 0,
    expiring_7_days_count: 0,
    expiring_30_days_count: 0,
    expired_count: 0
  })
  const orderRiskOverview = ref<SaasOrderRiskOverview>({
    pending_plan_orders: 0,
    pending_resource_pack_orders: 0,
    timeout_closed_plan_orders_7d: 0,
    timeout_closed_resource_pack_orders_7d: 0,
    tenant_cancelled_plan_orders_7d: 0,
    tenant_cancelled_resource_pack_orders_7d: 0
  })
  const currentOrderDetail = ref<SaasPlatformOrderRecord | null>(null)
  const currentSubscriptionDetail = ref<SaasPlatformSubscriptionRecord | null>(null)
  const orderDetailVisible = ref(false)
  const subscriptionDetailVisible = ref(false)
  const subscriptionPager = reactive({ page: 1, limit: 20, total: 0 })
  const orderPager = reactive({ page: 1, limit: 20, total: 0 })
  const statusOptions = ['active', 'trialing', 'expired', 'frozen', 'pending', 'paid', 'closed']
  const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })

  function buildBaseQuery(page: number, limit: number) {
    return { page, limit, status: filters.status || undefined, tenant_id: filters.tenant_id || undefined }
  }

  function buildLifecycleQuery() {
    if (lifecycleFilter.value === 'active') return { lifecycle_status: 'active' as const }
    if (lifecycleFilter.value === 'expiring') return { lifecycle_status: 'expiring' as const, expires_within_days: 7 }
    if (lifecycleFilter.value === 'expired') return { lifecycle_status: 'expired' as const, expired_since_days: 365 }
    return {}
  }

  function buildOrderRiskQuery() {
    if (orderRiskFilter.value === 'pending') return { status: 'pending' as const }
    if (orderRiskFilter.value === 'timeout') return { status: 'closed' as const, close_reason: 'timeout' as const }
    if (orderRiskFilter.value === 'tenant_cancelled') {
      return { status: 'closed' as const, close_reason: 'tenant_cancelled' as const }
    }
    return {}
  }

  async function loadSubscriptions() {
    loading.value = true
    try {
      const result = await fetchPlatformSubscriptions({
        ...buildBaseQuery(subscriptionPager.page, subscriptionPager.limit),
        ...buildLifecycleQuery(),
        plan_id: filters.plan_id || undefined,
        plan_code: filters.plan_code || undefined
      })
      subscriptions.value = result.list || []
      subscriptionPager.total = Number(result.total) || 0
    } finally {
      loading.value = false
    }
  }

  async function loadOrders() {
    loading.value = true
    try {
      const result = await fetchPlatformOrders({
        ...buildBaseQuery(orderPager.page, orderPager.limit),
        ...buildOrderRiskQuery(),
        order_no: filters.order_no || undefined,
        plan_code: filters.plan_code || undefined
      })
      orders.value = result.list || []
      orderPager.total = Number(result.total) || 0
    } finally {
      loading.value = false
    }
  }

  async function loadLifecycleOverview() {
    lifecycleOverview.value = await fetchPlatformSubscriptionLifecycleOverview()
  }

  async function loadOrderRiskOverview() {
    orderRiskOverview.value = await fetchPlatformOrderRiskOverview()
  }

  function refreshCurrentTab() {
    void loadLifecycleOverview()
    if (activeTab.value === 'orders') {
      void loadOrderRiskOverview()
      orderPager.page = 1
      void loadOrders()
      return
    }
    subscriptionPager.page = 1
    void loadSubscriptions()
  }

  function resetFilters() {
    Object.assign(filters, { tenant_id: '', status: '', order_no: '', plan_code: '', plan_id: '' })
    orderRiskFilter.value = 'all'
    refreshCurrentTab()
  }

  function handleTabChange() {
    refreshCurrentTab()
  }

  function handleStatusFilterChange() {
    orderRiskFilter.value = 'all'
    refreshCurrentTab()
  }

  function handleOrderRiskFilterChange() {
    if (orderRiskFilter.value !== 'all') {
      filters.status = ''
    }
    refreshCurrentTab()
  }

  function handleSubscriptionSizeChange() {
    subscriptionPager.page = 1
    void loadSubscriptions()
  }

  function handleOrderSizeChange() {
    orderPager.page = 1
    void loadOrders()
  }

  async function openOrderDetail(row: SaasPlatformOrderRecord) {
    orderDetailVisible.value = true
    detailLoading.value = true
    try {
      currentOrderDetail.value = await fetchPlatformOrder(row.order_no)
    } finally {
      detailLoading.value = false
    }
  }

  async function openSubscriptionDetail(row: SaasPlatformSubscriptionRecord) {
    subscriptionDetailVisible.value = true
    detailLoading.value = true
    try {
      currentSubscriptionDetail.value = await fetchPlatformSubscription(row.id)
    } finally {
      detailLoading.value = false
    }
  }

  function formatDateTime(value: unknown) {
    if (!value) return '-'
    const date = value instanceof Date ? value : new Date(String(value))
    return Number.isNaN(date.getTime()) ? String(value) : dateFormatter.format(date)
  }

  function formatMoney(amountCents: number) {
    return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format((Number(amountCents) || 0) / 100)
  }

  function formatRemainingDays(value: number | null | undefined) {
    if (value === null || value === undefined) return '-'
    if (value < 0) return `已过期 ${Math.abs(value)} 天`
    if (value === 0) return '今天到期'
    return `${value} 天`
  }

  function getLifecycleText(row: SaasPlatformSubscriptionRecord) {
    if (row.is_expired_by_time || row.status === 'expired') return '已过期'
    if (row.is_expiring_soon) return '即将到期'
    if (row.status === 'active') return '正常'
    return row.status || '-'
  }

  function getLifecycleTagType(row: SaasPlatformSubscriptionRecord) {
    if (row.is_expired_by_time || row.status === 'expired') return 'danger'
    if (row.is_expiring_soon) return 'warning'
    if (row.status === 'active') return 'success'
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

  function getStatusTagType(status: string) {
    const normalized = String(status || '').toLowerCase()
    if (['active', 'paid'].includes(normalized)) return 'success'
    if (['trialing', 'pending'].includes(normalized)) return 'warning'
    if (['frozen', 'closed'].includes(normalized)) return 'danger'
    return 'info'
  }

  onMounted(() => {
    void loadLifecycleOverview()
    void loadOrderRiskOverview()
    void loadSubscriptions()
  })
</script>

<style scoped>
  .saas-platform-page {
    min-height: 100%;
  }

  .saas-platform-page__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .saas-platform-page__title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.4;
  }

  .saas-platform-page__subtitle {
    margin: 6px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.5;
  }

  .saas-platform-page__lifecycle-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
    margin-bottom: 16px;
  }

  .saas-platform-page__summary-item {
    display: grid;
    gap: 4px;
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
    padding: 14px 16px;
    background: var(--el-bg-color);
  }

  .saas-platform-page__summary-item span {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    line-height: 1.4;
  }

  .saas-platform-page__summary-item strong {
    font-size: 22px;
    line-height: 1.2;
  }

  .saas-platform-page__filters {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 16px;
  }

  .saas-platform-page__lifecycle-filter {
    margin-bottom: 16px;
  }

  .saas-platform-page__order-risk-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
    margin-bottom: 16px;
  }

  .saas-platform-page__order-risk-filter {
    margin-bottom: 16px;
  }

  .saas-platform-page__filter-item {
    width: 160px;
  }

  .saas-platform-page__order-input {
    width: 260px;
  }

  .saas-platform-page__pagination {
    margin-top: 16px;
    justify-content: flex-end;
  }

  .saas-platform-page__inline-tag {
    margin-left: 6px;
  }
</style>
