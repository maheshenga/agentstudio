<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="app-marketplace-page">
      <template #header>
        <div class="app-marketplace-page__header">
          <div>
            <h1 class="app-marketplace-page__title">App Marketplace</h1>
            <p class="app-marketplace-page__subtitle">Install approved apps for the current tenant and open enabled tools.</p>
          </div>
          <ElButton type="primary" :icon="Refresh" :loading="loading" @click="loadApps">Refresh</ElButton>
        </div>
      </template>

      <div v-if="loadError" class="app-marketplace-page__load-error">
        <ElAlert type="error" :title="loadError" show-icon :closable="false" />
        <ElButton size="small" type="primary" link :loading="loading" @click="loadApps">Retry</ElButton>
      </div>

      <ElTable v-loading="loading" :data="records" border>
        <ElTableColumn label="App" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="app-marketplace-page__app-name">{{ row.name || '-' }}</div>
            <div class="app-marketplace-page__app-code">{{ row.code || '-' }}</div>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="category" label="Category" min-width="130" show-overflow-tooltip>
          <template #default="{ row }">{{ row.category || '-' }}</template>
        </ElTableColumn>
        <ElTableColumn label="Type" width="120">
          <template #default="{ row }">
            <ElTag :type="typeTagType(row.type)" effect="light">{{ typeText(row.type) }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="Status" width="140">
          <template #default="{ row }">
            <ElTag :type="row.installed ? 'success' : row.available ? 'info' : 'warning'" effect="light">
              {{ row.installed ? 'Installed' : row.available ? 'Available' : 'Unavailable' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="Access" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.available">{{ availabilityText(row.availability_status) }}</span>
            <span v-else>{{ row.availability_reason || availabilityText(row.availability_status) }}</span>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="summary" label="Summary" min-width="260" show-overflow-tooltip>
          <template #default="{ row }">{{ row.summary || row.description || '-' }}</template>
        </ElTableColumn>
        <ElTableColumn label="Capabilities" min-width="190">
          <template #default="{ row }">
            <div v-if="row.requested_capabilities?.length" class="app-marketplace-page__capabilities">
              <ElTag v-for="capability in row.requested_capabilities" :key="capability" size="small" effect="plain">
                {{ capabilityLabel(capability) }}
              </ElTag>
            </div>
            <span v-else>-</span>
          </template>
        </ElTableColumn>
        <ElTableColumn label="Actions" fixed="right" width="260">
          <template #default="{ row }">
            <ElButton
              v-if="row.availability_status === 'missing_plan_module'"
              link
              type="warning"
              @click="openUpgrade"
            >
              Upgrade
            </ElButton>
            <ElButton
              v-if="!row.installed"
              link
              type="primary"
              :icon="ShoppingCart"
              :disabled="!row.available"
              :loading="operatingCode === row.code"
              @click="installApp(row)"
            >
              Install
            </ElButton>
            <ElButton
              v-else
              link
              type="success"
              :icon="Link"
              :disabled="!row.available"
              :loading="operatingCode === row.code"
              @click="openApp(row.code)"
            >
              Open
            </ElButton>
          </template>
        </ElTableColumn>
        <template #empty>
          <ElEmpty description="No approved apps are available for this tenant" />
        </template>
      </ElTable>
    </ElCard>

    <ElDialog v-model="consentDialogVisible" title="App permissions" width="520px">
      <ElAlert
        type="info"
        title="Choose which approved capabilities this app may use."
        :closable="false"
        show-icon
      />
      <ElAlert v-if="consentError" type="error" :title="consentError" :closable="false" show-icon />
      <ElCheckboxGroup v-model="selectedCapabilities" class="app-marketplace-page__consent-options">
        <ElCheckbox v-for="capability in consentApp?.platform_approved_capabilities || []" :key="capability" :value="capability">
          {{ capabilityLabel(capability) }}
        </ElCheckbox>
      </ElCheckboxGroup>
      <template #footer>
        <ElButton @click="consentDialogVisible = false">Cancel</ElButton>
        <ElButton type="primary" :loading="Boolean(operatingCode)" @click="confirmInstall">Install</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import { Link, Refresh, ShoppingCart } from '@element-plus/icons-vue'
  import {
    fetchTenantAppMarketplace,
    installTenantApp,
    type AppPackageType,
    type TenantMarketplaceAppRecord
  } from '@/api/app-marketplace'

  defineOptions({ name: 'AppCenterMarketplacePage' })

  const router = useRouter()
  const records = ref<TenantMarketplaceAppRecord[]>([])
  const loading = ref(false)
  const loadError = ref('')
  const operatingCode = ref('')
  const consentDialogVisible = ref(false)
  const consentApp = ref<TenantMarketplaceAppRecord | null>(null)
  const selectedCapabilities = ref<string[]>([])
  const consentError = ref('')

  function typeText(type?: AppPackageType) {
    const map: Record<string, string> = { internal: 'Internal', static: 'Static', iframe: 'Iframe' }
    return type ? map[type] || type : '-'
  }

  function typeTagType(type?: AppPackageType) {
    const map: Record<string, 'success' | 'warning' | 'info'> = { internal: 'success', static: 'warning', iframe: 'info' }
    return type ? map[type] || 'info' : 'info'
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

  function capabilityLabel(capability: string) {
    return capability === 'context.read' ? 'Read tenant and user context' : capability
  }

  async function loadApps() {
    loading.value = true
    loadError.value = ''
    try {
      records.value = await fetchTenantAppMarketplace()
    } catch (error) {
      console.error('[AppCenterMarketplacePage] load marketplace failed:', error)
      loadError.value = 'Marketplace failed to load'
      ElMessage.error(loadError.value)
    } finally {
      loading.value = false
    }
  }

  async function installApp(row: TenantMarketplaceAppRecord) {
    if (row.requested_capabilities?.length) {
      consentApp.value = row
      selectedCapabilities.value = [...row.platform_approved_capabilities]
      consentError.value = ''
      consentDialogVisible.value = true
      return
    }
    await submitInstall(row, [])
  }

  async function submitConsent(consentApp: TenantMarketplaceAppRecord, selectedCapabilities: string[]) {
    await installTenantApp(consentApp.code, selectedCapabilities)
  }

  async function submitInstall(app: TenantMarketplaceAppRecord, capabilities: string[]) {
    operatingCode.value = app.code
    try {
      await submitConsent(app, capabilities)
      ElMessage.success('App installed')
      consentDialogVisible.value = false
      await loadApps()
    } finally {
      operatingCode.value = ''
    }
  }

  async function confirmInstall() {
    if (!consentApp.value) return
    consentError.value = ''
    try {
      await submitInstall(consentApp.value, selectedCapabilities.value)
    } catch {
      consentError.value = 'Permission consent could not be saved. Try again.'
    }
  }

  function openApp(code: string) {
    router.push({ path: '/app-center/open', query: { code } })
  }

  function openUpgrade() {
    router.push('/tenant-saas/plan')
  }

  onMounted(() => {
    loadApps()
  })
</script>

<style scoped>
  .app-marketplace-page {
    min-height: 100%;
  }

  .app-marketplace-page__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .app-marketplace-page__title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.4;
    letter-spacing: 0;
  }

  .app-marketplace-page__subtitle {
    margin: 6px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.5;
  }

  .app-marketplace-page__load-error {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .app-marketplace-page__capabilities,
  .app-marketplace-page__consent-options {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .app-marketplace-page__consent-options {
    margin: 18px 0;
  }

  .app-marketplace-page__app-name {
    color: var(--el-text-color-primary);
    font-weight: 500;
  }

  .app-marketplace-page__app-code {
    margin-top: 2px;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  @media (max-width: 640px) {
    .app-marketplace-page__header {
      display: grid;
    }
  }
</style>
