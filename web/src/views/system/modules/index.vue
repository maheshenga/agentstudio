<template>
  <div class="art-full-height p-5 system-modules-page">
    <ElCard class="art-table-card" shadow="never">
      <template #header>
        <div class="system-modules-page__header">
          <div>
            <h1 class="system-modules-page__title">系统模块</h1>
            <p class="system-modules-page__subtitle">管理平台内置、插件和扩展模块的安装状态与运行入口。</p>
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
        <ElButton type="primary" :icon="Search" :loading="loading" @click="loadModules">查询</ElButton>
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
  </div>
</template>

<script setup lang="ts">
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { Refresh, Search, SwitchButton, View } from '@element-plus/icons-vue'
  import {
    fetchSystemModules,
    registerBuiltInSystemModules,
    updateSystemModuleStatus,
    type SystemModuleRecord
  } from '@/api/system-module'

  defineOptions({ name: 'SystemModulesPage' })

  const router = useRouter()
  const records = ref<SystemModuleRecord[]>([])
  const loading = ref(false)
  const syncing = ref(false)
  const updatingCode = ref('')
  const filters = reactive({
    keyword: '',
    source: '',
    status: ''
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
      warning: '告警',
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

  onMounted(() => {
    loadModules()
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
