<template>
  <div class="art-full-height p-5">
    <ElCard v-loading="loading" shadow="never" class="saas-platform-usage-page">
      <template #header>
        <div class="saas-platform-usage-page__header">
          <div>
            <h1 class="saas-platform-usage-page__title">SaaS Usage</h1>
            <p class="saas-platform-usage-page__subtitle">Platform subscription, order, revenue, and quota overview.</p>
          </div>
          <ElButton :icon="Refresh" :loading="loading" @click="loadPage">Refresh</ElButton>
        </div>
      </template>

      <div class="saas-platform-usage-page__kpis">
        <div class="saas-platform-usage-page__kpi">
          <span class="saas-platform-usage-page__kpi-label">Active subscriptions</span>
          <strong>{{ formatNumber(overview.kpis.active_subscriptions) }}</strong>
        </div>
        <div class="saas-platform-usage-page__kpi">
          <span class="saas-platform-usage-page__kpi-label">Trialing subscriptions</span>
          <strong>{{ formatNumber(overview.kpis.trialing_subscriptions) }}</strong>
        </div>
        <div class="saas-platform-usage-page__kpi">
          <span class="saas-platform-usage-page__kpi-label">Total paid revenue</span>
          <strong>{{ formatMoney(overview.kpis.total_paid_amount_cents) }}</strong>
        </div>
        <div class="saas-platform-usage-page__kpi">
          <span class="saas-platform-usage-page__kpi-label">Pending orders</span>
          <strong>{{ formatNumber(pendingOrders) }}</strong>
        </div>
      </div>

      <section class="saas-platform-usage-page__section" v-loading="reconciliationLoading">
        <div class="saas-platform-usage-page__section-header saas-platform-usage-page__section-header--responsive">
          <div>
            <h2>Payment reconciliation</h2>
            <p class="saas-platform-usage-page__section-note">
              Pending payment requests without callbacks for {{ reconciliation.stale_minutes }} minutes or more.
            </p>
          </div>
          <div class="saas-platform-usage-page__actions">
            <ElInputNumber
              v-model="staleMinutes"
              :min="10"
              :max="1440"
              :step="10"
              controls-position="right"
              class="saas-platform-usage-page__stale-input"
            />
            <ElButton :icon="Refresh" :loading="reconciliationLoading" @click="loadReconciliation">Refresh</ElButton>
            <ElButton type="primary" :icon="Search" :loading="reconciliationLoading" @click="scanReconciliation">
              Scan
            </ElButton>
          </div>
        </div>

        <div class="saas-platform-usage-page__kpis saas-platform-usage-page__kpis--compact">
          <div class="saas-platform-usage-page__kpi">
            <span class="saas-platform-usage-page__kpi-label">Stale plan payments</span>
            <strong>{{ formatNumber(reconciliation.stale_plan_payment_count) }}</strong>
          </div>
          <div class="saas-platform-usage-page__kpi">
            <span class="saas-platform-usage-page__kpi-label">Stale resource-pack payments</span>
            <strong>{{ formatNumber(reconciliation.stale_resource_pack_payment_count) }}</strong>
          </div>
          <div class="saas-platform-usage-page__kpi">
            <span class="saas-platform-usage-page__kpi-label">Stale payment amount</span>
            <strong>{{ formatMoney(stalePaymentAmount) }}</strong>
          </div>
          <div class="saas-platform-usage-page__kpi">
            <span class="saas-platform-usage-page__kpi-label">Last checked</span>
            <strong class="saas-platform-usage-page__kpi-date">{{ formatDate(reconciliation.checked_at) }}</strong>
          </div>
        </div>

        <div class="saas-platform-usage-page__reconciliation-grid">
          <div>
            <div class="saas-platform-usage-page__table-title">Plan payment exceptions</div>
            <ElTable :data="reconciliation.recent_plan_orders" border>
              <ElTableColumn prop="order_no" label="Order no" min-width="210" />
              <ElTableColumn prop="tenant_id" label="Tenant" width="100" />
              <ElTableColumn label="Amount" width="130" align="right">
                <template #default="{ row }">{{ formatMoney(row.amount_cents) }}</template>
              </ElTableColumn>
              <ElTableColumn label="Requested" min-width="180">
                <template #default="{ row }">{{ formatDate(row.payment_requested_at) }}</template>
              </ElTableColumn>
              <template #empty>
                <ElEmpty description="No stale plan payments" />
              </template>
            </ElTable>
          </div>
          <div>
            <div class="saas-platform-usage-page__table-title">Resource-pack payment exceptions</div>
            <ElTable :data="reconciliation.recent_resource_pack_orders" border>
              <ElTableColumn prop="order_no" label="Order no" min-width="210" />
              <ElTableColumn prop="tenant_id" label="Tenant" width="100" />
              <ElTableColumn label="Amount" width="130" align="right">
                <template #default="{ row }">{{ formatMoney(row.amount_cents) }}</template>
              </ElTableColumn>
              <ElTableColumn label="Requested" min-width="180">
                <template #default="{ row }">{{ formatDate(row.payment_requested_at) }}</template>
              </ElTableColumn>
              <template #empty>
                <ElEmpty description="No stale resource-pack payments" />
              </template>
            </ElTable>
          </div>
        </div>
      </section>

      <section class="saas-platform-usage-page__section">
        <div class="saas-platform-usage-page__section-header">
          <h2>Quota summary</h2>
        </div>
        <ElTable :data="overview.quota_summary" border>
          <ElTableColumn label="Resource" min-width="150">
            <template #default="{ row }">{{ quotaLabel(row.resource_type) }}</template>
          </ElTableColumn>
          <ElTableColumn label="Total" min-width="130" align="right">
            <template #default="{ row }">{{ formatNumber(row.total_quota) }}</template>
          </ElTableColumn>
          <ElTableColumn label="Used" min-width="130" align="right">
            <template #default="{ row }">{{ formatNumber(row.used_quota) }}</template>
          </ElTableColumn>
          <ElTableColumn label="Remaining" min-width="130" align="right">
            <template #default="{ row }">{{ formatNumber(row.remaining_quota) }}</template>
          </ElTableColumn>
          <ElTableColumn label="Usage" min-width="220">
            <template #default="{ row }">
              <ElProgress :percentage="normalizeRate(row.usage_rate)" :stroke-width="10" />
            </template>
          </ElTableColumn>
          <template #empty>
            <ElEmpty description="No quota data" />
          </template>
        </ElTable>
      </section>

      <section class="saas-platform-usage-page__section" v-loading="quotaLedgerLoading">
        <div class="saas-platform-usage-page__section-header saas-platform-usage-page__section-header--responsive">
          <div>
            <h2>Quota ledger</h2>
          </div>
          <div class="saas-platform-usage-page__actions">
            <ElInput
              v-model="quotaLedgerFilters.tenant_id"
              clearable
              placeholder="Tenant ID"
              class="saas-platform-usage-page__filter-input"
              @clear="refreshQuotaLedgers"
              @keyup.enter="refreshQuotaLedgers"
            />
            <ElSelect
              v-model="quotaLedgerFilters.resource_type"
              clearable
              placeholder="Resource"
              class="saas-platform-usage-page__filter-select"
              @change="refreshQuotaLedgers"
            >
              <ElOption label="Users" value="users" />
              <ElOption label="Storage MB" value="storage_mb" />
              <ElOption label="AI Calls" value="ai_calls" />
              <ElOption label="RAG Documents" value="rag_documents" />
              <ElOption label="Tokens" value="tokens" />
            </ElSelect>
            <ElSelect
              v-model="quotaLedgerFilters.change_type"
              clearable
              placeholder="Change"
              class="saas-platform-usage-page__filter-select"
              @change="refreshQuotaLedgers"
            >
              <ElOption label="Grant" value="grant" />
              <ElOption label="Consume" value="consume" />
            </ElSelect>
            <ElSelect
              v-model="quotaLedgerFilters.source_type"
              clearable
              placeholder="Source"
              class="saas-platform-usage-page__filter-select"
              @change="refreshQuotaLedgers"
            >
              <ElOption label="AI Chat" value="ai_chat" />
              <ElOption label="Resource Pack Order" value="resource_pack_order" />
            </ElSelect>
            <ElInput
              v-model="quotaLedgerFilters.source_id"
              clearable
              placeholder="Source ID"
              class="saas-platform-usage-page__filter-input"
              @clear="refreshQuotaLedgers"
              @keyup.enter="refreshQuotaLedgers"
            />
            <ElButton :icon="Refresh" :loading="quotaLedgerLoading" @click="refreshQuotaLedgers">Refresh</ElButton>
          </div>
        </div>
        <ElTable :data="quotaLedgers" border>
          <ElTableColumn prop="tenant_id" label="Tenant" width="100" />
          <ElTableColumn label="Resource" min-width="140">
            <template #default="{ row }">{{ quotaLabel(row.resource_type) }}</template>
          </ElTableColumn>
          <ElTableColumn label="Change" width="120">
            <template #default="{ row }">
              <ElTag :type="getChangeTagType(row.change_type)" effect="light">
                {{ changeTypeLabel(row.change_type) }}
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn label="Quota delta" min-width="130" align="right">
            <template #default="{ row }">{{ formatSignedNumber(row.quota_delta) }}</template>
          </ElTableColumn>
          <ElTableColumn label="Used delta" min-width="130" align="right">
            <template #default="{ row }">{{ formatSignedNumber(row.used_delta) }}</template>
          </ElTableColumn>
          <ElTableColumn label="Balance" min-width="170" align="right">
            <template #default="{ row }">
              {{ formatNumber(row.balance_used_quota) }} / {{ formatNumber(row.balance_total_quota) }}
            </template>
          </ElTableColumn>
          <ElTableColumn label="Source" min-width="170" show-overflow-tooltip>
            <template #default="{ row }">{{ formatLedgerSource(row) }}</template>
          </ElTableColumn>
          <ElTableColumn label="Time" min-width="180">
            <template #default="{ row }">{{ formatDate(row.create_time) }}</template>
          </ElTableColumn>
          <template #empty>
            <ElEmpty description="No quota ledger records" />
          </template>
        </ElTable>
        <ElPagination
          v-model:current-page="quotaLedgerPager.page"
          v-model:page-size="quotaLedgerPager.limit"
          class="saas-platform-usage-page__pagination"
          layout="total, sizes, prev, pager, next"
          :page-sizes="[10, 20, 50, 100]"
          :total="quotaLedgerPager.total"
          @current-change="loadQuotaLedgers"
          @size-change="handleQuotaLedgerSizeChange"
        />
      </section>

      <section class="saas-platform-usage-page__section">
        <div class="saas-platform-usage-page__section-header">
          <h2>Plan distribution</h2>
        </div>
        <ElTable :data="overview.plan_distribution" border>
          <ElTableColumn prop="plan_code" label="Plan code" min-width="140" />
          <ElTableColumn prop="plan_name" label="Plan name" min-width="180" />
          <ElTableColumn label="Active subscriptions" min-width="180" align="right">
            <template #default="{ row }">{{ formatNumber(row.active_count) }}</template>
          </ElTableColumn>
          <template #empty>
            <ElEmpty description="No active plan data" />
          </template>
        </ElTable>
      </section>

      <section class="saas-platform-usage-page__section">
        <div class="saas-platform-usage-page__section-header">
          <h2>Recent plan orders</h2>
        </div>
        <ElTable :data="overview.recent_plan_orders" border>
          <ElTableColumn prop="order_no" label="Order no" min-width="210" />
          <ElTableColumn prop="tenant_id" label="Tenant" width="100" />
          <ElTableColumn prop="plan_code" label="Plan" width="120" />
          <ElTableColumn label="Amount" width="130" align="right">
            <template #default="{ row }">{{ formatMoney(row.amount_cents) }}</template>
          </ElTableColumn>
          <ElTableColumn prop="status" label="Status" width="110" />
          <ElTableColumn label="Created" min-width="180">
            <template #default="{ row }">{{ formatDate(row.create_time) }}</template>
          </ElTableColumn>
          <template #empty>
            <ElEmpty description="No plan orders" />
          </template>
        </ElTable>
      </section>

      <section class="saas-platform-usage-page__section">
        <div class="saas-platform-usage-page__section-header">
          <h2>Recent resource-pack orders</h2>
        </div>
        <ElTable :data="overview.recent_resource_pack_orders" border>
          <ElTableColumn prop="order_no" label="Order no" min-width="210" />
          <ElTableColumn prop="tenant_id" label="Tenant" width="100" />
          <ElTableColumn prop="resource_pack_code" label="Pack" min-width="150" />
          <ElTableColumn label="Resource" min-width="130">
            <template #default="{ row }">{{ quotaLabel(row.resource_type) }}</template>
          </ElTableColumn>
          <ElTableColumn label="Amount" width="130" align="right">
            <template #default="{ row }">{{ formatMoney(row.amount_cents) }}</template>
          </ElTableColumn>
          <ElTableColumn prop="status" label="Status" width="110" />
          <ElTableColumn label="Created" min-width="180">
            <template #default="{ row }">{{ formatDate(row.create_time) }}</template>
          </ElTableColumn>
          <template #empty>
            <ElEmpty description="No resource-pack orders" />
          </template>
        </ElTable>
      </section>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { Refresh, Search } from '@element-plus/icons-vue'
  import { ElMessage } from 'element-plus'
  import {
    fetchPlatformPaymentReconciliationOverview,
    fetchPlatformQuotaLedgers,
    fetchPlatformUsageOverview,
    scanPlatformPaymentReconciliation,
    type SaasPaymentReconciliationOverview,
    type SaasPlatformUsageOverview,
    type TenantQuotaLedgerRecord
  } from '@/api/saas'

  defineOptions({ name: 'SaasPlatformUsagePage' })

  const loading = ref(false)
  const reconciliationLoading = ref(false)
  const quotaLedgerLoading = ref(false)
  const staleMinutes = ref(120)
  const quotaLedgers = ref<TenantQuotaLedgerRecord[]>([])
  const quotaLedgerFilters = reactive({
    tenant_id: '',
    resource_type: '',
    change_type: '',
    source_type: '',
    source_id: ''
  })
  const quotaLedgerPager = reactive({
    page: 1,
    limit: 20,
    total: 0
  })
  const overview = ref<SaasPlatformUsageOverview>({
    kpis: {
      active_subscriptions: 0,
      trialing_subscriptions: 0,
      expired_subscriptions: 0,
      pending_plan_orders: 0,
      pending_resource_pack_orders: 0,
      paid_plan_order_amount_cents: 0,
      paid_resource_pack_order_amount_cents: 0,
      total_paid_amount_cents: 0
    },
    quota_summary: [],
    plan_distribution: [],
    recent_plan_orders: [],
    recent_resource_pack_orders: []
  })
  const reconciliation = ref<SaasPaymentReconciliationOverview>({
    checked_at: '',
    stale_minutes: 120,
    stale_plan_payment_count: 0,
    stale_resource_pack_payment_count: 0,
    stale_plan_payment_amount_cents: 0,
    stale_resource_pack_payment_amount_cents: 0,
    recent_plan_orders: [],
    recent_resource_pack_orders: []
  })

  const pendingOrders = computed(() => overview.value.kpis.pending_plan_orders + overview.value.kpis.pending_resource_pack_orders)
  const stalePaymentAmount = computed(
    () =>
      reconciliation.value.stale_plan_payment_amount_cents +
      reconciliation.value.stale_resource_pack_payment_amount_cents
  )

  function formatMoney(cents: number) {
    return `CNY ${((Number(cents) || 0) / 100).toFixed(2)}`
  }

  function formatNumber(value: number) {
    return new Intl.NumberFormat('zh-CN').format(Number(value) || 0)
  }

  function formatSignedNumber(value: number) {
    const numericValue = Number(value) || 0
    if (numericValue === 0) return '0'
    return numericValue > 0 ? `+${formatNumber(numericValue)}` : `-${formatNumber(Math.abs(numericValue))}`
  }

  function formatDate(value?: string | Date | null) {
    if (!value) return '-'
    return new Date(value).toLocaleString('zh-CN', { hour12: false })
  }

  function quotaLabel(type: string) {
    const labels: Record<string, string> = {
      users: 'Users',
      storage_mb: 'Storage MB',
      ai_calls: 'AI Calls',
      rag_documents: 'RAG Documents',
      tokens: 'Tokens'
    }
    return labels[type] || type
  }

  function changeTypeLabel(type: string) {
    const labels: Record<string, string> = {
      grant: 'Grant',
      consume: 'Consume'
    }
    return labels[type] || type || '-'
  }

  function getChangeTagType(type: string) {
    if (type === 'grant') return 'success'
    if (type === 'consume') return 'warning'
    return 'info'
  }

  function formatLedgerSource(row: TenantQuotaLedgerRecord) {
    const sourceType = row.source_type || '-'
    return row.source_id ? `${sourceType} / ${row.source_id}` : sourceType
  }

  function normalizeRate(value: number) {
    return Math.min(100, Math.max(0, Number(value) || 0))
  }

  async function loadOverview() {
    loading.value = true
    try {
      overview.value = await fetchPlatformUsageOverview()
    } catch (error) {
      console.error('[SaasPlatformUsagePage] load overview failed:', error)
      ElMessage.error('Load usage overview failed')
    } finally {
      loading.value = false
    }
  }

  async function loadReconciliation() {
    reconciliationLoading.value = true
    try {
      reconciliation.value = await fetchPlatformPaymentReconciliationOverview({ stale_minutes: staleMinutes.value })
    } catch (error) {
      console.error('[SaasPlatformUsagePage] load payment reconciliation failed:', error)
      ElMessage.error('Load payment reconciliation failed')
    } finally {
      reconciliationLoading.value = false
    }
  }

  async function loadQuotaLedgers() {
    quotaLedgerLoading.value = true
    try {
      const result = await fetchPlatformQuotaLedgers({
        page: quotaLedgerPager.page,
        limit: quotaLedgerPager.limit,
        tenant_id: quotaLedgerFilters.tenant_id || undefined,
        resource_type: quotaLedgerFilters.resource_type || undefined,
        change_type: quotaLedgerFilters.change_type || undefined,
        source_type: quotaLedgerFilters.source_type || undefined,
        source_id: quotaLedgerFilters.source_id || undefined
      })
      quotaLedgers.value = Array.isArray(result?.list) ? result.list : []
      quotaLedgerPager.total = Number(result?.total) || 0
    } catch (error) {
      console.error('[SaasPlatformUsagePage] load quota ledgers failed:', error)
      quotaLedgers.value = []
      quotaLedgerPager.total = 0
      ElMessage.error('Load quota ledgers failed')
    } finally {
      quotaLedgerLoading.value = false
    }
  }

  function refreshQuotaLedgers() {
    quotaLedgerPager.page = 1
    loadQuotaLedgers()
  }

  function handleQuotaLedgerSizeChange() {
    quotaLedgerPager.page = 1
    loadQuotaLedgers()
  }

  async function scanReconciliation() {
    reconciliationLoading.value = true
    try {
      reconciliation.value = await scanPlatformPaymentReconciliation({ stale_minutes: staleMinutes.value })
      ElMessage.success('Payment reconciliation scan completed')
    } catch (error) {
      console.error('[SaasPlatformUsagePage] scan payment reconciliation failed:', error)
      ElMessage.error('Payment reconciliation scan failed')
    } finally {
      reconciliationLoading.value = false
    }
  }

  async function loadPage() {
    await Promise.all([loadOverview(), loadReconciliation(), loadQuotaLedgers()])
  }

  onMounted(loadPage)
</script>

<style scoped>
  .saas-platform-usage-page {
    min-height: 100%;
  }

  .saas-platform-usage-page__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .saas-platform-usage-page__title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.4;
  }

  .saas-platform-usage-page__subtitle {
    margin: 6px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.5;
  }

  .saas-platform-usage-page__kpis {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 20px;
  }

  .saas-platform-usage-page__kpi {
    min-height: 86px;
    padding: 16px;
    border: 1px solid var(--el-border-color-light);
    border-radius: 6px;
    background: var(--el-fill-color-blank);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .saas-platform-usage-page__kpi-label {
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.4;
  }

  .saas-platform-usage-page__kpi strong {
    color: var(--el-text-color-primary);
    font-size: 24px;
    font-weight: 700;
    line-height: 1.2;
  }

  .saas-platform-usage-page__kpi strong.saas-platform-usage-page__kpi-date {
    font-size: 15px;
    line-height: 1.4;
  }

  .saas-platform-usage-page__section {
    margin-top: 20px;
  }

  .saas-platform-usage-page__section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
  }

  .saas-platform-usage-page__section-header h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    line-height: 1.4;
  }

  .saas-platform-usage-page__section-header--responsive {
    align-items: flex-end;
  }

  .saas-platform-usage-page__section-note {
    margin: 4px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.5;
  }

  .saas-platform-usage-page__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
  }

  .saas-platform-usage-page__stale-input {
    width: 150px;
  }

  .saas-platform-usage-page__filter-input,
  .saas-platform-usage-page__filter-select {
    width: 160px;
  }

  .saas-platform-usage-page__pagination {
    margin-top: 14px;
    justify-content: flex-end;
  }

  .saas-platform-usage-page__kpis--compact {
    margin-bottom: 14px;
  }

  .saas-platform-usage-page__reconciliation-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .saas-platform-usage-page__table-title {
    margin-bottom: 8px;
    color: var(--el-text-color-regular);
    font-size: 13px;
    font-weight: 600;
    line-height: 1.4;
  }

  @media (max-width: 1200px) {
    .saas-platform-usage-page__kpis {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .saas-platform-usage-page__reconciliation-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .saas-platform-usage-page__header,
    .saas-platform-usage-page__section-header--responsive {
      flex-direction: column;
      align-items: stretch;
    }

    .saas-platform-usage-page__kpis {
      grid-template-columns: 1fr;
    }

    .saas-platform-usage-page__actions {
      justify-content: flex-start;
    }

    .saas-platform-usage-page__filter-input,
    .saas-platform-usage-page__filter-select {
      width: 100%;
    }
  }
</style>
