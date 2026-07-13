<template>
  <div class="developer-runtime-page">
    <header class="developer-runtime-page__header">
      <div>
        <h1>Service Observability</h1>
        <p>Health, invocation outcomes, latency, and bounded redacted logs for your services.</p>
      </div>
      <div class="developer-runtime-page__actions">
        <ElSegmented v-model="days" :options="dayOptions" @change="loadOverview" />
        <ElButton :icon="Refresh" circle :loading="loading" title="Refresh" @click="loadOverview" />
      </div>
    </header>

    <ElAlert
      v-if="loadError"
      type="error"
      :title="loadError"
      show-icon
      :closable="false"
      class="developer-runtime-page__alert"
    >
      <template #default>
        <ElButton link type="primary" :loading="loading" @click="loadOverview">Retry</ElButton>
      </template>
    </ElAlert>

    <ElSkeleton v-if="loading && !overview" :rows="8" animated />

    <template v-else-if="overview">
      <section class="developer-runtime-page__kpis" aria-label="Service metrics">
        <div>
          <span>Services</span>
          <strong>{{ overview.total_services }}</strong>
        </div>
        <div>
          <span>Invocations</span>
          <strong>{{ overview.total_invocations }}</strong>
        </div>
        <div>
          <span>Success rate</span>
          <strong>{{ formatPercent(overview.success_rate) }}</strong>
        </div>
        <div>
          <span>Rejected</span>
          <strong>{{ overview.total_rejected }}</strong>
        </div>
      </section>

      <section class="developer-runtime-page__table-section">
        <div class="developer-runtime-page__section-heading">
          <h2>Owned services</h2>
          <span>{{ overview.days }} day window</span>
        </div>
        <ElTable :data="overview.services" border>
          <ElTableColumn label="Service" min-width="210">
            <template #default="{ row }">
              <strong>{{ row.app_name || row.app_code }}</strong>
              <div class="developer-runtime-page__muted">
                {{ row.app_code }} / {{ row.version || '-' }}
              </div>
            </template>
          </ElTableColumn>
          <ElTableColumn label="Runtime" width="170">
            <template #default="{ row }">
              <ElTag :type="healthTag(row.health_status)" effect="light">{{
                row.health_status
              }}</ElTag>
              <div class="developer-runtime-page__muted"
                >{{ row.role }} / {{ row.process_status }}</div
              >
            </template>
          </ElTableColumn>
          <ElTableColumn label="Circuit" width="110">
            <template #default="{ row }">
              <ElTag :type="circuitTag(row.circuit_state)" effect="plain">{{
                row.circuit_state
              }}</ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn label="Calls" width="105" prop="total_count" />
          <ElTableColumn label="Success" width="105">
            <template #default="{ row }">{{ formatPercent(row.success_rate) }}</template>
          </ElTableColumn>
          <ElTableColumn label="P95" width="105">
            <template #default="{ row }">{{ formatDuration(row.p95_duration_ms) }}</template>
          </ElTableColumn>
          <ElTableColumn label="Last invoke" min-width="165">
            <template #default="{ row }">{{ formatDateTime(row.last_invoke_time) }}</template>
          </ElTableColumn>
          <ElTableColumn label="Actions" width="90" fixed="right">
            <template #default="{ row }">
              <ElButton link type="primary" :icon="Document" @click="openLogs(row)">Logs</ElButton>
            </template>
          </ElTableColumn>
          <template #empty>
            <ElEmpty description="No service runtime data" />
          </template>
        </ElTable>
      </section>
    </template>

    <ElDrawer v-model="logDrawerVisible" title="Redacted service logs" :size="drawerSize">
      <ElSkeleton v-if="logLoading" :rows="6" animated />
      <ElAlert v-else-if="logError" type="error" :title="logError" show-icon :closable="false">
        <template #default>
          <ElButton link type="primary" :loading="logLoading" @click="retryLogs">Retry</ElButton>
        </template>
      </ElAlert>
      <template v-else-if="logs">
        <div class="developer-runtime-page__log-heading">
          <strong>{{ logs.app_code }}</strong>
          <span>{{ logs.version }} / {{ logs.role }}</span>
        </div>
        <ElTabs v-model="logTab">
          <ElTabPane label="stdout" name="stdout">
            <pre>{{ logs.stdout || 'No stdout output' }}</pre>
          </ElTabPane>
          <ElTabPane label="stderr" name="stderr">
            <pre>{{ logs.stderr || 'No stderr output' }}</pre>
          </ElTabPane>
        </ElTabs>
      </template>
    </ElDrawer>
  </div>
</template>

<script setup lang="ts">
  import { Document, Refresh } from '@element-plus/icons-vue'
  import { useWindowSize } from '@vueuse/core'
  import {
    fetchDeveloperServiceLogs,
    fetchDeveloperServiceOverview,
    type DeveloperServiceLogResponse,
    type DeveloperServiceOverview,
    type DeveloperServiceRuntimeRecord
  } from '@/api/app-developer'

  defineOptions({ name: 'AppDeveloperServiceObservabilityPage' })

  const days = ref<1 | 7 | 30>(7)
  const dayOptions = [
    { label: '1 day', value: 1 },
    { label: '7 days', value: 7 },
    { label: '30 days', value: 30 }
  ]
  const overview = ref<DeveloperServiceOverview | null>(null)
  const logs = ref<DeveloperServiceLogResponse | null>(null)
  const selectedService = ref<DeveloperServiceRuntimeRecord | null>(null)
  const loading = ref(false)
  const logLoading = ref(false)
  const loadError = ref('')
  const logError = ref('')
  const logDrawerVisible = ref(false)
  const logTab = ref<'stdout' | 'stderr'>('stdout')
  const { width } = useWindowSize()
  const drawerSize = computed(() => (width.value <= 760 ? '100%' : '720px'))
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })

  function formatPercent(value: number) {
    return `${Number(value || 0).toFixed(1)}%`
  }

  function formatDuration(value: number) {
    return value > 0 ? `${value} ms` : '-'
  }

  function formatDateTime(value: string | null) {
    if (!value) return '-'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '-' : formatter.format(date)
  }

  function healthTag(status: DeveloperServiceRuntimeRecord['health_status']) {
    if (status === 'healthy') return 'success'
    if (status === 'unhealthy') return 'danger'
    if (status === 'checking') return 'warning'
    return 'info'
  }

  function circuitTag(status: DeveloperServiceRuntimeRecord['circuit_state']) {
    if (status === 'open') return 'danger'
    if (status === 'half_open') return 'warning'
    return 'success'
  }

  async function loadOverview() {
    loading.value = true
    loadError.value = ''
    try {
      overview.value = await fetchDeveloperServiceOverview(days.value)
    } catch {
      loadError.value = 'Service observability failed to load'
    } finally {
      loading.value = false
    }
  }

  async function openLogs(row: DeveloperServiceRuntimeRecord) {
    selectedService.value = row
    logDrawerVisible.value = true
    logTab.value = 'stdout'
    await retryLogs()
  }

  async function retryLogs() {
    if (!selectedService.value) return
    logLoading.value = true
    logError.value = ''
    logs.value = null
    try {
      logs.value = await fetchDeveloperServiceLogs(selectedService.value.app_code, 100)
    } catch {
      logError.value = 'Redacted logs failed to load'
    } finally {
      logLoading.value = false
    }
  }

  onMounted(loadOverview)
</script>

<style scoped>
  .developer-runtime-page {
    min-height: 100%;
    padding: 20px;
    background: var(--el-bg-color);
  }

  .developer-runtime-page__header,
  .developer-runtime-page__actions,
  .developer-runtime-page__section-heading,
  .developer-runtime-page__log-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .developer-runtime-page__header h1,
  .developer-runtime-page__section-heading h2 {
    margin: 0;
    letter-spacing: 0;
  }

  .developer-runtime-page__header h1 {
    font-size: 20px;
  }

  .developer-runtime-page__header p,
  .developer-runtime-page__section-heading span,
  .developer-runtime-page__muted,
  .developer-runtime-page__log-heading span {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  .developer-runtime-page__header p {
    margin: 5px 0 0;
    font-size: 13px;
  }

  .developer-runtime-page__alert,
  .developer-runtime-page__kpis,
  .developer-runtime-page__table-section {
    margin-top: 18px;
  }

  .developer-runtime-page__kpis {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    border: 1px solid var(--el-border-color-lighter);
  }

  .developer-runtime-page__kpis > div {
    min-width: 0;
    padding: 16px 18px;
    border-right: 1px solid var(--el-border-color-lighter);
  }

  .developer-runtime-page__kpis > div:last-child {
    border-right: 0;
  }

  .developer-runtime-page__kpis span,
  .developer-runtime-page__kpis strong {
    display: block;
  }

  .developer-runtime-page__kpis span {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  .developer-runtime-page__kpis strong {
    margin-top: 5px;
    font-size: 22px;
  }

  .developer-runtime-page__section-heading {
    margin-bottom: 10px;
  }

  .developer-runtime-page__section-heading h2 {
    font-size: 15px;
  }

  .developer-runtime-page__muted {
    margin-top: 4px;
  }

  .developer-runtime-page__log-heading {
    margin-bottom: 12px;
  }

  pre {
    min-height: 280px;
    max-height: calc(100vh - 230px);
    margin: 0;
    padding: 14px;
    overflow: auto;
    border: 1px solid var(--el-border-color-lighter);
    background: var(--el-fill-color-light);
    color: var(--el-text-color-primary);
    font-size: 12px;
    line-height: 1.55;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  @media (max-width: 760px) {
    .developer-runtime-page {
      padding: 14px;
    }

    .developer-runtime-page__header,
    .developer-runtime-page__actions {
      align-items: stretch;
    }

    .developer-runtime-page__header {
      display: grid;
    }

    .developer-runtime-page__kpis {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .developer-runtime-page__kpis > div:nth-child(2) {
      border-right: 0;
    }

    .developer-runtime-page__kpis > div:nth-child(-n + 2) {
      border-bottom: 1px solid var(--el-border-color-lighter);
    }
  }
</style>
