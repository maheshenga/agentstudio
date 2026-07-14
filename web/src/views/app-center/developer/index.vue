<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="developer-apps-page">
      <template #header>
        <div class="developer-apps-page__header">
          <div>
            <h1 class="developer-apps-page__title">开发者应用</h1>
            <p class="developer-apps-page__subtitle">创建应用、提交版本并跟踪审核结果。</p>
          </div>
          <div class="developer-apps-page__header-actions">
            <ElButton :icon="Refresh" :loading="loading" @click="loadApps">刷新</ElButton>
            <ElButton type="primary" :icon="Plus" @click="openCreateDialog">创建应用</ElButton>
          </div>
        </div>
      </template>

      <div class="developer-apps-page__certification">
        <div>
          <div class="developer-apps-page__certification-title">
            开发者认证
            <ElTag :type="certificationTagType" effect="light">{{ certificationLabel }}</ElTag>
          </div>
          <p>{{ certificationDescription }}</p>
          <div
            v-if="profile?.approved_runtime_types.length"
            class="developer-apps-page__runtime-tags"
          >
            <ElTag
              v-for="runtime in profile.approved_runtime_types"
              :key="runtime"
              size="small"
              effect="plain"
            >
              {{ runtimeText(runtime) }}
            </ElTag>
          </div>
        </div>
        <div class="developer-apps-page__certification-actions">
          <ElButton :icon="DataLine" @click="goObservability">可观测性</ElButton>
          <ElButton
            v-if="profileError"
            type="primary"
            link
            :loading="profileLoading"
            @click="loadProfile"
          >
            重试
          </ElButton>
          <ElButton
            v-if="canApplyCertification"
            type="primary"
            :loading="profileLoading"
            @click="openCertificationDialog"
          >
            申请认证
          </ElButton>
        </div>
      </div>

      <div class="developer-apps-page__filters">
        <ElInput
          v-model="filters.keyword"
          clearable
          class="developer-apps-page__keyword"
          placeholder="应用名称或编码"
          :prefix-icon="Search"
        />
        <ElSelect
          v-model="filters.status"
          clearable
          class="developer-apps-page__status-filter"
          placeholder="应用状态"
        >
          <ElOption
            v-for="status in statusOptions"
            :key="status"
            :label="statusText(status)"
            :value="status"
          />
        </ElSelect>
        <ElButton @click="resetFilters">重置</ElButton>
      </div>

      <div v-if="loadError" class="developer-apps-page__load-error">
        <ElAlert type="error" :title="loadError" show-icon :closable="false" />
        <ElButton size="small" type="primary" link :loading="loading" @click="loadApps"
          >重试</ElButton
        >
      </div>

      <ElTable
        v-loading="loading"
        class="developer-apps-page__desktop-table"
        :data="filteredRecords"
        border
      >
        <ElTableColumn label="应用" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="developer-apps-page__app-name">{{ row.name || '-' }}</div>
            <div class="developer-apps-page__muted">{{ row.code || '-' }}</div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="应用状态" width="140">
          <template #default="{ row }">
            <ElTag :type="appStatusTagType(row.status)" effect="light">{{
              statusText(row.status)
            }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="最新版本" min-width="170">
          <template #default="{ row }">
            <div>{{ row.latest_version || '未上传版本' }}</div>
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
        <ElTableColumn label="审核结果" min-width="240" show-overflow-tooltip>
          <template #default="{ row }">
            <span
              :class="{ 'developer-apps-page__rejection': row.latest_review_status === 'rejected' }"
            >
              {{ row.latest_review_message || reviewSummary(row) }}
            </span>
          </template>
        </ElTableColumn>
        <ElTableColumn label="分类" width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.category || '-' }}</template>
        </ElTableColumn>
        <ElTableColumn label="更新时间" width="170">
          <template #default="{ row }">{{
            formatDateTime(row.update_time || row.create_time)
          }}</template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="250">
          <template #default="{ row }">
            <ElButton link type="primary" :icon="View" @click="openVersions(row)">版本</ElButton>
            <ElButton
              link
              type="primary"
              :icon="Edit"
              :disabled="!canEdit(row)"
              @click="openEditDialog(row)"
            >
              编辑
            </ElButton>
            <ElButton
              link
              type="success"
              :icon="UploadFilled"
              :disabled="!canUpload(row)"
              @click="openUploadDialog(row)"
            >
              上传版本
            </ElButton>
          </template>
        </ElTableColumn>
        <template #empty>
          <ElEmpty description="暂无开发者应用" />
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
              <span class="developer-apps-page__mobile-label">最新版本</span>
              <strong>{{ row.latest_version || '未上传版本' }}</strong>
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
            <ElButton link type="primary" :icon="View" @click="openVersions(row)">版本</ElButton>
            <ElButton
              link
              type="primary"
              :icon="Edit"
              :disabled="!canEdit(row)"
              @click="openEditDialog(row)"
            >
              编辑
            </ElButton>
            <ElButton
              link
              type="success"
              :icon="UploadFilled"
              :disabled="!canUpload(row)"
              @click="openUploadDialog(row)"
            >
              上传版本
            </ElButton>
          </div>
        </div>
        <ElEmpty v-if="!loading && !filteredRecords.length" description="暂无开发者应用" />
      </div>
    </ElCard>

    <ElDialog
      v-model="formDialogVisible"
      :title="editingCode ? '编辑应用' : '创建应用'"
      width="720px"
    >
      <ElForm ref="formRef" :model="form" :rules="formRules" label-width="112px">
        <ElFormItem v-if="!editingCode" label="运行类型" prop="runtime_type">
          <ElSegmented v-model="form.runtime_type" :options="runtimeOptions" />
        </ElFormItem>
        <ElAlert
          v-if="!editingCode && form.runtime_type === 'service'"
          type="info"
          title="服务应用需要有效的服务开发认证，并经过受限审核。"
          :closable="false"
          show-icon
          class="developer-apps-page__runtime-alert"
        />
        <template v-if="!editingCode && form.runtime_type === 'iframe'">
          <ElFormItem label="入口地址" prop="entry_url">
            <ElInput
              v-model="form.entry_url"
              maxlength="500"
              placeholder="https://example.com/app"
            />
          </ElFormItem>
          <ElFormItem label="允许访问的域名">
            <ElInput
              v-model="form.allowed_origins"
              type="textarea"
              :rows="3"
              placeholder="每行一个 HTTPS 域名，例如 https://api.example.com"
            />
          </ElFormItem>
          <ElFormItem label="申请能力">
            <ElCheckboxGroup v-model="form.requested_capabilities">
              <ElCheckbox
                v-for="capability in runtimeCapabilities"
                :key="capability"
                :value="capability"
              >
                {{ capability }}
              </ElCheckbox>
            </ElCheckboxGroup>
          </ElFormItem>
        </template>
        <div class="developer-apps-page__form-grid">
          <ElFormItem label="应用编码" prop="code">
            <ElInput
              v-model="form.code"
              :disabled="Boolean(editingCode)"
              maxlength="80"
              placeholder="creator_portal"
            />
          </ElFormItem>
          <ElFormItem label="应用名称" prop="name">
            <ElInput v-model="form.name" maxlength="120" placeholder="创作者中心" />
          </ElFormItem>
          <ElFormItem label="分类">
            <ElInput v-model="form.category" maxlength="50" placeholder="工具" />
          </ElFormItem>
          <ElFormItem label="图标">
            <ElInput v-model="form.icon" maxlength="100" placeholder="ri:code-box-line" />
          </ElFormItem>
        </div>
        <ElFormItem label="摘要">
          <ElInput
            v-model="form.summary"
            type="textarea"
            :rows="2"
            maxlength="255"
            show-word-limit
          />
        </ElFormItem>
        <ElFormItem label="详细描述">
          <ElInput
            v-model="form.description"
            type="textarea"
            :rows="5"
            maxlength="5000"
            show-word-limit
          />
        </ElFormItem>
        <ElFormItem label="截图地址">
          <ElInput
            v-model="form.screenshots"
            type="textarea"
            :rows="3"
            placeholder="每行一个 HTTPS 图片地址，最多 8 张"
          />
        </ElFormItem>
        <div class="developer-apps-page__form-grid">
          <ElFormItem label="使用文档">
            <ElInput v-model="form.documentation_url" maxlength="500" placeholder="https://" />
          </ElFormItem>
          <ElFormItem label="支持地址">
            <ElInput v-model="form.support_url" maxlength="500" placeholder="https://" />
          </ElFormItem>
        </div>
        <ElFormItem label="更新日志">
          <ElInput v-model="form.changelog" type="textarea" :rows="4" maxlength="20000" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="formDialogVisible = false">取消</ElButton>
        <ElButton type="primary" :icon="Check" :loading="saving" @click="saveApp">保存</ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="uploadDialogVisible" :title="uploadDialogTitle" width="620px">
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
        <div class="el-upload__text">
          将{{ uploadRuntimeType === 'service' ? '已构建的服务应用' : '静态应用' }} ZIP
          包拖到此处，或<em>选择文件</em>
        </div>
      </ElUpload>
      <template #footer>
        <ElButton @click="uploadDialogVisible = false">取消</ElButton>
        <ElButton
          type="primary"
          :icon="UploadFilled"
          :loading="uploading"
          :disabled="!selectedFile"
          @click="uploadVersion"
        >
          上传并提交审核
        </ElButton>
      </template>
    </ElDialog>

    <ElDrawer v-model="versionsDrawerVisible" title="版本历史" :size="versionsDrawerSize">
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
          <ElTableColumn label="版本" width="110">
            <template #default="{ row }">{{ row.version }}</template>
          </ElTableColumn>
          <ElTableColumn label="审核状态" width="120">
            <template #default="{ row }">
              <ElTag :type="reviewStatusTagType(row.review_status)" effect="light">
                {{ reviewStatusText(row.review_status) }}
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn label="发布状态" width="130">
            <template #default="{ row }">
              <ElTag :type="publishStatusTagType(row.publish_status)" effect="plain">
                {{ publishStatusText(row.publish_status) }}
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn label="审核说明" min-width="220" show-overflow-tooltip>
            <template #default="{ row }">
              <span :class="{ 'developer-apps-page__rejection': row.review_status === 'rejected' }">
                {{ row.review_message || '-' }}
              </span>
            </template>
          </ElTableColumn>
          <ElTableColumn label="自动审核" min-width="180">
            <template #default="{ row }">
              <ElTag
                v-if="row.scan_result"
                :type="row.scan_result.passed ? 'success' : 'danger'"
                effect="light"
              >
                {{ row.scan_result.passed ? '已通过' : '已阻止' }}
              </ElTag>
              <div v-if="row.scan_result?.findings?.length" class="developer-apps-page__muted">
                发现 {{ row.scan_result.findings.length }} 个问题
              </div>
              <span v-else-if="!row.scan_result" class="developer-apps-page__muted">-</span>
            </template>
          </ElTableColumn>
          <ElTableColumn label="冻结快照" min-width="180">
            <template #default="{ row }">
              <ElTag v-if="row.review_snapshot_hash" type="info" effect="plain">已冻结</ElTag>
              <div class="developer-apps-page__hash" :title="row.review_snapshot_hash || ''">
                {{ shortHash(row.review_snapshot_hash) }}
              </div>
            </template>
          </ElTableColumn>
          <ElTableColumn label="安装包" min-width="180">
            <template #default="{ row }">
              <div>{{ formatFileSize(row.file_size) }}</div>
              <div class="developer-apps-page__hash" :title="row.file_hash || ''">{{
                shortHash(row.file_hash)
              }}</div>
            </template>
          </ElTableColumn>
          <ElTableColumn label="创建时间" width="170">
            <template #default="{ row }">{{ formatDateTime(row.create_time) }}</template>
          </ElTableColumn>
          <ElTableColumn label="操作" width="110">
            <template #default="{ row }">
              <ElButton
                v-if="row.review_status === 'rejected'"
                link
                type="primary"
                :icon="RefreshRight"
                :loading="resubmittingVersion === row.version"
                @click="resubmitVersion(row)"
              >
                重新提交
              </ElButton>
              <span v-else class="developer-apps-page__muted">-</span>
            </template>
          </ElTableColumn>
          <template #empty>
            <ElEmpty description="暂无已上传版本" />
          </template>
        </ElTable>
      </template>
    </ElDrawer>

    <ElDialog v-model="certificationDialogVisible" title="开发者认证" width="640px">
      <ElForm label-width="150px">
        <ElFormItem label="显示名称" required>
          <ElInput v-model="certificationForm.display_name" maxlength="100" />
        </ElFormItem>
        <ElFormItem label="HTTPS 网站">
          <ElInput
            v-model="certificationForm.website"
            maxlength="255"
            placeholder="https://example.com"
          />
        </ElFormItem>
        <ElFormItem label="申请运行类型" required>
          <ElCheckboxGroup v-model="certificationForm.requested_runtime_types">
            <ElCheckbox
              v-for="runtime in certificationRuntimeTypes"
              :key="runtime"
              :value="runtime"
            >
              {{ runtimeText(runtime) }}
            </ElCheckbox>
          </ElCheckboxGroup>
        </ElFormItem>
        <ElFormItem label="申请说明" required>
          <ElInput
            v-model="certificationForm.statement"
            type="textarea"
            :rows="5"
            minlength="20"
            maxlength="2000"
            show-word-limit
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="certificationDialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="applyingCertification" @click="submitCertification">
          提交申请
        </ElButton>
      </template>
    </ElDialog>
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
    DataLine,
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
  import {
    applyDeveloperCertification,
    fetchOwnDeveloperProfile,
    type DeveloperCertificationProfile,
    type DeveloperRuntimeType
  } from '@/api/app-developer-certification'
  import type {
    AppPackageDetailRecord,
    AppPackageStatus,
    AppPackageVersionRecord
  } from '@/api/app-marketplace'
  import {
    appStatusTagType,
    appStatusText as statusText,
    appTypeText as runtimeText,
    cleanOptionalText as cleanText,
    developerReviewSummary as reviewSummary,
    formatAppBytes as formatFileSize,
    formatAppDateTime as formatDateTime,
    publishStatusTagType,
    publishStatusText,
    reviewStatusTagType,
    reviewStatusText
  } from '@/views/app-platform/shared/app-display'

  defineOptions({ name: 'AppCenterDeveloperPage' })

  const router = useRouter()
  const records = ref<DeveloperAppRecord[]>([])
  const selectedApp = ref<AppPackageDetailRecord>()
  const profile = ref<DeveloperCertificationProfile | null>(null)
  const loading = ref(false)
  const profileLoading = ref(false)
  const saving = ref(false)
  const uploading = ref(false)
  const applyingCertification = ref(false)
  const detailLoading = ref(false)
  const loadError = ref('')
  const profileError = ref('')
  const detailError = ref('')
  const editingCode = ref('')
  const uploadAppCode = ref('')
  const uploadAppName = ref('')
  const uploadRuntimeType = ref<'static' | 'service'>('static')
  const resubmittingVersion = ref('')
  const formDialogVisible = ref(false)
  const uploadDialogVisible = ref(false)
  const certificationDialogVisible = ref(false)
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
    runtime_type: 'static' as DeveloperRuntimeType,
    category: '',
    icon: '',
    summary: '',
    description: '',
    entry_url: '',
    allowed_origins: '',
    requested_capabilities: [] as string[],
    screenshots: '',
    documentation_url: '',
    support_url: '',
    changelog: ''
  })
  const runtimeCapabilities = [
    'context.read',
    'kv.read',
    'kv.write',
    'kv.delete',
    'files.read',
    'files.write',
    'http.request',
    'webhook.emit'
  ]
  const certificationRuntimeTypes: DeveloperRuntimeType[] = ['static', 'iframe', 'service']
  const certificationForm = reactive({
    display_name: '',
    website: '',
    statement: '',
    requested_runtime_types: ['static'] as DeveloperRuntimeType[]
  })
  const formRules: FormRules = {
    code: [
      { required: true, message: '请输入应用编码', trigger: 'blur' },
      {
        pattern: /^[a-z][a-z0-9_]{2,79}$/,
        message: '请输入 3-80 位小写 snake_case 编码',
        trigger: 'blur'
      }
    ],
    name: [{ required: true, message: '请输入应用名称', trigger: 'blur' }]
  }
  const { width: viewportWidth } = useWindowSize()
  const versionsDrawerSize = computed(() => (viewportWidth.value <= 800 ? '100%' : '920px'))
  function runtimeApproved(runtimeType: DeveloperRuntimeType) {
    return Boolean(
      !profileError.value &&
      profile.value?.certification_status === 'certified' &&
      !profile.value.disabled &&
      profile.value.approved_runtime_types.includes(runtimeType)
    )
  }
  const staticRuntimeApproved = computed(() => runtimeApproved('static'))
  const iframeRuntimeApproved = computed(() => runtimeApproved('iframe'))
  const serviceRuntimeApproved = computed(() => runtimeApproved('service'))
  const runtimeOptions = computed(() => [
    { label: '静态应用', value: 'static', disabled: !staticRuntimeApproved.value },
    { label: '外部应用', value: 'iframe', disabled: !iframeRuntimeApproved.value },
    { label: '服务应用', value: 'service', disabled: !serviceRuntimeApproved.value }
  ])
  const uploadDialogTitle = computed(() =>
    uploadRuntimeType.value === 'service' ? '上传服务应用版本' : '上传静态应用版本'
  )
  const canApplyCertification = computed(
    () =>
      !profileLoading.value &&
      !profileError.value &&
      (!profile.value ||
        profile.value.certification_status === 'rejected' ||
        profile.value.certification_status === 'expired')
  )
  const certificationLabel = computed(() => {
    if (profileLoading.value) return '加载中'
    if (profileError.value) return '暂不可用'
    if (!profile.value) return '未申请'
    if (profile.value.disabled) return '已禁用'
    const labels: Record<string, string> = {
      pending: '待审核',
      certified: '已认证',
      rejected: '已驳回',
      expired: '已过期'
    }
    return labels[profile.value.certification_status] || profile.value.certification_status
  })
  const certificationDescription = computed(() => {
    if (profileLoading.value) return '正在加载认证状态。'
    if (profileError.value) return profileError.value
    if (!profile.value) return '当前可提交静态应用；申请认证后可提交受限的服务应用。'
    if (profile.value.disabled) return profile.value.review_message || '开发者认证已禁用。'
    if (profile.value.certification_status === 'pending') return '认证申请正在等待平台审核。'
    if (profile.value.certification_status === 'certified') {
      return `已批准运行类型：${profile.value.approved_runtime_types.map(runtimeText).join('、') || '-'}`
    }
    return profile.value.review_message || '请更新申请信息后重新提交。'
  })
  const certificationTagType = computed(() => {
    if (profileError.value) return 'danger'
    if (profile.value?.disabled || profile.value?.certification_status === 'rejected')
      return 'danger'
    if (profile.value?.certification_status === 'certified') return 'success'
    if (profile.value?.certification_status === 'pending') return 'warning'
    return 'info'
  })

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

  function shortHash(value?: string) {
    return value ? `${value.slice(0, 12)}...` : '-'
  }

  function canEdit(row: DeveloperAppRecord) {
    return row.status === 'draft' || row.status === 'rejected'
  }

  function canUpload(row: DeveloperAppRecord) {
    if (row.status === 'disabled' || row.status === 'archived') return false
    if (row.type === 'iframe' || row.type === 'internal') return false
    return runtimeApproved(row.type)
  }

  function resetFilters() {
    filters.keyword = ''
    filters.status = ''
  }

  function resetForm() {
    Object.assign(form, {
      code: '',
      name: '',
      runtime_type: 'static',
      category: '',
      icon: '',
      summary: '',
      description: '',
      entry_url: '',
      allowed_origins: '',
      requested_capabilities: [],
      screenshots: '',
      documentation_url: '',
      support_url: '',
      changelog: ''
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
      loadError.value = '开发者应用加载失败'
      ElMessage.error(loadError.value)
    } finally {
      loading.value = false
    }
  }

  async function loadProfile() {
    profileLoading.value = true
    profileError.value = ''
    profile.value = null
    try {
      profile.value = await fetchOwnDeveloperProfile()
    } catch {
      profileError.value = '开发者认证状态加载失败，请重试后再申请。'
    } finally {
      profileLoading.value = false
    }
  }

  function openCreateDialog() {
    editingCode.value = ''
    resetForm()
    form.runtime_type =
      certificationRuntimeTypes.find((runtimeType) => runtimeApproved(runtimeType)) || 'static'
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
      description: row.description || '',
      screenshots: (row.screenshots || []).join('\n'),
      documentation_url: row.documentation_url || '',
      support_url: row.support_url || '',
      changelog: row.changelog || ''
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
      description: cleanText(form.description),
      screenshots: form.screenshots
        .split(/\r?\n/)
        .map((value) => value.trim())
        .filter(Boolean),
      documentation_url: cleanText(form.documentation_url),
      support_url: cleanText(form.support_url),
      changelog: cleanText(form.changelog)
    }
    saving.value = true
    try {
      if (editingCode.value) {
        await updateDeveloperApp(editingCode.value, params)
        ElMessage.success('应用已更新')
      } else {
        if (!runtimeApproved(form.runtime_type)) {
          return ElMessage.warning('当前开发者认证未批准所选运行类型')
        }
        if (form.runtime_type === 'iframe' && !form.entry_url.trim()) {
          return ElMessage.warning('请输入外部应用入口地址')
        }
        const runtimeParams: Pick<SaveDeveloperAppParams, 'runtime_type'> &
          Partial<SaveDeveloperAppParams> = {
          runtime_type: form.runtime_type,
          ...(form.runtime_type === 'iframe'
            ? {
                entry_url: form.entry_url.trim(),
                allowed_origins: form.allowed_origins
                  .split(/\r?\n/)
                  .map((value) => value.trim())
                  .filter(Boolean),
                requested_capabilities: [...form.requested_capabilities]
              }
            : {})
        }
        await createDeveloperApp({ ...params, ...runtimeParams, code: form.code.trim() })
        ElMessage.success('应用已创建')
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
      detailError.value = '版本历史加载失败'
      ElMessage.error(detailError.value)
    } finally {
      detailLoading.value = false
    }
  }

  function openUploadDialog(row: DeveloperAppRecord) {
    if (!canUpload(row)) return
    uploadAppCode.value = row.code
    uploadAppName.value = row.name
    uploadRuntimeType.value = row.type === 'service' ? 'service' : 'static'
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
      ElMessage.success('版本已提交审核')
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
      `确认重新提交 ${selectedApp.value.name} ${version.version} 进行审核吗？`,
      '重新提交版本',
      {
        type: 'warning',
        confirmButtonText: '重新提交',
        cancelButtonText: '取消'
      }
    )
    resubmittingVersion.value = version.version
    try {
      await submitDeveloperAppVersion(selectedApp.value.code, version.version)
      ElMessage.success('版本已重新提交')
      const code = selectedApp.value.code
      selectedApp.value = await fetchDeveloperApp(code)
      await loadApps()
    } finally {
      resubmittingVersion.value = ''
    }
  }

  function goObservability() {
    router.push('/app-center/developer-runtime')
  }

  function openCertificationDialog() {
    if (profileLoading.value || profileError.value) return
    Object.assign(certificationForm, {
      display_name: profile.value?.display_name || '',
      website: profile.value?.website || '',
      statement: profile.value?.statement || '',
      requested_runtime_types: profile.value?.requested_runtime_types?.length
        ? [...profile.value.requested_runtime_types]
        : ['static', 'service']
    })
    certificationDialogVisible.value = true
  }

  async function submitCertification() {
    const displayName = certificationForm.display_name.trim()
    const statement = certificationForm.statement.trim()
    if (displayName.length < 2 || statement.length < 20) {
      ElMessage.warning('请输入显示名称和至少 20 个字符的申请说明')
      return
    }
    if (!certificationForm.requested_runtime_types.length) {
      ElMessage.warning('请至少选择一种运行类型')
      return
    }
    applyingCertification.value = true
    try {
      profile.value = await applyDeveloperCertification({
        display_name: displayName,
        website: certificationForm.website.trim() || undefined,
        statement,
        requested_runtime_types: certificationForm.requested_runtime_types
      })
      certificationDialogVisible.value = false
      ElMessage.success('开发者认证申请已提交')
    } finally {
      applyingCertification.value = false
    }
  }

  onMounted(() => {
    Promise.all([loadApps(), loadProfile()])
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

  .developer-apps-page__certification,
  .developer-apps-page__certification-title,
  .developer-apps-page__certification-actions,
  .developer-apps-page__runtime-tags {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .developer-apps-page__certification {
    justify-content: space-between;
    margin-bottom: 16px;
    padding: 14px 16px;
    border: 1px solid var(--el-border-color-lighter);
    background: var(--el-fill-color-extra-light);
  }

  .developer-apps-page__certification-title {
    font-weight: 600;
  }

  .developer-apps-page__certification p {
    margin: 5px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  .developer-apps-page__runtime-tags {
    flex-wrap: wrap;
    margin-top: 8px;
  }

  .developer-apps-page__runtime-alert {
    margin-bottom: 16px;
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
    .developer-apps-page__certification,
    .developer-apps-page__form-grid {
      display: grid;
      grid-template-columns: 1fr;
    }

    .developer-apps-page__header-actions,
    .developer-apps-page__certification-actions,
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
