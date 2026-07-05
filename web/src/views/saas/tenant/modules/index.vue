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
        <ElTableColumn label="平台状态" width="120">
          <template #default="{ row }">
            <ElTag :type="platformStatusTagType(row.status)" effect="light">
              {{ platformStatusText(row.status) }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="入口" fixed="right" width="120">
          <template #default="{ row }">
            <ElButton
              v-if="row.entry_route"
              link
              type="primary"
              :icon="Link"
              @click="openModule(row.entry_route)"
            >
              进入
            </ElButton>
            <span v-else>-</span>
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
  import { ElMessage } from 'element-plus'
  import { Link, Refresh } from '@element-plus/icons-vue'
  import { fetchTenantSystemModules, type SystemModuleRecord } from '@/api/system-module'

  defineOptions({ name: 'TenantModulesPage' })

  const router = useRouter()
  const records = ref<SystemModuleRecord[]>([])
  const loading = ref(false)

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

  async function loadModules() {
    loading.value = true
    try {
      records.value = await fetchTenantSystemModules()
    } catch (error) {
      ElMessage.error('加载租户模块失败')
      throw error
    } finally {
      loading.value = false
    }
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

  @media (max-width: 640px) {
    .tenant-modules-page__header {
      display: grid;
    }
  }
</style>
