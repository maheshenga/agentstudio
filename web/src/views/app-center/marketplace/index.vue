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
            <ElTag :type="row.installed ? 'success' : 'info'" effect="light">
              {{ row.installed ? 'Installed' : 'Available' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="summary" label="Summary" min-width="260" show-overflow-tooltip>
          <template #default="{ row }">{{ row.summary || row.description || '-' }}</template>
        </ElTableColumn>
        <ElTableColumn label="Actions" fixed="right" width="220">
          <template #default="{ row }">
            <ElButton
              v-if="!row.installed"
              link
              type="primary"
              :icon="ShoppingCart"
              :loading="operatingCode === row.code"
              @click="installApp(row.code)"
            >
              Install
            </ElButton>
            <ElButton
              v-else
              link
              type="success"
              :icon="Link"
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

  function typeText(type?: AppPackageType) {
    const map: Record<string, string> = { internal: 'Internal', static: 'Static', iframe: 'Iframe' }
    return type ? map[type] || type : '-'
  }

  function typeTagType(type?: AppPackageType) {
    const map: Record<string, 'success' | 'warning' | 'info'> = { internal: 'success', static: 'warning', iframe: 'info' }
    return type ? map[type] || 'info' : 'info'
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

  async function installApp(code: string) {
    operatingCode.value = code
    try {
      await installTenantApp(code)
      ElMessage.success('App installed')
      await loadApps()
    } finally {
      operatingCode.value = ''
    }
  }

  function openApp(code: string) {
    router.push({ path: '/app-center/open', query: { code } })
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
