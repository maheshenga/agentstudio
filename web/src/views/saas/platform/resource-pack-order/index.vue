<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="saas-resource-pack-order-page">
      <template #header>
        <div class="saas-resource-pack-order-page__header">
          <div>
            <h1 class="saas-resource-pack-order-page__title">资源包订单</h1>
            <p class="saas-resource-pack-order-page__subtitle">查看租户资源包购买和额度发放状态。</p>
          </div>
          <ElButton :loading="loading" @click="loadOrders">刷新</ElButton>
        </div>
      </template>

      <div class="saas-resource-pack-order-page__filters">
        <ElInput
          v-model="filters.order_no"
          clearable
          placeholder="订单号"
          class="saas-resource-pack-order-page__input"
          @keyup.enter="refreshOrders"
        />
        <ElInput
          v-model="filters.tenant_id"
          clearable
          placeholder="租户 ID"
          class="saas-resource-pack-order-page__input"
          @keyup.enter="refreshOrders"
        />
        <ElInput
          v-model="filters.resource_pack_code"
          clearable
          placeholder="资源包编码"
          class="saas-resource-pack-order-page__input"
          @keyup.enter="refreshOrders"
        />
        <ElSelect
          v-model="filters.resource_type"
          clearable
          placeholder="资源类型"
          class="saas-resource-pack-order-page__select"
          @change="refreshOrders"
        >
          <ElOption label="AI 调用次数" value="ai_calls" />
          <ElOption label="Token" value="tokens" />
          <ElOption label="存储空间" value="storage_mb" />
          <ElOption label="知识库文档" value="rag_documents" />
        </ElSelect>
        <ElSelect
          v-model="filters.status"
          clearable
          placeholder="状态"
          class="saas-resource-pack-order-page__select"
          @change="refreshOrders"
        >
          <ElOption label="待支付" value="pending" />
          <ElOption label="已支付" value="paid" />
          <ElOption label="已关闭" value="closed" />
        </ElSelect>
        <ElButton type="primary" :loading="loading" @click="refreshOrders">查询</ElButton>
      </div>

      <ElTable v-loading="loading" :data="orders" border>
        <ElTableColumn prop="order_no" label="订单号" min-width="230" show-overflow-tooltip />
        <ElTableColumn prop="tenant_id" label="租户 ID" width="110" />
        <ElTableColumn prop="resource_pack_code" label="资源包" width="170" show-overflow-tooltip />
        <ElTableColumn label="资源类型" width="140">
          <template #default="{ row }">{{ formatResourceType(row.resource_type) }}</template>
        </ElTableColumn>
        <ElTableColumn label="额度" width="150">
          <template #default="{ row }">{{ formatQuota(row.resource_type, row.quota_amount) }}</template>
        </ElTableColumn>
        <ElTableColumn label="金额" width="130">
          <template #default="{ row }">{{ formatPrice(row.amount_cents, row.currency) }}</template>
        </ElTableColumn>
        <ElTableColumn label="状态" width="110">
          <template #default="{ row }">
            <ElTag :type="getStatusTagType(row.status)" effect="light">
              {{ formatStatus(row.status) }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="支付时间" min-width="180">
          <template #default="{ row }">{{ formatDateTime(row.paid_at) }}</template>
        </ElTableColumn>
        <ElTableColumn label="发放时间" min-width="180">
          <template #default="{ row }">{{ formatDateTime(row.delivered_at) }}</template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <ElButton type="primary" link @click="openOrderDetail(row)">详情</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>

      <ElPagination
        v-model:current-page="pager.page"
        v-model:page-size="pager.limit"
        class="saas-resource-pack-order-page__pagination"
        layout="total, sizes, prev, pager, next"
        :page-sizes="[10, 20, 50, 100]"
        :total="pager.total"
        @current-change="loadOrders"
        @size-change="handleSizeChange"
      />
    </ElCard>

    <ElDrawer v-model="detailVisible" title="资源包订单详情" size="520px">
      <ElSkeleton v-if="detailLoading" animated :rows="8" />
      <ElEmpty v-else-if="!currentDetail" description="未找到订单" />
      <ElDescriptions v-else :column="1" border>
        <ElDescriptionsItem label="订单号">{{ currentDetail.order_no }}</ElDescriptionsItem>
        <ElDescriptionsItem label="租户 ID">{{ currentDetail.tenant_id || '-' }}</ElDescriptionsItem>
        <ElDescriptionsItem label="资源包">{{ currentDetail.resource_pack_code }}</ElDescriptionsItem>
        <ElDescriptionsItem label="资源名称">{{ currentDetail.resource_pack_name }}</ElDescriptionsItem>
        <ElDescriptionsItem label="资源类型">{{ formatResourceType(currentDetail.resource_type) }}</ElDescriptionsItem>
        <ElDescriptionsItem label="额度">{{ formatQuota(currentDetail.resource_type, currentDetail.quota_amount) }}</ElDescriptionsItem>
        <ElDescriptionsItem label="金额">{{ formatPrice(currentDetail.amount_cents, currentDetail.currency) }}</ElDescriptionsItem>
        <ElDescriptionsItem label="状态">
          <ElTag :type="getStatusTagType(currentDetail.status)" effect="light">
            {{ formatStatus(currentDetail.status) }}
          </ElTag>
        </ElDescriptionsItem>
        <ElDescriptionsItem label="支付宝交易号">{{ currentDetail.alipay_trade_no || '-' }}</ElDescriptionsItem>
        <ElDescriptionsItem label="创建时间">{{ formatDateTime(currentDetail.create_time) }}</ElDescriptionsItem>
        <ElDescriptionsItem label="支付时间">{{ formatDateTime(currentDetail.paid_at) }}</ElDescriptionsItem>
        <ElDescriptionsItem label="发放时间">{{ formatDateTime(currentDetail.delivered_at) }}</ElDescriptionsItem>
      </ElDescriptions>
    </ElDrawer>
  </div>
</template>

<script setup lang="ts">
  import {
    fetchPlatformResourcePackOrder,
    fetchPlatformResourcePackOrders,
    type SaasResourcePackOrderRecord
  } from '@/api/saas'

  defineOptions({ name: 'SaasPlatformResourcePackOrderPage' })

  const loading = ref(false)
  const detailVisible = ref(false)
  const detailLoading = ref(false)
  const currentDetail = ref<SaasResourcePackOrderRecord | null>(null)
  const orders = ref<SaasResourcePackOrderRecord[]>([])
  const filters = reactive({
    order_no: '',
    tenant_id: '',
    resource_pack_code: '',
    resource_type: '',
    status: ''
  })
  const pager = reactive({
    page: 1,
    limit: 20,
    total: 0
  })

  const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })

  const resourceLabels: Record<string, string> = {
    ai_calls: 'AI 调用次数',
    tokens: 'Token',
    storage_mb: '存储空间',
    rag_documents: '知识库文档'
  }

  const statusLabels: Record<string, string> = {
    pending: '待支付',
    paid: '已支付',
    closed: '已关闭'
  }

  async function loadOrders() {
    loading.value = true

    try {
      const result = await fetchPlatformResourcePackOrders({
        page: pager.page,
        limit: pager.limit,
        order_no: filters.order_no || undefined,
        tenant_id: filters.tenant_id || undefined,
        resource_pack_code: filters.resource_pack_code || undefined,
        resource_type: filters.resource_type || undefined,
        status: filters.status || undefined
      })
      orders.value = result.list || []
      pager.total = Number(result.total) || 0
    } finally {
      loading.value = false
    }
  }

  function refreshOrders() {
    pager.page = 1
    loadOrders()
  }

  function handleSizeChange() {
    pager.page = 1
    loadOrders()
  }

  async function openOrderDetail(row: SaasResourcePackOrderRecord) {
    detailVisible.value = true
    detailLoading.value = true
    try {
      currentDetail.value = await fetchPlatformResourcePackOrder(row.order_no)
    } finally {
      detailLoading.value = false
    }
  }

  function formatResourceType(resourceType: string) {
    return resourceLabels[resourceType] || resourceType
  }

  function formatQuota(resourceType: string, value: unknown) {
    const amount = Number(value) || 0
    const formattedAmount = new Intl.NumberFormat('zh-CN').format(amount)
    return resourceType === 'storage_mb' ? `${formattedAmount} MB` : formattedAmount
  }

  function formatPrice(priceCents: number, currency = 'CNY') {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency
    }).format((Number(priceCents) || 0) / 100)
  }

  function formatStatus(status: string) {
    return statusLabels[status] || status
  }

  function getStatusTagType(status: string) {
    const normalized = String(status || '').toLowerCase()
    if (normalized === 'paid') return 'success'
    if (normalized === 'pending') return 'warning'
    if (normalized === 'closed') return 'info'
    return 'info'
  }

  function formatDateTime(value: unknown) {
    if (!value) return '-'
    const date = value instanceof Date ? value : new Date(String(value))
    return Number.isNaN(date.getTime()) ? String(value) : dateFormatter.format(date)
  }

  onMounted(() => {
    loadOrders()
  })
</script>

<style scoped>
  .saas-resource-pack-order-page {
    min-height: 100%;
  }

  .saas-resource-pack-order-page__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .saas-resource-pack-order-page__title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.4;
    letter-spacing: 0;
  }

  .saas-resource-pack-order-page__subtitle {
    margin: 6px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.5;
  }

  .saas-resource-pack-order-page__filters {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 16px;
  }

  .saas-resource-pack-order-page__input,
  .saas-resource-pack-order-page__select {
    width: 180px;
  }

  .saas-resource-pack-order-page__pagination {
    margin-top: 16px;
    justify-content: flex-end;
  }
</style>
