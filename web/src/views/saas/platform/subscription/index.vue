<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="saas-platform-page">
      <template #header>
        <div class="saas-platform-page__header">
          <div>
            <h1 class="saas-platform-page__title">SaaS 运营</h1>
            <p class="saas-platform-page__subtitle">查看租户订阅、升级订单和支付状态。</p>
          </div>
          <ElButton :loading="loading" @click="refreshCurrentTab">刷新</ElButton>
        </div>
      </template>

      <div class="saas-platform-page__filters">
        <ElInput
          v-model="filters.tenant_id"
          class="saas-platform-page__tenant-input"
          clearable
          placeholder="租户 ID"
          @keyup.enter="refreshCurrentTab"
        />
        <ElSelect v-model="filters.status" class="saas-platform-page__status-select" clearable placeholder="状态">
          <ElOption v-for="status in statusOptions" :key="status" :label="status" :value="status" />
        </ElSelect>
        <ElButton type="primary" :loading="loading" @click="refreshCurrentTab">查询</ElButton>
      </div>

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
            <ElTableColumn prop="remark" label="备注" min-width="240" show-overflow-tooltip />
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
              </template>
            </ElTableColumn>
            <ElTableColumn prop="alipay_trade_no" label="支付宝交易号" min-width="210" show-overflow-tooltip />
            <ElTableColumn label="支付时间" min-width="180">
              <template #default="{ row }">{{ formatDateTime(row.paid_at) }}</template>
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
  </div>
</template>

<script setup lang="ts">
  import {
    fetchPlatformOrders,
    fetchPlatformSubscriptions,
    type SaasPlatformOrderRecord,
    type SaasPlatformSubscriptionRecord
  } from '@/api/saas'

  defineOptions({ name: 'SaasPlatformSubscriptionPage' })

  const activeTab = ref<'subscriptions' | 'orders'>('subscriptions')
  const loading = ref(false)
  const filters = reactive({
    tenant_id: '',
    status: ''
  })
  const subscriptions = ref<SaasPlatformSubscriptionRecord[]>([])
  const orders = ref<SaasPlatformOrderRecord[]>([])
  const subscriptionPager = reactive({
    page: 1,
    limit: 20,
    total: 0
  })
  const orderPager = reactive({
    page: 1,
    limit: 20,
    total: 0
  })
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

  function buildQuery(page: number, limit: number) {
    return {
      page,
      limit,
      status: filters.status || undefined,
      tenant_id: filters.tenant_id || undefined
    }
  }

  async function loadSubscriptions() {
    loading.value = true
    try {
      const result = await fetchPlatformSubscriptions(
        buildQuery(subscriptionPager.page, subscriptionPager.limit)
      )
      subscriptions.value = result.list || []
      subscriptionPager.total = Number(result.total) || 0
    } finally {
      loading.value = false
    }
  }

  async function loadOrders() {
    loading.value = true
    try {
      const result = await fetchPlatformOrders(buildQuery(orderPager.page, orderPager.limit))
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

  function formatDateTime(value: unknown) {
    if (!value) return '-'
    const date = value instanceof Date ? value : new Date(String(value))
    return Number.isNaN(date.getTime()) ? String(value) : dateFormatter.format(date)
  }

  function formatMoney(amountCents: number) {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY'
    }).format((Number(amountCents) || 0) / 100)
  }

  function getStatusTagType(status: string) {
    const normalized = String(status || '').toLowerCase()
    if (['active', 'paid'].includes(normalized)) return 'success'
    if (['trialing', 'pending'].includes(normalized)) return 'warning'
    if (['frozen', 'closed'].includes(normalized)) return 'danger'
    return 'info'
  }

  onMounted(() => {
    loadSubscriptions()
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

  .saas-platform-page__filters {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 16px;
  }

  .saas-platform-page__tenant-input,
  .saas-platform-page__status-select {
    width: 180px;
  }

  .saas-platform-page__pagination {
    margin-top: 16px;
    justify-content: flex-end;
  }
</style>
