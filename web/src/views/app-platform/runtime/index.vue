<template>
  <div class="art-full-height app-service-runtime-page">
    <header class="app-service-runtime-page__header">
      <div>
        <h1>服务运行时</h1>
        <p>管理审核通过的服务应用，并查看受限的运行证据。</p>
      </div>
      <div class="app-service-runtime-page__header-actions">
        <ElTooltip content="启动候选版本" placement="bottom">
          <ElButton
            v-permission="'app:runtime:manage'"
            circle
            type="primary"
            :icon="Plus"
            aria-label="启动候选版本"
            @click="openStartDialog"
          />
        </ElTooltip>
        <ElTooltip content="校准运行状态" placement="bottom">
          <ElButton
            v-permission="'app:runtime:manage'"
            circle
            :icon="RefreshRight"
            :loading="reconciling"
            aria-label="校准运行状态"
            @click="reconcileRuntime"
          />
        </ElTooltip>
        <ElTooltip content="刷新" placement="bottom">
          <ElButton
            v-permission="'app:runtime:list'"
            circle
            :icon="Refresh"
            :loading="loading"
            aria-label="刷新运行实例"
            @click="loadInstances"
          />
        </ElTooltip>
      </div>
    </header>

    <div class="app-service-runtime-page__filters">
      <ElInput
        v-model="filters.app_code"
        clearable
        placeholder="应用编码"
        @keyup.enter="loadInstances"
      />
      <ElSelect v-model="filters.role" clearable placeholder="实例角色">
        <ElOption v-for="item in roleOptions" :key="item" :label="labelize(item)" :value="item" />
      </ElSelect>
      <ElSelect v-model="filters.process_status" clearable placeholder="进程状态">
        <ElOption
          v-for="item in processOptions"
          :key="item"
          :label="labelize(item)"
          :value="item"
        />
      </ElSelect>
      <ElSelect v-model="filters.health_status" clearable placeholder="健康状态">
        <ElOption v-for="item in healthOptions" :key="item" :label="labelize(item)" :value="item" />
      </ElSelect>
      <ElButton type="primary" :icon="Search" :loading="loading" @click="loadInstances"
        >查询</ElButton
      >
      <ElButton :disabled="loading" @click="resetFilters">重置</ElButton>
    </div>

    <div v-if="loadError" class="app-service-runtime-page__error">
      <ElAlert type="error" :title="loadError" show-icon :closable="false" />
      <ElButton link type="primary" :loading="loading" @click="loadInstances">重试</ElButton>
    </div>

    <div v-loading="loading" class="app-service-runtime-page__content">
      <ElTable
        v-if="instances.length"
        :data="instances"
        border
        class="app-service-runtime-page__table"
      >
        <ElTableColumn label="应用" min-width="190" fixed="left">
          <template #default="{ row }">
            <ElButton
              link
              type="primary"
              class="app-service-runtime-page__app-link"
              @click="openDetail(row.app_code)"
            >
              {{ row.app_code }}
            </ElButton>
            <div class="app-service-runtime-page__muted">{{ row.version }}</div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="角色" width="105">
          <template #default="{ row }">
            <ElTag :type="roleTagType(row.role)" effect="light">{{ labelize(row.role) }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="进程状态" width="115">
          <template #default="{ row }">
            <ElTag :type="processTagType(row.process_status)" effect="light">{{
              labelize(row.process_status)
            }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="健康状态" width="115">
          <template #default="{ row }">
            <ElTag :type="healthTagType(row.health_status)" effect="light">{{
              labelize(row.health_status)
            }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="restart_count" label="重启次数" width="90" align="right" />
        <ElTableColumn label="最近检查" width="180">
          <template #default="{ row }">{{ formatDateTime(row.last_health_at) }}</template>
        </ElTableColumn>
        <ElTableColumn label="诊断信息" min-width="230" show-overflow-tooltip>
          <template #default="{ row }">
            <div>{{ row.diagnostic_code || '-' }}</div>
            <div v-if="row.diagnostic_message" class="app-service-runtime-page__muted">{{
              row.diagnostic_message
            }}</div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="255" fixed="right">
          <template #default="{ row }">
            <div class="app-service-runtime-page__row-actions">
              <ElTooltip content="启动候选版本" placement="top">
                <ElButton
                  v-permission="'app:runtime:manage'"
                  circle
                  size="small"
                  type="primary"
                  :icon="VideoPlay"
                  :loading="isActionLoading(row, 'start')"
                  :disabled="!canStartCandidate(row)"
                  aria-label="启动候选版本"
                  @click="startCandidate(row.app_code, row.version)"
                />
              </ElTooltip>
              <ElTooltip content="发布候选版本" placement="top">
                <ElButton
                  v-permission="'app:runtime:manage'"
                  circle
                  size="small"
                  type="success"
                  :icon="Promotion"
                  :loading="isActionLoading(row, 'publish')"
                  :disabled="!canPublishCandidate(row)"
                  aria-label="发布候选版本"
                  @click="publishCandidate(row)"
                />
              </ElTooltip>
              <ElTooltip content="停止候选版本" placement="top">
                <ElButton
                  v-permission="'app:runtime:manage'"
                  circle
                  size="small"
                  type="warning"
                  :icon="VideoPause"
                  :disabled="!canStopCandidate(row)"
                  aria-label="停止候选版本"
                  @click="openReasonDialog('stop', row)"
                />
              </ElTooltip>
              <ElTooltip content="回滚到备用版本" placement="top">
                <ElButton
                  v-permission="'app:runtime:manage'"
                  circle
                  size="small"
                  type="danger"
                  :icon="RefreshLeft"
                  :disabled="!canRollbackInstance(row)"
                  aria-label="回滚到备用版本"
                  @click="openReasonDialog('rollback', row)"
                />
              </ElTooltip>
              <ElTooltip content="探测当前服务" placement="top">
                <ElButton
                  v-permission="'app:runtime:probe'"
                  circle
                  size="small"
                  :icon="Connection"
                  :disabled="!canProbeInstance(row)"
                  aria-label="探测当前服务"
                  @click="openProbeDialog(row.app_code)"
                />
              </ElTooltip>
              <ElTooltip content="查看脱敏日志" placement="top">
                <ElButton
                  v-permission="'app:runtime:logs'"
                  circle
                  size="small"
                  :icon="Document"
                  :disabled="row.role === 'retired'"
                  aria-label="查看脱敏日志"
                  @click="openLogs(row.app_code)"
                />
              </ElTooltip>
            </div>
          </template>
        </ElTableColumn>
      </ElTable>

      <div v-if="instances.length" class="app-service-runtime-page__mobile-list">
        <article
          v-for="row in instances"
          :key="row.id"
          class="app-service-runtime-page__mobile-item"
        >
          <div class="app-service-runtime-page__mobile-heading">
            <button type="button" @click="openDetail(row.app_code)">{{ row.app_code }}</button>
            <span>{{ row.version }}</span>
          </div>
          <div class="app-service-runtime-page__mobile-tags">
            <ElTag :type="roleTagType(row.role)" effect="light">{{ labelize(row.role) }}</ElTag>
            <ElTag :type="processTagType(row.process_status)" effect="light">{{
              labelize(row.process_status)
            }}</ElTag>
            <ElTag :type="healthTagType(row.health_status)" effect="light">{{
              labelize(row.health_status)
            }}</ElTag>
          </div>
          <p>{{ row.diagnostic_message || row.diagnostic_code || '暂无诊断信息' }}</p>
          <div class="app-service-runtime-page__row-actions">
            <ElButton
              v-permission="'app:runtime:manage'"
              size="small"
              :icon="VideoPlay"
              :disabled="!canStartCandidate(row)"
              @click="startCandidate(row.app_code, row.version)"
              >启动</ElButton
            >
            <ElButton
              v-permission="'app:runtime:manage'"
              size="small"
              type="success"
              :icon="Promotion"
              :disabled="!canPublishCandidate(row)"
              @click="publishCandidate(row)"
              >发布</ElButton
            >
            <ElButton
              v-permission="'app:runtime:manage'"
              size="small"
              type="warning"
              :icon="VideoPause"
              :disabled="!canStopCandidate(row)"
              @click="openReasonDialog('stop', row)"
              >停止</ElButton
            >
            <ElButton
              v-permission="'app:runtime:manage'"
              size="small"
              type="danger"
              :icon="RefreshLeft"
              :disabled="!canRollbackInstance(row)"
              @click="openReasonDialog('rollback', row)"
              >回滚</ElButton
            >
            <ElButton
              v-permission="'app:runtime:probe'"
              size="small"
              :icon="Connection"
              :disabled="!canProbeInstance(row)"
              @click="openProbeDialog(row.app_code)"
              >探测</ElButton
            >
            <ElButton
              v-permission="'app:runtime:logs'"
              size="small"
              :icon="Document"
              :disabled="row.role === 'retired'"
              @click="openLogs(row.app_code)"
              >日志</ElButton
            >
          </div>
        </article>
      </div>

      <ElEmpty v-if="!loading && !loadError && !instances.length" description="暂无服务运行实例" />
    </div>

    <ElDialog v-model="startDialogVisible" title="启动服务候选版本" width="min(520px, 94vw)">
      <ElForm label-width="100px">
        <ElFormItem label="应用编码" required>
          <ElInput v-model="startForm.app_code" maxlength="80" placeholder="service_app" />
        </ElFormItem>
        <ElFormItem label="版本" required>
          <ElInput v-model="startForm.version" maxlength="40" placeholder="1.0.0" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="startDialogVisible = false">取消</ElButton>
        <ElButton
          type="primary"
          :loading="startSubmitting"
          :disabled="!isStartFormValid"
          @click="submitStartCandidate"
          >启动候选版本</ElButton
        >
      </template>
    </ElDialog>

    <ElDialog
      v-model="reasonDialogVisible"
      :title="reasonAction === 'stop' ? '停止候选版本' : '回滚服务版本'"
      width="min(520px, 94vw)"
    >
      <p class="app-service-runtime-page__dialog-note">
        {{ reasonTarget?.app_code }} / {{ reasonTarget?.version }}
      </p>
      <ElInput
        v-if="reasonAction === 'stop'"
        v-model="stopReason"
        type="textarea"
        :rows="4"
        minlength="3"
        maxlength="500"
        show-word-limit
        placeholder="请输入停止候选版本的原因"
      />
      <ElInput
        v-else
        v-model="rollbackReason"
        type="textarea"
        :rows="4"
        minlength="3"
        maxlength="500"
        show-word-limit
        placeholder="请输入恢复备用版本的原因"
      />
      <template #footer>
        <ElButton @click="reasonDialogVisible = false">取消</ElButton>
        <ElButton
          :type="reasonAction === 'stop' ? 'warning' : 'danger'"
          :loading="reasonSubmitting"
          :disabled="activeReason.trim().length < 3"
          @click="submitReasonAction"
          >确认</ElButton
        >
      </template>
    </ElDialog>

    <ElDialog v-model="probeDialogVisible" title="探测当前服务" width="min(680px, 94vw)">
      <p class="app-service-runtime-page__dialog-note">{{ probeCode }}</p>
      <ElInput
        v-model="probeInput"
        type="textarea"
        :rows="8"
        resize="vertical"
        placeholder='{"ping":true}'
      />
      <ElAlert v-if="probeError" type="error" :title="probeError" show-icon :closable="false" />
      <pre v-if="probeOutput" class="app-service-runtime-page__output">{{ probeOutput }}</pre>
      <template #footer>
        <ElButton @click="probeDialogVisible = false">关闭</ElButton>
        <ElButton
          type="primary"
          :loading="probeLoading"
          :disabled="probeInputBytes > 64 * 1024"
          @click="submitProbe"
          >执行探测</ElButton
        >
      </template>
    </ElDialog>

    <ElDrawer v-model="logsDrawerVisible" title="运行时脱敏日志" size="min(820px, 96vw)">
      <div class="app-service-runtime-page__drawer-tools">
        <span>{{ logsCode }}</span>
        <ElInputNumber v-model="logLines" :min="1" :max="200" controls-position="right" />
        <ElButton :icon="Refresh" :loading="logsLoading" @click="loadLogs">刷新</ElButton>
      </div>
      <div v-if="logsError" class="app-service-runtime-page__error">
        <ElAlert type="error" :title="logsError" show-icon :closable="false" />
      </div>
      <div v-loading="logsLoading" class="app-service-runtime-page__logs">
        <section>
          <h2>标准输出</h2>
          <pre>{{ logs?.stdout || '暂无输出' }}</pre>
        </section>
        <section>
          <h2>标准错误</h2>
          <pre>{{ logs?.stderr || '暂无错误' }}</pre>
        </section>
      </div>
    </ElDrawer>

    <ElDrawer v-model="detailDrawerVisible" title="运行时详情" size="min(720px, 96vw)">
      <div v-if="detailError" class="app-service-runtime-page__error">
        <ElAlert type="error" :title="detailError" show-icon :closable="false" />
        <ElButton link type="primary" :loading="detailLoading" @click="loadDetail">重试</ElButton>
      </div>
      <div v-loading="detailLoading" class="app-service-runtime-page__detail">
        <template v-if="detail">
          <div class="app-service-runtime-page__detail-heading">
            <div>
              <h2>{{ detail.app_name }}</h2>
              <p>{{ detail.app_code }}</p>
            </div>
            <ElTag :type="detail.app_status === 'published' ? 'success' : 'info'" effect="light">
              {{ labelize(detail.app_status) }}
            </ElTag>
          </div>
          <dl class="app-service-runtime-page__versions">
            <div
              ><dt>当前版本</dt><dd>{{ detail.active_version || '-' }}</dd></div
            >
            <div
              ><dt>候选版本</dt><dd>{{ detail.candidate_version || '-' }}</dd></div
            >
            <div
              ><dt>备用版本</dt><dd>{{ detail.standby_version || '-' }}</dd></div
            >
          </dl>
          <ElTable :data="detail.instances" border>
            <ElTableColumn prop="version" label="版本" min-width="120" />
            <ElTableColumn label="角色" width="105">
              <template #default="{ row }">{{ labelize(row.role) }}</template>
            </ElTableColumn>
            <ElTableColumn label="进程状态" width="115">
              <template #default="{ row }">{{ labelize(row.process_status) }}</template>
            </ElTableColumn>
            <ElTableColumn label="健康状态" width="115">
              <template #default="{ row }">{{ labelize(row.health_status) }}</template>
            </ElTableColumn>
            <template #empty><ElEmpty description="该服务暂无运行实例" /></template>
          </ElTable>
        </template>
        <ElEmpty v-else-if="!detailLoading && !detailError" description="暂无运行时详情" />
      </div>
    </ElDrawer>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    Connection,
    Document,
    Plus,
    Promotion,
    Refresh,
    RefreshLeft,
    RefreshRight,
    Search,
    VideoPause,
    VideoPlay
  } from '@element-plus/icons-vue'
  import {
    fetchAppServiceInstances,
    fetchAppServiceLogs,
    fetchAppServiceRuntimeDetail,
    probeAppService,
    publishAppServiceCandidate,
    reconcileAppServiceRuntime,
    rollbackAppServiceVersion,
    startAppServiceCandidate,
    stopAppServiceCandidate,
    type AppServiceHealthStatus,
    type AppServiceInstanceRecord,
    type AppServiceInstanceRole,
    type AppServiceLogsResponse,
    type AppServiceProcessStatus,
    type AppServiceRuntimeDetail
  } from '@/api/app-service-runtime'
  import {
    formatDateTime,
    healthTagType,
    labelize,
    processTagType,
    roleTagType
  } from './runtime-display'

  defineOptions({ name: 'AppServiceRuntimePage' })

  type ReasonAction = 'stop' | 'rollback'
  type RuntimeAction = 'start' | 'publish'

  const roleOptions: AppServiceInstanceRole[] = ['candidate', 'active', 'standby', 'retired']
  const processOptions: AppServiceProcessStatus[] = ['starting', 'online', 'stopped', 'failed']
  const healthOptions: AppServiceHealthStatus[] = ['unknown', 'checking', 'healthy', 'unhealthy']
  const filters = reactive({
    app_code: '',
    role: '' as AppServiceInstanceRole | '',
    process_status: '' as AppServiceProcessStatus | '',
    health_status: '' as AppServiceHealthStatus | ''
  })
  const instances = ref<AppServiceInstanceRecord[]>([])
  const loading = ref(false)
  const loadError = ref('')
  const reconciling = ref(false)
  const actionLoading = ref('')
  const startDialogVisible = ref(false)
  const startSubmitting = ref(false)
  const startForm = reactive({ app_code: '', version: '' })
  const reasonDialogVisible = ref(false)
  const reasonAction = ref<ReasonAction>('stop')
  const reasonTarget = ref<AppServiceInstanceRecord | null>(null)
  const reasonSubmitting = ref(false)
  const stopReason = ref('')
  const rollbackReason = ref('')
  const probeDialogVisible = ref(false)
  const probeCode = ref('')
  const probeInput = ref('{\n  "ping": true\n}')
  const probeOutput = ref('')
  const probeError = ref('')
  const probeLoading = ref(false)
  const logsDrawerVisible = ref(false)
  const logsCode = ref('')
  const logLines = ref(100)
  const logs = ref<AppServiceLogsResponse | null>(null)
  const logsLoading = ref(false)
  const logsError = ref('')
  const detailDrawerVisible = ref(false)
  const detailCode = ref('')
  const detail = ref<AppServiceRuntimeDetail | null>(null)
  const detailLoading = ref(false)
  const detailError = ref('')
  const encoder = new TextEncoder()
  const activeReason = computed(() =>
    reasonAction.value === 'stop' ? stopReason.value : rollbackReason.value
  )
  const isStartFormValid = computed(
    () =>
      /^[a-z][a-z0-9_]{2,79}$/.test(startForm.app_code.trim()) &&
      /^[0-9A-Za-z][0-9A-Za-z._-]{0,39}$/.test(startForm.version.trim())
  )
  const probeInputBytes = computed(() => encoder.encode(probeInput.value).byteLength)

  function canStartCandidate(row: AppServiceInstanceRecord) {
    return (
      row.role === 'candidate' &&
      (row.process_status === 'stopped' ||
        row.process_status === 'failed' ||
        row.health_status === 'unhealthy')
    )
  }

  function canPublishCandidate(row: AppServiceInstanceRecord) {
    return (
      row.role === 'candidate' && row.process_status === 'online' && row.health_status === 'healthy'
    )
  }

  function canStopCandidate(row: AppServiceInstanceRecord) {
    return row.role === 'candidate' && row.process_status !== 'stopped'
  }

  function canRollbackInstance(row: AppServiceInstanceRecord) {
    return (
      row.role === 'standby' && row.process_status === 'online' && row.health_status === 'healthy'
    )
  }

  function canProbeInstance(row: AppServiceInstanceRecord) {
    return (
      row.role === 'active' && row.process_status === 'online' && row.health_status === 'healthy'
    )
  }

  function actionKey(row: AppServiceInstanceRecord, action: RuntimeAction) {
    return `${action}:${row.id}`
  }

  function isActionLoading(row: AppServiceInstanceRecord, action: RuntimeAction) {
    return actionLoading.value === actionKey(row, action)
  }

  async function loadInstances() {
    loading.value = true
    loadError.value = ''
    try {
      instances.value = await fetchAppServiceInstances({
        app_code: filters.app_code.trim() || undefined,
        role: filters.role || undefined,
        process_status: filters.process_status || undefined,
        health_status: filters.health_status || undefined
      })
    } catch (error) {
      console.error('[AppServiceRuntimePage] load failed:', error)
      loadError.value = '运行实例加载失败。'
    } finally {
      loading.value = false
    }
  }

  function resetFilters() {
    filters.app_code = ''
    filters.role = ''
    filters.process_status = ''
    filters.health_status = ''
    loadInstances()
  }

  function openStartDialog() {
    startForm.app_code = filters.app_code.trim()
    startForm.version = ''
    startDialogVisible.value = true
  }

  async function submitStartCandidate() {
    if (!isStartFormValid.value) return
    startSubmitting.value = true
    try {
      await startAppServiceCandidate(startForm.app_code.trim(), startForm.version.trim())
      ElMessage.success('候选版本已启动并通过健康检查。')
      startDialogVisible.value = false
      await loadInstances()
    } finally {
      startSubmitting.value = false
    }
  }

  async function startCandidate(code: string, version: string) {
    const row = instances.value.find((item) => item.app_code === code && item.version === version)
    if (!row || !canStartCandidate(row)) return
    actionLoading.value = actionKey(row, 'start')
    try {
      await startAppServiceCandidate(code, version)
      ElMessage.success('候选版本已启动并通过健康检查。')
      await loadInstances()
    } finally {
      actionLoading.value = ''
    }
  }

  async function publishCandidate(row: AppServiceInstanceRecord) {
    if (!canPublishCandidate(row)) return
    await ElMessageBox.confirm(
      `确认将 ${row.app_code} ${row.version} 发布为当前版本吗？`,
      '发布候选版本',
      {
        type: 'warning',
        confirmButtonText: '发布',
        cancelButtonText: '取消'
      }
    )
    actionLoading.value = actionKey(row, 'publish')
    try {
      await publishAppServiceCandidate(row.app_code, row.version)
      ElMessage.success('候选版本已发布。')
      await loadInstances()
    } finally {
      actionLoading.value = ''
    }
  }

  function openReasonDialog(action: ReasonAction, row: AppServiceInstanceRecord) {
    reasonAction.value = action
    reasonTarget.value = row
    stopReason.value = ''
    rollbackReason.value = ''
    reasonDialogVisible.value = true
  }

  async function submitReasonAction() {
    const row = reasonTarget.value
    const reason = activeReason.value.trim()
    if (!row || reason.length < 3) return
    reasonSubmitting.value = true
    try {
      if (reasonAction.value === 'stop') {
        await stopAppServiceCandidate(row.app_code, row.version, reason)
        ElMessage.success('候选版本已停止。')
      } else {
        await rollbackAppServiceVersion(row.app_code, row.version, reason)
        ElMessage.success('版本回滚已完成。')
      }
      reasonDialogVisible.value = false
      await loadInstances()
    } finally {
      reasonSubmitting.value = false
    }
  }

  function openProbeDialog(code: string) {
    probeCode.value = code
    probeInput.value = '{\n  "ping": true\n}'
    probeOutput.value = ''
    probeError.value = ''
    probeDialogVisible.value = true
  }

  async function submitProbe() {
    probeError.value = ''
    probeOutput.value = ''
    let payload: Record<string, unknown>
    try {
      const parsed = JSON.parse(probeInput.value)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('探测输入必须是 JSON 对象。')
      }
      payload = parsed
    } catch (error) {
      probeError.value = error instanceof Error ? error.message : '探测输入不是有效的 JSON。'
      return
    }
    if (probeInputBytes.value > 64 * 1024) {
      probeError.value = '探测输入不能超过 64 KB。'
      return
    }
    probeLoading.value = true
    try {
      const response = await probeAppService(probeCode.value, payload)
      probeOutput.value = JSON.stringify(response, null, 2)
    } catch (error) {
      console.error('[AppServiceRuntimePage] probe failed:', error)
      probeError.value = '服务探测失败，请检查健康状态后重试。'
    } finally {
      probeLoading.value = false
    }
  }

  async function openLogs(code: string) {
    logsCode.value = code
    logs.value = null
    logsDrawerVisible.value = true
    await loadLogs()
  }

  async function loadLogs() {
    if (!logsCode.value) return
    logsLoading.value = true
    logsError.value = ''
    try {
      logs.value = await fetchAppServiceLogs(logsCode.value, logLines.value)
    } catch (error) {
      console.error('[AppServiceRuntimePage] logs failed:', error)
      logsError.value = '脱敏日志加载失败。'
    } finally {
      logsLoading.value = false
    }
  }

  async function openDetail(code: string) {
    detailCode.value = code
    detail.value = null
    detailDrawerVisible.value = true
    await loadDetail()
  }

  async function loadDetail() {
    if (!detailCode.value) return
    detailLoading.value = true
    detailError.value = ''
    try {
      detail.value = await fetchAppServiceRuntimeDetail(detailCode.value)
    } catch (error) {
      console.error('[AppServiceRuntimePage] detail failed:', error)
      detailError.value = '运行时详情加载失败。'
    } finally {
      detailLoading.value = false
    }
  }

  async function reconcileRuntime() {
    await ElMessageBox.confirm('确认在不发布版本的情况下校准预期运行状态吗？', '校准运行状态', {
      type: 'info',
      confirmButtonText: '校准',
      cancelButtonText: '取消'
    })
    reconciling.value = true
    try {
      const result = await reconcileAppServiceRuntime()
      ElMessage.success(
        `运行状态校准完成：已重启 ${result.restarted ?? 0} 个，失败 ${result.failed ?? 0} 个。`
      )
      await loadInstances()
    } finally {
      reconciling.value = false
    }
  }

  onMounted(loadInstances)
</script>

<style scoped>
  .app-service-runtime-page {
    display: grid;
    align-content: start;
    gap: 16px;
    padding: 20px;
  }

  .app-service-runtime-page__header,
  .app-service-runtime-page__header-actions,
  .app-service-runtime-page__filters,
  .app-service-runtime-page__row-actions,
  .app-service-runtime-page__mobile-tags,
  .app-service-runtime-page__drawer-tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }

  .app-service-runtime-page__header {
    justify-content: space-between;
  }

  .app-service-runtime-page__header h1,
  .app-service-runtime-page__detail-heading h2,
  .app-service-runtime-page__logs h2 {
    margin: 0;
    letter-spacing: 0;
  }

  .app-service-runtime-page__header h1 {
    font-size: 20px;
    line-height: 1.4;
  }

  .app-service-runtime-page__header p,
  .app-service-runtime-page__detail-heading p,
  .app-service-runtime-page__dialog-note {
    margin: 4px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.5;
  }

  .app-service-runtime-page__filters .el-input,
  .app-service-runtime-page__filters .el-select {
    width: 180px;
  }

  .app-service-runtime-page__error {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .app-service-runtime-page__content {
    min-height: 280px;
  }

  .app-service-runtime-page__app-link {
    max-width: 100%;
    padding: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .app-service-runtime-page__muted {
    margin-top: 3px;
    overflow: hidden;
    color: var(--el-text-color-secondary);
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .app-service-runtime-page__row-actions {
    flex-wrap: nowrap;
  }

  .app-service-runtime-page__mobile-list {
    display: none;
  }

  .app-service-runtime-page__dialog-note {
    margin-bottom: 12px;
  }

  .app-service-runtime-page__output,
  .app-service-runtime-page__logs pre {
    max-height: 360px;
    margin: 14px 0 0;
    padding: 12px;
    overflow: auto;
    border: 1px solid var(--el-border-color);
    border-radius: 4px;
    background: var(--el-fill-color-light);
    color: var(--el-text-color-primary);
    font-size: 12px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .app-service-runtime-page__drawer-tools {
    margin-bottom: 16px;
  }

  .app-service-runtime-page__drawer-tools > span {
    margin-right: auto;
    font-weight: 600;
  }

  .app-service-runtime-page__logs {
    display: grid;
    gap: 18px;
  }

  .app-service-runtime-page__logs h2 {
    font-size: 15px;
  }

  .app-service-runtime-page__detail {
    min-height: 240px;
  }

  .app-service-runtime-page__detail-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 16px;
  }

  .app-service-runtime-page__detail-heading h2 {
    font-size: 17px;
  }

  .app-service-runtime-page__versions {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin: 0 0 16px;
  }

  .app-service-runtime-page__versions > div {
    padding: 10px 0;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .app-service-runtime-page__versions dt {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  .app-service-runtime-page__versions dd {
    margin: 5px 0 0;
    font-weight: 600;
  }

  @media (max-width: 760px) {
    .app-service-runtime-page {
      padding: 14px;
    }

    .app-service-runtime-page__header,
    .app-service-runtime-page__filters {
      align-items: stretch;
    }

    .app-service-runtime-page__header-actions {
      justify-content: flex-end;
    }

    .app-service-runtime-page__filters .el-input,
    .app-service-runtime-page__filters .el-select,
    .app-service-runtime-page__filters .el-button {
      width: 100%;
    }

    .app-service-runtime-page__table {
      display: none;
    }

    .app-service-runtime-page__mobile-list {
      display: grid;
      gap: 10px;
    }

    .app-service-runtime-page__mobile-item {
      min-width: 0;
      padding: 14px;
      border: 1px solid var(--el-border-color);
      border-radius: 6px;
      background: var(--el-bg-color);
    }

    .app-service-runtime-page__mobile-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .app-service-runtime-page__mobile-heading button {
      min-width: 0;
      padding: 0;
      overflow: hidden;
      border: 0;
      background: transparent;
      color: var(--el-color-primary);
      font: inherit;
      font-weight: 600;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .app-service-runtime-page__mobile-heading span {
      color: var(--el-text-color-secondary);
      font-size: 12px;
      white-space: nowrap;
    }

    .app-service-runtime-page__mobile-tags {
      margin-top: 10px;
    }

    .app-service-runtime-page__mobile-item p {
      margin: 10px 0;
      color: var(--el-text-color-secondary);
      font-size: 12px;
      line-height: 1.5;
      word-break: break-word;
    }

    .app-service-runtime-page__row-actions {
      flex-wrap: wrap;
    }

    .app-service-runtime-page__versions {
      grid-template-columns: 1fr;
    }
  }
</style>
