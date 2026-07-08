<template>
  <div class="art-full-height p-5 tenant-modules-page">
    <ElCard class="art-table-card" shadow="never">
      <template #header>
        <div class="tenant-modules-page__header">
          <div>
            <h1 class="tenant-modules-page__title">租户模块</h1>
            <p class="tenant-modules-page__subtitle">查看当前租户可用模块、授权来源与运行入口。</p>
          </div>
          <ElButton type="primary" :icon="Refresh" :loading="loading" @click="loadModules">
            刷新
          </ElButton>
        </div>
      </template>

      <div v-if="loadError" class="tenant-modules-page__load-error">
        <ElAlert type="error" :title="loadError" show-icon :closable="false" />
        <ElButton size="small" type="primary" link :loading="loading" @click="loadModules">重试</ElButton>
      </div>

      <ElTable v-loading="loading" :data="records" border>
        <ElTableColumn label="模块" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="tenant-modules-page__module">
              <span class="tenant-modules-page__module-name">{{ row.name || '-' }}</span>
              <span class="tenant-modules-page__module-code">{{ row.code || '-' }}</span>
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="category" label="分类" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.category || '-' }}</template>
        </ElTableColumn>
        <ElTableColumn prop="version" label="版本" width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.version || '-' }}</template>
        </ElTableColumn>
        <ElTableColumn label="授权来源" width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ entitlementText(row.entitlement_source) }}</template>
        </ElTableColumn>
        <ElTableColumn label="租户状态" width="130">
          <template #default="{ row }">
            <ElTag :type="isTenantEnabled(row.tenant_enabled) ? 'success' : 'info'" effect="light">
              {{ isTenantEnabled(row.tenant_enabled) ? '可用' : '由套餐决定' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="可用性说明" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <span
              :class="[
                'tenant-modules-page__reason',
                isTenantEnabled(row.tenant_enabled) ? 'is-available' : 'is-unavailable'
              ]"
            >
              {{ moduleAccessText(row) }}
            </span>
          </template>
        </ElTableColumn>
        <ElTableColumn label="平台状态" width="120">
          <template #default="{ row }">
            <ElTag :type="platformStatusTagType(row.status)" effect="light">
              {{ platformStatusText(row.status) }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="操作" fixed="right" width="180">
          <template #default="{ row }">
            <ElButton
              v-if="row.entry_route && isTenantEnabled(row.tenant_enabled)"
              link
              type="primary"
              :icon="Link"
              @click="openModule(row.entry_route)"
            >
              进入
            </ElButton>
            <ElButton
              v-if="!isTenantEnabled(row.tenant_enabled)"
              link
              type="warning"
              :icon="InfoFilled"
              :loading="diagnosingCode === row.code"
              @click="loadDiagnosis(row)"
            >
              查看原因
            </ElButton>
            <span v-if="!row.entry_route && isTenantEnabled(row.tenant_enabled)">-</span>
          </template>
        </ElTableColumn>
        <template #empty>
          <ElEmpty description="暂无模块数据" />
        </template>
      </ElTable>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { InfoFilled, Link, Refresh } from '@element-plus/icons-vue'
  import {
    fetchTenantSystemModuleAccessDiagnosis,
    fetchTenantSystemModules,
    type SystemModuleAccessDiagnosis,
    type SystemModuleRecord
  } from '@/api/system-module'

  defineOptions({ name: 'TenantModulesPage' })

  const router = useRouter()
  const records = ref<SystemModuleRecord[]>([])
  const loading = ref(false)
  const loadError = ref('')
  const diagnosingCode = ref('')
  const diagnosisByCode = reactive<Record<string, SystemModuleAccessDiagnosis>>({})

  function isTenantEnabled(value?: boolean | number) {
    return value === true || value === 1
  }

  function entitlementText(source?: string) {
    const map: Record<string, string> = {
      plan: '套餐',
      manual: '手动授权',
      trial: '试用',
      system: '系统'
    }
    return source ? map[source] || source : '-'
  }

  function platformStatusText(status?: string) {
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

  function platformStatusTagType(status?: string) {
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

  function moduleAccessText(row: SystemModuleRecord) {
    if (isTenantEnabled(row.tenant_enabled)) {
      return row.entitlement_source === 'plan' ? '当前套餐已包含，可直接使用' : '当前租户已开通，可直接使用'
    }
    return diagnosisByCode[row.code]?.reason || '当前租户未启用该系统模块'
  }

  async function loadModules() {
    loading.value = true
    loadError.value = ''
    try {
      records.value = await fetchTenantSystemModules()
    } catch (error) {
      console.error('[TenantModulesPage] load modules failed:', error)
      records.value = []
      loadError.value = '租户模块加载失败，请稍后重试'
      ElMessage.error(loadError.value)
    } finally {
      loading.value = false
    }
  }

  async function loadDiagnosis(row: SystemModuleRecord) {
    if (!row.code) return
    diagnosingCode.value = row.code
    try {
      const diagnosis = diagnosisByCode[row.code] || (await fetchTenantSystemModuleAccessDiagnosis(row.code))
      diagnosisByCode[row.code] = diagnosis
      showDiagnosis(row, diagnosis)
    } catch (error) {
      console.error('[TenantModulesPage] load module diagnosis failed:', error)
      ElMessage.error('模块诊断失败，请稍后重试')
    } finally {
      diagnosingCode.value = ''
    }
  }

  function showDiagnosis(row: SystemModuleRecord, diagnosis: SystemModuleAccessDiagnosis) {
    const lines = [
      `${row.name || row.code}：${diagnosis.reason}`,
      diagnosis.required_saas_module_codes?.length
        ? `需要的 SaaS 模块：${diagnosis.required_saas_module_codes.join('、')}`
        : '',
      diagnosis.missing_saas_module_codes?.length
        ? `当前缺少：${diagnosis.missing_saas_module_codes.join('、')}`
        : '',
      diagnosis.tenant_saas_module_codes?.length
        ? `当前套餐模块：${diagnosis.tenant_saas_module_codes.join('、')}`
        : '',
      ...(diagnosis.suggestions?.length ? ['建议：', ...diagnosis.suggestions.map((item) => `- ${item}`)] : [])
    ].filter(Boolean)

    ElMessageBox.alert(lines.join('\n'), '模块访问诊断', {
      confirmButtonText: '知道了'
    })
  }

  function openModule(entryRoute: string) {
    router.push(entryRoute)
  }

  onMounted(() => {
    loadModules()
  })
</script>

<style scoped>
  .tenant-modules-page {
    display: grid;
    align-content: start;
    gap: 16px;
  }

  .tenant-modules-page__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .tenant-modules-page__title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.4;
    letter-spacing: 0;
  }

  .tenant-modules-page__subtitle {
    margin: 6px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.5;
  }

  .tenant-modules-page__module {
    display: grid;
    gap: 2px;
  }

  .tenant-modules-page__module-name {
    color: var(--el-text-color-primary);
    font-weight: 500;
  }

  .tenant-modules-page__module-code {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  .tenant-modules-page__reason {
    font-size: 13px;
    line-height: 1.5;
  }

  .tenant-modules-page__reason.is-available {
    color: var(--el-color-success);
  }

  .tenant-modules-page__reason.is-unavailable {
    color: var(--el-color-warning);
  }

  @media (max-width: 640px) {
    .tenant-modules-page__header {
      display: grid;
    }
  }
</style>
