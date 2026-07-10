<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="app-analytics-page">
      <template #header>
        <div class="app-analytics-page__header">
          <div>
            <h1 class="app-analytics-page__title">App Analytics</h1>
            <p class="app-analytics-page__subtitle">
              Monitor installation adoption, open reliability, entitlement blockers, and version
              usage.
            </p>
          </div>
          <div class="app-analytics-page__controls">
            <ElSegmented
              v-model="days"
              :options="windowOptions"
              :disabled="loading"
              @change="handleWindowChange"
            />
            <ElTooltip content="Refresh" placement="bottom">
              <ElButton
                circle
                :icon="Refresh"
                :loading="loading"
                aria-label="Refresh analytics"
                @click="loadOverview"
              />
            </ElTooltip>
          </div>
        </div>
      </template>

      <div v-if="loadError" class="app-analytics-page__error">
        <ElAlert type="error" :title="loadError" show-icon :closable="false" />
        <ElButton link type="primary" :loading="loading" @click="loadOverview">Retry</ElButton>
      </div>

      <div v-loading="loading" class="app-analytics-page__content">
        <template v-if="overview">
          <section aria-label="Platform app analytics summary">
            <div class="app-analytics-page__kpis">
              <div v-for="item in overviewKpis" :key="item.label" class="app-analytics-page__kpi">
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
                <small>{{ item.note }}</small>
              </div>
            </div>
          </section>

          <section class="app-analytics-page__section">
            <div class="app-analytics-page__section-heading">
              <div>
                <h2>Open trend</h2>
                <p>Successful and failed app-open attempts in the selected window.</p>
              </div>
            </div>
            <div class="app-analytics-page__chart">
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

          <section class="app-analytics-page__section">
            <div class="app-analytics-page__section-heading">
              <div>
                <h2>Published apps</h2>
                <p>Installation reach and open reliability by application.</p>
              </div>
            </div>
            <div class="app-analytics-page__table-wrap">
              <ElTable :data="overview.apps" border min-width="1040">
                <ElTableColumn label="App" min-width="210" fixed="left">
                  <template #default="{ row }">
                    <div class="app-analytics-page__primary">{{ row.name || row.code }}</div>
                    <div class="app-analytics-page__muted">{{ row.code }}</div>
                  </template>
                </ElTableColumn>
                <ElTableColumn label="Type" width="105">
                  <template #default="{ row }">
                    <ElTag effect="light" type="info">{{ formatType(row.type) }}</ElTag>
                  </template>
                </ElTableColumn>
                <ElTableColumn label="Installs" width="105" align="right">
                  <template #default="{ row }">{{
                    formatInteger(row.active_installations)
                  }}</template>
                </ElTableColumn>
                <ElTableColumn label="New" width="90" align="right">
                  <template #default="{ row }">{{ formatInteger(row.new_installations) }}</template>
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
                <ElTableColumn label="Tenants" width="100" align="right">
                  <template #default="{ row }">{{ formatInteger(row.unique_tenants) }}</template>
                </ElTableColumn>
                <ElTableColumn label="Success" width="110" align="right">
                  <template #default="{ row }">
                    <ElTag :type="rateTagType(row.success_rate)" effect="light">{{
                      formatRate(row.success_rate)
                    }}</ElTag>
                  </template>
                </ElTableColumn>
                <ElTableColumn label="Actions" width="90" fixed="right">
                  <template #default="{ row }">
                    <ElButton link type="primary" @click="openAppDetail(row.code)"
                      >Details</ElButton
                    >
                  </template>
                </ElTableColumn>
                <template #empty>
                  <ElEmpty description="No published app analytics" />
                </template>
              </ElTable>
            </div>
          </section>

          <section class="app-analytics-page__section">
            <div class="app-analytics-page__section-heading">
              <div>
                <h2>Recent failures</h2>
                <p>Sanitized app-open failures, limited to the 20 most recent records.</p>
              </div>
            </div>
            <div class="app-analytics-page__table-wrap">
              <ElTable :data="overview.recent_failures" border>
                <ElTableColumn label="App" min-width="190">
                  <template #default="{ row }">
                    <div class="app-analytics-page__primary">{{
                      row.app_name || row.app_code
                    }}</div>
                    <div class="app-analytics-page__muted">{{ row.app_code }}</div>
                  </template>
                </ElTableColumn>
                <ElTableColumn prop="tenant_id" label="Tenant" width="100" />
                <ElTableColumn label="User" width="100">
                  <template #default="{ row }">{{ row.user_id ?? '-' }}</template>
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
                  min-width="260"
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

        <ElEmpty v-else-if="!loading && !loadError" description="No analytics data" />
      </div>
    </ElCard>

    <ElDrawer
      v-model="drawerOpen"
      :title="detail ? `${detail.app.name} analytics` : 'App analytics details'"
      size="min(920px, 94vw)"
      destroy-on-close
    >
      <div v-if="detailError" class="app-analytics-page__error">
        <ElAlert type="error" :title="detailError" show-icon :closable="false" />
        <ElButton link type="primary" :loading="detailLoading" @click="loadDetail">Retry</ElButton>
      </div>

      <div v-loading="detailLoading" class="app-analytics-page__drawer-content">
        <template v-if="detail">
          <div class="app-analytics-page__drawer-meta">
            <ElTag effect="light" type="info">{{ formatType(detail.app.type) }}</ElTag>
            <span>{{ detail.app.code }}</span>
            <span v-if="detail.app.category">{{ detail.app.category }}</span>
          </div>

          <div class="app-analytics-page__kpis app-analytics-page__kpis--drawer">
            <div v-for="item in detailKpis" :key="item.label" class="app-analytics-page__kpi">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
              <small>{{ item.note }}</small>
            </div>
          </div>

          <section class="app-analytics-page__section">
            <div class="app-analytics-page__section-heading"><h2>Open trend</h2></div>
            <div class="app-analytics-page__chart">
              <ArtLineChart
                height="240px"
                :data="detailTrendSeries"
                :xAxisData="detailTrendLabels"
                :showLegend="true"
                :showAxisLabel="true"
                :showAxisLine="false"
                :showSplitLine="true"
              />
            </div>
          </section>

          <section class="app-analytics-page__section">
            <div class="app-analytics-page__section-heading"><h2>Version adoption</h2></div>
            <div class="app-analytics-page__table-wrap">
              <ElTable :data="detail.version_adoption" border>
                <ElTableColumn prop="version" label="Version" min-width="150" />
                <ElTableColumn label="Installations" width="130" align="right">
                  <template #default="{ row }">{{ formatInteger(row.installations) }}</template>
                </ElTableColumn>
                <ElTableColumn label="Share" width="120" align="right">
                  <template #default="{ row }">{{ formatRate(row.percentage) }}</template>
                </ElTableColumn>
                <template #empty><ElEmpty description="No version adoption data" /></template>
              </ElTable>
            </div>
          </section>

          <section class="app-analytics-page__section">
            <div class="app-analytics-page__section-heading">
              <div>
                <h2>Tenant adoption</h2>
                <p>Up to 100 active installations ordered by recent usage.</p>
              </div>
            </div>
            <div class="app-analytics-page__table-wrap">
              <ElTable :data="detail.tenant_adoption" border min-width="820">
                <ElTableColumn prop="tenant_id" label="Tenant" width="100" fixed="left" />
                <ElTableColumn prop="version" label="Version" min-width="130" />
                <ElTableColumn label="Opens" width="95" align="right">
                  <template #default="{ row }">{{ formatInteger(row.total_opens) }}</template>
                </ElTableColumn>
                <ElTableColumn label="Failed" width="95" align="right">
                  <template #default="{ row }">{{ formatInteger(row.failed_opens) }}</template>
                </ElTableColumn>
                <ElTableColumn label="Success" width="105" align="right">
                  <template #default="{ row }">{{ formatRate(row.success_rate) }}</template>
                </ElTableColumn>
                <ElTableColumn label="Installed" width="180">
                  <template #default="{ row }">{{ formatDateTime(row.installed_time) }}</template>
                </ElTableColumn>
                <ElTableColumn label="Last open" width="180">
                  <template #default="{ row }">{{ formatDateTime(row.last_open_time) }}</template>
                </ElTableColumn>
                <template #empty><ElEmpty description="No tenant adoption data" /></template>
              </ElTable>
            </div>
          </section>

          <section class="app-analytics-page__section">
            <div class="app-analytics-page__section-heading"><h2>Recent failures</h2></div>
            <div class="app-analytics-page__table-wrap">
              <ElTable :data="detail.recent_failures" border>
                <ElTableColumn prop="tenant_id" label="Tenant" width="100" />
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
                  min-width="260"
                  show-overflow-tooltip
                />
                <ElTableColumn label="Time" width="180">
                  <template #default="{ row }">{{ formatDateTime(row.create_time) }}</template>
                </ElTableColumn>
                <template #empty><ElEmpty description="No failed opens in this window" /></template>
              </ElTable>
            </div>
          </section>
        </template>

        <ElEmpty
          v-else-if="!detailLoading && !detailError"
          description="No app analytics details"
        />
      </div>
    </ElDrawer>
  </div>
</template>

<script setup lang="ts">
  import { Refresh } from '@element-plus/icons-vue'
  import type { LineDataItem } from '@/types/component/chart'
  import {
    fetchPlatformAppAnalyticsDetail,
    fetchPlatformAppAnalyticsOverview,
    type AppAnalyticsWindow,
    type PlatformAppAnalyticsDetail,
    type PlatformAppAnalyticsOverview
  } from '@/api/app-analytics'

  defineOptions({ name: 'AppPlatformAnalyticsPage' })

  const windowOptions = [
    { label: '7 days', value: 7 },
    { label: '30 days', value: 30 },
    { label: '90 days', value: 90 }
  ]
  const days = ref<AppAnalyticsWindow>(30)
  const overview = ref<PlatformAppAnalyticsOverview | null>(null)
  const loading = ref(false)
  const loadError = ref('')
  const drawerOpen = ref(false)
  const selectedCode = ref('')
  const detail = ref<PlatformAppAnalyticsDetail | null>(null)
  const detailLoading = ref(false)
  const detailError = ref('')
  const numberFormatter = new Intl.NumberFormat('en-US')
  const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })

  const overviewKpis = computed(() => {
    const summary = overview.value?.summary
    if (!summary) return []
    return [
      {
        label: 'Published apps',
        value: formatInteger(summary.published_apps),
        note: 'Available catalog'
      },
      {
        label: 'Active installs',
        value: formatInteger(summary.active_installations),
        note: `${formatInteger(summary.new_installations)} new`
      },
      {
        label: 'Open attempts',
        value: formatInteger(summary.total_opens),
        note: `${formatInteger(summary.unique_users)} users`
      },
      {
        label: 'Success rate',
        value: formatRate(summary.success_rate),
        note: `${formatInteger(summary.successful_opens)} successful`
      },
      {
        label: 'Failed opens',
        value: formatInteger(summary.failed_opens),
        note: 'Sanitized failures'
      },
      {
        label: 'Entitlement blocks',
        value: formatInteger(summary.entitlement_blockers),
        note: `${formatInteger(summary.unique_tenants)} active tenants`
      }
    ]
  })

  const detailKpis = computed(() => {
    const summary = detail.value?.summary
    if (!summary) return []
    return [
      {
        label: 'Active installs',
        value: formatInteger(summary.active_installations),
        note: `${formatInteger(summary.new_installations)} new`
      },
      {
        label: 'Open attempts',
        value: formatInteger(summary.total_opens),
        note: `${formatInteger(summary.unique_users)} users`
      },
      {
        label: 'Success rate',
        value: formatRate(summary.success_rate),
        note: `${formatInteger(summary.successful_opens)} successful`
      },
      {
        label: 'Failed opens',
        value: formatInteger(summary.failed_opens),
        note: `${formatInteger(summary.entitlement_blockers)} blocked`
      }
    ]
  })

  const trendLabels = computed(() => overview.value?.trend.map((item) => item.date.slice(5)) || [])
  const trendSeries = computed<LineDataItem[]>(() => buildTrendSeries(overview.value?.trend || []))
  const detailTrendLabels = computed(
    () => detail.value?.trend.map((item) => item.date.slice(5)) || []
  )
  const detailTrendSeries = computed<LineDataItem[]>(() =>
    buildTrendSeries(detail.value?.trend || [])
  )

  function buildTrendSeries(trend: PlatformAppAnalyticsOverview['trend']): LineDataItem[] {
    return [
      { name: 'Successful', data: trend.map((item) => item.successful_opens) },
      { name: 'Failed', data: trend.map((item) => item.failed_opens) }
    ]
  }

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
      missing_system_module: 'Tenant module disabled',
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

  async function loadOverview() {
    loading.value = true
    loadError.value = ''
    try {
      overview.value = await fetchPlatformAppAnalyticsOverview(days.value)
    } catch {
      overview.value = null
      loadError.value = 'App analytics failed to load'
    } finally {
      loading.value = false
    }
  }

  async function loadDetail() {
    if (!selectedCode.value) return
    detailLoading.value = true
    detailError.value = ''
    try {
      detail.value = await fetchPlatformAppAnalyticsDetail(selectedCode.value, days.value)
    } catch {
      detail.value = null
      detailError.value = 'App analytics details failed to load'
    } finally {
      detailLoading.value = false
    }
  }

  function openAppDetail(code: string) {
    selectedCode.value = code
    detail.value = null
    drawerOpen.value = true
    void loadDetail()
  }

  async function handleWindowChange() {
    const tasks: Promise<unknown>[] = [loadOverview()]
    if (drawerOpen.value && selectedCode.value) tasks.push(loadDetail())
    await Promise.all(tasks)
  }

  onMounted(() => {
    void loadOverview()
  })
</script>

<style scoped>
  .app-analytics-page {
    min-height: 100%;
  }

  .app-analytics-page__header,
  .app-analytics-page__controls,
  .app-analytics-page__section-heading,
  .app-analytics-page__drawer-meta,
  .app-analytics-page__error {
    display: flex;
    align-items: center;
  }

  .app-analytics-page__header,
  .app-analytics-page__section-heading {
    justify-content: space-between;
    gap: 16px;
  }

  .app-analytics-page__controls,
  .app-analytics-page__drawer-meta,
  .app-analytics-page__error {
    gap: 12px;
  }

  .app-analytics-page__title,
  .app-analytics-page__section-heading h2 {
    margin: 0;
    letter-spacing: 0;
  }

  .app-analytics-page__title {
    font-size: 18px;
    font-weight: 600;
    line-height: 1.4;
  }

  .app-analytics-page__subtitle,
  .app-analytics-page__section-heading p {
    margin: 6px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.5;
  }

  .app-analytics-page__content,
  .app-analytics-page__drawer-content {
    min-height: 260px;
  }

  .app-analytics-page__error {
    margin-bottom: 16px;
  }

  .app-analytics-page__error :deep(.el-alert) {
    flex: 1;
  }

  .app-analytics-page__kpis {
    display: grid;
    grid-template-columns: repeat(6, minmax(132px, 1fr));
    gap: 12px;
  }

  .app-analytics-page__kpis--drawer {
    grid-template-columns: repeat(4, minmax(132px, 1fr));
    margin-top: 16px;
  }

  .app-analytics-page__kpi {
    display: grid;
    min-height: 98px;
    align-content: center;
    gap: 6px;
    padding: 14px;
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
    background: var(--el-bg-color);
  }

  .app-analytics-page__kpi span,
  .app-analytics-page__kpi small,
  .app-analytics-page__muted,
  .app-analytics-page__drawer-meta {
    color: var(--el-text-color-secondary);
  }

  .app-analytics-page__kpi span,
  .app-analytics-page__kpi small,
  .app-analytics-page__muted {
    font-size: 12px;
    line-height: 1.4;
  }

  .app-analytics-page__kpi strong {
    font-size: 22px;
    line-height: 1.2;
    letter-spacing: 0;
  }

  .app-analytics-page__section {
    margin-top: 24px;
  }

  .app-analytics-page__section-heading {
    margin-bottom: 12px;
  }

  .app-analytics-page__section-heading h2 {
    font-size: 15px;
    font-weight: 600;
    line-height: 1.4;
  }

  .app-analytics-page__chart {
    min-height: 280px;
    overflow: hidden;
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
    padding: 12px;
  }

  .app-analytics-page__table-wrap {
    max-width: 100%;
    overflow-x: auto;
  }

  .app-analytics-page__primary {
    color: var(--el-text-color-primary);
    font-weight: 500;
    line-height: 1.4;
  }

  .app-analytics-page__drawer-meta {
    flex-wrap: wrap;
    font-size: 13px;
  }

  @media (max-width: 1280px) {
    .app-analytics-page__kpis {
      grid-template-columns: repeat(3, minmax(132px, 1fr));
    }
  }

  @media (max-width: 768px) {
    .app-analytics-page__header {
      align-items: stretch;
      flex-direction: column;
    }

    .app-analytics-page__controls {
      justify-content: space-between;
    }

    .app-analytics-page__kpis,
    .app-analytics-page__kpis--drawer {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 480px) {
    .app-analytics-page__controls {
      align-items: flex-start;
      flex-direction: column;
    }

    .app-analytics-page__kpis,
    .app-analytics-page__kpis--drawer {
      grid-template-columns: 1fr;
    }
  }
</style>
