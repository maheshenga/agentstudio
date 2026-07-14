<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="app-orders-page">
      <template #header>
        <div class="app-orders-page__header">
          <div>
            <h1 class="app-orders-page__title">应用订单</h1>
            <p class="app-orders-page__subtitle">
              查看应用购买记录，并继续尚未完成的支付宝付款。
            </p>
          </div>
          <ElTooltip content="刷新" placement="bottom">
            <ElButton
              circle
              :icon="Refresh"
              :loading="loading"
              aria-label="刷新应用订单"
              @click="loadOrders"
            />
          </ElTooltip>
        </div>
      </template>

      <div class="app-orders-page__filters">
        <ElInput
          v-model="filters.order_no"
          clearable
          placeholder="订单号"
          class="app-orders-page__keyword"
          @keyup.enter="refreshOrders"
        />
        <ElInput
          v-model="filters.app_code"
          clearable
          placeholder="应用编码"
          class="app-orders-page__keyword"
          @keyup.enter="refreshOrders"
        />
        <ElSelect
          v-model="filters.status"
          clearable
          placeholder="状态"
          class="app-orders-page__status"
          @change="refreshOrders"
        >
          <ElOption label="待支付" value="pending" />
          <ElOption label="已支付" value="paid" />
          <ElOption label="已退款" value="refunded" />
          <ElOption label="已关闭" value="closed" />
        </ElSelect>
        <ElButton type="primary" :loading="loading" @click="refreshOrders">查询</ElButton>
        <ElButton :disabled="loading" @click="resetFilters">重置</ElButton>
      </div>

      <div v-if="loadError" class="app-orders-page__error">
        <ElAlert type="error" :title="loadError" show-icon :closable="false" />
        <ElButton link type="primary" :loading="loading" @click="loadOrders">重试</ElButton>
      </div>

      <ElTable v-loading="loading" :data="records" border>
        <ElTableColumn prop="order_no" label="订单号" min-width="210" show-overflow-tooltip />
        <ElTableColumn label="应用" min-width="210">
          <template #default="{ row }">
            <div class="app-orders-page__primary">{{ row.app_name || row.app_code }}</div>
            <div class="app-orders-page__muted">{{ row.app_code }}</div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="套餐" min-width="180">
          <template #default="{ row }">
            <div class="app-orders-page__primary">{{ row.price_plan_code }}</div>
            <div class="app-orders-page__muted">
              {{ pricingText(row.pricing_model, row.billing_period) }}
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="金额" width="130" align="right">
          <template #default="{ row }">{{ formatMoney(row.amount_cents, row.currency) }}</template>
        </ElTableColumn>
        <ElTableColumn label="状态" width="130">
          <template #default="{ row }">
            <ElTag :type="statusTagType(row.status)" effect="light">
              {{ statusText(row.status) }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="发起支付时间" width="180">
          <template #default="{ row }">{{ formatDateTime(row.payment_requested_at) }}</template>
        </ElTableColumn>
        <ElTableColumn label="创建时间" width="180">
          <template #default="{ row }">{{ formatDateTime(row.create_time) }}</template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <ElButton
              v-if="row.status === 'pending'"
              link
              type="primary"
              :loading="payingOrderNo === row.order_no"
              @click="continuePayment(row)"
            >
              继续支付
            </ElButton>
            <span v-else class="app-orders-page__muted">无需操作</span>
          </template>
        </ElTableColumn>
        <template #empty>
          <ElEmpty description="暂无应用订单" />
        </template>
      </ElTable>

      <ElPagination
        v-model:current-page="pager.page"
        v-model:page-size="pager.limit"
        class="app-orders-page__pagination"
        layout="total, sizes, prev, pager, next"
        :page-sizes="[10, 20, 50]"
        :total="pager.total"
        @current-change="loadOrders"
        @size-change="handleSizeChange"
      />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, reactive, ref } from 'vue'
  import { ElMessage } from 'element-plus'
  import { Refresh } from '@element-plus/icons-vue'
  import {
    fetchTenantAppOrders,
    startAppAlipayPayment,
    type AppOrderRecord,
    type AppOrderStatus
  } from '@/api/app-commerce'

  defineOptions({ name: 'AppCenterOrdersPage' })

  const records = ref<AppOrderRecord[]>([])
  const loading = ref(false)
  const loadError = ref('')
  const payingOrderNo = ref('')
  const filters = reactive<{ order_no: string; app_code: string; status: AppOrderStatus | '' }>({
    order_no: '',
    app_code: '',
    status: ''
  })
  const pager = reactive({ page: 1, limit: 20, total: 0 })
  const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })

  function formatMoney(amountCents: number, currency = 'CNY') {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency
    }).format((Number(amountCents) || 0) / 100)
  }

  function formatDateTime(value: unknown) {
    if (!value) return '-'
    const date = value instanceof Date ? value : new Date(String(value))
    return Number.isNaN(date.getTime()) ? String(value) : dateFormatter.format(date)
  }

  function pricingText(model: string, period: string) {
    if (model === 'one_time') return '一次性购买'
    if (period === 'monthly') return '按月订阅'
    if (period === 'yearly') return '按年订阅'
    return model || '-'
  }

  function statusText(status: AppOrderStatus) {
    const labels: Record<AppOrderStatus, string> = {
      pending: '待支付',
      paid: '已支付',
      refunded: '已退款',
      closed: '已关闭'
    }
    return labels[status]
  }

  function statusTagType(status: AppOrderStatus) {
    const types: Record<AppOrderStatus, 'success' | 'warning' | 'danger' | 'info'> = {
      pending: 'warning',
      paid: 'success',
      refunded: 'danger',
      closed: 'info'
    }
    return types[status]
  }

  async function loadOrders() {
    loading.value = true
    loadError.value = ''
    try {
      const result = await fetchTenantAppOrders({
        page: pager.page,
        limit: pager.limit,
        order_no: filters.order_no.trim() || undefined,
        app_code: filters.app_code.trim() || undefined,
        status: filters.status || undefined
      })
      records.value = result.list || []
      pager.total = Number(result.total) || 0
    } catch (error) {
      console.error('[AppCenterOrdersPage] load orders failed:', error)
      records.value = []
      pager.total = 0
      loadError.value = '应用订单加载失败'
    } finally {
      loading.value = false
    }
  }

  function refreshOrders() {
    pager.page = 1
    loadOrders()
  }

  function resetFilters() {
    filters.order_no = ''
    filters.app_code = ''
    filters.status = ''
    refreshOrders()
  }

  function handleSizeChange() {
    pager.page = 1
    loadOrders()
  }

  async function continuePayment(order: AppOrderRecord) {
    payingOrderNo.value = order.order_no
    try {
      const result = await startAppAlipayPayment(order.order_no)
      if (result.configured && result.pay_url) {
        window.open(result.pay_url, '_blank', 'noopener,noreferrer')
        ElMessage.success('已打开支付宝付款页面')
        await loadOrders()
        return
      }
      ElMessage.warning(result.message || '支付宝尚未配置')
    } catch (error) {
      console.error('[AppCenterOrdersPage] start payment failed:', error)
      ElMessage.error('支付发起失败')
    } finally {
      payingOrderNo.value = ''
    }
  }

  onMounted(loadOrders)
</script>

<style scoped>
  .app-orders-page {
    min-height: 100%;
  }

  .app-orders-page__header,
  .app-orders-page__filters,
  .app-orders-page__error {
    display: flex;
    gap: 12px;
  }

  .app-orders-page__header {
    align-items: flex-start;
    justify-content: space-between;
  }

  .app-orders-page__filters {
    flex-wrap: wrap;
    margin-bottom: 16px;
  }

  .app-orders-page__error {
    align-items: center;
    margin-bottom: 16px;
  }

  .app-orders-page__title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.4;
    letter-spacing: 0;
  }

  .app-orders-page__subtitle {
    margin: 6px 0 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--el-text-color-secondary);
  }

  .app-orders-page__keyword {
    width: 230px;
  }

  .app-orders-page__status {
    width: 150px;
  }

  .app-orders-page__primary {
    font-weight: 500;
    color: var(--el-text-color-primary);
  }

  .app-orders-page__muted {
    margin-top: 2px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .app-orders-page__pagination {
    justify-content: flex-end;
    margin-top: 18px;
  }

  @media (width <= 760px) {
    .app-orders-page__header {
      align-items: center;
    }

    .app-orders-page__keyword,
    .app-orders-page__status {
      width: 100%;
    }

    .app-orders-page__pagination {
      justify-content: flex-start;
      overflow-x: auto;
    }
  }
</style>
