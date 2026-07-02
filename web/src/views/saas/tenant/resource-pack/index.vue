<template>
  <div class="art-full-height p-5 tenant-resource-pack-page">
    <section class="tenant-resource-pack-page__header">
      <div>
        <h1 class="tenant-resource-pack-page__title">资源包</h1>
        <p class="tenant-resource-pack-page__subtitle">按需购买额外资源额度，支付成功后自动发放到当前租户。</p>
      </div>
      <ElButton :loading="loading" @click="loadResourcePacks">刷新</ElButton>
    </section>

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
          :disabled="pack.status !== 1 || Boolean(currentOrder && currentOrder.status !== 'paid')"
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
        <ElTag :type="currentOrder.status === 'paid' ? 'success' : 'warning'" effect="light">
          {{ currentOrder.status === 'paid' ? '已支付' : '待支付' }}
        </ElTag>
      </div>
      <div class="tenant-resource-pack-page__order-actions">
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
        <span v-if="pollingPayment" class="tenant-resource-pack-page__polling">正在同步支付结果...</span>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import {
    createAlipayPayment,
    createTenantResourcePackOrder,
    devConfirmTenantPayment,
    fetchTenantResourcePackOrder,
    fetchTenantResourcePacks,
    type SaasResourcePackOrderRecord,
    type SaasResourcePackRecord
  } from '@/api/saas'

  defineOptions({ name: 'SaasTenantResourcePackPage' })

  const records = ref<SaasResourcePackRecord[]>([])
  const currentOrder = ref<SaasResourcePackOrderRecord | null>(null)
  const loading = ref(false)
  const creatingPackCode = ref('')
  const creatingAlipayPayment = ref(false)
  const confirmingPayment = ref(false)
  const pollingPayment = ref(false)
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

  async function loadResourcePacks() {
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

  async function createOrder(pack: SaasResourcePackRecord) {
    creatingPackCode.value = pack.code
    try {
      currentOrder.value = await createTenantResourcePackOrder({
        resource_pack_code: pack.code,
        payment_method: 'alipay'
      })
      ElMessage.success('资源包订单已创建')
    } catch (error) {
      console.error('[SaasTenantResourcePackPage] create order failed:', error)
    } finally {
      creatingPackCode.value = ''
    }
  }

  async function startAlipayPayment() {
    if (!currentOrder.value) return
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
    if (!currentOrder.value) return
    confirmingPayment.value = true
    try {
      stopPaymentPolling()
      currentOrder.value = (await devConfirmTenantPayment(
        currentOrder.value.order_no,
        'resource_pack'
      )) as SaasResourcePackOrderRecord
      ElMessage.success('资源包支付成功，额度已发放')
      await loadResourcePacks()
    } catch (error) {
      console.error('[SaasTenantResourcePackPage] confirm dev payment failed:', error)
    } finally {
      confirmingPayment.value = false
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

  function formatPrice(priceCents: number, currency = 'CNY') {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency
    }).format((Number(priceCents) || 0) / 100)
  }

  onMounted(() => {
    loadResourcePacks()
  })

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
