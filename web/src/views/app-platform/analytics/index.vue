<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="app-analytics-page">
      <template #header>
        <div class="app-analytics-page__header">
          <div>
            <h1 class="app-analytics-page__title">应用分析</h1>
            <p class="app-analytics-page__subtitle">
              监控安装覆盖、打开稳定性、授权拦截和版本使用情况。
            </p>
          </div>
          <div class="app-analytics-page__controls">
            <ElSegmented
              v-model="days"
              :options="windowOptions"
              :disabled="loading"
              @change="handleWindowChange"
            />
            <ElTooltip content="刷新" placement="bottom">
              <ElButton
                circle
                :icon="Refresh"
                :loading="loading"
                aria-label="刷新应用分析"
                @click="loadOverview"
              />
            </ElTooltip>
          </div>
        </div>
      </template>

      <div v-if="loadError" class="app-analytics-page__error">
        <ElAlert type="error" :title="loadError" show-icon :closable="false" />
        <ElButton link type="primary" :loading="loading" @click="loadOverview">重试</ElButton>
      </div>

      <div v-loading="loading" class="app-analytics-page__content">
        <template v-if="overview">
          <section aria-label="平台应用分析概览">
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
                <h2>打开趋势</h2>
                <p>所选时间范围内应用打开成功与失败的趋势。</p>
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
                <h2>已发布应用</h2>
                <p>按应用查看安装覆盖率和打开稳定性。</p>
              </div>
            </div>
            <div class="app-analytics-page__table-wrap">
              <ElTable :data="overview.apps" border min-width="1040">
                <ElTableColumn label="应用" min-width="210" fixed="left">
                  <template #default="{ row }">
                    <div class="app-analytics-page__primary">{{ row.name || row.code }}</div>
                    <div class="app-analytics-page__muted">{{ row.code }}</div>
                  </template>
                </ElTableColumn>
                <ElTableColumn label="类型" width="105">
                  <template #default="{ row }">
                    <ElTag effect="light" type="info">{{ formatType(row.type) }}</ElTag>
                  </template>
                </ElTableColumn>
                <ElTableColumn label="安装数" width="105" align="right">
                  <template #default="{ row }">{{
                    formatInteger(row.active_installations)
                  }}</template>
                </ElTableColumn>
                <ElTableColumn label="新增" width="90" align="right">
                  <template #default="{ row }">{{ formatInteger(row.new_installations) }}</template>
                </ElTableColumn>
                <ElTableColumn label="打开次数" width="100" align="right">
                  <template #default="{ row }">{{ formatInteger(row.total_opens) }}</template>
                </ElTableColumn>
                <ElTableColumn label="失败次数" width="95" align="right">
                  <template #default="{ row }">{{ formatInteger(row.failed_opens) }}</template>
                </ElTableColumn>
                <ElTableColumn label="被拦截" width="100" align="right">
                  <template #default="{ row }">{{
                    formatInteger(row.entitlement_blockers)
                  }}</template>
                </ElTableColumn>
                <ElTableColumn label="租户数" width="100" align="right">
                  <template #default="{ row }">{{ formatInteger(row.unique_tenants) }}</template>
                </ElTableColumn>
                <ElTableColumn label="成功率" width="110" align="right">
                  <template #default="{ row }">
                    <ElTag :type="rateTagType(row.success_rate)" effect="light">{{
                      formatRate(row.success_rate)
                    }}</ElTag>
                  </template>
                </ElTableColumn>
                <ElTableColumn label="操作" width="90" fixed="right">
                  <template #default="{ row }">
                    <ElButton link type="primary" @click="openAppDetail(row.code)"
                      >查看详情</ElButton
                    >
                  </template>
                </ElTableColumn>
                <template #empty>
                  <ElEmpty description="暂无已发布应用的分析数据" />
                </template>
              </ElTable>
            </div>
          </section>

          <section class="app-analytics-page__section">
            <div class="app-analytics-page__section-heading">
              <div>
                <h2>最近失败记录</h2>
                <p>已做脱敏处理，仅显示最近 20 条应用打开失败记录。</p>
              </div>
            </div>
            <div class="app-analytics-page__table-wrap">
              <ElTable :data="overview.recent_failures" border>
                <ElTableColumn label="应用" min-width="190">
                  <template #default="{ row }">
                    <div class="app-analytics-page__primary">{{
                      row.app_name || row.app_code
                    }}</div>
                    <div class="app-analytics-page__muted">{{ row.app_code }}</div>
                  </template>
                </ElTableColumn>
                <ElTableColumn prop="tenant_id" label="租户" width="100" />
                <ElTableColumn label="用户" width="100">
                  <template #default="{ row }">{{ row.user_id ?? '-' }}</template>
                </ElTableColumn>
                <ElTableColumn label="原因" min-width="190">
                  <template #default="{ row }">
                    <ElTag :type="reasonTagType(row.reason_code)" effect="light">{{
                      reasonText(row.reason_code)
                    }}</ElTag>
                  </template>
                </ElTableColumn>
                <ElTableColumn
                  prop="failure_message"
                  label="信息"
                  min-width="260"
                  show-overflow-tooltip
                />
                <ElTableColumn label="时间" width="180">
                  <template #default="{ row }">{{ formatDateTime(row.create_time) }}</template>
                </ElTableColumn>
                <template #empty>
                  <ElEmpty description="当前时间范围内暂无失败的打开记录" />
                </template>
              </ElTable>
            </div>
          </section>
        </template>

        <ElEmpty v-else-if="!loading && !loadError" description="暂无分析数据" />
      </div>
    </ElCard>

    <ElDrawer
      v-model="drawerOpen"
      :title="detail ? `${detail.app.name} 应用分析` : '应用分析详情'"
      size="min(920px, 94vw)"
      destroy-on-close
    >
      <div v-if="detailError" class="app-analytics-page__error">
        <ElAlert type="error" :title="detailError" show-icon :closable="false" />
        <ElButton link type="primary" :loading="detailLoading" @click="loadDetail">重试</ElButton>
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
            <div class="app-analytics-page__section-heading"><h2>打开趋势</h2></div>
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
            <div class="app-analytics-page__section-heading"><h2>版本使用情况</h2></div>
            <div class="app-analytics-page__table-wrap">
              <ElTable :data="detail.version_adoption" border>
                <ElTableColumn prop="version" label="版本" min-width="150" />
                <ElTableColumn label="安装数" width="130" align="right">
                  <template #default="{ row }">{{ formatInteger(row.installations) }}</template>
                </ElTableColumn>
                <ElTableColumn label="占比" width="120" align="right">
                  <template #default="{ row }">{{ formatRate(row.percentage) }}</template>
                </ElTableColumn>
                <template #empty><ElEmpty description="暂无版本使用数据" /></template>
              </ElTable>
            </div>
          </section>

          <section class="app-analytics-page__section">
            <div class="app-analytics-page__section-heading">
              <div>
                <h2>租户使用情况</h2>
                <p>最多显示 100 条活跃安装记录，按最近使用时间排序。</p>
              </div>
            </div>
            <div class="app-analytics-page__table-wrap">
              <ElTable :data="detail.tenant_adoption" border min-width="820">
                <ElTableColumn prop="tenant_id" label="租户" width="100" fixed="left" />
                <ElTableColumn prop="version" label="版本" min-width="130" />
                <ElTableColumn label="打开次数" width="95" align="right">
                  <template #default="{ row }">{{ formatInteger(row.total_opens) }}</template>
                </ElTableColumn>
                <ElTableColumn label="失败次数" width="95" align="right">
                  <template #default="{ row }">{{ formatInteger(row.failed_opens) }}</template>
                </ElTableColumn>
                <ElTableColumn label="成功率" width="105" align="right">
                  <template #default="{ row }">{{ formatRate(row.success_rate) }}</template>
                </ElTableColumn>
                <ElTableColumn label="安装时间" width="180">
                  <template #default="{ row }">{{ formatDateTime(row.installed_time) }}</template>
                </ElTableColumn>
                <ElTableColumn label="最近打开" width="180">
                  <template #default="{ row }">{{ formatDateTime(row.last_open_time) }}</template>
                </ElTableColumn>
                <template #empty><ElEmpty description="暂无租户使用数据" /></template>
              </ElTable>
            </div>
          </section>

          <section class="app-analytics-page__section">
            <div class="app-analytics-page__section-heading"><h2>最近失败记录</h2></div>
            <div class="app-analytics-page__table-wrap">
              <ElTable :data="detail.recent_failures" border>
                <ElTableColumn prop="tenant_id" label="租户" width="100" />
                <ElTableColumn label="原因" min-width="190">
                  <template #default="{ row }">
                    <ElTag :type="reasonTagType(row.reason_code)" effect="light">{{
                      reasonText(row.reason_code)
                    }}</ElTag>
                  </template>
                </ElTableColumn>
                <ElTableColumn
                  prop="failure_message"
                  label="信息"
                  min-width="260"
                  show-overflow-tooltip
                />
                <ElTableColumn label="时间" width="180">
                  <template #default="{ row }">{{ formatDateTime(row.create_time) }}</template>
                </ElTableColumn>
                <template #empty><ElEmpty description="当前时间范围内暂无失败的打开记录" /></template>
              </ElTable>
            </div>
          </section>
        </template>

        <ElEmpty
          v-else-if="!detailLoading && !detailError"
          description="暂无应用分析详情"
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
    { label: '7 天', value: 7 },
    { label: '30 天', value: 30 },
    { label: '90 天', value: 90 }
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
        label: '已发布应用',
        value: formatInteger(summary.published_apps),
        note: '目录中可用'
      },
      {
        label: '活跃安装',
        value: formatInteger(summary.active_installations),
        note: `${formatInteger(summary.new_installations)} 新增`
      },
      {
        label: '打开尝试',
        value: formatInteger(summary.total_opens),
        note: `${formatInteger(summary.unique_users)} 位用户`
      },
      {
        label: '成功率',
        value: formatRate(summary.success_rate),
        note: `${formatInteger(summary.successful_opens)} 次成功`
      },
      {
        label: '打开失败',
        value: formatInteger(summary.failed_opens),
        note: '已脱敏失败记录'
      },
      {
        label: '授权拦截',
        value: formatInteger(summary.entitlement_blockers),
        note: `${formatInteger(summary.unique_tenants)} 个活跃租户`
      }
    ]
  })

  const detailKpis = computed(() => {
    const summary = detail.value?.summary
    if (!summary) return []
    return [
      {
        label: '活跃安装',
        value: formatInteger(summary.active_installations),
        note: `${formatInteger(summary.new_installations)} 新增`
      },
      {
        label: '打开尝试',
        value: formatInteger(summary.total_opens),
        note: `${formatInteger(summary.unique_users)} 位用户`
      },
      {
        label: '成功率',
        value: formatRate(summary.success_rate),
        note: `${formatInteger(summary.successful_opens)} 次成功`
      },
      {
        label: '打开失败',
        value: formatInteger(summary.failed_opens),
        note: `${formatInteger(summary.entitlement_blockers)} 次被拦截`
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
      { name: '成功', data: trend.map((item) => item.successful_opens) },
      { name: '失败', data: trend.map((item) => item.failed_opens) }
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
      internal: '内置应用',
      static: '静态应用',
      iframe: '嵌入式页面'
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
      missing_plan_module: '套餐未开通此模块',
      missing_system_module: '租户模块已停用',
      system_module_unavailable: '系统模块不可用',
      app_not_found: '应用不存在',
      app_not_published: '应用未发布',
      app_not_installed: '应用未安装',
      published_version_missing: '已发布版本不存在',
      open_metadata_error: '打开元数据异常'
    }
    return labels[reason] || reason || '未知失败'
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
      loadError.value = '应用分析加载失败'
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
      detailError.value = '应用分析详情加载失败'
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
