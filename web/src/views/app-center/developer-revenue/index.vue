<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="developer-revenue-page">
      <template #header>
        <div class="developer-revenue-page__header">
          <div>
            <h1 class="developer-revenue-page__title">开发者收入</h1>
            <p class="developer-revenue-page__subtitle"> 查看应用收入与平台结算进度。 </p>
          </div>
          <ElTooltip content="刷新" placement="bottom">
            <ElButton
              circle
              :icon="Refresh"
              :loading="loading || settlementLoading"
              aria-label="刷新开发者收入"
              @click="loadAll"
            />
          </ElTooltip>
        </div>
      </template>

      <div class="developer-revenue-page__filters">
        <ElDatePicker
          v-model="dateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          class="developer-revenue-page__date"
        />
        <ElInput
          v-model="appCode"
          clearable
          placeholder="应用编码"
          class="developer-revenue-page__app-filter"
          @keyup.enter="refreshRevenue"
        />
        <ElButton type="primary" :loading="loading" @click="refreshRevenue">查询</ElButton>
        <ElButton :disabled="loading" @click="resetRevenueFilters">重置</ElButton>
      </div>

      <div v-if="loadError.revenue" class="developer-revenue-page__error">
        <ElAlert type="error" :title="loadError.revenue" show-icon :closable="false" />
        <ElButton link type="primary" :loading="loading" @click="loadRevenue">重试</ElButton>
      </div>

      <div v-loading="loading" class="developer-revenue-page__revenue">
        <div v-if="overview" class="developer-revenue-page__kpis">
          <div v-for="item in kpis" :key="item.label" class="developer-revenue-page__kpi">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
            <small>{{ item.note }}</small>
          </div>
        </div>

        <section class="developer-revenue-page__section">
          <div class="developer-revenue-page__section-heading">
            <div>
              <h2>应用收入</h2>
              <p>当前账号所拥有应用的收入与待结算收益。</p>
            </div>
          </div>
          <ElTable :data="overview?.apps || []" border>
            <ElTableColumn label="应用" min-width="220">
              <template #default="{ row }">
                <div class="developer-revenue-page__primary">{{ row.app_name }}</div>
                <div class="developer-revenue-page__muted">{{ row.app_code }}</div>
              </template>
            </ElTableColumn>
            <ElTableColumn label="总收入" width="150" align="right">
              <template #default="{ row }">{{ formatMoney(row.gross_amount_cents) }}</template>
            </ElTableColumn>
            <ElTableColumn label="退款" width="150" align="right">
              <template #default="{ row }">{{ formatMoney(row.refund_amount_cents) }}</template>
            </ElTableColumn>
            <ElTableColumn label="开发者收入" width="170" align="right">
              <template #default="{ row }">{{ formatMoney(row.developer_amount_cents) }}</template>
            </ElTableColumn>
            <ElTableColumn label="待结算" width="150" align="right">
              <template #default="{ row }">
                {{ formatMoney(row.unsettled_developer_amount_cents) }}
              </template>
            </ElTableColumn>
            <ElTableColumn prop="order_count" label="订单数" width="100" align="right" />
            <template #empty>
              <ElEmpty description="所选时间范围内暂无应用收入" />
            </template>
          </ElTable>
        </section>
      </div>

      <section class="developer-revenue-page__section">
        <div class="developer-revenue-page__section-heading">
          <div>
            <h2>结算记录</h2>
            <p>结算批次由平台运营人员审核并付款。</p>
          </div>
          <ElSelect
            v-model="settlementStatus"
            clearable
            placeholder="状态"
            class="developer-revenue-page__status"
            @change="refreshSettlements"
          >
            <ElOption label="草稿" value="draft" />
            <ElOption label="已审核" value="approved" />
            <ElOption label="已付款" value="paid" />
            <ElOption label="已取消" value="cancelled" />
          </ElSelect>
        </div>

        <div v-if="loadError.settlements" class="developer-revenue-page__error">
          <ElAlert type="error" :title="loadError.settlements" show-icon :closable="false" />
          <ElButton link type="primary" :loading="settlementLoading" @click="loadSettlements">
            重试
          </ElButton>
        </div>

        <ElTable v-loading="settlementLoading" :data="settlements" border>
          <ElTableColumn prop="batch_no" label="结算批次" min-width="210" show-overflow-tooltip />
          <ElTableColumn label="结算周期" width="210">
            <template #default="{ row }">{{ row.period_start }} 至 {{ row.period_end }}</template>
          </ElTableColumn>
          <ElTableColumn label="总收入" width="140" align="right">
            <template #default="{ row }">{{ formatMoney(row.gross_amount_cents) }}</template>
          </ElTableColumn>
          <ElTableColumn label="退款" width="140" align="right">
            <template #default="{ row }">{{ formatMoney(row.refund_amount_cents) }}</template>
          </ElTableColumn>
          <ElTableColumn label="开发者收入" width="170" align="right">
            <template #default="{ row }">{{ formatMoney(row.developer_amount_cents) }}</template>
          </ElTableColumn>
          <ElTableColumn prop="order_count" label="订单数" width="100" align="right" />
          <ElTableColumn label="状态" width="120">
            <template #default="{ row }">
              <ElTag :type="settlementTagType(row.status)" effect="light">
                {{ settlementStatusText(row.status) }}
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn label="更新时间" width="180">
            <template #default="{ row }">
              {{ formatDateTime(row.paid_at || row.reviewed_at || row.update_time) }}
            </template>
          </ElTableColumn>
          <template #empty>
            <ElEmpty description="暂无结算记录" />
          </template>
        </ElTable>

        <ElPagination
          v-model:current-page="pager.page"
          v-model:page-size="pager.limit"
          class="developer-revenue-page__pagination"
          layout="total, sizes, prev, pager, next"
          :page-sizes="[10, 20, 50]"
          :total="pager.total"
          @current-change="loadSettlements"
          @size-change="handleSettlementSizeChange"
        />
      </section>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, reactive, ref } from 'vue'
  import { Refresh } from '@element-plus/icons-vue'
  import {
    fetchDeveloperAppRevenue,
    fetchDeveloperAppSettlements,
    type AppRevenueOverview,
    type AppSettlementRecord
  } from '@/api/app-commerce'

  defineOptions({ name: 'AppCenterDeveloperRevenuePage' })

  const overview = ref<AppRevenueOverview | null>(null)
  const settlements = ref<AppSettlementRecord[]>([])
  const loading = ref(false)
  const settlementLoading = ref(false)
  const loadError = reactive({ revenue: '', settlements: '' })
  const dateRange = ref<[string, string] | []>([])
  const appCode = ref('')
  const settlementStatus = ref<AppSettlementRecord['status'] | ''>('')
  const pager = reactive({ page: 1, limit: 20, total: 0 })
  const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })

  const kpis = computed(() => {
    const totals = overview.value?.totals
    if (!totals) return []
    return [
      {
        label: '总收入',
        value: formatMoney(totals.gross_amount_cents),
        note: `${totals.order_count} paid orders`
      },
      {
        label: '退款',
        value: formatMoney(totals.refund_amount_cents),
        note: '已确认全额退款'
      },
      {
        label: '开发者收入',
        value: formatMoney(totals.developer_amount_cents),
        note: '扣除平台分成后'
      },
      {
        label: '待结算金额',
        value: formatMoney(totals.unsettled_developer_amount_cents),
        note: '等待生成结算批次'
      }
    ]
  })

  function formatMoney(amountCents: number) {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: overview.value?.currency || 'CNY'
    }).format((Number(amountCents) || 0) / 100)
  }

  function formatDateTime(value: unknown) {
    if (!value) return '-'
    const date = value instanceof Date ? value : new Date(String(value))
    return Number.isNaN(date.getTime()) ? String(value) : dateFormatter.format(date)
  }

  function settlementStatusText(status: AppSettlementRecord['status']) {
    const labels: Record<AppSettlementRecord['status'], string> = {
      draft: '草稿',
      approved: '已审核',
      paid: '已付款',
      cancelled: '已取消'
    }
    return labels[status]
  }

  function settlementTagType(status: AppSettlementRecord['status']) {
    const types: Record<AppSettlementRecord['status'], 'success' | 'warning' | 'danger' | 'info'> =
      {
        draft: 'info',
        approved: 'warning',
        paid: 'success',
        cancelled: 'danger'
      }
    return types[status]
  }

  async function loadRevenue() {
    loading.value = true
    loadError.revenue = ''
    try {
      overview.value = await fetchDeveloperAppRevenue({
        start_date: dateRange.value[0] || undefined,
        end_date: dateRange.value[1] || undefined,
        app_code: appCode.value.trim() || undefined
      })
    } catch (error) {
      console.error('[AppCenterDeveloperRevenuePage] load revenue failed:', error)
      overview.value = null
      loadError.revenue = '开发者收入加载失败'
    } finally {
      loading.value = false
    }
  }

  async function loadSettlements() {
    settlementLoading.value = true
    loadError.settlements = ''
    try {
      const result = await fetchDeveloperAppSettlements({
        page: pager.page,
        limit: pager.limit,
        status: settlementStatus.value || undefined
      })
      settlements.value = result.list || []
      pager.total = Number(result.total) || 0
    } catch (error) {
      console.error('[AppCenterDeveloperRevenuePage] load settlements failed:', error)
      settlements.value = []
      pager.total = 0
      loadError.settlements = '结算记录加载失败'
    } finally {
      settlementLoading.value = false
    }
  }

  function loadAll() {
    return Promise.all([loadRevenue(), loadSettlements()])
  }

  function refreshRevenue() {
    loadRevenue()
  }

  function resetRevenueFilters() {
    dateRange.value = []
    appCode.value = ''
    loadRevenue()
  }

  function refreshSettlements() {
    pager.page = 1
    loadSettlements()
  }

  function handleSettlementSizeChange() {
    pager.page = 1
    loadSettlements()
  }

  onMounted(loadAll)
</script>

<style scoped>
  .developer-revenue-page {
    min-height: 100%;
  }

  .developer-revenue-page__header,
  .developer-revenue-page__filters,
  .developer-revenue-page__error,
  .developer-revenue-page__section-heading {
    display: flex;
    gap: 12px;
  }

  .developer-revenue-page__header,
  .developer-revenue-page__section-heading {
    align-items: flex-start;
    justify-content: space-between;
  }

  .developer-revenue-page__filters {
    flex-wrap: wrap;
    margin-bottom: 16px;
  }

  .developer-revenue-page__error {
    align-items: center;
    margin-bottom: 16px;
  }

  .developer-revenue-page__title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.4;
    letter-spacing: 0;
  }

  .developer-revenue-page__subtitle,
  .developer-revenue-page__section-heading p {
    margin: 6px 0 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--el-text-color-secondary);
  }

  .developer-revenue-page__date {
    width: 330px;
  }

  .developer-revenue-page__app-filter {
    width: 230px;
  }

  .developer-revenue-page__status {
    width: 150px;
  }

  .developer-revenue-page__revenue {
    min-height: 240px;
  }

  .developer-revenue-page__kpis {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }

  .developer-revenue-page__kpi {
    min-width: 0;
    padding: 14px 16px;
    background: var(--el-fill-color-extra-light);
    border: 1px solid var(--el-border-color-lighter);
  }

  .developer-revenue-page__kpi span,
  .developer-revenue-page__kpi small {
    display: block;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .developer-revenue-page__kpi strong {
    display: block;
    margin: 8px 0 4px;
    font-size: 22px;
    font-weight: 600;
    line-height: 1.2;
  }

  .developer-revenue-page__section {
    margin-top: 24px;
  }

  .developer-revenue-page__section-heading {
    margin-bottom: 12px;
  }

  .developer-revenue-page__section-heading h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0;
  }

  .developer-revenue-page__primary {
    font-weight: 500;
  }

  .developer-revenue-page__muted {
    margin-top: 2px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .developer-revenue-page__pagination {
    justify-content: flex-end;
    margin-top: 18px;
  }

  @media (width <= 980px) {
    .developer-revenue-page__kpis {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (width <= 680px) {
    .developer-revenue-page__date,
    .developer-revenue-page__app-filter,
    .developer-revenue-page__status {
      width: 100%;
    }

    .developer-revenue-page__kpis {
      grid-template-columns: 1fr;
    }

    .developer-revenue-page__section-heading {
      display: grid;
      grid-template-columns: 1fr;
    }

    .developer-revenue-page__pagination {
      justify-content: flex-start;
      overflow-x: auto;
    }
  }
</style>
