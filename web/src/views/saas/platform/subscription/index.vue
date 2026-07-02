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

      <div class="saas-platform-page__filters">
        <ElInput v-model="filters.tenant_id" class="saas-platform-page__filter-item" clearable placeholder="租户 ID" @keyup.enter="refreshCurrentTab" />
        <ElInput v-model="filters.plan_id" class="saas-platform-page__filter-item" clearable placeholder="套餐 ID" @keyup.enter="refreshCurrentTab" />
        <ElInput v-model="filters.plan_code" class="saas-platform-page__filter-item" clearable placeholder="套餐编码" @keyup.enter="refreshCurrentTab" />
        <ElInput v-if="activeTab === 'orders'" v-model="filters.order_no" class="saas-platform-page__order-input" clearable placeholder="订单号" @keyup.enter="refreshCurrentTab" />
        <ElSelect v-model="filters.status" class="saas-platform-page__filter-item" clearable placeholder="状态">
          <ElOption v-for="status in statusOptions" :key="status" :label="status" :value="status" />
        </ElSelect>
        <ElButton type="primary" :loading="loading" @click="refreshCurrentTab">查询</ElButton>
        <ElButton @click="resetFilters">重置</ElButton>
      </div>

      <ElTabs v-model="activeTab" @tab-change="handleTabChange">
        <ElTabPane label="订阅" name="subscriptions">
          <ElTable v-loading="loading && activeTab === 'subscriptions'" :data="subscriptions" border>
            <ElTableColumn prop="tenant_id" label="租户 ID" width="110" />
            <ElTableColumn prop="plan_id" label="套餐 ID" width="110" />
            <ElTableColumn prop="billing_cycle" label="周期" width="110" />
            <ElTableColumn prop="status" label="状态" width="120">
              <template #default="{ row }"><ElTag :type="getStatusTagType(row.status)" effect="light">{{ row.status }}</ElTag></template>
            </ElTableColumn>
            <ElTableColumn label="开始时间" min-width="180"><template #default="{ row }">{{ formatDateTime(row.start_time) }}</template></ElTableColumn>
            <ElTableColumn label="结束时间" min-width="180"><template #default="{ row }">{{ formatDateTime(row.end_time) }}</template></ElTableColumn>
            <ElTableColumn prop="remark" label="备注" min-width="220" show-overflow-tooltip />
            <ElTableColumn label="操作" fixed="right" width="100"><template #default="{ row }"><ElButton link type="primary" @click="openSubscriptionDetail(row)">详情</ElButton></template></ElTableColumn>
          </ElTable>
          <ElPagination v-model:current-page="subscriptionPager.page" v-model:page-size="subscriptionPager.limit" class="saas-platform-page__pagination" layout="total, sizes, prev, pager, next" :page-sizes="[10, 20, 50, 100]" :total="subscriptionPager.total" @current-change="loadSubscriptions" @size-change="handleSubscriptionSizeChange" />
        </ElTabPane>

        <ElTabPane label="订单" name="orders">
          <ElTable v-loading="loading && activeTab === 'orders'" :data="orders" border>
            <ElTableColumn prop="order_no" label="订单号" min-width="230" show-overflow-tooltip />
            <ElTableColumn prop="tenant_id" label="租户 ID" width="110" />
            <ElTableColumn prop="plan_code" label="套餐" width="120" />
            <ElTableColumn label="金额" width="130"><template #default="{ row }">{{ formatMoney(row.amount_cents) }}</template></ElTableColumn>
            <ElTableColumn prop="payment_method" label="支付方式" width="120" />
            <ElTableColumn prop="status" label="状态" width="120"><template #default="{ row }"><ElTag :type="getStatusTagType(row.status)" effect="light">{{ row.status }}</ElTag></template></ElTableColumn>
            <ElTableColumn prop="alipay_trade_no" label="支付宝交易号" min-width="210" show-overflow-tooltip />
            <ElTableColumn label="支付时间" min-width="180"><template #default="{ row }">{{ formatDateTime(row.paid_at) }}</template></ElTableColumn>
            <ElTableColumn label="操作" fixed="right" width="100"><template #default="{ row }"><ElButton link type="primary" @click="openOrderDetail(row)">详情</ElButton></template></ElTableColumn>
          </ElTable>
          <ElPagination v-model:current-page="orderPager.page" v-model:page-size="orderPager.limit" class="saas-platform-page__pagination" layout="total, sizes, prev, pager, next" :page-sizes="[10, 20, 50, 100]" :total="orderPager.total" @current-change="loadOrders" @size-change="handleOrderSizeChange" />
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
        <ElDescriptionsItem label="状态"><ElTag :type="getStatusTagType(currentOrderDetail.status)" effect="light">{{ currentOrderDetail.status }}</ElTag></ElDescriptionsItem>
        <ElDescriptionsItem label="支付方式">{{ currentOrderDetail.payment_method || '-' }}</ElDescriptionsItem>
        <ElDescriptionsItem label="支付宝交易号">{{ currentOrderDetail.alipay_trade_no || '-' }}</ElDescriptionsItem>
        <ElDescriptionsItem label="支付时间">{{ formatDateTime(currentOrderDetail.paid_at) }}</ElDescriptionsItem>
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
        <ElDescriptionsItem label="状态"><ElTag :type="getStatusTagType(currentSubscriptionDetail.status)" effect="light">{{ currentSubscriptionDetail.status }}</ElTag></ElDescriptionsItem>
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
    fetchPlatformOrders,
    fetchPlatformSubscription,
    fetchPlatformSubscriptions,
    type SaasPlatformOrderRecord,
    type SaasPlatformSubscriptionRecord
  } from '@/api/saas'

  defineOptions({ name: 'SaasPlatformSubscriptionPage' })

  const activeTab = ref<'subscriptions' | 'orders'>('subscriptions')
  const loading = ref(false)
  const detailLoading = ref(false)
  const filters = reactive({ tenant_id: '', status: '', order_no: '', plan_code: '', plan_id: '' })
  const subscriptions = ref<SaasPlatformSubscriptionRecord[]>([])
  const orders = ref<SaasPlatformOrderRecord[]>([])
  const currentOrderDetail = ref<SaasPlatformOrderRecord | null>(null)
  const currentSubscriptionDetail = ref<SaasPlatformSubscriptionRecord | null>(null)
  const orderDetailVisible = ref(false)
  const subscriptionDetailVisible = ref(false)
  const subscriptionPager = reactive({ page: 1, limit: 20, total: 0 })
  const orderPager = reactive({ page: 1, limit: 20, total: 0 })
  const statusOptions = ['active', 'trialing', 'expired', 'frozen', 'pending', 'paid', 'closed']
  const dateFormatter = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

  function buildBaseQuery(page: number, limit: number) {
    return { page, limit, status: filters.status || undefined, tenant_id: filters.tenant_id || undefined }
  }

  async function loadSubscriptions() {
    loading.value = true
    try {
      const result = await fetchPlatformSubscriptions({ ...buildBaseQuery(subscriptionPager.page, subscriptionPager.limit), plan_id: filters.plan_id || undefined, plan_code: filters.plan_code || undefined })
      subscriptions.value = result.list || []
      subscriptionPager.total = Number(result.total) || 0
    } finally {
      loading.value = false
    }
  }

  async function loadOrders() {
    loading.value = true
    try {
      const result = await fetchPlatformOrders({ ...buildBaseQuery(orderPager.page, orderPager.limit), order_no: filters.order_no || undefined, plan_code: filters.plan_code || undefined })
      orders.value = result.list || []
      orderPager.total = Number(result.total) || 0
    } finally {
      loading.value = false
    }
  }

  function refreshCurrentTab() {
    if (activeTab.value === 'orders') {
      orderPager.page = 1
      loadOrders()
      return
    }
    subscriptionPager.page = 1
    loadSubscriptions()
  }

  function resetFilters() {
    Object.assign(filters, { tenant_id: '', status: '', order_no: '', plan_code: '', plan_id: '' })
    refreshCurrentTab()
  }

  function handleTabChange() {
    refreshCurrentTab()
  }

  function handleSubscriptionSizeChange() {
    subscriptionPager.page = 1
    loadSubscriptions()
  }

  function handleOrderSizeChange() {
    orderPager.page = 1
    loadOrders()
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

  function getStatusTagType(status: string) {
    const normalized = String(status || '').toLowerCase()
    if (['active', 'paid'].includes(normalized)) return 'success'
    if (['trialing', 'pending'].includes(normalized)) return 'warning'
    if (['frozen', 'closed'].includes(normalized)) return 'danger'
    return 'info'
  }

  onMounted(() => loadSubscriptions())
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

  .saas-platform-page__filters {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
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
</style>