<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="saas-module-page">
      <template #header>
        <div class="saas-module-page__header">
          <div>
            <h1 class="saas-module-page__title">Module Catalog</h1>
            <p class="saas-module-page__subtitle">Manage platform modules exposed to SaaS plans and tenants.</p>
          </div>
          <div class="saas-module-page__actions">
            <ElButton :loading="loading" @click="loadModules">Refresh</ElButton>
            <ElButton type="primary" @click="openCreateDialog">Create</ElButton>
          </div>
        </div>
      </template>

      <div class="saas-module-page__filters">
        <ElInput
          v-model="filters.keyword"
          clearable
          class="saas-module-page__filter-item"
          placeholder="Code or name"
          @keyup.enter="loadModules"
        />
        <ElSelect v-model="filters.status" clearable class="saas-module-page__status-select" placeholder="Status">
          <ElOption label="Enabled" :value="1" />
          <ElOption label="Disabled" :value="0" />
        </ElSelect>
        <ElButton type="primary" :loading="loading" @click="loadModules">Search</ElButton>
        <ElButton @click="resetFilters">Reset</ElButton>
      </div>

      <div v-if="loadError" class="saas-module-page__load-error">
        <ElAlert type="error" :title="loadError" show-icon :closable="false" />
        <ElButton size="small" type="primary" link :loading="loading" @click="loadModules">重试</ElButton>
      </div>

      <ElTable v-loading="loading" :data="records" border>
        <ElTableColumn prop="code" label="Code" min-width="150" show-overflow-tooltip />
        <ElTableColumn prop="name" label="Name" min-width="160" show-overflow-tooltip />
        <ElTableColumn prop="category" label="Category" min-width="130" show-overflow-tooltip />
        <ElTableColumn label="Route" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">{{ getRoutePath(row) }}</template>
        </ElTableColumn>
        <ElTableColumn label="Status" width="110">
          <template #default="{ row }">
            <ElTag :type="row.status === 1 ? 'success' : 'info'" effect="light">{{ getStatusText(row.status) }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="sort" label="Sort" width="90" />
        <ElTableColumn prop="remark" label="Remark" min-width="180" show-overflow-tooltip />
        <ElTableColumn label="Updated" width="180">
          <template #default="{ row }">{{ formatDateTime(row.update_time) }}</template>
        </ElTableColumn>
        <ElTableColumn label="Actions" fixed="right" width="180">
          <template #default="{ row }">
            <ElButton link type="primary" @click="openEditDialog(row)">Edit</ElButton>
            <ElButton link :type="row.status === 1 ? 'warning' : 'success'" @click="toggleStatus(row)">
              {{ row.status === 1 ? 'Disable' : 'Enable' }}
            </ElButton>
          </template>
        </ElTableColumn>
        <template #empty>
          <ElEmpty description="暂无模块数据" />
        </template>
      </ElTable>
    </ElCard>

    <ElDialog v-model="dialogVisible" :title="editingCode ? 'Edit Module' : 'Create Module'" width="620px">
      <ElForm ref="moduleFormRef" :model="moduleForm" :rules="moduleRules" label-width="104px">
        <ElFormItem label="Code" prop="code">
          <ElInput v-model="moduleForm.code" :disabled="Boolean(editingCode)" maxlength="50" />
        </ElFormItem>
        <ElFormItem label="Name" prop="name">
          <ElInput v-model="moduleForm.name" maxlength="100" />
        </ElFormItem>
        <ElFormItem label="Category">
          <ElInput v-model="moduleForm.category" maxlength="50" />
        </ElFormItem>
        <ElFormItem label="Icon">
          <ElInput v-model="moduleForm.icon" maxlength="100" />
        </ElFormItem>
        <ElFormItem label="Route">
          <ElInput v-model="moduleForm.route_path" maxlength="255" />
        </ElFormItem>
        <ElFormItem label="Status">
          <ElSwitch v-model="moduleForm.status" :active-value="1" :inactive-value="0" />
        </ElFormItem>
        <ElFormItem label="Sort">
          <ElInputNumber v-model="moduleForm.sort" :min="0" :step="10" controls-position="right" />
        </ElFormItem>
        <ElFormItem label="Description">
          <ElInput v-model="moduleForm.description" type="textarea" maxlength="255" show-word-limit />
        </ElFormItem>
        <ElFormItem label="Remark">
          <ElInput v-model="moduleForm.remark" type="textarea" maxlength="255" show-word-limit />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">Cancel</ElButton>
        <ElButton type="primary" :loading="saving" @click="saveModule">Save</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import type { FormInstance, FormRules } from 'element-plus'
  import {
    createPlatformModule,
    fetchPlatformModules,
    updatePlatformModule,
    updatePlatformModuleStatus,
    type SaasModuleRecord,
    type SaveSaasModuleParams
  } from '@/api/saas'

  defineOptions({ name: 'SaasPlatformModulePage' })

  const records = ref<SaasModuleRecord[]>([])
  const loading = ref(false)
  const loadError = ref('')
  const saving = ref(false)
  const dialogVisible = ref(false)
  const editingCode = ref('')
  const moduleFormRef = ref<FormInstance>()
  const filters = reactive<{ keyword: string; status: number | '' }>({ keyword: '', status: '' })
  const moduleForm = reactive({
    code: '',
    name: '',
    description: '',
    category: '',
    icon: '',
    route_path: '',
    status: 1,
    sort: 100,
    remark: ''
  })
  const moduleRules: FormRules = {
    code: [
      { required: true, message: 'Code is required', trigger: 'blur' },
      { pattern: /\S/, message: 'Code cannot be blank', trigger: 'blur' }
    ],
    name: [
      { required: true, message: 'Name is required', trigger: 'blur' },
      { pattern: /\S/, message: 'Name cannot be blank', trigger: 'blur' }
    ]
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

  function getRoutePath(row: SaasModuleRecord) {
    return row.route_path || row.routePath || '-'
  }

  function getStatusText(status: number) {
    return status === 1 ? 'Enabled' : 'Disabled'
  }

  function formatDateTime(value: unknown) {
    if (!value) return '-'
    const date = value instanceof Date ? value : new Date(String(value))
    return Number.isNaN(date.getTime()) ? String(value) : dateFormatter.format(date)
  }

  async function loadModules() {
    loading.value = true
    loadError.value = ''
    try {
      records.value = await fetchPlatformModules({
        keyword: cleanText(filters.keyword),
        status: filters.status === '' ? undefined : filters.status
      })
    } catch (error) {
      console.error('[SaasPlatformModulePage] load modules failed:', error)
      loadError.value = '模块列表加载失败'
      ElMessage.error(loadError.value)
    } finally {
      loading.value = false
    }
  }

  function resetFilters() {
    filters.keyword = ''
    filters.status = ''
    loadModules()
  }

  function resetForm() {
    Object.assign(moduleForm, {
      code: '',
      name: '',
      description: '',
      category: '',
      icon: '',
      route_path: '',
      status: 1,
      sort: 100,
      remark: ''
    })
    moduleFormRef.value?.clearValidate()
  }

  function openCreateDialog() {
    editingCode.value = ''
    resetForm()
    dialogVisible.value = true
  }

  function openEditDialog(row: SaasModuleRecord) {
    editingCode.value = row.code
    Object.assign(moduleForm, {
      code: row.code,
      name: row.name,
      description: row.description || '',
      category: row.category || '',
      icon: row.icon || '',
      route_path: getRoutePath(row) === '-' ? '' : getRoutePath(row),
      status: row.status,
      sort: row.sort ?? 100,
      remark: row.remark || ''
    })
    moduleFormRef.value?.clearValidate()
    dialogVisible.value = true
  }

  function buildPayload(): SaveSaasModuleParams {
    return {
      code: cleanText(moduleForm.code),
      name: moduleForm.name.trim(),
      description: cleanText(moduleForm.description),
      category: cleanText(moduleForm.category),
      icon: cleanText(moduleForm.icon),
      route_path: cleanText(moduleForm.route_path),
      status: moduleForm.status,
      sort: moduleForm.sort,
      remark: cleanText(moduleForm.remark)
    }
  }

  async function saveModule() {
    await moduleFormRef.value?.validate()
    saving.value = true
    try {
      const payload = buildPayload()
      if (editingCode.value) {
        await updatePlatformModule(editingCode.value, payload)
      } else {
        await createPlatformModule(payload)
      }
      ElMessage.success('Module saved')
      dialogVisible.value = false
      await loadModules()
    } finally {
      saving.value = false
    }
  }

  async function toggleStatus(row: SaasModuleRecord) {
    await updatePlatformModuleStatus(row.code, row.status === 1 ? 0 : 1)
    ElMessage.success(row.status === 1 ? 'Module disabled' : 'Module enabled')
    await loadModules()
  }

  onMounted(() => {
    loadModules()
  })
</script>

<style scoped>
  .saas-module-page {
    min-height: 100%;
  }

  .saas-module-page__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .saas-module-page__title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.4;
    letter-spacing: 0;
  }

  .saas-module-page__subtitle {
    margin: 6px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.5;
  }

  .saas-module-page__actions,
  .saas-module-page__filters {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .saas-module-page__filters {
    margin-bottom: 16px;
  }

  .saas-module-page__filter-item {
    width: 220px;
  }

  .saas-module-page__status-select {
    width: 140px;
  }

  .saas-module-page__load-error {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  @media (max-width: 640px) {
    .saas-module-page__header {
      flex-direction: column;
    }

    .saas-module-page__actions,
    .saas-module-page__filter-item,
    .saas-module-page__status-select {
      width: 100%;
    }
  }
</style>
