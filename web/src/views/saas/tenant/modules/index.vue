<template>
  <div class="art-full-height p-5 tenant-modules-page">
    <div class="tenant-modules-page__header">
      <div>
        <h1>租户模块</h1>
        <p>查看模块授权来源、可用状态和租户级配置。</p>
      </div>
      <ElButton type="primary" :icon="Refresh" :loading="loading" @click="loadModules">刷新</ElButton>
    </div>

    <ElAlert v-if="loadError" type="error" :title="loadError" show-icon :closable="false" />
    <ElTable v-loading="loading" :data="records" border>
      <ElTableColumn label="模块" min-width="190">
        <template #default="{ row }">
          <div class="tenant-modules-page__module">
            <strong>{{ row.name || '-' }}</strong>
            <span>{{ row.code }}</span>
          </div>
        </template>
      </ElTableColumn>
      <ElTableColumn prop="category" label="分类" min-width="120" />
      <ElTableColumn prop="version" label="版本" width="110" />
      <ElTableColumn label="授权来源" width="130">
        <template #default="{ row }">{{ entitlementText(row.entitlement_source) }}</template>
      </ElTableColumn>
      <ElTableColumn label="状态" width="120">
        <template #default="{ row }">
          <ElTag :type="isEnabled(row) ? 'success' : 'info'" effect="light">
            {{ isEnabled(row) ? '可用' : '未开通' }}
          </ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn label="说明" min-width="230" show-overflow-tooltip>
        <template #default="{ row }">{{ accessText(row) }}</template>
      </ElTableColumn>
      <ElTableColumn label="操作" fixed="right" width="210">
        <template #default="{ row }">
          <ElButton v-if="isEnabled(row)" link type="primary" :icon="Setting" @click="openConfig(row)">
            配置
          </ElButton>
          <ElButton v-if="isEnabled(row) && row.entry_route" link type="primary" :icon="Link" @click="router.push(row.entry_route)">
            进入
          </ElButton>
          <ElButton v-if="!isEnabled(row)" link type="warning" :icon="InfoFilled" :loading="diagnosingCode === row.code" @click="showDiagnosis(row)">
            查看原因
          </ElButton>
        </template>
      </ElTableColumn>
      <template #empty><ElEmpty description="暂无模块数据" /></template>
    </ElTable>

    <ElDialog v-model="configVisible" :title="`${selectedModule?.name || '模块'}配置`" width="min(680px, 92vw)" destroy-on-close>
      <ElForm label-position="top">
        <ElFormItem label="租户覆盖配置">
          <ElInput v-model="tenantConfigText" type="textarea" :rows="10" resize="vertical" spellcheck="false" />
        </ElFormItem>
        <ElFormItem label="当前有效配置">
          <pre class="tenant-modules-page__effective">{{ effectiveConfigText }}</pre>
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="configVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="savingConfig" @click="saveConfig">保存</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { InfoFilled, Link, Refresh, Setting } from '@element-plus/icons-vue'
  import {
    fetchTenantSystemModuleAccessDiagnosis,
    fetchTenantSystemModuleConfig,
    fetchTenantSystemModules,
    saveTenantSystemModuleConfig,
    type SystemModuleRecord
  } from '@/api/system-module'

  defineOptions({ name: 'TenantModulesPage' })
  const router = useRouter()
  const records = ref<SystemModuleRecord[]>([])
  const loading = ref(false)
  const loadError = ref('')
  const diagnosingCode = ref('')
  const configVisible = ref(false)
  const savingConfig = ref(false)
  const selectedModule = ref<SystemModuleRecord | null>(null)
  const tenantConfigText = ref('{}')
  const effectiveConfigText = ref('{}')

  function isEnabled(row: SystemModuleRecord) {
    return row.tenant_enabled === true || row.tenant_enabled === 1
  }
  function entitlementText(source?: string) {
    return ({ plan: '套餐', platform: '平台授权', manual: '手动授权', trial: '试用', system: '系统基线' } as Record<string, string>)[source || ''] || source || '-'
  }
  function accessText(row: SystemModuleRecord) {
    if (isEnabled(row)) return row.entitlement_source === 'plan' ? '当前套餐已包含' : '当前租户已开通'
    return '当前租户尚未开通该模块'
  }
  function parseConfig() {
    const value = JSON.parse(tenantConfigText.value)
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('配置必须是 JSON 对象')
    return value as Record<string, any>
  }

  async function loadModules() {
    loading.value = true
    loadError.value = ''
    try {
      records.value = await fetchTenantSystemModules()
    } catch (error) {
      console.error('[TenantModulesPage] load failed:', error)
      records.value = []
      loadError.value = '租户模块加载失败，请稍后重试'
    } finally {
      loading.value = false
    }
  }

  async function showDiagnosis(row: SystemModuleRecord) {
    diagnosingCode.value = row.code
    try {
      const diagnosis = await fetchTenantSystemModuleAccessDiagnosis(row.code)
      const content = [diagnosis.reason, ...(diagnosis.suggestions || [])].filter(Boolean).join('\n')
      await ElMessageBox.alert(content, '模块访问诊断', { confirmButtonText: '知道了' })
    } finally {
      diagnosingCode.value = ''
    }
  }

  async function openConfig(row: SystemModuleRecord) {
    selectedModule.value = row
    const result = await fetchTenantSystemModuleConfig(row.code)
    tenantConfigText.value = JSON.stringify(result.tenant_config || {}, null, 2)
    effectiveConfigText.value = JSON.stringify(result.effective_config || {}, null, 2)
    configVisible.value = true
  }

  async function saveConfig() {
    if (!selectedModule.value) return
    let config: Record<string, any>
    try {
      config = parseConfig()
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '配置 JSON 无效')
      return
    }
    savingConfig.value = true
    try {
      const result = await saveTenantSystemModuleConfig(selectedModule.value.code, config)
      tenantConfigText.value = JSON.stringify(result.tenant_config || {}, null, 2)
      effectiveConfigText.value = JSON.stringify(result.effective_config || {}, null, 2)
      ElMessage.success('租户配置已保存')
    } finally {
      savingConfig.value = false
    }
  }

  onMounted(loadModules)
</script>

<style scoped>
  .tenant-modules-page { display: grid; align-content: start; gap: 16px; }
  .tenant-modules-page__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
  .tenant-modules-page__header h1 { margin: 0; font-size: 18px; line-height: 1.4; letter-spacing: 0; }
  .tenant-modules-page__header p { margin: 5px 0 0; color: var(--el-text-color-secondary); font-size: 13px; }
  .tenant-modules-page__module { display: grid; gap: 2px; }
  .tenant-modules-page__module span { color: var(--el-text-color-secondary); font-size: 12px; }
  .tenant-modules-page__effective { width: 100%; max-height: 260px; margin: 0; overflow: auto; padding: 12px; border: 1px solid var(--el-border-color-light); border-radius: 6px; background: var(--el-fill-color-lighter); font-size: 13px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
  @media (max-width: 640px) { .tenant-modules-page__header { display: grid; } }
</style>
