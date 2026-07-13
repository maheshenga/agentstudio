<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="app-platform-page">
      <template #header>
        <div class="app-platform-page__header">
          <div>
            <h1 class="app-platform-page__title">App Platform</h1>
            <p class="app-platform-page__subtitle"
              >Manage marketplace apps, reviewed packages, service releases, and tenant
              availability.</p
            >
          </div>
          <div class="app-platform-page__actions">
            <ElButton :icon="Refresh" :loading="loading" @click="loadApps">Refresh</ElButton>
            <ElButton type="primary" :icon="Plus" @click="openCreateDialog">Create App</ElButton>
          </div>
        </div>
      </template>

      <div class="app-platform-page__filters">
        <ElInput
          v-model="filters.keyword"
          clearable
          class="app-platform-page__filter-item"
          placeholder="Code, name, category"
          @keyup.enter="loadApps"
        />
        <ElSelect
          v-model="filters.type"
          clearable
          class="app-platform-page__select"
          placeholder="Type"
        >
          <ElOption label="Internal" value="internal" />
          <ElOption label="Static" value="static" />
          <ElOption label="Iframe" value="iframe" />
          <ElOption label="Service" value="service" />
        </ElSelect>
        <ElSelect
          v-model="filters.status"
          clearable
          class="app-platform-page__select"
          placeholder="Status"
        >
          <ElOption
            v-for="item in statusOptions"
            :key="item"
            :label="statusText(item)"
            :value="item"
          />
        </ElSelect>
        <ElButton type="primary" :icon="Search" :loading="loading" @click="loadApps"
          >Search</ElButton
        >
        <ElButton @click="resetFilters">Reset</ElButton>
      </div>

      <div v-if="loadError" class="app-platform-page__load-error">
        <ElAlert type="error" :title="loadError" show-icon :closable="false" />
        <ElButton size="small" type="primary" link :loading="loading" @click="loadApps"
          >Retry</ElButton
        >
      </div>

      <ElTable v-loading="loading" :data="records" border>
        <ElTableColumn label="App" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="app-platform-page__app-name">{{ row.name || '-' }}</div>
            <div class="app-platform-page__app-code">{{ row.code || '-' }}</div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="Type" width="120">
          <template #default="{ row }">
            <ElTag :type="typeTagType(row.type)" effect="light">{{ typeText(row.type) }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="category" label="Category" width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.category || '-' }}</template>
        </ElTableColumn>
        <ElTableColumn label="Status" width="140">
          <template #default="{ row }">
            <ElTag :type="statusTagType(row.status)" effect="light">{{
              statusText(row.status)
            }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="Visibility" width="130">
          <template #default="{ row }">{{ visibilityText(row.visibility) }}</template>
        </ElTableColumn>
        <ElTableColumn label="Entry" min-width="240" show-overflow-tooltip>
          <template #default="{ row }">{{
            row.type === 'service' ? 'Managed runtime' : row.entry_url || '-'
          }}</template>
        </ElTableColumn>
        <ElTableColumn prop="sort" label="Sort" width="80" />
        <ElTableColumn label="Updated" width="170">
          <template #default="{ row }">{{ formatDateTime(row.update_time) }}</template>
        </ElTableColumn>
        <ElTableColumn label="Actions" fixed="right" width="330">
          <template #default="{ row }">
            <ElButton link type="primary" :icon="Edit" @click="openEditDialog(row)">Edit</ElButton>
            <ElButton
              link
              type="primary"
              :icon="View"
              :loading="detailLoadingCode === row.code"
              @click="openDetail(row)"
            >
              Versions
            </ElButton>
            <ElUpload
              v-if="row.type === 'static' || row.type === 'service'"
              accept=".zip"
              :auto-upload="false"
              :show-file-list="false"
              :on-change="(file) => handlePackageSelected(row, file)"
            >
              <ElButton link type="primary" :icon="Upload" :loading="uploadingCode === row.code"
                >Upload</ElButton
              >
            </ElUpload>
            <ElButton
              v-if="row.status === 'published' || row.status === 'disabled'"
              link
              :type="row.status === 'disabled' ? 'success' : 'warning'"
              :icon="row.status === 'disabled' ? CircleCheck : CircleClose"
              @click="toggleStatus(row)"
            >
              {{ row.status === 'disabled' ? 'Enable' : 'Disable' }}
            </ElButton>
          </template>
        </ElTableColumn>
        <template #empty>
          <ElEmpty description="No marketplace apps yet" />
        </template>
      </ElTable>
    </ElCard>

    <ElDialog
      v-model="dialogVisible"
      :title="editingCode ? 'Edit App' : 'Create App'"
      width="680px"
    >
      <ElForm ref="appFormRef" :model="appForm" :rules="appRules" label-width="124px">
        <ElFormItem label="Code" prop="code">
          <ElInput
            v-model="appForm.code"
            :disabled="Boolean(editingCode)"
            maxlength="80"
            placeholder="job_board"
          />
        </ElFormItem>
        <ElFormItem label="Name" prop="name">
          <ElInput v-model="appForm.name" maxlength="120" />
        </ElFormItem>
        <ElFormItem label="Type" prop="type">
          <ElSegmented
            v-model="appForm.type"
            :disabled="Boolean(editingCode)"
            :options="[
              { label: 'Internal', value: 'internal' },
              { label: 'Static', value: 'static' },
              { label: 'Iframe', value: 'iframe' },
              { label: 'Service', value: 'service' }
            ]"
          />
        </ElFormItem>
        <ElFormItem v-if="appForm.type !== 'service'" label="Entry URL" prop="entry_url">
          <ElInput
            v-model="appForm.entry_url"
            maxlength="500"
            placeholder="/tenant-saas/members or https://example.com"
          />
        </ElFormItem>
        <ElFormItem v-else label="Runtime trust">
          <div class="app-platform-page__trust-copy">
            <ElTag type="success" effect="light">platform_trusted</ElTag>
            <span>Reviewed service packages run in the isolated platform runtime.</span>
          </div>
        </ElFormItem>
        <ElFormItem label="Visibility">
          <ElSelect v-model="appForm.visibility" :disabled="appForm.type === 'service'">
            <ElOption label="Marketplace" value="marketplace" />
            <ElOption label="Tenant" value="tenant" />
            <ElOption label="Platform" value="platform" />
            <ElOption label="Private" value="private" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="Category">
          <ElInput v-model="appForm.category" maxlength="50" />
        </ElFormItem>
        <ElFormItem label="Icon">
          <ElInput v-model="appForm.icon" maxlength="100" placeholder="ri:apps-line" />
        </ElFormItem>
        <ElFormItem label="Developer">
          <ElInput v-model="appForm.developer_name" maxlength="100" />
        </ElFormItem>
        <ElFormItem label="SaaS Module">
          <ElSelect
            v-model="appForm.saas_module_code"
            clearable
            filterable
            placeholder="Optional entitlement module"
          >
            <ElOption
              v-for="item in saasModuleOptions"
              :key="item.code"
              :label="`${item.name} (${item.code})`"
              :value="item.code"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="System Module">
          <ElSelect
            v-model="appForm.system_module_code"
            clearable
            filterable
            placeholder="Optional runtime guard module"
          >
            <ElOption
              v-for="item in systemModuleOptions"
              :key="item.code"
              :label="`${item.name} (${item.code})`"
              :value="item.code"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="Sort">
          <ElInputNumber v-model="appForm.sort" :min="0" :step="10" controls-position="right" />
        </ElFormItem>
        <ElFormItem label="Summary">
          <ElInput v-model="appForm.summary" type="textarea" maxlength="255" show-word-limit />
        </ElFormItem>
        <ElFormItem label="Description">
          <ElInput v-model="appForm.description" type="textarea" maxlength="1000" show-word-limit />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">Cancel</ElButton>
        <ElButton type="primary" :icon="Check" :loading="saving" @click="saveApp">Save</ElButton>
      </template>
    </ElDialog>

    <ElDrawer v-model="detailVisible" title="App Versions" size="860px">
      <div v-if="selectedDetail" class="app-platform-page__detail">
        <div class="app-platform-page__detail-header">
          <div>
            <h2>{{ selectedDetail.name }}</h2>
            <p>{{ selectedDetail.code }} · {{ typeText(selectedDetail.type) }}</p>
          </div>
          <ElTag :type="statusTagType(selectedDetail.status)" effect="light">{{
            statusText(selectedDetail.status)
          }}</ElTag>
        </div>

        <ElAlert
          v-if="selectedDetail.type === 'static' && !selectedDetail.versions.length"
          type="info"
          title="Upload a static app zip package to start the review flow."
          show-icon
          :closable="false"
        />
        <ElAlert
          v-else-if="selectedDetail.type === 'service' && !selectedDetail.versions.length"
          type="info"
          title="Upload a service zip package to run the parser scan and start review."
          show-icon
          :closable="false"
        />

        <ElTable :data="selectedDetail.versions" border>
          <ElTableColumn label="Version" width="140">
            <template #default="{ row }">
              <div class="app-platform-page__version">
                <span>{{ row.version }}</span>
                <ElTag v-if="row.is_active" size="small" type="success" effect="light"
                  >Active</ElTag
                >
              </div>
            </template>
          </ElTableColumn>
          <ElTableColumn label="Review" width="120">
            <template #default="{ row }">
              <ElTag :type="reviewTagType(row.review_status)" effect="light">{{
                row.review_status
              }}</ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn label="Publish" width="130">
            <template #default="{ row }">
              <ElTag :type="publishTagType(row.publish_status)" effect="light">{{
                row.publish_status
              }}</ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn
            v-if="selectedDetail.type !== 'service'"
            prop="entry_file"
            label="Entry"
            min-width="180"
            show-overflow-tooltip
          />
          <ElTableColumn
            v-if="selectedDetail.type !== 'service'"
            prop="entry_url"
            label="Runtime URL"
            min-width="220"
            show-overflow-tooltip
          />
          <ElTableColumn v-else label="Scan" min-width="190">
            <template #default="{ row }">
              <div class="app-platform-page__scan-status">
                <ElTag :type="scanTagType(row.scan_result)" effect="light">{{
                  scanStatusText(row.scan_result)
                }}</ElTag>
                <span v-if="row.scan_result">{{ row.scan_result.scannedFiles }} files</span>
              </div>
            </template>
          </ElTableColumn>
          <ElTableColumn
            prop="review_message"
            label="Message"
            min-width="160"
            show-overflow-tooltip
          >
            <template #default="{ row }">{{ row.review_message || '-' }}</template>
          </ElTableColumn>
          <ElTableColumn label="Actions" fixed="right" width="260">
            <template #default="{ row }">
              <ElButton
                v-if="selectedDetail.type !== 'service'"
                link
                type="primary"
                :icon="Promotion"
                :disabled="row.review_status !== 'approved' || row.publish_status === 'published'"
                @click="publishVersion(row.version)"
              >
                Publish
              </ElButton>
              <ElButton
                v-if="selectedDetail.type !== 'service'"
                link
                type="warning"
                :loading="versionGovernanceLoading === `rollback:${row.version}`"
                :disabled="row.review_status !== 'approved' || !row.publish_path || row.is_active"
                @click="versionGovernance(row.version, 'rollback')"
              >
                Rollback
              </ElButton>
              <ElButton
                v-if="selectedDetail.type !== 'service'"
                link
                type="danger"
                :loading="versionGovernanceLoading === `unpublish:${row.version}`"
                :disabled="row.publish_status !== 'published'"
                @click="versionGovernance(row.version, 'unpublish')"
              >
                Unpublish
              </ElButton>
            </template>
          </ElTableColumn>
          <template #empty>
            <ElEmpty description="No versions" />
          </template>
        </ElTable>
      </div>
    </ElDrawer>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage, ElMessageBox } from 'element-plus'
  import type { FormInstance, FormRules, UploadFile } from 'element-plus'
  import {
    Check,
    CircleCheck,
    CircleClose,
    Edit,
    Plus,
    Promotion,
    Refresh,
    Search,
    Upload,
    View
  } from '@element-plus/icons-vue'
  import {
    createPlatformApp,
    fetchPlatformApp,
    fetchPlatformApps,
    publishPlatformAppVersion,
    rollbackPlatformAppVersion,
    unpublishPlatformAppVersion,
    updatePlatformApp,
    updatePlatformAppStatus,
    uploadPlatformServiceAppVersion,
    uploadPlatformStaticAppVersion,
    type AppPackageDetailRecord,
    type AppPackageRecord,
    type AppPackageStatus,
    type AppPackageType,
    type AppPackageVisibility,
    type SaveAppPackageParams
  } from '@/api/app-marketplace'
  import { fetchPlatformModules, type SaasModuleRecord } from '@/api/saas'
  import { fetchSystemModules, type SystemModuleRecord } from '@/api/system-module'

  defineOptions({ name: 'AppPlatformAppsPage' })

  const records = ref<AppPackageRecord[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const detailVisible = ref(false)
  const dialogVisible = ref(false)
  const loadError = ref('')
  const editingCode = ref('')
  const uploadingCode = ref('')
  const detailLoadingCode = ref('')
  const versionGovernanceLoading = ref('')
  const selectedDetail = ref<AppPackageDetailRecord | null>(null)
  const saasModuleOptions = ref<SaasModuleRecord[]>([])
  const systemModuleOptions = ref<SystemModuleRecord[]>([])
  const appFormRef = ref<FormInstance>()
  const statusOptions: AppPackageStatus[] = [
    'draft',
    'pending_review',
    'approved',
    'published',
    'rejected',
    'disabled',
    'archived'
  ]
  const filters = reactive<{
    keyword: string
    type: AppPackageType | ''
    status: AppPackageStatus | ''
  }>({
    keyword: '',
    type: '',
    status: ''
  })
  const appForm = reactive({
    code: '',
    name: '',
    type: 'iframe' as AppPackageType,
    category: '',
    icon: '',
    summary: '',
    description: '',
    visibility: 'marketplace' as AppPackageVisibility,
    entry_url: '',
    developer_name: '',
    system_module_code: '',
    saas_module_code: '',
    sort: 100,
    remark: ''
  })
  const appRules: FormRules = {
    code: [
      { required: true, message: 'Code is required', trigger: 'blur' },
      {
        pattern: /^[a-z][a-z0-9_]{2,79}$/,
        message: 'Use lowercase snake_case, 3-80 chars',
        trigger: 'blur'
      }
    ],
    name: [{ required: true, message: 'Name is required', trigger: 'blur' }],
    type: [{ required: true, message: 'Type is required', trigger: 'change' }]
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

  function typeText(type?: string) {
    const map: Record<string, string> = {
      internal: 'Internal',
      static: 'Static',
      iframe: 'Iframe',
      service: 'Service'
    }
    return type ? map[type] || type : '-'
  }

  function typeTagType(type?: string) {
    const map: Record<string, 'success' | 'info' | 'warning'> = {
      internal: 'success',
      static: 'warning',
      iframe: 'info',
      service: 'success'
    }
    return type ? map[type] || 'info' : 'info'
  }

  function statusText(status?: string) {
    const map: Record<string, string> = {
      draft: 'Draft',
      pending_review: 'Pending Review',
      approved: 'Approved',
      published: 'Published',
      rejected: 'Rejected',
      disabled: 'Disabled',
      archived: 'Archived'
    }
    return status ? map[status] || status : '-'
  }

  function statusTagType(status?: string) {
    const map: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
      draft: 'info',
      pending_review: 'warning',
      approved: 'success',
      published: 'success',
      rejected: 'danger',
      disabled: 'info',
      archived: 'info'
    }
    return status ? map[status] || 'info' : 'info'
  }

  function visibilityText(value?: string) {
    const map: Record<string, string> = {
      marketplace: 'Marketplace',
      tenant: 'Tenant',
      platform: 'Platform',
      private: 'Private'
    }
    return value ? map[value] || value : '-'
  }

  function reviewTagType(status?: string) {
    if (status === 'approved') return 'success'
    if (status === 'rejected') return 'danger'
    return 'warning'
  }

  function publishTagType(status?: string) {
    if (status === 'published') return 'success'
    if (status === 'failed') return 'danger'
    return 'info'
  }

  function scanStatusText(scanResult?: AppPackageDetailRecord['versions'][number]['scan_result']) {
    if (!scanResult) return 'Not scanned'
    return scanResult.passed ? 'Passed' : 'Blocked'
  }

  function scanTagType(scanResult?: AppPackageDetailRecord['versions'][number]['scan_result']) {
    if (!scanResult) return 'info'
    return scanResult.passed ? 'success' : 'danger'
  }

  function formatDateTime(value: unknown) {
    if (!value) return '-'
    const date = value instanceof Date ? value : new Date(String(value))
    return Number.isNaN(date.getTime()) ? String(value) : dateFormatter.format(date)
  }

  function resetForm() {
    Object.assign(appForm, {
      code: '',
      name: '',
      type: 'iframe',
      category: '',
      icon: '',
      summary: '',
      description: '',
      visibility: 'marketplace',
      entry_url: '',
      developer_name: '',
      system_module_code: '',
      saas_module_code: '',
      sort: 100,
      remark: ''
    })
    appFormRef.value?.clearValidate()
  }

  async function loadApps() {
    loading.value = true
    loadError.value = ''
    try {
      records.value = await fetchPlatformApps({
        keyword: cleanText(filters.keyword),
        type: filters.type || undefined,
        status: filters.status || undefined
      })
    } catch (error) {
      console.error('[AppPlatformAppsPage] load apps failed:', error)
      loadError.value = 'App list failed to load'
      ElMessage.error(loadError.value)
    } finally {
      loading.value = false
    }
  }

  async function loadModuleOptions() {
    try {
      const [saasModules, systemModules] = await Promise.all([
        fetchPlatformModules({ status: 1 }),
        fetchSystemModules({ status: 'enabled' })
      ])
      saasModuleOptions.value = Array.isArray(saasModules) ? saasModules : []
      systemModuleOptions.value = Array.isArray(systemModules) ? systemModules : []
    } catch (error) {
      console.error('[AppPlatformAppsPage] load module options failed:', error)
      saasModuleOptions.value = []
      systemModuleOptions.value = []
    }
  }

  function resetFilters() {
    filters.keyword = ''
    filters.type = ''
    filters.status = ''
    loadApps()
  }

  function openCreateDialog() {
    editingCode.value = ''
    resetForm()
    dialogVisible.value = true
  }

  watch(
    () => appForm.type,
    (type) => {
      if (type !== 'service') return
      appForm.entry_url = ''
      appForm.visibility = 'platform'
    }
  )

  function openEditDialog(row: AppPackageRecord) {
    editingCode.value = row.code
    Object.assign(appForm, {
      code: row.code,
      name: row.name,
      type: row.type,
      category: row.category || '',
      icon: row.icon || '',
      summary: row.summary || '',
      description: row.description || '',
      visibility: row.visibility || 'marketplace',
      entry_url: row.entry_url || '',
      developer_name: row.developer_name || '',
      system_module_code: row.system_module_code || '',
      saas_module_code: row.saas_module_code || '',
      sort: row.sort ?? 100,
      remark: row.remark || ''
    })
    appFormRef.value?.clearValidate()
    dialogVisible.value = true
  }

  function buildPayload(): SaveAppPackageParams {
    return {
      code: cleanText(appForm.code),
      name: appForm.name.trim(),
      type: appForm.type,
      category: cleanText(appForm.category),
      icon: cleanText(appForm.icon),
      summary: cleanText(appForm.summary),
      description: cleanText(appForm.description),
      visibility: appForm.type === 'service' ? 'platform' : appForm.visibility,
      entry_url: appForm.type === 'service' ? undefined : cleanText(appForm.entry_url),
      developer_name: cleanText(appForm.developer_name),
      system_module_code: cleanText(appForm.system_module_code),
      saas_module_code: cleanText(appForm.saas_module_code),
      sort: appForm.sort,
      remark: cleanText(appForm.remark)
    }
  }

  async function saveApp() {
    await appFormRef.value?.validate()
    saving.value = true
    try {
      const payload = buildPayload()
      if (editingCode.value) {
        await updatePlatformApp(editingCode.value, payload)
      } else {
        await createPlatformApp(payload)
      }
      ElMessage.success('App saved')
      dialogVisible.value = false
      await loadApps()
    } finally {
      saving.value = false
    }
  }

  async function openDetail(row: AppPackageRecord) {
    detailLoadingCode.value = row.code
    try {
      selectedDetail.value = await fetchPlatformApp(row.code)
      detailVisible.value = true
    } finally {
      detailLoadingCode.value = ''
    }
  }

  async function refreshSelectedDetail() {
    if (!selectedDetail.value?.code) return
    selectedDetail.value = await fetchPlatformApp(selectedDetail.value.code)
  }

  async function handlePackageSelected(row: AppPackageRecord, uploadFile: UploadFile) {
    if (!uploadFile.raw) return
    uploadingCode.value = row.code
    try {
      const version =
        row.type === 'service'
          ? await uploadPlatformServiceAppVersion(row.code, uploadFile.raw)
          : await uploadPlatformStaticAppVersion(row.code, uploadFile.raw)
      if (row.type === 'service') {
        const scannedFiles = version.scan_result?.scannedFiles ?? 0
        ElMessage.success(
          `Service package uploaded. Scan: ${scanStatusText(version.scan_result)}, ${scannedFiles} files.`
        )
      } else {
        ElMessage.success('Package uploaded for review')
      }
      await loadApps()
      if (selectedDetail.value?.code === row.code) await refreshSelectedDetail()
    } finally {
      uploadingCode.value = ''
    }
  }

  async function publishVersion(version: string) {
    if (!selectedDetail.value) return
    await publishPlatformAppVersion(selectedDetail.value.code, version)
    ElMessage.success('Version published')
    await refreshSelectedDetail()
    await loadApps()
  }

  async function versionGovernance(version: string, action: 'rollback' | 'unpublish') {
    if (!selectedDetail.value) return
    const actionText = action === 'rollback' ? 'Rollback' : 'Unpublish'
    const { value } = await ElMessageBox.prompt(
      `Reason for ${actionText.toLowerCase()} ${version}`,
      actionText,
      {
        confirmButtonText: actionText,
        cancelButtonText: 'Cancel',
        inputPlaceholder:
          action === 'rollback' ? 'Restore stable version' : 'Retire unsafe or obsolete version',
        inputValue: action === 'rollback' ? 'Restore stable version' : 'Retire version'
      }
    )
    versionGovernanceLoading.value = `${action}:${version}`
    try {
      if (action === 'rollback') {
        await rollbackPlatformAppVersion(selectedDetail.value.code, version, String(value || ''))
      } else {
        await unpublishPlatformAppVersion(selectedDetail.value.code, version, String(value || ''))
      }
      ElMessage.success(`${actionText} completed`)
      await refreshSelectedDetail()
      await loadApps()
    } finally {
      versionGovernanceLoading.value = ''
    }
  }

  async function toggleStatus(row: AppPackageRecord) {
    const nextStatus: AppPackageStatus = row.status === 'disabled' ? 'published' : 'disabled'
    await ElMessageBox.confirm(
      `Change ${row.name} to ${statusText(nextStatus)}?`,
      'Update status',
      {
        type: nextStatus === 'disabled' ? 'warning' : 'info',
        confirmButtonText: 'Confirm',
        cancelButtonText: 'Cancel'
      }
    )
    await updatePlatformAppStatus(row.code, nextStatus)
    ElMessage.success(`App ${statusText(nextStatus).toLowerCase()}`)
    await loadApps()
  }

  onMounted(() => {
    loadApps()
    loadModuleOptions()
  })
</script>

<style scoped>
  .app-platform-page {
    min-height: 100%;
  }

  .app-platform-page__header,
  .app-platform-page__actions,
  .app-platform-page__filters {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .app-platform-page__header {
    align-items: flex-start;
    justify-content: space-between;
  }

  .app-platform-page__title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.4;
    letter-spacing: 0;
  }

  .app-platform-page__subtitle {
    margin: 6px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.5;
  }

  .app-platform-page__filters {
    margin-bottom: 16px;
  }

  .app-platform-page__filter-item {
    width: 240px;
  }

  .app-platform-page__select {
    width: 160px;
  }

  .app-platform-page__load-error {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .app-platform-page__app-name {
    color: var(--el-text-color-primary);
    font-weight: 500;
  }

  .app-platform-page__app-code {
    margin-top: 2px;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  .app-platform-page__detail {
    display: grid;
    gap: 16px;
  }

  .app-platform-page__detail-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .app-platform-page__detail-header h2 {
    margin: 0;
    font-size: 17px;
    line-height: 1.4;
    letter-spacing: 0;
  }

  .app-platform-page__detail-header p {
    margin: 4px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }

  .app-platform-page__version {
    display: inline-flex;
    min-width: 0;
    align-items: center;
    gap: 8px;
  }

  .app-platform-page__trust-copy,
  .app-platform-page__scan-status {
    display: inline-flex;
    min-width: 0;
    align-items: center;
    gap: 8px;
  }

  .app-platform-page__trust-copy span,
  .app-platform-page__scan-status span {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  :deep(.el-upload) {
    display: inline-flex;
    vertical-align: middle;
  }

  @media (max-width: 720px) {
    .app-platform-page__header {
      display: grid;
    }

    .app-platform-page__actions,
    .app-platform-page__filter-item,
    .app-platform-page__select {
      width: 100%;
    }
  }
</style>
