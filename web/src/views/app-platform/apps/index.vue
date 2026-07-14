<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="app-platform-page">
      <template #header>
        <div class="app-platform-page__header">
          <div>
            <h1 class="app-platform-page__title">应用平台</h1>
            <p class="app-platform-page__subtitle"
              >管理应用市场、审核版本、服务发布和租户可用范围。</p
            >
          </div>
          <div class="app-platform-page__actions">
            <ElButton :icon="Refresh" :loading="loading" @click="loadApps">刷新</ElButton>
            <ElButton type="primary" :icon="Plus" @click="openCreateDialog">创建应用</ElButton>
          </div>
        </div>
      </template>

      <div class="app-platform-page__filters">
        <ElInput
          v-model="filters.keyword"
          clearable
          class="app-platform-page__filter-item"
          placeholder="编码、名称或分类"
          @keyup.enter="loadApps"
        />
        <ElSelect
          v-model="filters.type"
          clearable
          class="app-platform-page__select"
          placeholder="应用类型"
        >
          <ElOption label="内置页面" value="internal" />
          <ElOption label="静态应用" value="static" />
          <ElOption label="外部应用" value="iframe" />
          <ElOption label="服务应用" value="service" />
        </ElSelect>
        <ElSelect
          v-model="filters.status"
          clearable
          class="app-platform-page__select"
          placeholder="应用状态"
        >
          <ElOption
            v-for="item in statusOptions"
            :key="item"
            :label="statusText(item)"
            :value="item"
          />
        </ElSelect>
        <ElButton type="primary" :icon="Search" :loading="loading" @click="loadApps">查询</ElButton>
        <ElButton @click="resetFilters">重置</ElButton>
      </div>

      <div v-if="loadError" class="app-platform-page__load-error">
        <ElAlert type="error" :title="loadError" show-icon :closable="false" />
        <ElButton size="small" type="primary" link :loading="loading" @click="loadApps"
          >重试</ElButton
        >
      </div>

      <ElTable v-loading="loading" :data="records" border>
        <ElTableColumn label="应用" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="app-platform-page__app-name">{{ row.name || '-' }}</div>
            <div class="app-platform-page__app-code">{{ row.code || '-' }}</div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="类型" width="120">
          <template #default="{ row }">
            <ElTag :type="typeTagType(row.type)" effect="light">{{ typeText(row.type) }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="category" label="分类" width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.category || '-' }}</template>
        </ElTableColumn>
        <ElTableColumn label="状态" width="140">
          <template #default="{ row }">
            <ElTag :type="statusTagType(row.status)" effect="light">{{
              statusText(row.status)
            }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="可见范围" width="130">
          <template #default="{ row }">{{ visibilityText(row.visibility) }}</template>
        </ElTableColumn>
        <ElTableColumn label="入口" min-width="240" show-overflow-tooltip>
          <template #default="{ row }">{{
            row.type === 'service' ? '平台托管运行时' : row.entry_url || '-'
          }}</template>
        </ElTableColumn>
        <ElTableColumn prop="sort" label="排序" width="80" />
        <ElTableColumn label="更新时间" width="170">
          <template #default="{ row }">{{ formatDateTime(row.update_time) }}</template>
        </ElTableColumn>
        <ElTableColumn label="操作" fixed="right" width="330">
          <template #default="{ row }">
            <ElButton link type="primary" :icon="Edit" @click="openEditDialog(row)">编辑</ElButton>
            <ElButton
              link
              type="primary"
              :icon="View"
              :loading="detailLoadingCode === row.code"
              @click="openDetail(row)"
            >
              版本
            </ElButton>
            <ElUpload
              v-if="row.type === 'static' || row.type === 'service'"
              accept=".zip"
              :auto-upload="false"
              :show-file-list="false"
              :on-change="(file) => handlePackageSelected(row, file)"
            >
              <ElButton link type="primary" :icon="Upload" :loading="uploadingCode === row.code"
                >上传</ElButton
              >
            </ElUpload>
            <ElButton
              v-if="row.status === 'published' || row.status === 'disabled'"
              link
              :type="row.status === 'disabled' ? 'success' : 'warning'"
              :icon="row.status === 'disabled' ? CircleCheck : CircleClose"
              @click="toggleStatus(row)"
            >
              {{ row.status === 'disabled' ? '启用' : '禁用' }}
            </ElButton>
          </template>
        </ElTableColumn>
        <template #empty>
          <ElEmpty description="暂无应用" />
        </template>
      </ElTable>
    </ElCard>

    <ElDialog v-model="dialogVisible" :title="editingCode ? '编辑应用' : '创建应用'" width="680px">
      <ElForm ref="appFormRef" :model="appForm" :rules="appRules" label-width="124px">
        <ElFormItem label="应用编码" prop="code">
          <ElInput
            v-model="appForm.code"
            :disabled="Boolean(editingCode)"
            maxlength="80"
            placeholder="job_board"
          />
        </ElFormItem>
        <ElFormItem label="应用名称" prop="name">
          <ElInput v-model="appForm.name" maxlength="120" />
        </ElFormItem>
        <ElFormItem label="应用类型" prop="type">
          <ElSegmented
            v-model="appForm.type"
            :disabled="Boolean(editingCode)"
            :options="[
              { label: '内置页面', value: 'internal' },
              { label: '静态应用', value: 'static' },
              { label: '外部应用', value: 'iframe' },
              { label: '服务应用', value: 'service' }
            ]"
          />
        </ElFormItem>
        <ElFormItem v-if="appForm.type !== 'service'" label="入口地址" prop="entry_url">
          <ElInput
            v-model="appForm.entry_url"
            maxlength="500"
            placeholder="/tenant-saas/members or https://example.com"
          />
        </ElFormItem>
        <ElFormItem v-else label="运行时可信级别">
          <div class="app-platform-page__trust-copy">
            <ElTag type="success" effect="light">平台可信</ElTag>
            <span>审核通过的服务包将在平台隔离运行时中执行。</span>
          </div>
        </ElFormItem>
        <ElFormItem label="可见范围">
          <ElSelect v-model="appForm.visibility" :disabled="appForm.type === 'service'">
            <ElOption label="应用市场" value="marketplace" />
            <ElOption label="租户可见" value="tenant" />
            <ElOption label="平台可见" value="platform" />
            <ElOption label="私有" value="private" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="分类">
          <ElInput v-model="appForm.category" maxlength="50" />
        </ElFormItem>
        <ElFormItem label="图标">
          <ElInput v-model="appForm.icon" maxlength="100" placeholder="ri:apps-line" />
        </ElFormItem>
        <ElFormItem label="开发者">
          <ElInput v-model="appForm.developer_name" maxlength="100" />
        </ElFormItem>
        <ElFormItem label="SaaS 套餐模块">
          <ElSelect
            v-model="appForm.saas_module_code"
            clearable
            filterable
            placeholder="可选，用于套餐权益校验"
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
            v-model="appForm.system_module_code"
            clearable
            filterable
            placeholder="可选，用于运行时访问控制"
          >
            <ElOption
              v-for="item in systemModuleOptions"
              :key="item.code"
              :label="`${item.name} (${item.code})`"
              :value="item.code"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="排序">
          <ElInputNumber v-model="appForm.sort" :min="0" :step="10" controls-position="right" />
        </ElFormItem>
        <ElFormItem label="摘要">
          <ElInput v-model="appForm.summary" type="textarea" maxlength="255" show-word-limit />
        </ElFormItem>
        <ElFormItem label="详细描述">
          <ElInput v-model="appForm.description" type="textarea" maxlength="1000" show-word-limit />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" :icon="Check" :loading="saving" @click="saveApp">保存</ElButton>
      </template>
    </ElDialog>

    <ElDrawer v-model="detailVisible" title="应用版本" size="860px">
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
          title="上传静态应用 ZIP 包后即可发起审核。"
          show-icon
          :closable="false"
        />
        <ElAlert
          v-else-if="selectedDetail.type === 'service' && !selectedDetail.versions.length"
          type="info"
          title="上传服务应用 ZIP 包后将自动扫描并发起审核。"
          show-icon
          :closable="false"
        />

        <ElTable :data="selectedDetail.versions" border>
          <ElTableColumn label="版本" width="140">
            <template #default="{ row }">
              <div class="app-platform-page__version">
                <span>{{ row.version }}</span>
                <ElTag v-if="row.is_active" size="small" type="success" effect="light"
                  >当前版本</ElTag
                >
              </div>
            </template>
          </ElTableColumn>
          <ElTableColumn label="审核状态" width="120">
            <template #default="{ row }">
              <ElTag :type="reviewTagType(row.review_status)" effect="light">{{
                reviewText(row.review_status)
              }}</ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn label="发布状态" width="130">
            <template #default="{ row }">
              <ElTag :type="publishTagType(row.publish_status)" effect="light">{{
                publishText(row.publish_status)
              }}</ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn
            v-if="selectedDetail.type !== 'service'"
            prop="entry_file"
            label="入口文件"
            min-width="180"
            show-overflow-tooltip
          />
          <ElTableColumn
            v-if="selectedDetail.type !== 'service'"
            prop="entry_url"
            label="运行地址"
            min-width="220"
            show-overflow-tooltip
          />
          <ElTableColumn v-else label="扫描结果" min-width="190">
            <template #default="{ row }">
              <div class="app-platform-page__scan-status">
                <ElTag :type="scanTagType(row.scan_result)" effect="light">{{
                  scanStatusText(row.scan_result)
                }}</ElTag>
                <span v-if="row.scan_result">已扫描 {{ row.scan_result.scannedFiles }} 个文件</span>
              </div>
            </template>
          </ElTableColumn>
          <ElTableColumn
            prop="review_message"
            label="审核说明"
            min-width="160"
            show-overflow-tooltip
          >
            <template #default="{ row }">{{ row.review_message || '-' }}</template>
          </ElTableColumn>
          <ElTableColumn label="操作" fixed="right" width="260">
            <template #default="{ row }">
              <ElButton
                v-if="selectedDetail.type !== 'service'"
                link
                type="primary"
                :icon="Promotion"
                :disabled="row.review_status !== 'approved' || row.publish_status === 'published'"
                @click="publishVersion(row.version)"
              >
                发布
              </ElButton>
              <ElButton
                v-if="selectedDetail.type !== 'service'"
                link
                type="warning"
                :loading="versionGovernanceLoading === `rollback:${row.version}`"
                :disabled="row.review_status !== 'approved' || !row.publish_path || row.is_active"
                @click="versionGovernance(row.version, 'rollback')"
              >
                回滚
              </ElButton>
              <ElButton
                v-if="selectedDetail.type !== 'service'"
                link
                type="danger"
                :loading="versionGovernanceLoading === `unpublish:${row.version}`"
                :disabled="row.publish_status !== 'published'"
                @click="versionGovernance(row.version, 'unpublish')"
              >
                下线
              </ElButton>
            </template>
          </ElTableColumn>
          <template #empty>
            <ElEmpty description="暂无版本" />
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
  import {
    appStatusTagType as statusTagType,
    appStatusText as statusText,
    appTypeTagType as typeTagType,
    appTypeText as typeText,
    appVisibilityText as visibilityText,
    cleanOptionalText as cleanText,
    formatAppDateTime as formatDateTime,
    publishStatusTagType as publishTagType,
    publishStatusText as publishText,
    reviewStatusTagType as reviewTagType,
    reviewStatusText as reviewText,
    scanStatusTagType as scanTagType,
    scanStatusText
  } from '../shared/app-display'

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
      { required: true, message: '请输入应用编码', trigger: 'blur' },
      {
        pattern: /^[a-z][a-z0-9_]{2,79}$/,
        message: '请输入 3-80 位小写 snake_case 编码',
        trigger: 'blur'
      }
    ],
    name: [{ required: true, message: '请输入应用名称', trigger: 'blur' }],
    type: [{ required: true, message: '请选择应用类型', trigger: 'change' }]
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
      loadError.value = '应用列表加载失败'
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
      ElMessage.success('应用已保存')
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
          `服务包已上传，扫描结果：${scanStatusText(version.scan_result)}，共 ${scannedFiles} 个文件。`
        )
      } else {
        ElMessage.success('安装包已上传并提交审核')
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
    ElMessage.success('版本已发布')
    await refreshSelectedDetail()
    await loadApps()
  }

  async function versionGovernance(version: string, action: 'rollback' | 'unpublish') {
    if (!selectedDetail.value) return
    const actionText = action === 'rollback' ? '回滚' : '下线'
    const { value } = await ElMessageBox.prompt(
      `请输入${actionText}版本 ${version} 的原因`,
      actionText,
      {
        confirmButtonText: actionText,
        cancelButtonText: '取消',
        inputPlaceholder: action === 'rollback' ? '恢复稳定版本' : '下线不安全或已过时版本',
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
      ElMessage.success(`${actionText}操作已完成`)
      await refreshSelectedDetail()
      await loadApps()
    } finally {
      versionGovernanceLoading.value = ''
    }
  }

  async function toggleStatus(row: AppPackageRecord) {
    const nextStatus: AppPackageStatus = row.status === 'disabled' ? 'published' : 'disabled'
    await ElMessageBox.confirm(
      `确认将 ${row.name} 设为“${statusText(nextStatus)}”吗？`,
      '更新应用状态',
      {
        type: nextStatus === 'disabled' ? 'warning' : 'info',
        confirmButtonText: '确认',
        cancelButtonText: '取消'
      }
    )
    await updatePlatformAppStatus(row.code, nextStatus)
    ElMessage.success(`应用已设为“${statusText(nextStatus)}”`)
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
