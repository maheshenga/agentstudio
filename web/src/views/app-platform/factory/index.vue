<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="app-factory-page">
      <template #header>
        <div class="app-factory-page__header">
          <div>
            <h1 class="app-factory-page__title">Module Factory</h1>
            <p class="app-factory-page__subtitle">Build static HTML/CSS modules and publish them into the marketplace runtime.</p>
          </div>
          <div class="app-factory-page__actions">
            <ElButton :icon="Refresh" :loading="loading" @click="loadModules">Refresh</ElButton>
            <ElButton type="primary" :icon="Plus" @click="openCreateDialog">Create Module</ElButton>
          </div>
        </div>
      </template>

      <div class="app-factory-page__filters">
        <ElInput
          v-model="filters.keyword"
          clearable
          class="app-factory-page__filter-item"
          placeholder="Code, name"
          @keyup.enter="loadModules"
        />
        <ElSelect v-model="filters.status" clearable class="app-factory-page__select" placeholder="Status">
          <ElOption v-for="item in statusOptions" :key="item" :label="statusText(item)" :value="item" />
        </ElSelect>
        <ElButton type="primary" :icon="Search" :loading="loading" @click="loadModules">Search</ElButton>
        <ElButton @click="resetFilters">Reset</ElButton>
      </div>

      <div v-if="loadError" class="app-factory-page__load-error">
        <ElAlert type="error" :title="loadError" show-icon :closable="false" />
        <ElButton size="small" type="primary" link :loading="loading" @click="loadModules">Retry</ElButton>
      </div>

      <ElTable v-loading="loading" :data="records" border>
        <ElTableColumn label="Module" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="app-factory-page__module-name">{{ row.name || '-' }}</div>
            <div class="app-factory-page__module-code">{{ row.code || '-' }}</div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="Status" width="130">
          <template #default="{ row }">
            <ElTag :type="statusTagType(row.status)" effect="light">{{ statusText(row.status) }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="Marketplace App" min-width="190" show-overflow-tooltip>
          <template #default="{ row }">{{ row.app_code || '-' }}</template>
        </ElTableColumn>
        <ElTableColumn label="Version" width="120">
          <template #default="{ row }">{{ row.latest_version || '-' }}</template>
        </ElTableColumn>
        <ElTableColumn label="Binding" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <div>{{ row.saas_module_code || 'No SaaS module' }}</div>
            <div class="app-factory-page__muted">{{ row.system_module_code || 'No system module' }}</div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="Updated" width="170">
          <template #default="{ row }">{{ formatDateTime(row.update_time) }}</template>
        </ElTableColumn>
        <ElTableColumn label="Actions" fixed="right" width="260">
          <template #default="{ row }">
            <ElButton link type="primary" :icon="Edit" :loading="editLoadingCode === row.code" @click="openEditDialog(row)">Edit</ElButton>
            <ElButton link type="primary" :icon="View" :loading="previewCode === row.code" @click="openPreview(row)">Preview</ElButton>
            <ElButton link type="success" :icon="Promotion" :loading="publishingCode === row.code" @click="publishModule(row)">
              Publish
            </ElButton>
          </template>
        </ElTableColumn>
        <template #empty>
          <ElEmpty description="No factory modules yet" />
        </template>
      </ElTable>
    </ElCard>

    <ElDialog v-model="dialogVisible" :title="editingCode ? 'Edit Module' : 'Create Module'" width="880px" top="6vh">
      <ElAlert
        class="app-factory-page__form-alert"
        type="warning"
        title="Factory page rejects scripts, inline event handlers, and javascript URLs."
        show-icon
        :closable="false"
      />
      <ElForm ref="formRef" :model="form" :rules="formRules" label-width="132px">
        <div class="app-factory-page__form-grid">
          <ElFormItem label="Code" prop="code">
            <ElInput v-model="form.code" :disabled="Boolean(editingCode)" maxlength="80" placeholder="landing_page" />
          </ElFormItem>
          <ElFormItem label="Name" prop="name">
            <ElInput v-model="form.name" maxlength="120" placeholder="Landing Page" />
          </ElFormItem>
          <ElFormItem label="Category">
            <ElInput v-model="form.category" maxlength="50" placeholder="Marketing" />
          </ElFormItem>
          <ElFormItem label="Icon">
            <ElInput v-model="form.icon" maxlength="100" placeholder="ri:pages-line" />
          </ElFormItem>
          <ElFormItem label="Visibility">
            <ElSelect v-model="form.visibility">
              <ElOption label="Marketplace" value="marketplace" />
              <ElOption label="Tenant" value="tenant" />
              <ElOption label="Platform" value="platform" />
              <ElOption label="Private" value="private" />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="Sort">
            <ElInputNumber v-model="form.sort" :min="0" :step="10" controls-position="right" />
          </ElFormItem>
          <ElFormItem label="SaaS Module">
            <ElSelect v-model="form.saas_module_code" clearable filterable placeholder="Optional entitlement module">
              <ElOption
                v-for="item in saasModuleOptions"
                :key="item.code"
                :label="`${item.name} (${item.code})`"
                :value="item.code"
              />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="System Module">
            <ElSelect v-model="form.system_module_code" clearable filterable placeholder="Optional runtime guard module">
              <ElOption
                v-for="item in systemModuleOptions"
                :key="item.code"
                :label="`${item.name} (${item.code})`"
                :value="item.code"
              />
            </ElSelect>
          </ElFormItem>
        </div>
        <ElFormItem label="Summary">
          <ElInput v-model="form.summary" type="textarea" maxlength="255" show-word-limit :rows="2" />
        </ElFormItem>
        <ElFormItem label="HTML" prop="html_content">
          <ElInput
            v-model="form.html_content"
            type="textarea"
            maxlength="200000"
            show-word-limit
            :rows="10"
            placeholder="<main><h1>Hello</h1></main>"
          />
        </ElFormItem>
        <ElFormItem label="CSS" prop="css_content">
          <ElInput
            v-model="form.css_content"
            type="textarea"
            maxlength="100000"
            show-word-limit
            :rows="7"
            placeholder=".hero { padding: 32px; }"
          />
        </ElFormItem>
        <ElFormItem label="Remark">
          <ElInput v-model="form.remark" maxlength="255" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">Cancel</ElButton>
        <ElButton type="primary" :icon="Check" :loading="saving" @click="saveModule">Save</ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="previewVisible" title="Factory Preview" width="900px" top="6vh">
      <iframe class="app-factory-page__preview" :srcdoc="previewHtml" sandbox="allow-forms"></iframe>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage, ElMessageBox } from 'element-plus'
  import type { FormInstance, FormRules } from 'element-plus'
  import { Check, Edit, Plus, Promotion, Refresh, Search, View } from '@element-plus/icons-vue'
  import {
    createAppFactoryModule,
    fetchAppFactoryModule,
    fetchAppFactoryModules,
    publishAppFactoryModule,
    updateAppFactoryModule,
    type AppFactoryModuleRecord,
    type AppFactoryModuleStatus,
    type AppFactoryModuleVisibility,
    type SaveAppFactoryModuleParams
  } from '@/api/app-factory'
  import { fetchPlatformModules, type SaasModuleRecord } from '@/api/saas'
  import { fetchSystemModules, type SystemModuleRecord } from '@/api/system-module'

  defineOptions({ name: 'AppPlatformFactoryPage' })

  const records = ref<AppFactoryModuleRecord[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const dialogVisible = ref(false)
  const previewVisible = ref(false)
  const loadError = ref('')
  const editingCode = ref('')
  const editLoadingCode = ref('')
  const publishingCode = ref('')
  const previewCode = ref('')
  const previewHtml = ref('')
  const formRef = ref<FormInstance>()
  const saasModuleOptions = ref<SaasModuleRecord[]>([])
  const systemModuleOptions = ref<SystemModuleRecord[]>([])
  const statusOptions: AppFactoryModuleStatus[] = ['draft', 'published', 'disabled', 'archived']
  const filters = reactive<{ keyword: string; status: AppFactoryModuleStatus | '' }>({
    keyword: '',
    status: ''
  })
  const form = reactive({
    code: '',
    name: '',
    kind: 'static_page' as const,
    category: '',
    icon: '',
    summary: '',
    description: '',
    html_content: '',
    css_content: '',
    visibility: 'marketplace' as AppFactoryModuleVisibility,
    saas_module_code: '',
    system_module_code: '',
    sort: 100,
    remark: ''
  })
  const formRules: FormRules = {
    code: [
      { required: true, message: 'Code is required', trigger: 'blur' },
      { pattern: /^[a-z][a-z0-9_]{2,79}$/, message: 'Use lowercase snake_case, 3-80 chars', trigger: 'blur' }
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

  function cleanText(value: string) {
    return value.trim() || undefined
  }

  function statusText(status?: string) {
    const map: Record<string, string> = {
      draft: 'Draft',
      published: 'Published',
      disabled: 'Disabled',
      archived: 'Archived'
    }
    return status ? map[status] || status : '-'
  }

  function statusTagType(status?: string) {
    const map: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
      draft: 'info',
      published: 'success',
      disabled: 'warning',
      archived: 'info'
    }
    return status ? map[status] || 'info' : 'info'
  }

  function formatDateTime(value: unknown) {
    if (!value) return '-'
    const date = value instanceof Date ? value : new Date(String(value))
    return Number.isNaN(date.getTime()) ? String(value) : dateFormatter.format(date)
  }

  function resetForm() {
    Object.assign(form, {
      code: '',
      name: '',
      kind: 'static_page',
      category: '',
      icon: '',
      summary: '',
      description: '',
      html_content: '<main><h1>New module</h1><p>Edit this static page content.</p></main>',
      css_content: '.factory-section { padding: 32px; background: #ffffff; border-radius: 8px; }',
      visibility: 'marketplace',
      saas_module_code: '',
      system_module_code: '',
      sort: 100,
      remark: ''
    })
    formRef.value?.clearValidate()
  }

  function fillForm(row: AppFactoryModuleRecord) {
    Object.assign(form, {
      code: row.code,
      name: row.name,
      kind: row.kind || 'static_page',
      category: row.category || '',
      icon: row.icon || '',
      summary: row.summary || '',
      description: row.description || '',
      html_content: row.html_content || '',
      css_content: row.css_content || '',
      visibility: row.visibility || 'marketplace',
      saas_module_code: row.saas_module_code || '',
      system_module_code: row.system_module_code || '',
      sort: row.sort ?? 100,
      remark: row.remark || ''
    })
    formRef.value?.clearValidate()
  }

  function buildPayload(): SaveAppFactoryModuleParams {
    return {
      code: cleanText(form.code),
      name: form.name.trim(),
      kind: 'static_page',
      category: cleanText(form.category),
      icon: cleanText(form.icon),
      summary: cleanText(form.summary),
      description: cleanText(form.description),
      html_content: form.html_content,
      css_content: form.css_content,
      visibility: form.visibility,
      saas_module_code: cleanText(form.saas_module_code),
      system_module_code: cleanText(form.system_module_code),
      sort: form.sort,
      remark: cleanText(form.remark)
    }
  }

  function nextPatchVersion(version?: string) {
    if (!version) return '1.0.0'
    const parts = version.split('.').map((item) => Number(item))
    if (parts.length !== 3 || parts.some((item) => Number.isNaN(item))) return '1.0.0'
    return `${parts[0]}.${parts[1]}.${parts[2] + 1}`
  }

  async function loadModules() {
    loading.value = true
    loadError.value = ''
    try {
      records.value = await fetchAppFactoryModules({
        keyword: cleanText(filters.keyword),
        status: filters.status || undefined
      })
    } catch (error) {
      console.error('[AppPlatformFactoryPage] load modules failed:', error)
      loadError.value = 'Factory module list failed to load'
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
      console.error('[AppPlatformFactoryPage] load module options failed:', error)
      saasModuleOptions.value = []
      systemModuleOptions.value = []
    }
  }

  function resetFilters() {
    filters.keyword = ''
    filters.status = ''
    loadModules()
  }

  function openCreateDialog() {
    editingCode.value = ''
    resetForm()
    dialogVisible.value = true
  }

  async function openEditDialog(row: AppFactoryModuleRecord) {
    editLoadingCode.value = row.code
    try {
      const detail = await fetchAppFactoryModule(row.code)
      editingCode.value = row.code
      fillForm(detail)
      dialogVisible.value = true
    } finally {
      editLoadingCode.value = ''
    }
  }

  async function saveModule() {
    await formRef.value?.validate()
    saving.value = true
    try {
      const payload = buildPayload()
      if (editingCode.value) {
        await updateAppFactoryModule(editingCode.value, payload)
      } else {
        await createAppFactoryModule(payload)
      }
      ElMessage.success('Factory module saved')
      dialogVisible.value = false
      await loadModules()
    } finally {
      saving.value = false
    }
  }

  async function publishModule(row: AppFactoryModuleRecord) {
    const defaultVersion = nextPatchVersion(row.latest_version)
    const result = (await ElMessageBox.prompt('Version', `Publish ${row.name}`, {
      inputValue: defaultVersion,
      inputPattern: /^\d+\.\d+\.\d+$/,
      inputErrorMessage: 'Use semantic version format, for example 1.0.0',
      confirmButtonText: 'Publish',
      cancelButtonText: 'Cancel',
      type: 'warning'
    })) as { value: string }

    publishingCode.value = row.code
    try {
      await publishAppFactoryModule(row.code, result.value, `Published ${row.name} from module factory`)
      ElMessage.success('Factory module published')
      await loadModules()
    } finally {
      publishingCode.value = ''
    }
  }

  async function openPreview(row: AppFactoryModuleRecord) {
    previewCode.value = row.code
    try {
      const detail = await fetchAppFactoryModule(row.code)
      previewHtml.value = [
        '<style>',
        'body{margin:0;}',
        '.factory-preview{padding:24px;color:#1f2937;background:#f8fafc;}',
        detail.css_content || '',
        '</style>',
        '<div class="factory-preview">',
        detail.html_content || '<p>This factory page is empty.</p>',
        '</div>'
      ].join('\n')
      previewVisible.value = true
    } finally {
      previewCode.value = ''
    }
  }

  onMounted(() => {
    loadModules()
    loadModuleOptions()
  })
</script>

<style scoped>
  .app-factory-page {
    min-height: 100%;
  }

  .app-factory-page__header,
  .app-factory-page__actions,
  .app-factory-page__filters {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .app-factory-page__header {
    align-items: flex-start;
    justify-content: space-between;
  }

  .app-factory-page__title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.4;
    letter-spacing: 0;
  }

  .app-factory-page__subtitle {
    margin: 6px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.5;
  }

  .app-factory-page__filters {
    margin-bottom: 16px;
  }

  .app-factory-page__filter-item {
    width: 240px;
  }

  .app-factory-page__select {
    width: 160px;
  }

  .app-factory-page__load-error {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .app-factory-page__module-name {
    color: var(--el-text-color-primary);
    font-weight: 500;
  }

  .app-factory-page__module-code,
  .app-factory-page__muted {
    margin-top: 2px;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  .app-factory-page__form-alert {
    margin-bottom: 16px;
  }

  .app-factory-page__form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 16px;
  }

  .app-factory-page__preview {
    width: 100%;
    min-height: 360px;
    max-height: 68vh;
    border: 1px solid var(--el-border-color-light);
    border-radius: 6px;
    background: #fff;
  }

  @media (max-width: 820px) {
    .app-factory-page__header,
    .app-factory-page__form-grid {
      display: grid;
      grid-template-columns: 1fr;
    }

    .app-factory-page__actions,
    .app-factory-page__filter-item,
    .app-factory-page__select {
      width: 100%;
    }
  }
</style>
