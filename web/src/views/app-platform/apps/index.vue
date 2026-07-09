<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="app-platform-page">
      <template #header>
        <div class="app-platform-page__header">
          <div>
            <h1 class="app-platform-page__title">App Platform</h1>
            <p class="app-platform-page__subtitle">Manage marketplace apps, static packages, review state, and tenant availability.</p>
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
        <ElSelect v-model="filters.type" clearable class="app-platform-page__select" placeholder="Type">
          <ElOption label="Internal" value="internal" />
          <ElOption label="Static" value="static" />
          <ElOption label="Iframe" value="iframe" />
        </ElSelect>
        <ElSelect v-model="filters.status" clearable class="app-platform-page__select" placeholder="Status">
          <ElOption v-for="item in statusOptions" :key="item" :label="statusText(item)" :value="item" />
        </ElSelect>
        <ElButton type="primary" :icon="Search" :loading="loading" @click="loadApps">Search</ElButton>
        <ElButton @click="resetFilters">Reset</ElButton>
      </div>

      <div v-if="loadError" class="app-platform-page__load-error">
        <ElAlert type="error" :title="loadError" show-icon :closable="false" />
        <ElButton size="small" type="primary" link :loading="loading" @click="loadApps">Retry</ElButton>
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
            <ElTag :type="statusTagType(row.status)" effect="light">{{ statusText(row.status) }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="Visibility" width="130">
          <template #default="{ row }">{{ visibilityText(row.visibility) }}</template>
        </ElTableColumn>
        <ElTableColumn label="Entry" min-width="240" show-overflow-tooltip>
          <template #default="{ row }">{{ row.entry_url || '-' }}</template>
        </ElTableColumn>
        <ElTableColumn prop="sort" label="Sort" width="80" />
        <ElTableColumn label="Updated" width="170">
          <template #default="{ row }">{{ formatDateTime(row.update_time) }}</template>
        </ElTableColumn>
        <ElTableColumn label="Actions" fixed="right" width="330">
          <template #default="{ row }">
            <ElButton link type="primary" :icon="Edit" @click="openEditDialog(row)">Edit</ElButton>
            <ElButton link type="primary" :icon="View" :loading="detailLoadingCode === row.code" @click="openDetail(row)">
              Versions
            </ElButton>
            <ElUpload
              v-if="row.type === 'static'"
              accept=".zip"
              :auto-upload="false"
              :show-file-list="false"
              :on-change="(file) => handlePackageSelected(row.code, file)"
            >
              <ElButton link type="primary" :icon="Upload" :loading="uploadingCode === row.code">Upload</ElButton>
            </ElUpload>
            <ElButton
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

    <ElDialog v-model="dialogVisible" :title="editingCode ? 'Edit App' : 'Create App'" width="680px">
      <ElForm ref="appFormRef" :model="appForm" :rules="appRules" label-width="124px">
        <ElFormItem label="Code" prop="code">
          <ElInput v-model="appForm.code" :disabled="Boolean(editingCode)" maxlength="80" placeholder="job_board" />
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
              { label: 'Iframe', value: 'iframe' }
            ]"
          />
        </ElFormItem>
        <ElFormItem label="Entry URL" prop="entry_url">
          <ElInput v-model="appForm.entry_url" maxlength="500" placeholder="/tenant-saas/members or https://example.com" />
        </ElFormItem>
        <ElFormItem label="Visibility">
          <ElSelect v-model="appForm.visibility">
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
          <ElInput v-model="appForm.saas_module_code" maxlength="50" placeholder="Optional entitlement code" />
        </ElFormItem>
        <ElFormItem label="System Module">
          <ElInput v-model="appForm.system_module_code" maxlength="80" placeholder="Optional runtime guard code" />
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

    <ElDrawer v-model="detailVisible" title="App Versions" size="720px">
      <div v-if="selectedDetail" class="app-platform-page__detail">
        <div class="app-platform-page__detail-header">
          <div>
            <h2>{{ selectedDetail.name }}</h2>
            <p>{{ selectedDetail.code }} · {{ typeText(selectedDetail.type) }}</p>
          </div>
          <ElTag :type="statusTagType(selectedDetail.status)" effect="light">{{ statusText(selectedDetail.status) }}</ElTag>
        </div>

        <ElAlert
          v-if="selectedDetail.type === 'static' && !selectedDetail.versions.length"
          type="info"
          title="Upload a static app zip package to start the review flow."
          show-icon
          :closable="false"
        />

        <ElTable :data="selectedDetail.versions" border>
          <ElTableColumn prop="version" label="Version" width="120" />
          <ElTableColumn label="Review" width="120">
            <template #default="{ row }">
              <ElTag :type="reviewTagType(row.review_status)" effect="light">{{ row.review_status }}</ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn label="Publish" width="130">
            <template #default="{ row }">
              <ElTag :type="publishTagType(row.publish_status)" effect="light">{{ row.publish_status }}</ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn prop="entry_file" label="Entry" min-width="180" show-overflow-tooltip />
          <ElTableColumn label="Actions" fixed="right" width="220">
            <template #default="{ row }">
              <ElButton
                link
                type="success"
                :icon="CircleCheck"
                :disabled="row.review_status !== 'pending'"
                @click="reviewVersion(row.version, 'approve')"
              >
                Approve
              </ElButton>
              <ElButton
                link
                type="warning"
                :icon="CircleClose"
                :disabled="row.review_status !== 'pending'"
                @click="reviewVersion(row.version, 'reject')"
              >
                Reject
              </ElButton>
              <ElButton
                link
                type="primary"
                :icon="Promotion"
                :disabled="row.review_status !== 'approved' || row.publish_status === 'published'"
                @click="publishVersion(row.version)"
              >
                Publish
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
  import { Check, CircleCheck, CircleClose, Edit, Plus, Promotion, Refresh, Search, Upload, View } from '@element-plus/icons-vue'
  import {
    approvePlatformAppVersion,
    createPlatformApp,
    fetchPlatformApp,
    fetchPlatformApps,
    publishPlatformAppVersion,
    rejectPlatformAppVersion,
    updatePlatformApp,
    updatePlatformAppStatus,
    uploadPlatformStaticAppVersion,
    type AppPackageDetailRecord,
    type AppPackageRecord,
    type AppPackageStatus,
    type AppPackageType,
    type AppPackageVisibility,
    type SaveAppPackageParams
  } from '@/api/app-marketplace'

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
  const selectedDetail = ref<AppPackageDetailRecord | null>(null)
  const appFormRef = ref<FormInstance>()
  const statusOptions: AppPackageStatus[] = ['draft', 'pending_review', 'approved', 'published', 'rejected', 'disabled', 'archived']
  const filters = reactive<{ keyword: string; type: AppPackageType | ''; status: AppPackageStatus | '' }>({
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
      { pattern: /^[a-z][a-z0-9_]{2,79}$/, message: 'Use lowercase snake_case, 3-80 chars', trigger: 'blur' }
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
    const map: Record<string, string> = { internal: 'Internal', static: 'Static', iframe: 'Iframe' }
    return type ? map[type] || type : '-'
  }

  function typeTagType(type?: string) {
    const map: Record<string, 'success' | 'info' | 'warning'> = { internal: 'success', static: 'warning', iframe: 'info' }
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
    const map: Record<string, string> = { marketplace: 'Marketplace', tenant: 'Tenant', platform: 'Platform', private: 'Private' }
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
      visibility: appForm.visibility,
      entry_url: cleanText(appForm.entry_url),
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

  async function handlePackageSelected(code: string, uploadFile: UploadFile) {
    if (!uploadFile.raw) return
    uploadingCode.value = code
    try {
      await uploadPlatformStaticAppVersion(code, uploadFile.raw)
      ElMessage.success('Package uploaded for review')
      await loadApps()
      if (selectedDetail.value?.code === code) await refreshSelectedDetail()
    } finally {
      uploadingCode.value = ''
    }
  }

  async function reviewVersion(version: string, action: 'approve' | 'reject') {
    if (!selectedDetail.value) return
    const message = action === 'approve' ? 'Approved from platform console' : 'Rejected from platform console'
    if (action === 'approve') {
      await approvePlatformAppVersion(selectedDetail.value.code, version, message)
      ElMessage.success('Version approved')
    } else {
      await rejectPlatformAppVersion(selectedDetail.value.code, version, message)
      ElMessage.success('Version rejected')
    }
    await refreshSelectedDetail()
    await loadApps()
  }

  async function publishVersion(version: string) {
    if (!selectedDetail.value) return
    await publishPlatformAppVersion(selectedDetail.value.code, version)
    ElMessage.success('Version published')
    await refreshSelectedDetail()
    await loadApps()
  }

  async function toggleStatus(row: AppPackageRecord) {
    const nextStatus: AppPackageStatus = row.status === 'disabled' ? 'published' : 'disabled'
    await ElMessageBox.confirm(`Change ${row.name} to ${statusText(nextStatus)}?`, 'Update status', {
      type: nextStatus === 'disabled' ? 'warning' : 'info',
      confirmButtonText: 'Confirm',
      cancelButtonText: 'Cancel'
    })
    await updatePlatformAppStatus(row.code, nextStatus)
    ElMessage.success(`App ${statusText(nextStatus).toLowerCase()}`)
    await loadApps()
  }

  onMounted(() => {
    loadApps()
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
