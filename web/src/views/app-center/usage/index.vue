<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="app-usage-page">
      <template #header>
        <div class="app-usage-page__header">
          <div>
            <h1 class="app-usage-page__title">App Usage</h1>
            <p class="app-usage-page__subtitle">
              Track installed app activity, reliability, entitlement blockers, and version adoption
              for this workspace.
            </p>
          </div>
          <div class="app-usage-page__controls">
            <ElSegmented
              v-model="days"
              :options="windowOptions"
              :disabled="loading"
              @change="loadUsage"
            />
            <ElTooltip content="Refresh" placement="bottom">
              <ElButton
                circle
                :icon="Refresh"
                :loading="loading"
                aria-label="Refresh app usage"
                @click="loadUsage"
              />
            </ElTooltip>
          </div>
        </div>
      </template>

      <div v-if="loadError" class="app-usage-page__error">
        <ElAlert type="error" :title="loadError" show-icon :closable="false" />
        <ElButton link type="primary" :loading="loading" @click="loadUsage">Retry</ElButton>
      </div>

      <div v-loading="loading" class="app-usage-page__content">
        <template v-if="overview">
          <section aria-label="Tenant app usage summary">
            <div class="app-usage-page__kpis">
              <div v-for="item in kpis" :key="item.label" class="app-usage-page__kpi">
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
                <small>{{ item.note }}</small>
              </div>
            </div>
          </section>

          <section class="app-usage-page__section">
            <div class="app-usage-page__section-heading">
              <div>
                <h2>Open trend</h2>
                <p>Successful and failed app-open attempts in the selected window.</p>
              </div>
            </div>
            <div class="app-usage-page__chart">
              <ArtLineChart
                height="280px"
                :data="trendSeries"
                :xAxisData="trendLabels"
                :showLegend="true"
                :showAxisLabel="true"
                :showAxisLine="false"
                :showSplitLine="true"
              />
            </div>
          </section>

          <section class="app-usage-page__section">
            <div class="app-usage-page__section-heading">
              <div>
                <h2>Installed apps</h2>
                <p>Usage and reliability for apps currently enabled in this workspace.</p>
              </div>
            </div>
            <div class="app-usage-page__table-wrap">
              <ElTable :data="overview.apps" border>
                <ElTableColumn label="App" min-width="210" fixed="left">
                  <template #default="{ row }">
                    <div class="app-usage-page__primary">{{ row.name || row.code }}</div>
                    <div class="app-usage-page__muted">{{ row.code }}</div>
                  </template>
                </ElTableColumn>
                <ElTableColumn label="Type" width="105">
                  <template #default="{ row }">
                    <ElTag effect="light" type="info">{{ formatType(row.type) }}</ElTag>
                  </template>
                </ElTableColumn>
                <ElTableColumn label="Version" min-width="130">
                  <template #default="{ row }">{{ row.version || 'Unassigned' }}</template>
                </ElTableColumn>
                <ElTableColumn label="Opens" width="100" align="right">
                  <template #default="{ row }">{{ formatInteger(row.total_opens) }}</template>
                </ElTableColumn>
                <ElTableColumn label="Failed" width="95" align="right">
                  <template #default="{ row }">{{ formatInteger(row.failed_opens) }}</template>
                </ElTableColumn>
                <ElTableColumn label="Blocked" width="100" align="right">
                  <template #default="{ row }">{{
                    formatInteger(row.entitlement_blockers)
                  }}</template>
                </ElTableColumn>
                <ElTableColumn label="Success" width="110" align="right">
                  <template #default="{ row }">
                    <ElTag :type="rateTagType(row.success_rate)" effect="light">{{
                      formatRate(row.success_rate)
                    }}</ElTag>
                  </template>
                </ElTableColumn>
                <ElTableColumn label="Last open" width="180">
                  <template #default="{ row }">{{ formatDateTime(row.last_open_time) }}</template>
                </ElTableColumn>
                <template #empty>
                  <ElEmpty description="No enabled apps" />
                </template>
              </ElTable>
            </div>
          </section>

          <section class="app-usage-page__section">
            <div class="app-usage-page__section-heading">
              <div>
                <h2>Version adoption</h2>
                <p>Successful opens grouped by app and resolved version.</p>
              </div>
            </div>
            <div class="app-usage-page__table-wrap">
              <ElTable :data="overview.version_adoption" border>
                <ElTableColumn label="App" min-width="210">
                  <template #default="{ row }">
                    <div class="app-usage-page__primary">{{ row.app_name || row.app_code }}</div>
                    <div class="app-usage-page__muted">{{ row.app_code }}</div>
                  </template>
                </ElTableColumn>
                <ElTableColumn prop="version" label="Version" min-width="140" />
                <ElTableColumn label="Successful opens" width="160" align="right">
                  <template #default="{ row }">{{ formatInteger(row.successful_opens) }}</template>
                </ElTableColumn>
                <ElTableColumn label="Share" width="120" align="right">
                  <template #default="{ row }">{{ formatRate(row.percentage) }}</template>
                </ElTableColumn>
                <template #empty>
                  <ElEmpty description="No version adoption data" />
                </template>
              </ElTable>
            </div>
          </section>

          <section class="app-usage-page__section">
            <div class="app-usage-page__section-heading">
              <div>
                <h2>Recent failures</h2>
                <p>Sanitized app-open failures, limited to the 20 most recent records.</p>
              </div>
            </div>
            <div class="app-usage-page__table-wrap">
              <ElTable :data="overview.recent_failures" border>
                <ElTableColumn label="App" min-width="210">
                  <template #default="{ row }">
                    <div class="app-usage-page__primary">{{ row.app_name || row.app_code }}</div>
                    <div class="app-usage-page__muted">{{ row.app_code }}</div>
                  </template>
                </ElTableColumn>
                <ElTableColumn label="Reason" min-width="190">
                  <template #default="{ row }">
                    <ElTag :type="reasonTagType(row.reason_code)" effect="light">{{
                      reasonText(row.reason_code)
                    }}</ElTag>
                  </template>
                </ElTableColumn>
                <ElTableColumn
                  prop="failure_message"
                  label="Message"
                  min-width="280"
                  show-overflow-tooltip
                />
                <ElTableColumn label="Time" width="180">
                  <template #default="{ row }">{{ formatDateTime(row.create_time) }}</template>
                </ElTableColumn>
                <template #empty>
                  <ElEmpty description="No failed opens in this window" />
                </template>
              </ElTable>
            </div>
          </section>
        </template>

        <ElEmpty v-else-if="!loading && !loadError" description="No app usage data" />
      </div>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { Refresh } from '@element-plus/icons-vue'
  import type { LineDataItem } from '@/types/component/chart'
  import {
    fetchTenantAppUsageOverview,
    type AppAnalyticsWindow,
    type TenantAppUsageOverview
  } from '@/api/app-analytics'

  defineOptions({ name: 'AppCenterUsagePage' })

  const windowOptions = [
    { label: '7 days', value: 7 },
    { label: '30 days', value: 30 },
    { label: '90 days', value: 90 }
  ]
  const days = ref<AppAnalyticsWindow>(30)
  const overview = ref<TenantAppUsageOverview | null>(null)
  const loading = ref(false)
  const loadError = ref('')
  const numberFormatter = new Intl.NumberFormat('en-US')
  const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })

  const kpis = computed(() => {
    const summary = overview.value?.summary
    if (!summary) return []
    return [
      {
        label: 'Enabled apps',
        value: formatInteger(summary.enabled_apps),
        note: 'Current workspace'
      },
      {
        label: 'Open attempts',
        value: formatInteger(summary.total_opens),
        note: `${days.value}-day window`
      },
      {
        label: 'Successful opens',
        value: formatInteger(summary.successful_opens),
        note: 'Completed launches'
      },
      {
        label: 'Success rate',
        value: formatRate(summary.success_rate),
        note: 'Launch reliability'
      },
      {
        label: 'Failed opens',
        value: formatInteger(summary.failed_opens),
        note: 'Sanitized failures'
      },
      {
        label: 'Entitlement blocks',
        value: formatInteger(summary.entitlement_blockers),
        note: 'Plan or module access'
      }
    ]
  })

  const trendLabels = computed(() => overview.value?.trend.map((item) => item.date.slice(5)) || [])
  const trendSeries = computed<LineDataItem[]>(() => [
    { name: 'Successful', data: overview.value?.trend.map((item) => item.successful_opens) || [] },
    { name: 'Failed', data: overview.value?.trend.map((item) => item.failed_opens) || [] }
  ])

  function formatInteger(value: unknown) {
    return numberFormatter.format(Number(value) || 0)
  }

  function formatRate(value: unknown) {
    return `${Number(value || 0)
      .toFixed(2)
      .replace(/\.00$/, '')}%`
  }

  function formatType(value: unknown) {
    const normalized = String(value || '')
    const labels: Record<string, string> = {
      internal: 'Internal',
      static: 'Static',
      iframe: 'Iframe'
    }
    return labels[normalized] || normalized || '-'
  }

  function formatDateTime(value: unknown) {
    if (!value) return '-'
    const date = value instanceof Date ? value : new Date(String(value))
    return Number.isNaN(date.getTime()) ? String(value) : dateFormatter.format(date)
  }

  function rateTagType(rate: number) {
    if (rate >= 98) return 'success'
    if (rate >= 90) return 'warning'
    return 'danger'
  }

  function reasonText(reason: string) {
    const labels: Record<string, string> = {
      missing_plan_module: 'Plan module missing',
      missing_system_module: 'Workspace module disabled',
      system_module_unavailable: 'System module unavailable',
      app_not_found: 'App not found',
      app_not_published: 'App not published',
      app_not_installed: 'App not installed',
      published_version_missing: 'Published version missing',
      open_metadata_error: 'Open metadata error'
    }
    return labels[reason] || reason || 'Unknown failure'
  }

  function reasonTagType(reason: string) {
    if (
      ['missing_plan_module', 'missing_system_module', 'system_module_unavailable'].includes(reason)
    )
      return 'warning'
    return 'danger'
  }

  async function loadUsage() {
    loading.value = true
    loadError.value = ''
    try {
      overview.value = await fetchTenantAppUsageOverview(days.value)
    } catch {
      loadError.value = 'App usage failed to load'
    } finally {
      loading.value = false
    }
  }

  onMounted(() => {
    void loadUsage()
  })
</script>

<style scoped>
  .app-usage-page {
    min-height: 100%;
  }

  .app-usage-page__header,
  .app-usage-page__controls,
  .app-usage-page__section-heading,
  .app-usage-page__error {
    display: flex;
    align-items: center;
  }

  .app-usage-page__header,
  .app-usage-page__section-heading {
    justify-content: space-between;
    gap: 16px;
  }

  .app-usage-page__controls,
  .app-usage-page__error {
    gap: 12px;
  }

  .app-usage-page__title,
  .app-usage-page__section-heading h2 {
    margin: 0;
    letter-spacing: 0;
  }

  .app-usage-page__title {
    font-size: 18px;
    font-weight: 600;
    line-height: 1.4;
  }

  .app-usage-page__subtitle,
  .app-usage-page__section-heading p {
    margin: 6px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.5;
  }

  .app-usage-page__content {
    min-height: 260px;
  }

  .app-usage-page__error {
    margin-bottom: 16px;
  }

  .app-usage-page__error :deep(.el-alert) {
    flex: 1;
  }

  .app-usage-page__kpis {
    display: grid;
    grid-template-columns: repeat(6, minmax(132px, 1fr));
    gap: 12px;
  }

  .app-usage-page__kpi {
    display: grid;
    min-height: 98px;
    align-content: center;
    gap: 6px;
    padding: 14px;
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
    background: var(--el-bg-color);
  }

  .app-usage-page__kpi span,
  .app-usage-page__kpi small,
  .app-usage-page__muted {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    line-height: 1.4;
  }

  .app-usage-page__kpi strong {
    font-size: 22px;
    line-height: 1.2;
    letter-spacing: 0;
  }

  .app-usage-page__section {
    margin-top: 24px;
  }

  .app-usage-page__section-heading {
    margin-bottom: 12px;
  }

  .app-usage-page__section-heading h2 {
    font-size: 15px;
    font-weight: 600;
    line-height: 1.4;
  }

  .app-usage-page__chart {
    min-height: 280px;
    overflow: hidden;
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
    padding: 12px;
  }

  .app-usage-page__table-wrap {
    max-width: 100%;
    overflow-x: auto;
  }

  .app-usage-page__primary {
    color: var(--el-text-color-primary);
    font-weight: 500;
    line-height: 1.4;
  }

  @media (max-width: 1280px) {
    .app-usage-page__kpis {
      grid-template-columns: repeat(3, minmax(132px, 1fr));
    }
  }

  @media (max-width: 768px) {
    .app-usage-page__header {
      align-items: stretch;
      flex-direction: column;
    }

    .app-usage-page__controls {
      justify-content: space-between;
    }

    .app-usage-page__kpis {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 480px) {
    .app-usage-page__controls {
      align-items: flex-start;
      flex-direction: column;
    }

    .app-usage-page__kpis {
      grid-template-columns: 1fr;
    }
  }
</style>
