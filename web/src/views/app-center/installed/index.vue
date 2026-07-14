<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="app-installed-page">
      <template #header>
        <div class="app-installed-page__header">
          <div>
            <h1 class="app-installed-page__title">已安装应用</h1>
            <p class="app-installed-page__subtitle"
              >打开租户应用、调整权限，或卸载不再需要的应用。</p
            >
          </div>
          <ElButton type="primary" :icon="Refresh" :loading="loading" @click="loadInstalled"
            >刷新</ElButton
          >
        </div>
      </template>

      <div v-if="loadError" class="app-installed-page__load-error">
        <ElAlert type="error" :title="loadError" show-icon :closable="false" />
        <ElButton size="small" type="primary" link :loading="loading" @click="loadInstalled"
          >重试</ElButton
        >
      </div>

      <ElTable v-loading="loading" :data="records" border>
        <ElTableColumn label="应用" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="app-installed-page__app-name">{{
              row.app?.name || `应用 #${row.app_id}`
            }}</div>
            <div class="app-installed-page__app-code">{{ row.app?.code || '-' }}</div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="类型" width="120">
          <template #default="{ row }">
            <ElTag :type="typeTagType(row.app?.type)" effect="light">{{
              typeText(row.app?.type)
            }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="状态" width="120">
          <template #default="{ row }">
            <ElTag
              :type="row.enabled && row.app?.available !== false ? 'success' : 'info'"
              effect="light"
            >
              {{ row.enabled && row.app?.available !== false ? '已启用' : '已停用' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="可用状态" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.app?.available === false">
              {{ row.app?.availability_reason || availabilityText(row.app?.availability_status) }}
            </span>
            <span v-else>{{ availabilityText(row.app?.availability_status) }}</span>
          </template>
        </ElTableColumn>
        <ElTableColumn label="授权" min-width="190">
          <template #default="{ row }">
            <div class="app-installed-page__license">
              <ElTag :type="commerceTagType(row.app?.commerce?.access_status)" effect="light">
                {{ commerceLabel(row.app?.commerce?.access_status) }}
              </ElTag>
              <span v-if="row.app?.commerce?.license_expires_at">
                到期时间 {{ formatDateTime(row.app.commerce.license_expires_at) }}
              </span>
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="来源" width="130">
          <template #default="{ row }">{{ sourceText(row.source) }}</template>
        </ElTableColumn>
        <ElTableColumn label="安装时间" width="170">
          <template #default="{ row }">{{
            formatDateTime(row.installed_time || row.create_time)
          }}</template>
        </ElTableColumn>
        <ElTableColumn label="简介" min-width="260" show-overflow-tooltip>
          <template #default="{ row }">{{
            row.app?.summary || row.app?.description || '-'
          }}</template>
        </ElTableColumn>
        <ElTableColumn label="有效能力" min-width="180">
          <template #default="{ row }">
            <div v-if="row.effective_capabilities?.length" class="app-installed-page__capabilities">
              <ElTag
                v-for="capability in row.effective_capabilities"
                :key="capability"
                size="small"
                type="success"
                effect="plain"
              >
                {{ capabilityLabel(capability) }}
              </ElTag>
            </div>
            <span v-else-if="row.tenant_approved_capabilities?.length">授权当前未生效</span>
            <span v-else>未授予能力</span>
          </template>
        </ElTableColumn>
        <ElTableColumn label="操作" fixed="right" width="270">
          <template #default="{ row }">
            <ElButton
              v-if="row.app?.commerce_action === 'renew'"
              link
              type="warning"
              @click="renewApp(row.app?.code)"
            >
              续费
            </ElButton>
            <ElButton
              v-else-if="row.app?.commerce_action === 'contact_admin'"
              link
              type="danger"
              disabled
            >
              联系管理员
            </ElButton>
            <ElButton
              v-if="row.app?.type !== 'service'"
              link
              type="primary"
              :icon="Link"
              :disabled="isOpenDisabled(row)"
              @click="openApp(row.app?.code)"
            >
              打开
            </ElButton>
            <ElTag v-else :type="row.app?.service_callable ? 'success' : 'warning'" effect="light">
              {{
                row.app?.service_callable
                  ? '可调用'
                  : row.app?.service_status === 'update_required'
                    ? '需要升级'
                    : '不可用'
              }}
            </ElTag>
            <ElButton
              link
              type="primary"
              :disabled="!row.app?.code || !row.requested_capabilities?.length"
              @click="openPermissions(row)"
            >
              权限设置
            </ElButton>
            <ElButton
              link
              type="warning"
              :icon="Delete"
              :disabled="!row.app?.code"
              :loading="operatingCode === row.app?.code"
              @click="uninstallApp(row)"
            >
              卸载
            </ElButton>
          </template>
        </ElTableColumn>
        <template #empty>
          <ElEmpty description="暂无已安装应用" />
        </template>
      </ElTable>
    </ElCard>

    <ElDialog v-model="permissionDialogVisible" title="权限设置" width="520px">
      <div v-loading="permissionLoading" class="app-installed-page__permission-body">
        <ElAlert
          v-if="permissionError"
          type="error"
          :title="permissionError"
          :closable="false"
          show-icon
        />
        <ElAlert
          v-else-if="!permissionLoading && !platformApprovedCapabilities.length"
          type="warning"
          title="平台当前未批准任何可用能力。"
          :closable="false"
          show-icon
        />
        <ElCheckboxGroup
          v-else
          v-model="selectedCapabilities"
          class="app-installed-page__permission-options"
        >
          <ElCheckbox
            v-for="capability in platformApprovedCapabilities"
            :key="capability"
            :value="capability"
          >
            {{ capabilityLabel(capability) }}
          </ElCheckbox>
        </ElCheckboxGroup>
      </div>
      <template #footer>
        <ElButton
          :disabled="permissionSaving || permissionLoading"
          @click="permissionDialogVisible = false"
          >取消</ElButton
        >
        <ElButton
          type="danger"
          plain
          :disabled="permissionLoading || Boolean(permissionError)"
          :loading="permissionSaving"
          @click="revokeAllCapabilities"
        >
          全部撤销
        </ElButton>
        <ElButton
          type="primary"
          :disabled="permissionLoading || Boolean(permissionError)"
          :loading="permissionSaving"
          @click="savePermissions"
        >
          保存
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
    type TenantAppInstallRecord
  } from '@/api/app-marketplace'
  import {
    appAvailabilityText as availabilityText,
    appCapabilityLabel as capabilityLabel,
    appCenterTypeTagType as typeTagType,
    appCenterTypeText as typeText,
    appCommerceLabel as commerceLabel,
    appCommerceTagType as commerceTagType
  } from '../shared/app-center-display'

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

  function sourceText(source?: string) {
    const map: Record<string, string> = {
      marketplace: '应用市场',
      plan: '套餐包含',
      platform: '平台安装',
      manual: '手动安装'
    }
    return source ? map[source] || source : '-'
  }

  function isOpenDisabled(row: TenantAppInstallRecord) {
    return (
      row.app?.available === false || row.app?.can_open === false || !row.enabled || !row.app?.code
    )
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
      loadError.value = '已安装应用加载失败'
      ElMessage.error(loadError.value)
    } finally {
      loading.value = false
    }
  }

  function openApp(code?: string) {
    if (!code) return
    router.push({ path: '/app-center/open', query: { code } })
  }

  function renewApp(code?: string) {
    if (!code) return
    router.push({ path: '/app-center/marketplace', query: { app: code } })
  }

  async function uninstallApp(row: TenantAppInstallRecord) {
    const code = row.app?.code
    if (!code) return
    await ElMessageBox.confirm(`确认卸载 ${row.app?.name || code}？`, '卸载应用', {
      type: 'warning',
      confirmButtonText: '卸载',
      cancelButtonText: '取消'
    })
    operatingCode.value = code
    try {
      await uninstallTenantApp(code)
      ElMessage.success('应用已卸载')
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
      permissionError.value = '权限加载失败，请关闭后重试。'
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
      ElMessage.success('应用权限已更新')
      permissionDialogVisible.value = false
      await loadInstalled()
    } catch {
      permissionError.value = '权限保存失败，请重试。'
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
    gap: 16px;
    align-items: flex-start;
    justify-content: space-between;
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
    font-size: 13px;
    line-height: 1.5;
    color: var(--el-text-color-secondary);
  }

  .app-installed-page__load-error {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 16px;
  }

  .app-installed-page__app-name {
    font-weight: 500;
    color: var(--el-text-color-primary);
  }

  .app-installed-page__app-code {
    margin-top: 2px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .app-installed-page__capabilities,
  .app-installed-page__permission-options {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .app-installed-page__license {
    display: grid;
    gap: 6px;
    justify-items: start;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .app-installed-page__permission-body {
    min-height: 100px;
  }

  .app-installed-page__permission-options {
    margin: 12px 0;
  }

  @media (width <= 640px) {
    .app-installed-page__header {
      display: grid;
    }
  }
</style>
