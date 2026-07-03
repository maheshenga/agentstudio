<template>
  <div class="art-full-height p-5">
    <ElCard v-loading="loading" shadow="never" class="saas-platform-usage-page">
      <template #header>
        <div class="saas-platform-usage-page__header">
          <div>
            <h1 class="saas-platform-usage-page__title">SaaS Usage</h1>
            <p class="saas-platform-usage-page__subtitle">Platform subscription, order, revenue, and quota overview.</p>
          </div>
          <ElButton :loading="loading" @click="loadOverview">Refresh</ElButton>
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
  import { ElMessage } from 'element-plus'
  import {
    fetchPlatformUsageOverview,
    type SaasPlatformUsageOverview
  } from '@/api/saas'

  defineOptions({ name: 'SaasPlatformUsagePage' })

  const loading = ref(false)
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

  const pendingOrders = computed(() => overview.value.kpis.pending_plan_orders + overview.value.kpis.pending_resource_pack_orders)

  function formatMoney(cents: number) {
    return `CNY ${((Number(cents) || 0) / 100).toFixed(2)}`
  }

  function formatNumber(value: number) {
    return new Intl.NumberFormat('zh-CN').format(Number(value) || 0)
  }

  function formatDate(value?: string | Date) {
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

  onMounted(loadOverview)
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

  @media (max-width: 1200px) {
    .saas-platform-usage-page__kpis {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 640px) {
    .saas-platform-usage-page__header {
      flex-direction: column;
      align-items: stretch;
    }

    .saas-platform-usage-page__kpis {
      grid-template-columns: 1fr;
    }
  }
</style>
