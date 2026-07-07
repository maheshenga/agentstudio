<template>
  <div class="art-full-height p-5 tenant-resource-pack-page">
    <section class="tenant-resource-pack-page__header">
      <div>
        <h1 class="tenant-resource-pack-page__title">资源包</h1>
        <p class="tenant-resource-pack-page__subtitle">按需购买额外资源额度，支付成功后自动发放到当前租户。</p>
      </div>
      <ElButton v-if="moduleEnabled" :loading="loading" @click="loadResourcePacks">刷新</ElButton>
    </section>

    <template v-if="moduleEnabled">
      <ElSkeleton v-if="loading && !records.length" animated :rows="6" />

    <ElResult v-else-if="errorMessage" icon="error" :title="errorMessage" sub-title="请稍后重试。">
      <template #extra>
        <ElButton type="primary" :loading="loading" @click="loadResourcePacks">重试</ElButton>
      </template>
    </ElResult>

    <section v-else-if="!records.length" class="tenant-resource-pack-page__state">
      <ElEmpty description="暂无可购买资源包" />
      <ElButton type="primary" :loading="loading" @click="loadResourcePacks">刷新</ElButton>
    </section>

    <section v-else class="tenant-resource-pack-page__grid">
      <article v-for="pack in records" :key="pack.code" class="tenant-resource-pack-page__pack">
        <div class="tenant-resource-pack-page__pack-header">
          <div>
            <p class="tenant-resource-pack-page__pack-type">{{ formatResourceType(pack.resource_type) }}</p>
            <h2 class="tenant-resource-pack-page__pack-name">{{ pack.name }}</h2>
          </div>
          <ElTag effect="light">{{ pack.status === 1 ? '可购买' : '已停用' }}</ElTag>
        </div>

        <div class="tenant-resource-pack-page__quota">{{ formatQuota(pack) }}</div>
        <div class="tenant-resource-pack-page__price">{{ formatPrice(pack.price_cents, pack.currency) }}</div>
        <p class="tenant-resource-pack-page__remark">{{ pack.remark || '资源包说明待补充' }}</p>
        <ElButton
          type="primary"
          :loading="creatingPackCode === pack.code"
          :disabled="pack.status !== 1 || currentOrder?.status === 'pending'"
          @click="createOrder(pack)"
        >
          购买
        </ElButton>
      </article>
    </section>

    <section v-if="currentOrder" class="tenant-resource-pack-page__order">
      <div>
        <h2 class="tenant-resource-pack-page__section-title">当前资源包订单</h2>
        <p class="tenant-resource-pack-page__order-meta">
          {{ currentOrder.order_no }} · {{ currentOrder.resource_pack_code }} ·
          {{ formatPrice(currentOrder.amount_cents, currentOrder.currency) }}
        </p>
        <ElTag :type="currentOrderStatusTagType" effect="light">
          {{ currentOrderStatusText }}
        </ElTag>
        <ElTag v-if="isCurrentOrderPaymentRequested" type="warning" effect="light">
          已发起支付
        </ElTag>
        <p v-if="hasPaymentRequestedAt(currentOrder.payment_requested_at)" class="tenant-resource-pack-page__order-meta">
          发起支付时间：{{ formatDateTime(currentOrder.payment_requested_at) }}
        </p>
        <p v-if="currentOrder.status === 'closed'" class="tenant-resource-pack-page__order-meta">
          {{ formatCloseReason(currentOrder.close_reason) }} · {{ formatDateTime(currentOrder.closed_at) }}
        </p>
      </div>
      <div class="tenant-resource-pack-page__order-actions">
        <ElButton
          type="primary"
          :disabled="!isCurrentOrderPayable"
          :loading="creatingAlipayPayment"
          @click="startAlipayPayment"
        >
          去支付宝支付
        </ElButton>
        <ElButton
          v-if="showDevPaymentConfirm"
          type="success"
          :disabled="!isCurrentOrderPayable"
          :loading="confirmingPayment"
          @click="confirmDevPayment"
        >
          本地模拟支付成功
        </ElButton>
        <span v-if="pollingPayment" class="tenant-resource-pack-page__polling">正在同步支付结果...</span>
      </div>
    </section>

    <section class="tenant-resource-pack-page__orders">
      <div class="tenant-resource-pack-page__section-header">
        <div>
          <h2 class="tenant-resource-pack-page__section-title">资源包订单记录</h2>
          <p class="tenant-resource-pack-page__remark">查看历史购买、支付和发放状态。</p>
        </div>
        <ElButton :loading="orderHistoryLoading" @click="loadOrderHistory">刷新</ElButton>
      </div>

      <div class="tenant-resource-pack-page__filters">
        <ElInput
          v-model="orderFilters.resource_pack_code"
          clearable
          placeholder="资源包编码"
          class="tenant-resource-pack-page__filter-input"
          @keyup.enter="refreshOrderHistory"
        />
        <ElSelect
          v-model="orderFilters.status"
          clearable
          placeholder="状态"
          class="tenant-resource-pack-page__filter-input"
          @change="refreshOrderHistory"
        >
          <ElOption label="待支付" value="pending" />
          <ElOption label="已支付" value="paid" />
          <ElOption label="已关闭" value="closed" />
        </ElSelect>
        <ElButton type="primary" :loading="orderHistoryLoading" @click="refreshOrderHistory">查询</ElButton>
      </div>

      <ElTable v-loading="orderHistoryLoading" :data="orderHistory" border>
        <ElTableColumn prop="order_no" label="订单号" min-width="230" show-overflow-tooltip />
        <ElTableColumn prop="resource_pack_code" label="资源包" width="170" show-overflow-tooltip />
        <ElTableColumn label="资源类型" width="140">
          <template #default="{ row }">{{ formatResourceType(row.resource_type) }}</template>
        </ElTableColumn>
        <ElTableColumn label="额度" width="150">
          <template #default="{ row }">{{ formatOrderQuota(row) }}</template>
        </ElTableColumn>
        <ElTableColumn label="金额" width="130">
          <template #default="{ row }">{{ formatPrice(row.amount_cents, row.currency) }}</template>
        </ElTableColumn>
        <ElTableColumn label="状态" width="110">
          <template #default="{ row }">
            <ElTag :type="getOrderStatusTagType(row.status)" effect="light">
              {{ formatOrderStatus(row.status) }}
            </ElTag>
            <ElTag v-if="isPaymentRequestedPendingOrder(row)" class="tenant-resource-pack-page__inline-tag" type="warning" effect="light">
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
        <ElTableColumn label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <ElButton v-if="row.status === 'pending'" type="primary" link @click="resumeOrderPayment(row)">
              继续支付
            </ElButton>
            <ElButton v-if="showDevPaymentConfirm && row.status === 'pending'" type="success" link @click="confirmHistoryOrder(row)">
              模拟确认
            </ElButton>
            <ElButton
              v-if="row.status === 'pending' && !isPaymentRequestedPendingOrder(row)"
              type="danger"
              link
              :disabled="cancellingOrderNo === row.order_no"
              :loading="cancellingOrderNo === row.order_no"
              @click="cancelOrder(row)"
            >
              取消
            </ElButton>
          </template>
        </ElTableColumn>
      </ElTable>

      <ElPagination
        v-model:current-page="orderPager.page"
        v-model:page-size="orderPager.limit"
        class="tenant-resource-pack-page__pagination"
        layout="total, sizes, prev, pager, next"
        :page-sizes="[10, 20, 50]"
        :total="orderPager.total"
        @current-change="loadOrderHistory"
        @size-change="handleOrderHistorySizeChange"
      />
    </section>
    </template>

    <section v-else-if="moduleChecked && errorMessage" class="tenant-resource-pack-page__state">
      <ElResult icon="error" :title="errorMessage" sub-title="请稍后重试。">
        <template #extra>
          <ElButton type="primary" @click="loadPage">重试</ElButton>
        </template>
      </ElResult>
    </section>

    <section v-else-if="moduleChecked" class="tenant-resource-pack-page__state">
      <ElEmpty description="当前套餐未开通资源包" />
    </section>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import {
    cancelTenantResourcePackOrder,
    createAlipayPayment,
    createTenantResourcePackOrder,
    devConfirmTenantPayment,
    fetchTenantResourcePackOrder,
    fetchTenantResourcePackOrders,
    fetchTenantModules,
    fetchTenantResourcePacks,
    type SaasResourcePackOrderRecord,
    type SaasResourcePackRecord
  } from '@/api/saas'
  import { hasPaymentRequestedAt, isPaymentRequestedPendingOrder } from '@/utils/saas/payment-request-state'

  defineOptions({ name: 'SaasTenantResourcePackPage' })

  const showDevPaymentConfirm = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEV_PAYMENT_CONFIRM === 'true'

  const records = ref<SaasResourcePackRecord[]>([])
  const currentOrder = ref<SaasResourcePackOrderRecord | null>(null)
  const moduleChecked = ref(false)
  const moduleEnabled = ref(false)
  const loading = ref(false)
  const creatingPackCode = ref('')
  const creatingAlipayPayment = ref(false)
  const confirmingPayment = ref(false)
  const pollingPayment = ref(false)
  const cancellingOrderNo = ref('')
  const orderHistory = ref<SaasResourcePackOrderRecord[]>([])
  const orderHistoryLoading = ref(false)
  const orderFilters = reactive({
    resource_pack_code: '',
    status: ''
  })
  const orderPager = reactive({
    page: 1,
    limit: 10,
    total: 0
  })
  const errorMessage = ref('')
  let paymentPollingTimer: number | undefined
  let paymentPollingStartedAt = 0
  const PAYMENT_POLL_INTERVAL_MS = 5000
  const PAYMENT_POLL_TIMEOUT_MS = 120000

  const resourceLabels: Record<string, string> = {
    ai_calls: 'AI 调用次数',
    tokens: 'Token',
    storage_mb: '存储空间',
    rag_documents: '知识库文档'
  }

  const isCurrentOrderPayable = computed(() => currentOrder.value?.status === 'pending')
  const isCurrentOrderPaymentRequested = computed(() => isPaymentRequestedPendingOrder(currentOrder.value))
  const currentOrderStatusText = computed(() => formatOrderStatus(currentOrder.value?.status || ''))
  const currentOrderStatusTagType = computed(() => getOrderStatusTagType(currentOrder.value?.status || ''))

  async function loadResourcePacks() {
    if (!moduleEnabled.value) return
    loading.value = true
    errorMessage.value = ''

    try {
      records.value = await fetchTenantResourcePacks()
    } catch (error) {
      console.error('[SaasTenantResourcePackPage] load resource packs failed:', error)
      records.value = []
      errorMessage.value = '加载资源包失败'
    } finally {
      loading.value = false
    }
  }

  async function loadPage() {
    moduleChecked.value = false
    errorMessage.value = ''
    try {
      const modules = await fetchTenantModules()
      moduleEnabled.value = modules.some((module) => module.code === 'resource_pack' && module.status === 1)
      moduleChecked.value = true
      if (moduleEnabled.value) {
        await loadResourcePacks()
        await loadOrderHistory()
      }
    } catch (error) {
      console.error('[SaasTenantResourcePackPage] load module access failed:', error)
      moduleEnabled.value = false
      moduleChecked.value = true
      errorMessage.value = '加载模块权限失败'
    }
  }

  async function createOrder(pack: SaasResourcePackRecord) {
    creatingPackCode.value = pack.code
    try {
      currentOrder.value = await createTenantResourcePackOrder({
        resource_pack_code: pack.code,
        payment_method: 'alipay'
      })
      await loadOrderHistory()
      ElMessage.success('资源包订单已创建')
    } catch (error) {
      console.error('[SaasTenantResourcePackPage] create order failed:', error)
    } finally {
      creatingPackCode.value = ''
    }
  }

  async function startAlipayPayment() {
    if (!isCurrentOrderPayable.value || !currentOrder.value) return
    creatingAlipayPayment.value = true
    try {
      const result = await createAlipayPayment(currentOrder.value.order_no, 'resource_pack')
      if (result.configured && result.pay_url) {
        window.open(result.pay_url, '_blank', 'noopener,noreferrer')
        startPaymentPolling()
        ElMessage.success('支付宝支付页面已打开')
        return
      }
      ElMessage.warning(result.message || '支付宝沙箱配置未完成')
    } catch (error) {
      console.error('[SaasTenantResourcePackPage] create Alipay payment failed:', error)
    } finally {
      creatingAlipayPayment.value = false
    }
  }

  async function confirmDevPayment() {
    if (!showDevPaymentConfirm) return
    const order = currentOrder.value
    if (!order || order.status !== 'pending') return
    confirmingPayment.value = true
    try {
      stopPaymentPolling()
      currentOrder.value = (await devConfirmTenantPayment(
        order.order_no,
        'resource_pack'
      )) as SaasResourcePackOrderRecord
      ElMessage.success('资源包支付成功，额度已发放')
      await loadResourcePacks()
      await loadOrderHistory()
    } catch (error) {
      console.error('[SaasTenantResourcePackPage] confirm dev payment failed:', error)
    } finally {
      confirmingPayment.value = false
    }
  }

  function startPaymentPolling() {
    if (!isCurrentOrderPayable.value || paymentPollingTimer) return
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
    if (!orderNo || Date.now() - paymentPollingStartedAt > PAYMENT_POLL_TIMEOUT_MS) {
      stopPaymentPolling()
      return
    }

    try {
      const order = await fetchTenantResourcePackOrder(orderNo)
      currentOrder.value = order
      if (order.status === 'paid') {
        stopPaymentPolling()
        ElMessage.success('资源包支付成功，额度已发放')
        await loadOrderHistory()
        return
      }
      if (order.status === 'closed') {
        stopPaymentPolling()
        await loadOrderHistory()
      }
    } catch (error) {
      console.error('[SaasTenantResourcePackPage] poll payment status failed:', error)
    }
  }

  function formatResourceType(resourceType: string) {
    return resourceLabels[resourceType] || resourceType
  }

  function formatQuota(record: SaasResourcePackRecord) {
    const amount = Number(record.quota_amount) || 0
    const formattedAmount = new Intl.NumberFormat('zh-CN').format(amount)

    if (record.resource_type === 'storage_mb') {
      return `${formattedAmount} MB`
    }

    return formattedAmount
  }

  function formatOrderQuota(order: SaasResourcePackOrderRecord) {
    const amount = Number(order.quota_amount) || 0
    const formattedAmount = new Intl.NumberFormat('zh-CN').format(amount)
    return order.resource_type === 'storage_mb' ? `${formattedAmount} MB` : formattedAmount
  }

  async function loadOrderHistory() {
    orderHistoryLoading.value = true
    try {
      const result = await fetchTenantResourcePackOrders({
        page: orderPager.page,
        limit: orderPager.limit,
        resource_pack_code: orderFilters.resource_pack_code || undefined,
        status: orderFilters.status || undefined
      })
      orderHistory.value = result.list || []
      orderPager.total = Number(result.total) || 0
    } catch (error) {
      console.error('[SaasTenantResourcePackPage] load order history failed:', error)
      orderHistory.value = []
      orderPager.total = 0
      ElMessage.error('加载订单记录失败')
    } finally {
      orderHistoryLoading.value = false
    }
  }

  function refreshOrderHistory() {
    orderPager.page = 1
    loadOrderHistory()
  }

  function handleOrderHistorySizeChange() {
    orderPager.page = 1
    loadOrderHistory()
  }

  async function resumeOrderPayment(order: SaasResourcePackOrderRecord) {
    currentOrder.value = order
    if (order.status === 'closed') {
      stopPaymentPolling()
      return
    }
    await startAlipayPayment()
  }

  async function confirmHistoryOrder(order: SaasResourcePackOrderRecord) {
    currentOrder.value = order
    if (order.status === 'closed') {
      stopPaymentPolling()
      return
    }
    await confirmDevPayment()
  }

  async function cancelOrder(order: SaasResourcePackOrderRecord) {
    if (order.status !== 'pending' || cancellingOrderNo.value) return
    cancellingOrderNo.value = order.order_no
    try {
      await cancelTenantResourcePackOrder(order.order_no)
      if (currentOrder.value?.order_no === order.order_no) {
        stopPaymentPolling()
        currentOrder.value = { ...currentOrder.value, status: 'closed', close_reason: 'tenant_cancelled', closed_at: new Date() }
      }
      ElMessage.success('订单已取消')
      await loadOrderHistory()
    } catch (error) {
      console.error('[SaasTenantResourcePackPage] cancel order failed:', error)
    } finally {
      cancellingOrderNo.value = ''
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

  function formatCloseReason(value: unknown) {
    const labels: Record<string, string> = {
      timeout: '超时关闭',
      tenant_cancelled: '租户取消'
    }
    if (!value) return '-'
    const normalized = String(value)
    return labels[normalized] || normalized
  }

  function getOrderStatusTagType(status: string) {
    if (status === 'paid') return 'success'
    if (status === 'pending') return 'warning'
    return 'info'
  }

  function formatDateTime(value: unknown) {
    if (!value) return '-'
    const date = value instanceof Date ? value : new Date(String(value))
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('zh-CN', { hour12: false })
  }

  function formatPrice(priceCents: number, currency = 'CNY') {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency
    }).format((Number(priceCents) || 0) / 100)
  }

  onMounted(loadPage)

  onBeforeUnmount(() => {
    stopPaymentPolling()
  })
</script>

<style scoped>
  .tenant-resource-pack-page {
    display: grid;
    align-content: start;
    gap: 20px;
  }

  .tenant-resource-pack-page__header,
  .tenant-resource-pack-page__order {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .tenant-resource-pack-page__title,
  .tenant-resource-pack-page__pack-name,
  .tenant-resource-pack-page__section-title {
    margin: 0;
    line-height: 1.4;
    letter-spacing: 0;
  }

  .tenant-resource-pack-page__title {
    font-size: 20px;
    font-weight: 600;
  }

  .tenant-resource-pack-page__section-title {
    font-size: 16px;
    font-weight: 600;
  }

  .tenant-resource-pack-page__subtitle,
  .tenant-resource-pack-page__pack-type,
  .tenant-resource-pack-page__remark,
  .tenant-resource-pack-page__order-meta,
  .tenant-resource-pack-page__polling {
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.5;
  }

  .tenant-resource-pack-page__subtitle,
  .tenant-resource-pack-page__pack-type,
  .tenant-resource-pack-page__remark,
  .tenant-resource-pack-page__order-meta {
    margin: 6px 0 0;
  }

  .tenant-resource-pack-page__state {
    display: grid;
    justify-items: start;
    gap: 16px;
    padding: 24px 0;
  }

  .tenant-resource-pack-page__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 16px;
  }

  .tenant-resource-pack-page__pack,
  .tenant-resource-pack-page__order {
    border: 1px solid var(--el-border-color);
    border-radius: 8px;
    background: var(--el-bg-color);
    padding: 18px;
  }

  .tenant-resource-pack-page__pack {
    display: grid;
    align-content: start;
    gap: 16px;
    min-height: 250px;
  }

  .tenant-resource-pack-page__pack-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .tenant-resource-pack-page__pack-name {
    font-size: 17px;
    font-weight: 600;
  }

  .tenant-resource-pack-page__quota {
    font-size: 30px;
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: 0;
  }

  .tenant-resource-pack-page__price {
    font-size: 16px;
    font-weight: 600;
    line-height: 1.4;
  }

  .tenant-resource-pack-page__remark {
    min-height: 40px;
  }

  .tenant-resource-pack-page__order-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
  }

  .tenant-resource-pack-page__orders {
    display: grid;
    gap: 16px;
    overflow: hidden;
  }

  .tenant-resource-pack-page__section-header,
  .tenant-resource-pack-page__filters {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .tenant-resource-pack-page__filters {
    justify-content: flex-start;
  }

  .tenant-resource-pack-page__filter-input {
    width: 180px;
  }

  .tenant-resource-pack-page__pagination {
    justify-content: flex-end;
  }

  .tenant-resource-pack-page__inline-tag {
    margin-left: 6px;
  }

  @media (max-width: 768px) {
    .tenant-resource-pack-page__header,
    .tenant-resource-pack-page__order {
      display: grid;
    }

    .tenant-resource-pack-page__order-actions {
      justify-content: flex-start;
    }
  }
</style>
