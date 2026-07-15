<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="app-factory-page">
      <template #header>
        <div class="app-factory-page__header">
          <div>
            <h1 class="app-factory-page__title">模块工厂</h1>
            <p class="app-factory-page__subtitle"
              >构建可版本化的静态模块，或生成必须进入应用平台审核的服务清单。</p
            >
          </div>
          <div class="app-factory-page__actions">
            <ElButton :icon="Refresh" :loading="loading" @click="loadModules">刷新</ElButton>
            <ElButton :icon="Collection" @click="openTemplateDrawer">使用模板</ElButton>
            <ElButton type="primary" :icon="Plus" @click="openCreateDialog">创建模块</ElButton>
          </div>
        </div>
      </template>

      <div class="app-factory-page__filters">
        <ElInput
          v-model="filters.keyword"
          clearable
          class="app-factory-page__filter-item"
          placeholder="编码、名称"
          @keyup.enter="loadModules"
        />
        <ElSelect
          v-model="filters.status"
          clearable
          class="app-factory-page__select"
          placeholder="状态"
        >
          <ElOption
            v-for="item in statusOptions"
            :key="item"
            :label="statusText(item)"
            :value="item"
          />
        </ElSelect>
        <ElButton type="primary" :icon="Search" :loading="loading" @click="loadModules"
          >搜索</ElButton
        >
        <ElButton @click="resetFilters">重置</ElButton>
      </div>

      <div v-if="loadError" class="app-factory-page__load-error">
        <ElAlert type="error" :title="loadError" show-icon :closable="false" />
        <ElButton size="small" type="primary" link :loading="loading" @click="loadModules"
          >重试</ElButton
        >
      </div>

      <ElTable v-loading="loading" :data="records" border>
        <ElTableColumn label="模块" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="app-factory-page__module-name">{{ row.name || '-' }}</div>
            <div class="app-factory-page__module-code">{{ row.code || '-' }}</div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="状态" width="130">
          <template #default="{ row }">
            <ElTag :type="statusTagType(row.status)" effect="light">{{
              statusText(row.status)
            }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="运行类型" width="110">
          <template #default="{ row }">
            <ElTag :type="row.runtime_target === 'service' ? 'warning' : 'info'" effect="plain">
              {{ row.runtime_target || 'static' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="市场应用" min-width="190" show-overflow-tooltip>
          <template #default="{ row }">{{ row.app_code || '-' }}</template>
        </ElTableColumn>
        <ElTableColumn label="版本" width="120">
          <template #default="{ row }">{{ row.latest_version || '-' }}</template>
        </ElTableColumn>
        <ElTableColumn label="绑定" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <div>{{ row.saas_module_code || '未绑定 SaaS 模块' }}</div>
            <div class="app-factory-page__muted">{{
              row.system_module_code || '未绑定系统模块'
            }}</div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="更新时间" width="170">
          <template #default="{ row }">{{ formatDateTime(row.update_time) }}</template>
        </ElTableColumn>
        <ElTableColumn label="操作" fixed="right" width="350">
          <template #default="{ row }">
            <ElButton
              link
              type="primary"
              :icon="Edit"
              :loading="editLoadingCode === row.code"
              @click="openEditDialog(row)"
              >编辑</ElButton
            >
            <ElButton
              v-if="row.runtime_target !== 'service'"
              link
              type="primary"
              :icon="View"
              :loading="previewCode === row.code"
              @click="openPreview(row)"
              >页面</ElButton
            >
            <ElButton
              link
              type="primary"
              :icon="Document"
              :loading="manifestPreviewCode === row.code"
              @click="openManifestPreview(row)"
              >清单</ElButton
            >
            <ElButton
              v-if="row.runtime_target !== 'service'"
              link
              type="success"
              :icon="Promotion"
              :loading="publishingCode === row.code"
              @click="publishModule(row)"
            >
              发布
            </ElButton>
          </template>
        </ElTableColumn>
        <template #empty>
          <ElEmpty description="暂无工厂模块" />
        </template>
      </ElTable>
    </ElCard>

    <ElDrawer v-model="templateDrawerVisible" title="工厂模板" size="820px">
      <div class="app-factory-page__template-toolbar">
        <ElInput
          v-model="templateKeyword"
          clearable
          placeholder="搜索模板"
          @keyup.enter="loadTemplates"
        />
        <ElButton type="primary" :icon="Search" :loading="templateLoading" @click="loadTemplates"
          >搜索</ElButton
        >
      </div>
      <ElTable v-loading="templateLoading" :data="templates" :row-key="templateKey" border>
        <ElTableColumn label="模板" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="app-factory-page__module-name">{{ row.name || '-' }}</div>
            <div class="app-factory-page__module-code">{{ row.code || '-' }}</div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="分类" width="140">
          <template #default="{ row }">{{ row.category || '-' }}</template>
        </ElTableColumn>
        <ElTableColumn label="版本" width="120">
          <template #default="{ row }">
            <div>{{ row.template_version || '1.0.0' }}</div>
            <div class="app-factory-page__muted">schema {{ row.schema_version || 1 }}</div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="运行类型" width="105">
          <template #default="{ row }">
            <ElTag :type="row.runtime_target === 'service' ? 'warning' : 'info'" effect="plain">
              {{ row.runtime_target || 'static' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="简介" min-width="260" show-overflow-tooltip>
          <template #default="{ row }">{{ row.summary || '-' }}</template>
        </ElTableColumn>
        <ElTableColumn label="操作" fixed="right" width="120">
          <template #default="{ row }">
            <ElButton
              link
              type="primary"
              :loading="applyingTemplateCode === templateKey(row)"
              @click="applyTemplate(row)"
            >
              应用
            </ElButton>
          </template>
        </ElTableColumn>
        <template #empty>
          <ElEmpty description="暂无工厂模板" />
        </template>
      </ElTable>
    </ElDrawer>

    <ElDialog
      v-model="dialogVisible"
      :title="editingCode ? '编辑模块' : '创建模块'"
      width="880px"
      top="6vh"
    >
      <ElAlert
        class="app-factory-page__form-alert"
        :type="form.runtime_target === 'service' ? 'info' : 'warning'"
        :title="
          form.runtime_target === 'service'
            ? '服务模板只生成清单。可执行代码必须通过应用平台审核。'
            : '工厂页面会拒绝脚本、内联事件处理器和 javascript 链接。'
        "
        show-icon
        :closable="false"
      />
      <ElAlert
        v-if="form.template_code"
        class="app-factory-page__form-alert"
        type="info"
        :title="`Template ${form.template_code}@${form.template_version || '1.0.0'} · schema ${form.template_schema_version || 1} · ${form.runtime_target}`"
        :closable="false"
      />
      <ElForm ref="formRef" :model="form" :rules="formRules" label-width="132px">
        <div class="app-factory-page__form-grid">
          <ElFormItem label="编码" prop="code">
            <ElInput
              v-model="form.code"
              :disabled="Boolean(editingCode)"
              maxlength="80"
              placeholder="landing_page"
            />
          </ElFormItem>
          <ElFormItem label="名称" prop="name">
            <ElInput v-model="form.name" maxlength="120" placeholder="落地页" />
          </ElFormItem>
          <ElFormItem label="分类">
            <ElInput v-model="form.category" maxlength="50" placeholder="营销" />
          </ElFormItem>
          <ElFormItem label="图标">
            <ElInput v-model="form.icon" maxlength="100" placeholder="ri:pages-line" />
          </ElFormItem>
          <ElFormItem label="可见范围">
            <ElSelect v-model="form.visibility">
              <ElOption label="应用市场" value="marketplace" />
              <ElOption label="租户" value="tenant" />
              <ElOption label="平台" value="platform" />
              <ElOption label="私有" value="private" />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="排序">
            <ElInputNumber v-model="form.sort" :min="0" :step="10" controls-position="right" />
          </ElFormItem>
          <ElFormItem label="SaaS 模块">
            <ElSelect
              v-model="form.saas_module_code"
              clearable
              filterable
              placeholder="可选权益模块"
            >
              <ElOption
                v-for="item in saasModuleOptions"
                :key="item.code"
                :label="`${item.name} (${item.code})`"
                :value="item.code"
              />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="系统模块">
            <ElSelect
              v-model="form.system_module_code"
              clearable
              filterable
              placeholder="可选运行守卫模块"
            >
              <ElOption
                v-for="item in systemModuleOptions"
                :key="item.code"
                :label="`${item.name} (${item.code})`"
                :value="item.code"
              />
            </ElSelect>
          </ElFormItem>
        </div>
        <ElFormItem label="简介">
          <ElInput
            v-model="form.summary"
            type="textarea"
            maxlength="255"
            show-word-limit
            :rows="2"
          />
        </ElFormItem>
        <ElFormItem v-if="form.runtime_target === 'static'" label="HTML" prop="html_content">
          <ElInput
            v-model="form.html_content"
            type="textarea"
            maxlength="200000"
            show-word-limit
            :rows="10"
            placeholder="<main><h1>Hello</h1></main>"
          />
        </ElFormItem>
        <ElFormItem v-if="form.runtime_target === 'static'" label="CSS" prop="css_content">
          <ElInput
            v-model="form.css_content"
            type="textarea"
            maxlength="100000"
            show-word-limit
            :rows="7"
            placeholder=".hero { padding: 32px; }"
          />
        </ElFormItem>
        <ElFormItem label="备注">
          <ElInput v-model="form.remark" maxlength="255" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" :icon="Check" :loading="saving" @click="saveModule">保存</ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="previewVisible" title="工厂预览" width="900px" top="6vh">
      <iframe
        class="app-factory-page__preview"
        :srcdoc="previewHtml"
        sandbox="allow-forms"
      ></iframe>
    </ElDialog>

    <ElDialog
      v-model="manifestPreviewVisible"
      :title="manifestPreviewTitle"
      width="760px"
      top="8vh"
    >
      <pre class="app-factory-page__manifest-preview">{{ manifestPreviewText }}</pre>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage, ElMessageBox } from 'element-plus'
  import type { FormInstance, FormRules } from 'element-plus'
  import {
    Check,
    Collection,
    Document,
    Edit,
    Plus,
    Promotion,
    Refresh,
    Search,
    View
  } from '@element-plus/icons-vue'
  import {
    createAppFactoryModule,
    fetchAppFactoryModule,
    fetchAppFactoryModules,
    fetchAppFactoryTemplate,
    fetchAppFactoryTemplates,
    previewAppFactoryManifest,
    publishAppFactoryModule,
    updateAppFactoryModule,
    type AppFactoryModuleRecord,
    type AppFactoryModuleStatus,
    type AppFactoryModuleVisibility,
    type AppFactoryTemplateRecord,
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
  const manifestPreviewVisible = ref(false)
  const templateDrawerVisible = ref(false)
  const loadError = ref('')
  const editingCode = ref('')
  const editLoadingCode = ref('')
  const publishingCode = ref('')
  const previewCode = ref('')
  const manifestPreviewCode = ref('')
  const applyingTemplateCode = ref('')
  const previewHtml = ref('')
  const manifestPreviewText = ref('')
  const manifestPreviewTitle = ref('生成的清单')
  const templateKeyword = ref('')
  const templateLoading = ref(false)
  const formRef = ref<FormInstance>()
  const templates = ref<AppFactoryTemplateRecord[]>([])
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
    template_code: '',
    template_version: '',
    template_schema_version: 1,
    runtime_target: 'static' as AppFactoryModuleRecord['runtime_target'],
    manifest_defaults: {} as NonNullable<AppFactoryModuleRecord['manifest_defaults']>,
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
      { required: true, message: '请输入模块编码', trigger: 'blur' },
      {
        pattern: /^[a-z][a-z0-9_]{2,79}$/,
        message: '请使用 3-80 位小写 snake_case 编码',
        trigger: 'blur'
      }
    ],
    name: [{ required: true, message: '请输入模块名称', trigger: 'blur' }]
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
      draft: '草稿',
      published: '已发布',
      disabled: '已禁用',
      archived: '已归档'
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
      template_code: '',
      template_version: '',
      template_schema_version: 1,
      runtime_target: 'static',
      manifest_defaults: {},
      category: '',
      icon: '',
      summary: '',
      description: '',
      html_content: '<main><h1>新模块</h1><p>编辑这段静态页面内容。</p></main>',
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
      template_code: row.template_code || '',
      template_version: row.template_version || '',
      template_schema_version: row.template_schema_version || 1,
      runtime_target: row.runtime_target || 'static',
      manifest_defaults: { ...(row.manifest_defaults || {}) },
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

  function fillFormFromTemplate(template: AppFactoryTemplateRecord) {
    Object.assign(form, {
      code: template.code || '',
      name: template.name || '',
      kind: 'static_page',
      template_code: template.code || '',
      template_version: template.template_version || '1.0.0',
      template_schema_version: template.schema_version || 1,
      runtime_target: template.runtime_target || 'static',
      manifest_defaults: { ...(template.manifest_defaults || {}) },
      category: template.category || '',
      icon: template.icon || '',
      summary: template.summary || '',
      description: template.description || '',
      html_content: template.html_content || '',
      css_content: template.css_content || '',
      visibility: template.default_visibility || 'marketplace',
      saas_module_code: template.default_saas_module_code || '',
      system_module_code: template.default_system_module_code || '',
      sort: 100,
      remark: ''
    })
    formRef.value?.clearValidate()
  }

  function buildPayload(): SaveAppFactoryModuleParams {
    return {
      code: cleanText(form.code),
      name: form.name.trim(),
      kind: 'static_page',
      template_code: cleanText(form.template_code),
      template_version: cleanText(form.template_version),
      template_schema_version: form.template_schema_version,
      runtime_target: form.runtime_target,
      manifest_defaults: { ...form.manifest_defaults },
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

  function templateKey(template: AppFactoryTemplateRecord) {
    return `${template.code}@${template.template_version || '1.0.0'}`
  }

  async function loadModules() {
    loading.value = true
    loadError.value = ''
    try {
      records.value = await fetchAppFactoryModules({
        keyword: cleanText(filters.keyword),
        status: filters.status || undefined
      })
    } catch {
      loadError.value = '工厂模块列表加载失败'
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
    } catch {
      saasModuleOptions.value = []
      systemModuleOptions.value = []
    }
  }

  async function loadTemplates() {
    templateLoading.value = true
    try {
      templates.value = await fetchAppFactoryTemplates({
        keyword: cleanText(templateKeyword.value),
        status: 1
      })
    } catch {
      templates.value = []
      ElMessage.error('工厂模板加载失败')
    } finally {
      templateLoading.value = false
    }
  }

  function resetFilters() {
    filters.keyword = ''
    filters.status = ''
    loadModules()
  }

  async function openTemplateDrawer() {
    templateDrawerVisible.value = true
    if (!templates.value.length) await loadTemplates()
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
      ElMessage.success('工厂模块已保存')
      dialogVisible.value = false
      await loadModules()
    } finally {
      saving.value = false
    }
  }

  async function applyTemplate(row: AppFactoryTemplateRecord) {
    applyingTemplateCode.value = templateKey(row)
    try {
      const detail = await fetchAppFactoryTemplate(row.code, row.template_version)
      editingCode.value = ''
      fillFormFromTemplate(detail)
      templateDrawerVisible.value = false
      dialogVisible.value = true
    } finally {
      applyingTemplateCode.value = ''
    }
  }

  async function publishModule(row: AppFactoryModuleRecord) {
    if (row.runtime_target === 'service') {
      ElMessage.warning('服务工厂产物必须通过应用平台审核提交')
      return
    }
    const defaultVersion = nextPatchVersion(row.latest_version)
    const result = (await ElMessageBox.prompt('版本号', `发布 ${row.name}`, {
      inputValue: defaultVersion,
      inputPattern: /^\d+\.\d+\.\d+$/,
      inputErrorMessage: '请使用语义化版本号，例如 1.0.0',
      confirmButtonText: '发布',
      cancelButtonText: '取消',
      type: 'warning'
    })) as { value: string }

    publishingCode.value = row.code
    try {
      await publishAppFactoryModule(
        row.code,
        result.value,
        `从模块工厂发布 ${row.name}`
      )
      ElMessage.success('工厂模块已发布')
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
        detail.html_content || '<p>这个工厂页面暂无内容。</p>',
        '</div>'
      ].join('\n')
      previewVisible.value = true
    } finally {
      previewCode.value = ''
    }
  }

  async function openManifestPreview(row: AppFactoryModuleRecord) {
    manifestPreviewCode.value = row.code
    try {
      const version = nextPatchVersion(row.latest_version)
      const manifest = await previewAppFactoryManifest(row.code, version)
      manifestPreviewTitle.value = `生成的清单 · ${row.code}@${version}`
      manifestPreviewText.value = JSON.stringify(manifest, null, 2)
      manifestPreviewVisible.value = true
    } finally {
      manifestPreviewCode.value = ''
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

  .app-factory-page__template-toolbar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
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

  .app-factory-page__manifest-preview {
    max-height: 62vh;
    margin: 0;
    padding: 16px;
    overflow: auto;
    border: 1px solid var(--el-border-color-light);
    border-radius: 6px;
    background: var(--el-fill-color-light);
    color: var(--el-text-color-primary);
    font-family: Consolas, Monaco, monospace;
    font-size: 13px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
  }

  @media (max-width: 820px) {
    .app-factory-page__header,
    .app-factory-page__form-grid {
      display: grid;
      grid-template-columns: 1fr;
    }

    .app-factory-page__actions,
    .app-factory-page__filter-item,
    .app-factory-page__select,
    .app-factory-page__template-toolbar {
      width: 100%;
    }

    .app-factory-page__template-toolbar {
      grid-template-columns: 1fr;
    }
  }
</style>
