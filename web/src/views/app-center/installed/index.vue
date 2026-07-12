<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="app-installed-page">
      <template #header>
        <div class="app-installed-page__header">
          <div>
            <h1 class="app-installed-page__title">Installed Apps</h1>
            <p class="app-installed-page__subtitle">Open tenant apps or remove apps that are no longer needed.</p>
          </div>
          <ElButton type="primary" :icon="Refresh" :loading="loading" @click="loadInstalled">Refresh</ElButton>
        </div>
      </template>

      <div v-if="loadError" class="app-installed-page__load-error">
        <ElAlert type="error" :title="loadError" show-icon :closable="false" />
        <ElButton size="small" type="primary" link :loading="loading" @click="loadInstalled">Retry</ElButton>
      </div>

      <ElTable v-loading="loading" :data="records" border>
        <ElTableColumn label="App" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="app-installed-page__app-name">{{ row.app?.name || `App #${row.app_id}` }}</div>
            <div class="app-installed-page__app-code">{{ row.app?.code || '-' }}</div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="Type" width="120">
          <template #default="{ row }">
            <ElTag :type="typeTagType(row.app?.type)" effect="light">{{ typeText(row.app?.type) }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="Status" width="120">
          <template #default="{ row }">
            <ElTag :type="row.enabled && row.app?.available !== false ? 'success' : 'info'" effect="light">
              {{ row.enabled && row.app?.available !== false ? 'Enabled' : 'Disabled' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="Access" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.app?.available === false">
              {{ row.app?.availability_reason || availabilityText(row.app?.availability_status) }}
            </span>
            <span v-else>{{ availabilityText(row.app?.availability_status) }}</span>
          </template>
        </ElTableColumn>
        <ElTableColumn label="Source" width="130">
          <template #default="{ row }">{{ sourceText(row.source) }}</template>
        </ElTableColumn>
        <ElTableColumn label="Installed" width="170">
          <template #default="{ row }">{{ formatDateTime(row.installed_time || row.create_time) }}</template>
        </ElTableColumn>
        <ElTableColumn label="Summary" min-width="260" show-overflow-tooltip>
          <template #default="{ row }">{{ row.app?.summary || row.app?.description || '-' }}</template>
        </ElTableColumn>
        <ElTableColumn label="Capabilities" min-width="180">
          <template #default="{ row }">
            <div v-if="row.effective_capabilities?.length" class="app-installed-page__capabilities">
              <ElTag v-for="capability in row.effective_capabilities" :key="capability" size="small" type="success" effect="plain">
                {{ capabilityLabel(capability) }}
              </ElTag>
            </div>
            <span v-else-if="row.tenant_approved_capabilities?.length">Consent inactive</span>
            <span v-else>None granted</span>
          </template>
        </ElTableColumn>
        <ElTableColumn label="Actions" fixed="right" width="270">
          <template #default="{ row }">
            <ElButton
              link
              type="primary"
              :icon="Link"
              :disabled="isOpenDisabled(row)"
              @click="openApp(row.app?.code)"
            >
              Open
            </ElButton>
            <ElButton
              link
              type="primary"
              :disabled="!row.app?.code || !row.requested_capabilities?.length"
              @click="openPermissions(row)"
            >
              Permissions
            </ElButton>
            <ElButton
              link
              type="warning"
              :icon="Delete"
              :disabled="!row.app?.code"
              :loading="operatingCode === row.app?.code"
              @click="uninstallApp(row)"
            >
              Uninstall
            </ElButton>
          </template>
        </ElTableColumn>
        <template #empty>
          <ElEmpty description="No installed apps" />
        </template>
      </ElTable>
    </ElCard>

    <ElDialog v-model="permissionDialogVisible" title="App permissions" width="520px">
      <div v-loading="permissionLoading" class="app-installed-page__permission-body">
        <ElAlert v-if="permissionError" type="error" :title="permissionError" :closable="false" show-icon />
        <ElAlert
          v-else-if="!permissionLoading && !platformApprovedCapabilities.length"
          type="warning"
          title="No capabilities are currently approved by the platform."
          :closable="false"
          show-icon
        />
        <ElCheckboxGroup v-else v-model="selectedCapabilities" class="app-installed-page__permission-options">
          <ElCheckbox v-for="capability in platformApprovedCapabilities" :key="capability" :value="capability">
            {{ capabilityLabel(capability) }}
          </ElCheckbox>
        </ElCheckboxGroup>
      </div>
      <template #footer>
        <ElButton :disabled="permissionSaving || permissionLoading" @click="permissionDialogVisible = false">Cancel</ElButton>
        <ElButton
          type="danger"
          plain
          :disabled="permissionLoading || Boolean(permissionError)"
          :loading="permissionSaving"
          @click="revokeAllCapabilities"
        >
          Revoke all
        </ElButton>
        <ElButton
          type="primary"
          :disabled="permissionLoading || Boolean(permissionError)"
          :loading="permissionSaving"
          @click="savePermissions"
        >
          Save
        </ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { Delete, Link, Refresh } from '@element-plus/icons-vue'
  import {
    fetchTenantInstalledApps,
    fetchTenantAppCapabilities,
    updateTenantAppCapabilities,
    uninstallTenantApp,
    type AppPackageType,
    type TenantAppInstallRecord
  } from '@/api/app-marketplace'

  defineOptions({ name: 'AppCenterInstalledPage' })

  const router = useRouter()
  const records = ref<TenantAppInstallRecord[]>([])
  const loading = ref(false)
  const loadError = ref('')
  const operatingCode = ref('')
  const permissionDialogVisible = ref(false)
  const permissionLoading = ref(false)
  const permissionSaving = ref(false)
  const permissionError = ref('')
  const permissionAppCode = ref('')
  const platformApprovedCapabilities = ref<string[]>([])
  const selectedCapabilities = ref<string[]>([])
  const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })

  function typeText(type?: AppPackageType) {
    const map: Record<string, string> = { internal: 'Internal', static: 'Static', iframe: 'Iframe' }
    return type ? map[type] || type : '-'
  }

  function typeTagType(type?: AppPackageType) {
    const map: Record<string, 'success' | 'warning' | 'info'> = { internal: 'success', static: 'warning', iframe: 'info' }
    return type ? map[type] || 'info' : 'info'
  }

  function sourceText(source?: string) {
    const map: Record<string, string> = { marketplace: 'Marketplace', plan: 'Plan', platform: 'Platform', manual: 'Manual' }
    return source ? map[source] || source : '-'
  }

  function availabilityText(status?: string) {
    const map: Record<string, string> = {
      available: 'Ready',
      missing_plan_module: 'Requires upgrade',
      missing_system_module: 'Module disabled for tenant',
      system_module_unavailable: 'System module unavailable'
    }
    return status ? map[status] || status : 'Ready'
  }

  function isOpenDisabled(row: TenantAppInstallRecord) {
    return row.app?.available === false || !row.enabled || !row.app?.code
  }

  function capabilityLabel(capability: string) {
    return capability === 'context.read' ? 'Read tenant and user context' : capability
  }

  function formatDateTime(value: unknown) {
    if (!value) return '-'
    const date = value instanceof Date ? value : new Date(String(value))
    return Number.isNaN(date.getTime()) ? String(value) : dateFormatter.format(date)
  }

  async function loadInstalled() {
    loading.value = true
    loadError.value = ''
    try {
      records.value = await fetchTenantInstalledApps()
    } catch (error) {
      console.error('[AppCenterInstalledPage] load installed failed:', error)
      loadError.value = 'Installed apps failed to load'
      ElMessage.error(loadError.value)
    } finally {
      loading.value = false
    }
  }

  function openApp(code?: string) {
    if (!code) return
    router.push({ path: '/app-center/open', query: { code } })
  }

  async function uninstallApp(row: TenantAppInstallRecord) {
    const code = row.app?.code
    if (!code) return
    await ElMessageBox.confirm(`Uninstall ${row.app?.name || code}?`, 'Uninstall app', {
      type: 'warning',
      confirmButtonText: 'Uninstall',
      cancelButtonText: 'Cancel'
    })
    operatingCode.value = code
    try {
      await uninstallTenantApp(code)
      ElMessage.success('App uninstalled')
      await loadInstalled()
    } finally {
      operatingCode.value = ''
    }
  }

  async function openPermissions(row: TenantAppInstallRecord) {
    const code = row.app?.code
    if (!code) return
    permissionDialogVisible.value = true
    permissionLoading.value = true
    permissionError.value = ''
    permissionAppCode.value = code
    platformApprovedCapabilities.value = []
    selectedCapabilities.value = []
    try {
      const state = await fetchTenantAppCapabilities(code)
      platformApprovedCapabilities.value = state.platform_approved
      selectedCapabilities.value = state.tenant_approved.filter((capability) =>
        state.platform_approved.includes(capability)
      )
    } catch {
      permissionError.value = 'Permissions failed to load. Close and try again.'
    } finally {
      permissionLoading.value = false
    }
  }

  async function persistPermissions(capabilities: string[]) {
    if (!permissionAppCode.value) return
    permissionSaving.value = true
    permissionError.value = ''
    try {
      await updateTenantAppCapabilities(permissionAppCode.value, capabilities)
      ElMessage.success('App permissions updated')
      permissionDialogVisible.value = false
      await loadInstalled()
    } catch {
      permissionError.value = 'Permissions could not be saved. Try again.'
    } finally {
      permissionSaving.value = false
    }
  }

  function savePermissions() {
    return persistPermissions(selectedCapabilities.value)
  }

  function revokeAllCapabilities() {
    return persistPermissions([])
  }

  onMounted(() => {
    loadInstalled()
  })
</script>

<style scoped>
  .app-installed-page {
    min-height: 100%;
  }

  .app-installed-page__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .app-installed-page__title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.4;
    letter-spacing: 0;
  }

  .app-installed-page__subtitle {
    margin: 6px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.5;
  }

  .app-installed-page__load-error {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .app-installed-page__app-name {
    color: var(--el-text-color-primary);
    font-weight: 500;
  }

  .app-installed-page__app-code {
    margin-top: 2px;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  .app-installed-page__capabilities,
  .app-installed-page__permission-options {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .app-installed-page__permission-body {
    min-height: 100px;
  }

  .app-installed-page__permission-options {
    margin: 12px 0;
  }

  @media (max-width: 640px) {
    .app-installed-page__header {
      display: grid;
    }
  }
</style>
