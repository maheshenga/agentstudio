<template>
  <div class="art-full-height p-5">
    <ElCard v-loading="loading" shadow="never" class="saas-revenue-page">
      <template #header>
        <div class="saas-revenue-page__header">
          <div>
            <h1 class="saas-revenue-page__title">SaaS Revenue</h1>
            <p class="saas-revenue-page__subtitle">Cash-basis revenue from paid plan and resource-pack orders.</p>
          </div>
          <ElButton :loading="loading" @click="loadOverview">Refresh</ElButton>
        </div>
      </template>

      <div class="saas-revenue-page__kpis">
        <div class="saas-revenue-page__kpi">
          <span>Today revenue</span>
          <strong>{{ formatMoney(overview.kpis.today_revenue_cents) }}</strong>
        </div>
        <div class="saas-revenue-page__kpi">
          <span>Month revenue</span>
          <strong>{{ formatMoney(overview.kpis.month_revenue_cents) }}</strong>
        </div>
        <div class="saas-revenue-page__kpi">
          <span>Total revenue</span>
          <strong>{{ formatMoney(overview.kpis.total_revenue_cents) }}</strong>
        </div>
        <div class="saas-revenue-page__kpi">
          <span>Month paid tenants</span>
          <strong>{{ formatNumber(overview.kpis.month_paid_tenant_count) }}</strong>
        </div>
        <div class="saas-revenue-page__kpi">
          <span>Month paid orders</span>
          <strong>{{ formatNumber(overview.kpis.month_paid_order_count) }}</strong>
        </div>
        <div class="saas-revenue-page__kpi">
          <span>Month AOV</span>
          <strong>{{ formatMoney(overview.kpis.month_average_order_value_cents) }}</strong>
        </div>
      </div>

      <section class="saas-revenue-page__section">
        <div class="saas-revenue-page__section-header">
          <h2>Revenue split</h2>
        </div>
        <ElTable :data="overview.revenue_split" border>
          <ElTableColumn label="Source" min-width="160">
            <template #default="{ row }">{{ sourceLabel(row.source) }}</template>
          </ElTableColumn>
          <ElTableColumn label="Revenue" min-width="160" align="right">
            <template #default="{ row }">{{ formatMoney(row.revenue_cents) }}</template>
          </ElTableColumn>
          <ElTableColumn label="Orders" min-width="120" align="right">
            <template #default="{ row }">{{ formatNumber(row.order_count) }}</template>
          </ElTableColumn>
          <ElTableColumn label="Percent" min-width="180">
            <template #default="{ row }">
              <ElProgress :percentage="normalizePercent(row.percent)" :stroke-width="10" />
            </template>
          </ElTableColumn>
          <template #empty>
            <ElEmpty description="No revenue split" />
          </template>
        </ElTable>
      </section>

      <section class="saas-revenue-page__section">
        <div class="saas-revenue-page__section-header">
          <h2>Last 30 days</h2>
        </div>
        <ElTable :data="overview.daily_trend" border height="360">
          <ElTableColumn prop="date" label="Date" width="130" />
          <ElTableColumn label="Plan revenue" min-width="150" align="right">
            <template #default="{ row }">{{ formatMoney(row.plan_revenue_cents) }}</template>
          </ElTableColumn>
          <ElTableColumn label="Resource-pack revenue" min-width="190" align="right">
            <template #default="{ row }">{{ formatMoney(row.resource_pack_revenue_cents) }}</template>
          </ElTableColumn>
          <ElTableColumn label="Total revenue" min-width="150" align="right">
            <template #default="{ row }">{{ formatMoney(row.total_revenue_cents) }}</template>
          </ElTableColumn>
          <ElTableColumn label="Orders" width="110" align="right">
            <template #default="{ row }">{{ formatNumber(row.paid_order_count) }}</template>
          </ElTableColumn>
          <template #empty>
            <ElEmpty description="No trend data" />
          </template>
        </ElTable>
      </section>

      <section class="saas-revenue-page__section">
        <div class="saas-revenue-page__section-header">
          <h2>Top tenants</h2>
        </div>
        <ElTable :data="overview.top_tenants" border>
          <ElTableColumn label="Tenant" min-width="160">
            <template #default="{ row }">{{ row.tenant_name || `#${row.tenant_id}` }}</template>
          </ElTableColumn>
          <ElTableColumn label="Revenue" min-width="160" align="right">
            <template #default="{ row }">{{ formatMoney(row.revenue_cents) }}</template>
          </ElTableColumn>
          <ElTableColumn label="Orders" width="120" align="right">
            <template #default="{ row }">{{ formatNumber(row.order_count) }}</template>
          </ElTableColumn>
          <ElTableColumn label="Last paid" min-width="180">
            <template #default="{ row }">{{ formatDate(row.last_paid_at) }}</template>
          </ElTableColumn>
          <template #empty>
            <ElEmpty description="No paid tenants" />
          </template>
        </ElTable>
      </section>

      <section class="saas-revenue-page__section">
        <div class="saas-revenue-page__section-header">
          <h2>Recent paid orders</h2>
        </div>
        <ElTable :data="overview.recent_paid_orders" border>
          <ElTableColumn prop="order_no" label="Order no" min-width="210" />
          <ElTableColumn label="Type" width="140">
            <template #default="{ row }">{{ sourceLabel(row.order_type) }}</template>
          </ElTableColumn>
          <ElTableColumn prop="tenant_id" label="Tenant" width="110" />
          <ElTableColumn prop="label" label="Label" min-width="150" />
          <ElTableColumn label="Amount" width="140" align="right">
            <template #default="{ row }">{{ formatMoney(row.amount_cents) }}</template>
          </ElTableColumn>
          <ElTableColumn prop="payment_method" label="Payment" width="120" />
          <ElTableColumn label="Paid time" min-width="180">
            <template #default="{ row }">{{ formatDate(row.paid_at) }}</template>
          </ElTableColumn>
          <template #empty>
            <ElEmpty description="No paid orders" />
          </template>
        </ElTable>
      </section>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import {
    fetchPlatformRevenueOverview,
    type SaasRevenueOverview
  } from '@/api/saas'

  defineOptions({ name: 'SaasPlatformRevenuePage' })

  const loading = ref(false)
  const overview = ref<SaasRevenueOverview>({
    kpis: {
      today_revenue_cents: 0,
      month_revenue_cents: 0,
      total_revenue_cents: 0,
      plan_revenue_cents: 0,
      resource_pack_revenue_cents: 0,
      today_paid_order_count: 0,
      month_paid_order_count: 0,
      total_paid_order_count: 0,
      month_paid_tenant_count: 0,
      total_paid_tenant_count: 0,
      active_subscription_count: 0,
      average_order_value_cents: 0,
      month_average_order_value_cents: 0
    },
    revenue_split: [],
    daily_trend: [],
    top_tenants: [],
    recent_paid_orders: []
  })

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

  function sourceLabel(source: string) {
    if (source === 'plan') return 'Plan'
    if (source === 'resource_pack') return 'Resource pack'
    return source || '-'
  }

  function normalizePercent(value: number) {
    return Math.min(100, Math.max(0, Number(value) || 0))
  }

  async function loadOverview() {
    loading.value = true
    try {
      overview.value = await fetchPlatformRevenueOverview()
    } catch (error) {
      console.error('[SaasPlatformRevenuePage] load overview failed:', error)
      ElMessage.error('Load revenue report failed')
    } finally {
      loading.value = false
    }
  }

  onMounted(loadOverview)
</script>

<style scoped>
  .saas-revenue-page {
    min-height: 100%;
  }

  .saas-revenue-page__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .saas-revenue-page__title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.4;
  }

  .saas-revenue-page__subtitle {
    margin: 6px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.5;
  }

  .saas-revenue-page__kpis {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 20px;
  }

  .saas-revenue-page__kpi {
    min-height: 86px;
    padding: 16px;
    border: 1px solid var(--el-border-color-light);
    border-radius: 6px;
    background: var(--el-fill-color-blank);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .saas-revenue-page__kpi span {
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.4;
  }

  .saas-revenue-page__kpi strong {
    color: var(--el-text-color-primary);
    font-size: 24px;
    font-weight: 700;
    line-height: 1.2;
  }

  .saas-revenue-page__section {
    margin-top: 20px;
  }

  .saas-revenue-page__section-header {
    margin-bottom: 10px;
  }

  .saas-revenue-page__section-header h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    line-height: 1.4;
  }

  @media (max-width: 1200px) {
    .saas-revenue-page__kpis {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 640px) {
    .saas-revenue-page__header {
      flex-direction: column;
      align-items: stretch;
    }

    .saas-revenue-page__kpis {
      grid-template-columns: 1fr;
    }
  }
</style>
