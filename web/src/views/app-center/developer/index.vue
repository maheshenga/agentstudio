<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="developer-apps-page">
      <template #header>
        <div class="developer-apps-page__header">
          <div>
            <h1 class="developer-apps-page__title">Developer Apps</h1>
            <p class="developer-apps-page__subtitle"
              >Create static apps, submit versions, and track review results.</p
            >
          </div>
          <div class="developer-apps-page__header-actions">
            <ElButton :icon="Refresh" :loading="loading" @click="loadApps">Refresh</ElButton>
            <ElButton type="primary" :icon="Plus" @click="openCreateDialog">Create App</ElButton>
          </div>
        </div>
      </template>

      <div class="developer-apps-page__filters">
        <ElInput
          v-model="filters.keyword"
          clearable
          class="developer-apps-page__keyword"
          placeholder="App name or code"
          :prefix-icon="Search"
        />
        <ElSelect
          v-model="filters.status"
          clearable
          class="developer-apps-page__status-filter"
          placeholder="Status"
        >
          <ElOption
            v-for="status in statusOptions"
            :key="status"
            :label="statusText(status)"
            :value="status"
          />
        </ElSelect>
        <ElButton @click="resetFilters">Reset</ElButton>
      </div>

      <div v-if="loadError" class="developer-apps-page__load-error">
        <ElAlert type="error" :title="loadError" show-icon :closable="false" />
        <ElButton size="small" type="primary" link :loading="loading" @click="loadApps"
          >Retry</ElButton
        >
      </div>

      <ElTable
        v-loading="loading"
        class="developer-apps-page__desktop-table"
        :data="filteredRecords"
        border
      >
        <ElTableColumn label="App" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="developer-apps-page__app-name">{{ row.name || '-' }}</div>
            <div class="developer-apps-page__muted">{{ row.code || '-' }}</div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="App Status" width="140">
          <template #default="{ row }">
            <ElTag :type="appStatusTagType(row.status)" effect="light">{{
              statusText(row.status)
            }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="Latest Version" min-width="170">
          <template #default="{ row }">
            <div>{{ row.latest_version || 'No package' }}</div>
            <ElTag
              v-if="row.latest_review_status"
              class="developer-apps-page__inline-tag"
              size="small"
              :type="reviewStatusTagType(row.latest_review_status)"
              effect="plain"
            >
              {{ reviewStatusText(row.latest_review_status) }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="Review Result" min-width="240" show-overflow-tooltip>
          <template #default="{ row }">
            <span
              :class="{ 'developer-apps-page__rejection': row.latest_review_status === 'rejected' }"
            >
              {{ row.latest_review_message || reviewSummary(row) }}
            </span>
          </template>
        </ElTableColumn>
        <ElTableColumn label="Category" width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.category || '-' }}</template>
        </ElTableColumn>
        <ElTableColumn label="Updated" width="170">
          <template #default="{ row }">{{
            formatDateTime(row.update_time || row.create_time)
          }}</template>
        </ElTableColumn>
        <ElTableColumn label="Actions" width="250">
          <template #default="{ row }">
            <ElButton link type="primary" :icon="View" @click="openVersions(row)"
              >Versions</ElButton
            >
            <ElButton
              link
              type="primary"
              :icon="Edit"
              :disabled="!canEdit(row)"
              @click="openEditDialog(row)"
            >
              Edit
            </ElButton>
            <ElButton
              link
              type="success"
              :icon="UploadFilled"
              :disabled="!canUpload(row)"
              @click="openUploadDialog(row)"
            >
              Upload
            </ElButton>
          </template>
        </ElTableColumn>
        <template #empty>
          <ElEmpty description="No developer apps" />
        </template>
      </ElTable>

      <div v-loading="loading" class="developer-apps-page__mobile-list">
        <div
          v-for="row in filteredRecords"
          :key="row.code"
          class="developer-apps-page__mobile-item"
        >
          <div class="developer-apps-page__mobile-heading">
            <div>
              <div class="developer-apps-page__app-name">{{ row.name || '-' }}</div>
              <div class="developer-apps-page__muted">{{ row.code || '-' }}</div>
            </div>
            <ElTag :type="appStatusTagType(row.status)" effect="light">{{
              statusText(row.status)
            }}</ElTag>
          </div>
          <div class="developer-apps-page__mobile-meta">
            <div>
              <span class="developer-apps-page__mobile-label">Latest</span>
              <strong>{{ row.latest_version || 'No package' }}</strong>
            </div>
            <ElTag
              v-if="row.latest_review_status"
              size="small"
              :type="reviewStatusTagType(row.latest_review_status)"
              effect="plain"
            >
              {{ reviewStatusText(row.latest_review_status) }}
            </ElTag>
          </div>
          <div
            class="developer-apps-page__mobile-review"
            :class="{ 'developer-apps-page__rejection': row.latest_review_status === 'rejected' }"
          >
            {{ row.latest_review_message || reviewSummary(row) }}
          </div>
          <div class="developer-apps-page__mobile-actions">
            <ElButton link type="primary" :icon="View" @click="openVersions(row)"
              >Versions</ElButton
            >
            <ElButton
              link
              type="primary"
              :icon="Edit"
              :disabled="!canEdit(row)"
              @click="openEditDialog(row)"
            >
              Edit
            </ElButton>
            <ElButton
              link
              type="success"
              :icon="UploadFilled"
              :disabled="!canUpload(row)"
              @click="openUploadDialog(row)"
            >
              Upload
            </ElButton>
          </div>
        </div>
        <ElEmpty v-if="!loading && !filteredRecords.length" description="No developer apps" />
      </div>
    </ElCard>

    <ElDialog
      v-model="formDialogVisible"
      :title="editingCode ? 'Edit App' : 'Create App'"
      width="720px"
    >
      <ElForm ref="formRef" :model="form" :rules="formRules" label-width="112px">
        <div class="developer-apps-page__form-grid">
          <ElFormItem label="Code" prop="code">
            <ElInput
              v-model="form.code"
              :disabled="Boolean(editingCode)"
              maxlength="80"
              placeholder="creator_portal"
            />
          </ElFormItem>
          <ElFormItem label="Name" prop="name">
            <ElInput v-model="form.name" maxlength="120" placeholder="Creator Portal" />
          </ElFormItem>
          <ElFormItem label="Category">
            <ElInput v-model="form.category" maxlength="50" placeholder="Tools" />
          </ElFormItem>
          <ElFormItem label="Icon">
            <ElInput v-model="form.icon" maxlength="100" placeholder="ri:code-box-line" />
          </ElFormItem>
        </div>
        <ElFormItem label="Summary">
          <ElInput
            v-model="form.summary"
            type="textarea"
            :rows="2"
            maxlength="255"
            show-word-limit
          />
        </ElFormItem>
        <ElFormItem label="Description">
          <ElInput
            v-model="form.description"
            type="textarea"
            :rows="5"
            maxlength="5000"
            show-word-limit
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="formDialogVisible = false">Cancel</ElButton>
        <ElButton type="primary" :icon="Check" :loading="saving" @click="saveApp">Save</ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="uploadDialogVisible" title="Upload Static Version" width="620px">
      <div class="developer-apps-page__upload-target">
        <span>{{ uploadAppName || uploadAppCode }}</span>
        <code>{{ uploadAppCode }}</code>
      </div>
      <ElUpload
        ref="uploadRef"
        v-model:file-list="uploadFiles"
        drag
        :auto-upload="false"
        :limit="1"
        accept=".zip,application/zip"
        :on-change="handleUploadChange"
        :on-remove="handleUploadRemove"
      >
        <ElIcon class="el-icon--upload"><UploadFilled /></ElIcon>
        <div class="el-upload__text">Drop ZIP package here or <em>select file</em></div>
      </ElUpload>
      <template #footer>
        <ElButton @click="uploadDialogVisible = false">Cancel</ElButton>
        <ElButton
          type="primary"
          :icon="UploadFilled"
          :loading="uploading"
          :disabled="!selectedFile"
          @click="uploadVersion"
        >
          Upload
        </ElButton>
      </template>
    </ElDialog>

    <ElDrawer v-model="versionsDrawerVisible" title="Version History" :size="versionsDrawerSize">
      <div
        v-if="detailLoading"
        v-loading="detailLoading"
        class="developer-apps-page__drawer-loading"
      ></div>
      <template v-else>
        <div v-if="selectedApp" class="developer-apps-page__drawer-heading">
          <div>
            <div class="developer-apps-page__app-name">{{ selectedApp.name }}</div>
            <div class="developer-apps-page__muted">{{ selectedApp.code }}</div>
          </div>
          <ElTag :type="appStatusTagType(selectedApp.status)" effect="light">{{
            statusText(selectedApp.status)
          }}</ElTag>
        </div>

        <ElAlert
          v-if="detailError"
          class="developer-apps-page__detail-error"
          type="error"
          :title="detailError"
          show-icon
          :closable="false"
        />

        <ElTable v-if="selectedApp" :data="selectedApp.versions" border>
          <ElTableColumn label="Version" width="110">
            <template #default="{ row }">{{ row.version }}</template>
          </ElTableColumn>
          <ElTableColumn label="Review" width="120">
            <template #default="{ row }">
              <ElTag :type="reviewStatusTagType(row.review_status)" effect="light">
                {{ reviewStatusText(row.review_status) }}
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn label="Publish" width="130">
            <template #default="{ row }">
              <ElTag :type="publishStatusTagType(row.publish_status)" effect="plain">
                {{ publishStatusText(row.publish_status) }}
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn label="Review Message" min-width="220" show-overflow-tooltip>
            <template #default="{ row }">
              <span :class="{ 'developer-apps-page__rejection': row.review_status === 'rejected' }">
                {{ row.review_message || '-' }}
              </span>
            </template>
          </ElTableColumn>
          <ElTableColumn label="Package" min-width="180">
            <template #default="{ row }">
              <div>{{ formatFileSize(row.file_size) }}</div>
              <div class="developer-apps-page__hash" :title="row.file_hash || ''">{{
                shortHash(row.file_hash)
              }}</div>
            </template>
          </ElTableColumn>
          <ElTableColumn label="Created" width="170">
            <template #default="{ row }">{{ formatDateTime(row.create_time) }}</template>
          </ElTableColumn>
          <ElTableColumn label="Actions" width="110">
            <template #default="{ row }">
              <ElButton
                v-if="row.review_status === 'rejected'"
                link
                type="primary"
                :icon="RefreshRight"
                :loading="resubmittingVersion === row.version"
                @click="resubmitVersion(row)"
              >
                Resubmit
              </ElButton>
              <span v-else class="developer-apps-page__muted">-</span>
            </template>
          </ElTableColumn>
          <template #empty>
            <ElEmpty description="No versions uploaded" />
          </template>
        </ElTable>
      </template>
    </ElDrawer>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage, ElMessageBox } from 'element-plus'
  import type {
    FormInstance,
    FormRules,
    UploadFile,
    UploadInstance,
    UploadUserFile
  } from 'element-plus'
  import {
    Check,
    Edit,
    Plus,
    Refresh,
    RefreshRight,
    Search,
    UploadFilled,
    View
  } from '@element-plus/icons-vue'
  import { useWindowSize } from '@vueuse/core'
  import {
    createDeveloperApp,
    fetchDeveloperApp,
    fetchDeveloperApps,
    submitDeveloperAppVersion,
    updateDeveloperApp,
    uploadDeveloperAppVersion,
    type DeveloperAppRecord,
    type SaveDeveloperAppParams
  } from '@/api/app-developer'
  import type {
    AppPackageDetailRecord,
    AppPackageStatus,
    AppPackageVersionRecord
  } from '@/api/app-marketplace'

  defineOptions({ name: 'AppCenterDeveloperPage' })

  const records = ref<DeveloperAppRecord[]>([])
  const selectedApp = ref<AppPackageDetailRecord>()
  const loading = ref(false)
  const saving = ref(false)
  const uploading = ref(false)
  const detailLoading = ref(false)
  const loadError = ref('')
  const detailError = ref('')
  const editingCode = ref('')
  const uploadAppCode = ref('')
  const uploadAppName = ref('')
  const resubmittingVersion = ref('')
  const formDialogVisible = ref(false)
  const uploadDialogVisible = ref(false)
  const versionsDrawerVisible = ref(false)
  const formRef = ref<FormInstance>()
  const uploadRef = ref<UploadInstance>()
  const uploadFiles = ref<UploadUserFile[]>([])
  const selectedFile = ref<File>()
  const statusOptions: AppPackageStatus[] = [
    'draft',
    'pending_review',
    'approved',
    'published',
    'rejected',
    'disabled',
    'archived'
  ]
  const filters = reactive<{ keyword: string; status: AppPackageStatus | '' }>({
    keyword: '',
    status: ''
  })
  const form = reactive({
    code: '',
    name: '',
    category: '',
    icon: '',
    summary: '',
    description: ''
  })
  const formRules: FormRules = {
    code: [
      { required: true, message: 'Code is required', trigger: 'blur' },
      {
        pattern: /^[a-z][a-z0-9_]{2,79}$/,
        message: 'Use lowercase snake_case, 3-80 chars',
        trigger: 'blur'
      }
    ],
    name: [{ required: true, message: 'Name is required', trigger: 'blur' }]
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
  const { width: viewportWidth } = useWindowSize()
  const versionsDrawerSize = computed(() => (viewportWidth.value <= 800 ? '100%' : '760px'))

  const filteredRecords = computed(() => {
    const keyword = filters.keyword.trim().toLowerCase()
    return records.value.filter((row) => {
      if (filters.status && row.status !== filters.status) return false
      if (!keyword) return true
      return [row.code, row.name, row.category, row.summary].some((value) =>
        String(value || '')
          .toLowerCase()
          .includes(keyword)
      )
    })
  })

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

  function reviewStatusText(status?: string) {
    const map: Record<string, string> = {
      pending: 'Pending',
      approved: 'Approved',
      rejected: 'Rejected'
    }
    return status ? map[status] || status : '-'
  }

  function publishStatusText(status?: string) {
    const map: Record<string, string> = {
      unpublished: 'Unpublished',
      published: 'Published',
      failed: 'Failed',
      unpublished_retired: 'Retired'
    }
    return status ? map[status] || status : '-'
  }

  function appStatusTagType(status?: string) {
    const map: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'primary'> = {
      draft: 'info',
      pending_review: 'warning',
      approved: 'primary',
      published: 'success',
      rejected: 'danger',
      disabled: 'warning',
      archived: 'info'
    }
    return status ? map[status] || 'info' : 'info'
  }

  function reviewStatusTagType(status?: string) {
    const map: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
      pending: 'warning',
      approved: 'success',
      rejected: 'danger'
    }
    return status ? map[status] || 'info' : 'info'
  }

  function publishStatusTagType(status?: string) {
    const map: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
      unpublished: 'info',
      published: 'success',
      failed: 'danger',
      unpublished_retired: 'warning'
    }
    return status ? map[status] || 'info' : 'info'
  }

  function reviewSummary(row: DeveloperAppRecord) {
    if (!row.latest_version) return 'Upload the first version'
    if (row.latest_review_status === 'pending') return 'Waiting for review'
    if (row.latest_review_status === 'approved' && row.latest_publish_status !== 'published')
      return 'Approved, awaiting publish'
    if (row.latest_publish_status === 'published') return 'Published'
    return '-'
  }

  function formatDateTime(value: unknown) {
    if (!value) return '-'
    const date = value instanceof Date ? value : new Date(String(value))
    return Number.isNaN(date.getTime()) ? String(value) : dateFormatter.format(date)
  }

  function formatFileSize(value?: number) {
    const bytes = Number(value || 0)
    if (!bytes) return '-'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function shortHash(value?: string) {
    return value ? `${value.slice(0, 12)}...` : '-'
  }

  function cleanText(value: string) {
    return value.trim() || undefined
  }

  function canEdit(row: DeveloperAppRecord) {
    return row.status === 'draft' || row.status === 'rejected'
  }

  function canUpload(row: DeveloperAppRecord) {
    return row.status !== 'disabled' && row.status !== 'archived'
  }

  function resetFilters() {
    filters.keyword = ''
    filters.status = ''
  }

  function resetForm() {
    Object.assign(form, {
      code: '',
      name: '',
      category: '',
      icon: '',
      summary: '',
      description: ''
    })
    formRef.value?.clearValidate()
  }

  async function loadApps() {
    loading.value = true
    loadError.value = ''
    try {
      records.value = await fetchDeveloperApps()
    } catch (error) {
      console.error('[AppCenterDeveloperPage] load apps failed:', error)
      loadError.value = 'Developer apps failed to load'
      ElMessage.error(loadError.value)
    } finally {
      loading.value = false
    }
  }

  function openCreateDialog() {
    editingCode.value = ''
    resetForm()
    formDialogVisible.value = true
  }

  function openEditDialog(row: DeveloperAppRecord) {
    if (!canEdit(row)) return
    editingCode.value = row.code
    Object.assign(form, {
      code: row.code,
      name: row.name || '',
      category: row.category || '',
      icon: row.icon || '',
      summary: row.summary || '',
      description: row.description || ''
    })
    formDialogVisible.value = true
  }

  async function saveApp() {
    await formRef.value?.validate()
    const params: SaveDeveloperAppParams = {
      name: form.name.trim(),
      category: cleanText(form.category),
      icon: cleanText(form.icon),
      summary: cleanText(form.summary),
      description: cleanText(form.description)
    }
    saving.value = true
    try {
      if (editingCode.value) {
        await updateDeveloperApp(editingCode.value, params)
        ElMessage.success('App updated')
      } else {
        await createDeveloperApp({ ...params, code: form.code.trim() })
        ElMessage.success('App created')
      }
      formDialogVisible.value = false
      await loadApps()
    } finally {
      saving.value = false
    }
  }

  async function openVersions(row: DeveloperAppRecord) {
    versionsDrawerVisible.value = true
    detailLoading.value = true
    detailError.value = ''
    selectedApp.value = undefined
    try {
      selectedApp.value = await fetchDeveloperApp(row.code)
    } catch (error) {
      console.error('[AppCenterDeveloperPage] load versions failed:', error)
      detailError.value = 'Version history failed to load'
      ElMessage.error(detailError.value)
    } finally {
      detailLoading.value = false
    }
  }

  function openUploadDialog(row: DeveloperAppRecord) {
    if (!canUpload(row)) return
    uploadAppCode.value = row.code
    uploadAppName.value = row.name
    uploadFiles.value = []
    selectedFile.value = undefined
    uploadRef.value?.clearFiles()
    uploadDialogVisible.value = true
  }

  function handleUploadChange(file: UploadFile) {
    selectedFile.value = file.raw
  }

  function handleUploadRemove() {
    selectedFile.value = undefined
  }

  async function uploadVersion() {
    if (!selectedFile.value || !uploadAppCode.value) return
    uploading.value = true
    const appCode = uploadAppCode.value
    try {
      await uploadDeveloperAppVersion(appCode, selectedFile.value)
      ElMessage.success('Version submitted for review')
      uploadDialogVisible.value = false
      await loadApps()
      const row = records.value.find((item) => item.code === appCode)
      if (row) await openVersions(row)
    } finally {
      uploading.value = false
    }
  }

  async function resubmitVersion(version: AppPackageVersionRecord) {
    if (!selectedApp.value || version.review_status !== 'rejected') return
    await ElMessageBox.confirm(
      `Resubmit ${selectedApp.value.name} ${version.version} for review?`,
      'Resubmit version',
      {
        type: 'warning',
        confirmButtonText: 'Resubmit',
        cancelButtonText: 'Cancel'
      }
    )
    resubmittingVersion.value = version.version
    try {
      await submitDeveloperAppVersion(selectedApp.value.code, version.version)
      ElMessage.success('Version resubmitted')
      const code = selectedApp.value.code
      selectedApp.value = await fetchDeveloperApp(code)
      await loadApps()
    } finally {
      resubmittingVersion.value = ''
    }
  }

  onMounted(() => {
    loadApps()
  })
</script>

<style scoped>
  .developer-apps-page {
    min-height: 100%;
  }

  .developer-apps-page__header,
  .developer-apps-page__header-actions,
  .developer-apps-page__filters,
  .developer-apps-page__drawer-heading {
    display: flex;
    gap: 12px;
  }

  .developer-apps-page__header,
  .developer-apps-page__drawer-heading {
    align-items: flex-start;
    justify-content: space-between;
  }

  .developer-apps-page__header-actions,
  .developer-apps-page__filters {
    flex-wrap: wrap;
  }

  .developer-apps-page__title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.4;
    letter-spacing: 0;
  }

  .developer-apps-page__subtitle {
    margin: 6px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.5;
  }

  .developer-apps-page__filters {
    margin-bottom: 16px;
  }

  .developer-apps-page__keyword {
    width: 260px;
  }

  .developer-apps-page__status-filter {
    width: 170px;
  }

  .developer-apps-page__load-error {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .developer-apps-page__mobile-list {
    display: none;
    min-height: 160px;
  }

  .developer-apps-page__mobile-item {
    padding: 16px 0;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .developer-apps-page__mobile-item:last-child {
    border-bottom: 0;
  }

  .developer-apps-page__mobile-heading,
  .developer-apps-page__mobile-meta,
  .developer-apps-page__mobile-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .developer-apps-page__mobile-heading,
  .developer-apps-page__mobile-meta {
    justify-content: space-between;
  }

  .developer-apps-page__mobile-meta {
    margin-top: 14px;
  }

  .developer-apps-page__mobile-label {
    margin-right: 8px;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  .developer-apps-page__mobile-review {
    margin-top: 10px;
    overflow-wrap: anywhere;
    font-size: 13px;
    line-height: 1.5;
  }

  .developer-apps-page__mobile-actions {
    justify-content: flex-end;
    margin-top: 12px;
  }

  .developer-apps-page__app-name {
    color: var(--el-text-color-primary);
    font-weight: 500;
  }

  .developer-apps-page__muted,
  .developer-apps-page__hash {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  .developer-apps-page__muted {
    margin-top: 2px;
  }

  .developer-apps-page__inline-tag {
    margin-top: 4px;
  }

  .developer-apps-page__rejection {
    color: var(--el-color-danger);
  }

  .developer-apps-page__form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 16px;
  }

  .developer-apps-page__upload-target {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }

  .developer-apps-page__upload-target code {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  .developer-apps-page__drawer-loading {
    min-height: 240px;
  }

  .developer-apps-page__drawer-heading,
  .developer-apps-page__detail-error {
    margin-bottom: 16px;
  }

  .developer-apps-page__hash {
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (max-width: 760px) {
    .developer-apps-page__header,
    .developer-apps-page__form-grid {
      display: grid;
      grid-template-columns: 1fr;
    }

    .developer-apps-page__header-actions,
    .developer-apps-page__keyword,
    .developer-apps-page__status-filter {
      width: 100%;
    }

    .developer-apps-page__header-actions :deep(.el-button) {
      flex: 1;
      margin-left: 0;
    }

    .developer-apps-page__desktop-table {
      display: none;
    }

    .developer-apps-page__mobile-list {
      display: block;
    }
  }
</style>
