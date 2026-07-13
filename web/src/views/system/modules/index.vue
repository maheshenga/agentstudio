<template>
  <div class="art-full-height p-5 system-modules-page">
    <ElCard class="art-table-card" shadow="never">
      <template #header>
        <div class="system-modules-page__header">
          <div>
            <h1 class="system-modules-page__title">系统模块</h1>
            <p class="system-modules-page__subtitle"
              >管理平台内置、插件和扩展模块的安装状态与运行入口。</p
            >
          </div>
          <ElButton type="primary" :icon="Refresh" :loading="syncing" @click="syncBuiltIns">
            同步内置模块
          </ElButton>
        </div>
      </template>

      <div class="system-modules-page__filters">
        <ElInput
          v-model="filters.keyword"
          clearable
          class="system-modules-page__keyword"
          placeholder="搜索编码或名称"
          @keyup.enter="loadModules"
        />
        <ElSelect
          v-model="filters.source"
          clearable
          class="system-modules-page__select"
          placeholder="模块来源"
        >
          <ElOption label="内置" value="built_in" />
          <ElOption label="插件" value="plugin" />
          <ElOption label="扩展" value="extension" />
        </ElSelect>
        <ElSelect
          v-model="filters.status"
          clearable
          class="system-modules-page__select"
          placeholder="模块状态"
        >
          <ElOption label="已启用" value="enabled" />
          <ElOption label="已禁用" value="disabled" />
          <ElOption label="已安装" value="installed" />
          <ElOption label="异常" value="failed" />
        </ElSelect>
        <ElButton type="primary" :icon="Search" :loading="loading" @click="loadModules"
          >查询</ElButton
        >
        <ElButton @click="resetFilters">重置</ElButton>
      </div>

      <ElTable v-loading="loading" :data="records" border>
        <ElTableColumn prop="code" label="模块编码" min-width="150" show-overflow-tooltip />
        <ElTableColumn prop="name" label="模块名称" min-width="150" show-overflow-tooltip />
        <ElTableColumn label="来源" width="110">
          <template #default="{ row }">{{ sourceText(row.source) }}</template>
        </ElTableColumn>
        <ElTableColumn prop="version" label="版本" width="120" show-overflow-tooltip />
        <ElTableColumn prop="category" label="分类" min-width="120" show-overflow-tooltip />
        <ElTableColumn label="状态" width="110">
          <template #default="{ row }">
            <ElTag :type="statusTagType(row.status)" effect="light">
              {{ statusText(row.status) }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="健康状态" width="120">
          <template #default="{ row }">
            <span>{{ healthText(row.health_status) }}</span>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="entry_route" label="入口路由" min-width="220" show-overflow-tooltip />
        <ElTableColumn label="操作" fixed="right" width="180">
          <template #default="{ row }">
            <ElSpace>
              <ElButton link type="primary" :icon="View" @click="openDetail(row)">详情</ElButton>
              <ElButton
                v-if="canToggleStatus(row.status)"
                link
                :type="isEnabled(row.status) ? 'warning' : 'success'"
                :icon="SwitchButton"
                :loading="updatingCode === row.code"
                @click="toggleStatus(row)"
              >
                {{ isEnabled(row.status) ? '禁用' : '启用' }}
              </ElButton>
            </ElSpace>
          </template>
        </ElTableColumn>
        <template #empty>
          <ElEmpty description="暂无模块数据" />
        </template>
      </ElTable>
    </ElCard>

    <ElCard class="art-table-card" shadow="never">
      <template #header>
        <div class="system-modules-page__header">
          <div>
            <h2 class="system-modules-page__title">SAAS 桥接配置</h2>
            <p class="system-modules-page__subtitle"
              >维护商业 SAAS 模块与系统模块之间的授权映射关系。</p
            >
          </div>
          <ElButton type="primary" @click="openBridgeDialog()">新增桥接</ElButton>
        </div>
      </template>

      <div class="system-modules-page__filters">
        <ElInput
          v-model="bridgeFilters.saas_module_code"
          clearable
          class="system-modules-page__keyword"
          placeholder="SAAS 模块编码"
          @keyup.enter="loadSaasBridges"
        />
        <ElInput
          v-model="bridgeFilters.system_module_code"
          clearable
          class="system-modules-page__keyword"
          placeholder="系统模块编码"
          @keyup.enter="loadSaasBridges"
        />
        <ElSelect
          v-model="bridgeFilters.enabled"
          clearable
          class="system-modules-page__select"
          placeholder="桥接状态"
        >
          <ElOption label="已启用" :value="1" />
          <ElOption label="已禁用" :value="0" />
        </ElSelect>
        <ElButton type="primary" :icon="Search" :loading="bridgeLoading" @click="loadSaasBridges"
          >查询</ElButton
        >
        <ElButton @click="resetBridgeFilters">重置</ElButton>
      </div>

      <ElTable v-loading="bridgeLoading" :data="bridgeRecords" border>
        <ElTableColumn
          prop="saas_module_code"
          label="SAAS 模块"
          min-width="160"
          show-overflow-tooltip
        />
        <ElTableColumn
          prop="system_module_code"
          label="系统模块"
          min-width="160"
          show-overflow-tooltip
        />
        <ElTableColumn label="状态" width="110">
          <template #default="{ row }">
            <ElTag :type="row.enabled ? 'success' : 'info'" effect="light">
              {{ row.enabled ? '已启用' : '已禁用' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="source" label="来源" width="110" show-overflow-tooltip />
        <ElTableColumn prop="remark" label="备注" min-width="180" show-overflow-tooltip />
        <ElTableColumn label="更新时间" width="180">
          <template #default="{ row }">{{ formatDateTime(row.update_time) }}</template>
        </ElTableColumn>
        <ElTableColumn label="操作" fixed="right" width="180">
          <template #default="{ row }">
            <ElSpace>
              <ElButton link type="primary" @click="openBridgeDialog(row)">编辑</ElButton>
              <ElButton
                link
                :type="row.enabled ? 'warning' : 'success'"
                :loading="updatingBridgeId === row.id"
                @click="toggleBridgeStatus(row)"
              >
                {{ row.enabled ? '禁用' : '启用' }}
              </ElButton>
            </ElSpace>
          </template>
        </ElTableColumn>
        <template #empty>
          <ElEmpty description="暂无桥接配置" />
        </template>
      </ElTable>
    </ElCard>

    <ElCard class="art-table-card" shadow="never">
      <template #header>
        <div class="system-modules-page__header">
          <div>
            <h2 class="system-modules-page__title">租户模块授权</h2>
            <p class="system-modules-page__subtitle">
              管理平台显式授权；套餐授权需要通过套餐或 SaaS 桥接配置调整。
            </p>
          </div>
        </div>
      </template>

      <div class="system-modules-page__filters">
        <ElInputNumber
          v-model="tenantGrantTenantId"
          :min="1"
          :precision="0"
          controls-position="right"
          placeholder="租户 ID"
        />
        <ElButton
          type="primary"
          :icon="Search"
          :loading="tenantGrantLoading"
          @click="loadTenantGrants"
        >
          查询授权
        </ElButton>
      </div>

      <ElTable v-loading="tenantGrantLoading" :data="tenantGrantRecords" border>
        <ElTableColumn prop="code" label="模块编码" min-width="160" show-overflow-tooltip />
        <ElTableColumn prop="name" label="模块名称" min-width="160" show-overflow-tooltip />
        <ElTableColumn label="显式授权" width="110">
          <template #default="{ row }">
            <ElTag :type="row.explicit_enabled ? 'success' : 'info'" effect="light">
              {{ row.explicit_enabled ? '已授权' : '未授权' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="套餐授权" width="110">
          <template #default="{ row }">
            <ElTag :type="row.plan_enabled ? 'success' : 'info'" effect="light">
              {{ row.plan_enabled ? '已包含' : '未包含' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="最终状态" width="110">
          <template #default="{ row }">
            <ElTag :type="row.tenant_enabled ? 'success' : 'warning'" effect="light">
              {{ row.tenant_enabled ? '可用' : '不可用' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="entitlement_source" label="权益来源" width="120">
          <template #default="{ row }">{{ row.entitlement_source || '-' }}</template>
        </ElTableColumn>
        <ElTableColumn label="操作" fixed="right" width="130">
          <template #default="{ row }">
            <ElButton
              link
              :type="row.explicit_enabled ? 'warning' : 'primary'"
              :loading="tenantGrantUpdatingCode === row.code"
              @click="changeTenantGrant(row)"
            >
              {{ row.explicit_enabled ? '撤销授权' : '授予模块' }}
            </ElButton>
          </template>
        </ElTableColumn>
        <template #empty>
          <ElEmpty description="请输入租户 ID 查询模块授权" />
        </template>
      </ElTable>
    </ElCard>

    <ElDialog
      v-model="bridgeDialogVisible"
      :title="editingBridgeId ? '编辑桥接' : '新增桥接'"
      width="560px"
    >
      <ElForm ref="bridgeFormRef" :model="bridgeForm" :rules="bridgeRules" label-width="112px">
        <ElFormItem label="SAAS 模块" prop="saas_module_code">
          <ElSelect
            v-model="bridgeForm.saas_module_code"
            filterable
            :disabled="Boolean(editingBridgeId)"
            class="system-modules-page__form-control"
            placeholder="选择 SAAS 模块"
          >
            <ElOption
              v-for="module in saasModuleOptions"
              :key="module.code"
              :label="`${module.name} (${module.code})`"
              :value="module.code"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="系统模块" prop="system_module_code">
          <ElSelect
            v-model="bridgeForm.system_module_code"
            filterable
            :disabled="Boolean(editingBridgeId)"
            class="system-modules-page__form-control"
            placeholder="选择系统模块"
          >
            <ElOption
              v-for="module in systemModuleOptions"
              :key="module.code"
              :label="`${module.name} (${module.code})`"
              :value="module.code"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="状态">
          <ElSwitch v-model="bridgeForm.enabled" :active-value="1" :inactive-value="0" />
        </ElFormItem>
        <ElFormItem label="备注">
          <ElInput v-model="bridgeForm.remark" type="textarea" maxlength="255" show-word-limit />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="bridgeDialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="bridgeSaving" @click="saveBridge">保存</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage, ElMessageBox } from 'element-plus'
  import type { FormInstance, FormRules } from 'element-plus'
  import { Refresh, Search, SwitchButton, View } from '@element-plus/icons-vue'
  import { fetchPlatformModules, type SaasModuleRecord } from '@/api/saas'
  import {
    fetchPlatformTenantModuleGrants,
    fetchSystemModuleSaasBridges,
    fetchSystemModules,
    grantPlatformTenantModule,
    registerBuiltInSystemModules,
    revokePlatformTenantModule,
    saveSystemModuleSaasBridge,
    updateSystemModuleSaasBridgeStatus,
    type SaveSystemModuleSaasBridgeParams,
    type SystemModuleSaasBridgeRecord,
    updateSystemModuleStatus,
    type SystemModuleRecord
  } from '@/api/system-module'

  defineOptions({ name: 'SystemModulesPage' })

  const router = useRouter()
  const records = ref<SystemModuleRecord[]>([])
  const loading = ref(false)
  const syncing = ref(false)
  const updatingCode = ref('')
  const bridgeRecords = ref<SystemModuleSaasBridgeRecord[]>([])
  const bridgeLoading = ref(false)
  const bridgeSaving = ref(false)
  const bridgeDialogVisible = ref(false)
  const editingBridgeId = ref<number | string | undefined>()
  const updatingBridgeId = ref<number | string | undefined>()
  const bridgeFormRef = ref<FormInstance>()
  const saasModuleOptions = ref<SaasModuleRecord[]>([])
  const systemModuleOptions = ref<SystemModuleRecord[]>([])
  const tenantGrantTenantId = ref<number>()
  const tenantGrantRecords = ref<SystemModuleRecord[]>([])
  const tenantGrantLoading = ref(false)
  const tenantGrantUpdatingCode = ref('')
  const filters = reactive({
    keyword: '',
    source: '',
    status: ''
  })
  const bridgeFilters = reactive<{
    saas_module_code: string
    system_module_code: string
    enabled: number | ''
  }>({
    saas_module_code: '',
    system_module_code: '',
    enabled: ''
  })
  const bridgeForm = reactive({
    saas_module_code: '',
    system_module_code: '',
    enabled: 1,
    remark: ''
  })
  const bridgeRules: FormRules = {
    saas_module_code: [{ required: true, message: '请选择 SAAS 模块', trigger: 'change' }],
    system_module_code: [{ required: true, message: '请选择系统模块', trigger: 'change' }]
  }
  const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })

  function cleanText(value: string) {
    return value.trim() || undefined
  }

  function sourceText(source?: string) {
    const map: Record<string, string> = {
      built_in: '内置',
      plugin: '插件',
      extension: '扩展'
    }
    return source ? map[source] || source : '-'
  }

  function statusText(status?: string) {
    const map: Record<string, string> = {
      enabled: '已启用',
      disabled: '已禁用',
      installed: '已安装',
      draft: '草稿',
      upgrading: '升级中',
      failed: '异常',
      uninstalled: '未安装',
      unknown: '未知'
    }
    return status ? map[status] || status : '-'
  }

  function statusTagType(status?: string) {
    const map: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
      enabled: 'success',
      disabled: 'info',
      installed: 'warning',
      draft: 'info',
      upgrading: 'warning',
      failed: 'danger',
      uninstalled: 'info',
      unknown: 'info'
    }
    return status ? map[status] || 'info' : 'info'
  }

  function healthText(status?: string) {
    const map: Record<string, string> = {
      healthy: '正常',
      degraded: '降级',
      failed: '异常',
      unknown: '未知'
    }
    return status ? map[status] || status : '-'
  }

  function isEnabled(status?: string) {
    return status === 'enabled'
  }

  function canToggleStatus(status?: string) {
    return status === 'enabled' || status === 'disabled' || status === 'installed'
  }

  function formatDateTime(value: unknown) {
    if (!value) return '-'
    const date = value instanceof Date ? value : new Date(String(value))
    return Number.isNaN(date.getTime()) ? String(value) : dateFormatter.format(date)
  }

  async function loadModules() {
    loading.value = true
    try {
      records.value = await fetchSystemModules({
        keyword: cleanText(filters.keyword),
        source: cleanText(filters.source),
        status: cleanText(filters.status)
      })
    } finally {
      loading.value = false
    }
  }

  function resetFilters() {
    filters.keyword = ''
    filters.source = ''
    filters.status = ''
    loadModules()
  }

  async function loadSaasBridges() {
    bridgeLoading.value = true
    try {
      bridgeRecords.value = await fetchSystemModuleSaasBridges({
        saas_module_code: cleanText(bridgeFilters.saas_module_code),
        system_module_code: cleanText(bridgeFilters.system_module_code),
        enabled: bridgeFilters.enabled === '' ? undefined : bridgeFilters.enabled
      })
    } finally {
      bridgeLoading.value = false
    }
  }

  function resetBridgeFilters() {
    bridgeFilters.saas_module_code = ''
    bridgeFilters.system_module_code = ''
    bridgeFilters.enabled = ''
    loadSaasBridges()
  }

  async function loadBridgeOptions() {
    const [saasModules, systemModules] = await Promise.all([
      fetchPlatformModules({}),
      fetchSystemModules({ status: 'enabled' })
    ])
    saasModuleOptions.value = saasModules
    systemModuleOptions.value = systemModules
  }

  async function loadTenantGrants() {
    const tenantId = Number(tenantGrantTenantId.value || 0)
    if (!Number.isSafeInteger(tenantId) || tenantId <= 0) {
      ElMessage.warning('请输入有效的租户 ID')
      return
    }
    tenantGrantLoading.value = true
    try {
      tenantGrantRecords.value = await fetchPlatformTenantModuleGrants(tenantId)
    } finally {
      tenantGrantLoading.value = false
    }
  }

  async function changeTenantGrant(row: SystemModuleRecord) {
    const tenantId = Number(tenantGrantTenantId.value || 0)
    if (!Number.isSafeInteger(tenantId) || tenantId <= 0) return
    const action = row.explicit_enabled ? '撤销' : '授予'
    const { value } = await ElMessageBox.prompt(
      `请输入${action}模块「${row.name}」的原因`,
      `${action}租户模块`,
      {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        inputValue: `${action}租户模块 ${row.code}`,
        inputValidator: (reason) => Boolean(String(reason || '').trim()) || '请输入操作原因'
      }
    )
    tenantGrantUpdatingCode.value = row.code
    try {
      if (row.explicit_enabled) {
        await revokePlatformTenantModule(tenantId, row.code, String(value || ''))
      } else {
        await grantPlatformTenantModule(tenantId, row.code, String(value || ''))
      }
      ElMessage.success(`${action}完成`)
      await loadTenantGrants()
    } finally {
      tenantGrantUpdatingCode.value = ''
    }
  }

  function resetBridgeForm() {
    Object.assign(bridgeForm, {
      saas_module_code: '',
      system_module_code: '',
      enabled: 1,
      remark: ''
    })
    bridgeFormRef.value?.clearValidate()
  }

  async function openBridgeDialog(row?: SystemModuleSaasBridgeRecord) {
    editingBridgeId.value = row?.id
    resetBridgeForm()
    await loadBridgeOptions()
    if (row) {
      Object.assign(bridgeForm, {
        saas_module_code: row.saas_module_code,
        system_module_code: row.system_module_code,
        enabled: row.enabled ? 1 : 0,
        remark: row.remark || ''
      })
    }
    bridgeDialogVisible.value = true
  }

  function buildBridgePayload(): SaveSystemModuleSaasBridgeParams {
    return {
      saas_module_code: bridgeForm.saas_module_code,
      system_module_code: bridgeForm.system_module_code,
      enabled: bridgeForm.enabled,
      remark: cleanText(bridgeForm.remark)
    }
  }

  async function saveBridge() {
    await bridgeFormRef.value?.validate()
    bridgeSaving.value = true
    try {
      await saveSystemModuleSaasBridge(buildBridgePayload())
      ElMessage.success(editingBridgeId.value ? '桥接配置已更新' : '桥接配置已创建')
      bridgeDialogVisible.value = false
      await loadSaasBridges()
    } finally {
      bridgeSaving.value = false
    }
  }

  async function syncBuiltIns() {
    syncing.value = true
    try {
      await registerBuiltInSystemModules()
      ElMessage.success('内置模块同步完成')
      await loadModules()
    } finally {
      syncing.value = false
    }
  }

  function openDetail(row: SystemModuleRecord) {
    router.push({ path: '/system/modules/detail', query: { code: row.code } })
  }

  async function toggleStatus(row: SystemModuleRecord) {
    if (!canToggleStatus(row.status)) {
      ElMessage.warning('当前状态不支持启停操作')
      return
    }
    const nextStatus = isEnabled(row.status) ? 'disabled' : 'enabled'
    await ElMessageBox.confirm(
      `确认${nextStatus === 'enabled' ? '启用' : '禁用'}模块「${row.name}」？`,
      '状态确认',
      { type: 'warning' }
    )
    updatingCode.value = row.code
    try {
      await updateSystemModuleStatus(row.code, nextStatus)
      ElMessage.success(nextStatus === 'enabled' ? '模块已启用' : '模块已禁用')
      await loadModules()
    } finally {
      updatingCode.value = ''
    }
  }

  async function toggleBridgeStatus(row: SystemModuleSaasBridgeRecord) {
    if (!row.id) return
    const nextEnabled = row.enabled ? 0 : 1
    updatingBridgeId.value = row.id
    try {
      await updateSystemModuleSaasBridgeStatus(row.id, nextEnabled)
      ElMessage.success(nextEnabled === 1 ? '桥接已启用' : '桥接已禁用')
      await loadSaasBridges()
    } finally {
      updatingBridgeId.value = undefined
    }
  }

  onMounted(() => {
    loadModules()
    loadSaasBridges()
  })
</script>

<style scoped>
  .system-modules-page {
    display: grid;
    align-content: start;
    gap: 16px;
  }

  .system-modules-page__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .system-modules-page__title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.4;
    letter-spacing: 0;
  }

  .system-modules-page__subtitle {
    margin: 6px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.5;
  }

  .system-modules-page__filters {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 16px;
  }

  .system-modules-page__form-control {
    width: 100%;
  }

  .system-modules-page__keyword {
    width: 240px;
  }

  .system-modules-page__select {
    width: 150px;
  }

  @media (max-width: 640px) {
    .system-modules-page__header {
      display: grid;
    }

    .system-modules-page__keyword,
    .system-modules-page__select {
      width: 100%;
    }
  }
</style>
