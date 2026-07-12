<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="app-review-page">
      <template #header>
        <div class="app-review-page__header">
          <div>
            <h1 class="app-review-page__title">Review Center</h1>
            <p class="app-review-page__subtitle"
              >Review, publish, unpublish, and rollback app versions from one operations queue.</p
            >
          </div>
          <ElButton :icon="Refresh" :loading="loading" @click="loadReviews">Refresh</ElButton>
        </div>
      </template>

      <div class="app-review-page__filters">
        <ElInput
          v-model="filters.keyword"
          clearable
          class="app-review-page__filter-item"
          placeholder="App, version, developer"
          @keyup.enter="loadReviews"
        />
        <ElSelect
          v-model="filters.type"
          clearable
          class="app-review-page__select"
          placeholder="Type"
        >
          <ElOption label="Internal" value="internal" />
          <ElOption label="Static" value="static" />
          <ElOption label="Iframe" value="iframe" />
          <ElOption label="Service" value="service" />
        </ElSelect>
        <ElSelect
          v-model="filters.review_status"
          clearable
          class="app-review-page__select"
          placeholder="Review"
        >
          <ElOption label="Pending" value="pending" />
          <ElOption label="Approved" value="approved" />
          <ElOption label="Rejected" value="rejected" />
        </ElSelect>
        <ElSelect
          v-model="filters.publish_status"
          clearable
          class="app-review-page__select"
          placeholder="Publish"
        >
          <ElOption label="Unpublished" value="unpublished" />
          <ElOption label="Published" value="published" />
          <ElOption label="Failed" value="failed" />
          <ElOption label="Retired" value="unpublished_retired" />
        </ElSelect>
        <ElButton type="primary" :icon="Search" :loading="loading" @click="loadReviews"
          >Search</ElButton
        >
        <ElButton @click="resetFilters">Reset</ElButton>
      </div>

      <div v-if="loadError" class="app-review-page__load-error">
        <ElAlert type="error" :title="loadError" show-icon :closable="false" />
        <ElButton size="small" type="primary" link :loading="loading" @click="loadReviews"
          >Retry</ElButton
        >
      </div>

      <ElTable v-loading="loading" :data="records" border>
        <ElTableColumn label="App" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="app-review-page__app-name">{{ row.app_name || '-' }}</div>
            <div class="app-review-page__muted">{{ row.app_code || '-' }}</div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="Version" width="140">
          <template #default="{ row }">
            <div class="app-review-page__version">
              <span>{{ row.version }}</span>
              <ElTag v-if="row.is_active" size="small" type="success" effect="light">Active</ElTag>
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="Type" width="110">
          <template #default="{ row }">
            <ElTag :type="typeTagType(row.app_type)" effect="light">{{
              typeText(row.app_type)
            }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="Review" width="120">
          <template #default="{ row }">
            <ElTag :type="reviewTagType(row.review_status)" effect="light">{{
              row.review_status
            }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="Publish" width="140">
          <template #default="{ row }">
            <ElTag :type="publishTagType(row.publish_status)" effect="light">{{
              row.publish_status
            }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="Developer" width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ row.developer_name || '-' }}</template>
        </ElTableColumn>
        <ElTableColumn label="Capabilities" min-width="180">
          <template #default="{ row }">
            <div v-if="row.requested_capabilities?.length" class="app-review-page__capabilities">
              <ElTag
                v-for="capability in row.requested_capabilities"
                :key="capability"
                size="small"
                effect="plain"
              >
                {{ capabilityLabel(capability) }}
              </ElTag>
            </div>
            <span v-else class="app-review-page__muted">None</span>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="entry_url" label="Runtime URL" min-width="240" show-overflow-tooltip />
        <ElTableColumn label="Updated" width="170">
          <template #default="{ row }">{{
            formatDateTime(row.update_time || row.create_time)
          }}</template>
        </ElTableColumn>
        <ElTableColumn label="Actions" fixed="right" width="500">
          <template #default="{ row }">
            <ElButton link :icon="View" @click="openEvidence(row)">Evidence</ElButton>
            <ElButton
              link
              type="success"
              :loading="actionLoading === `approve:${row.app_code}:${row.version}`"
              :disabled="row.review_status !== 'pending'"
              @click="reviewVersion(row, 'approve')"
            >
              Approve
            </ElButton>
            <ElButton
              link
              type="warning"
              :loading="actionLoading === `reject:${row.app_code}:${row.version}`"
              :disabled="row.review_status !== 'pending'"
              @click="reviewVersion(row, 'reject')"
            >
              Reject
            </ElButton>
            <ElButton
              link
              type="primary"
              :loading="actionLoading === `publish:${row.app_code}:${row.version}`"
              :disabled="
                row.app_type === 'service' ||
                row.review_status !== 'approved' ||
                row.publish_status === 'published'
              "
              @click="publishVersion(row)"
            >
              Publish
            </ElButton>
            <ElButton
              link
              type="warning"
              :loading="actionLoading === `rollback:${row.app_code}:${row.version}`"
              :disabled="row.review_status !== 'approved' || !row.publish_path || row.is_active"
              @click="versionGovernance(row, 'rollback')"
            >
              Rollback
            </ElButton>
            <ElButton
              link
              type="danger"
              :loading="actionLoading === `unpublish:${row.app_code}:${row.version}`"
              :disabled="row.publish_status !== 'published'"
              @click="versionGovernance(row, 'unpublish')"
            >
              Unpublish
            </ElButton>
          </template>
        </ElTableColumn>
        <template #empty>
          <ElEmpty description="No app versions in the review queue" />
        </template>
      </ElTable>
    </ElCard>

    <ElDialog v-model="approvalDialogVisible" title="Approve capabilities" width="520px">
      <ElAlert
        type="info"
        title="Only selected capabilities will be available for tenant consent."
        :closable="false"
        show-icon
      />
      <ElCheckboxGroup v-model="approved_capabilities" class="app-review-page__capability-options">
        <ElCheckbox
          v-for="capability in approvalRow?.requested_capabilities || []"
          :key="capability"
          :value="capability"
        >
          {{ capabilityLabel(capability) }}
        </ElCheckbox>
      </ElCheckboxGroup>
      <ElInput
        v-model="approvalMessage"
        type="textarea"
        :rows="3"
        maxlength="500"
        show-word-limit
      />
      <template #footer>
        <ElButton @click="approvalDialogVisible = false">Cancel</ElButton>
        <ElButton
          type="primary"
          :loading="Boolean(actionLoading)"
          @click="confirmCapabilityApproval"
          >Approve</ElButton
        >
      </template>
    </ElDialog>

    <ElDrawer
      v-model="evidenceDrawerVisible"
      :title="evidenceTitle"
      size="min(760px, 96vw)"
      destroy-on-close
    >
      <ElAlert
        v-if="!evidenceSnapshot"
        type="warning"
        title="Frozen review evidence is unavailable"
        :closable="false"
        show-icon
      />
      <template v-else>
        <section class="app-review-page__evidence-section">
          <h2>Review integrity</h2>
          <ElDescriptions :column="2" border>
            <ElDescriptionsItem label="Trust">
              <ElTag type="warning" effect="light">{{ evidenceRow?.trust_level }}</ElTag>
            </ElDescriptionsItem>
            <ElDescriptionsItem label="Submission">{{
              formatDateTime(evidenceSnapshot.submitted_at)
            }}</ElDescriptionsItem>
            <ElDescriptionsItem label="Snapshot SHA-256" :span="2">
              <code>{{ evidenceRow?.review_snapshot_hash || '-' }}</code>
            </ElDescriptionsItem>
            <ElDescriptionsItem label="Package SHA-256" :span="2">
              <code>{{ evidenceSnapshot.version.package_sha256 }}</code>
            </ElDescriptionsItem>
            <ElDescriptionsItem label="Entry SHA-256" :span="2">
              <code>{{ evidenceSnapshot.version.entry_sha256 }}</code>
            </ElDescriptionsItem>
            <ElDescriptionsItem label="Manual review">
              <ElTag :type="manualReviewTagType">{{ manualReviewStatus }}</ElTag>
            </ElDescriptionsItem>
            <ElDescriptionsItem label="Candidate review">
              <ElTag :type="candidateReviewTagType">{{ candidateReviewStatus }}</ElTag>
            </ElDescriptionsItem>
          </ElDescriptions>
        </section>

        <section class="app-review-page__evidence-section">
          <h2>Submission snapshot</h2>
          <ElDescriptions :column="2" border>
            <ElDescriptionsItem label="Application">{{
              evidenceSnapshot.app.name
            }}</ElDescriptionsItem>
            <ElDescriptionsItem label="Code"
              ><code>{{ evidenceSnapshot.app.code }}</code></ElDescriptionsItem
            >
            <ElDescriptionsItem label="Developer">{{
              evidenceSnapshot.app.developer_name
            }}</ElDescriptionsItem>
            <ElDescriptionsItem label="Profile"
              ><code>{{ evidenceSnapshot.developer.profile_id }}</code></ElDescriptionsItem
            >
            <ElDescriptionsItem label="Risk">{{
              evidenceSnapshot.developer.risk_level
            }}</ElDescriptionsItem>
            <ElDescriptionsItem label="Certification expires">
              {{ formatDateTime(evidenceSnapshot.developer.certification_expiry) }}
            </ElDescriptionsItem>
            <ElDescriptionsItem label="File size">{{
              formatBytes(evidenceSnapshot.version.file_size)
            }}</ElDescriptionsItem>
            <ElDescriptionsItem label="Scanned files">{{
              evidenceSnapshot.version.scan.scanned_files
            }}</ElDescriptionsItem>
          </ElDescriptions>
        </section>

        <section class="app-review-page__evidence-section">
          <h2>Capabilities and targets</h2>
          <div class="app-review-page__evidence-list">
            <span class="app-review-page__evidence-label">Capabilities</span>
            <div class="app-review-page__capabilities">
              <ElTag
                v-for="capability in evidenceSnapshot.version.requested_capabilities"
                :key="capability"
                effect="plain"
              >
                {{ capabilityLabel(capability) }}
              </ElTag>
              <span
                v-if="!evidenceSnapshot.version.requested_capabilities.length"
                class="app-review-page__muted"
                >None</span
              >
            </div>
          </div>
          <div class="app-review-page__evidence-list">
            <span class="app-review-page__evidence-label">Service targets</span>
            <div class="app-review-page__capabilities">
              <ElTag
                v-for="target in evidenceSnapshot.version.service_targets"
                :key="target"
                type="info"
                effect="plain"
              >
                {{ target }}
              </ElTag>
              <span
                v-if="!evidenceSnapshot.version.service_targets.length"
                class="app-review-page__muted"
                >None</span
              >
            </div>
          </div>
        </section>

        <section class="app-review-page__evidence-section">
          <h2>Automated findings</h2>
          <ElTable :data="evidenceSnapshot.version.scan.findings" border>
            <ElTableColumn prop="code" label="Code" min-width="220" />
            <ElTableColumn label="Severity" width="110">
              <template #default="{ row }">
                <ElTag :type="row.severity === 'warning' ? 'warning' : 'danger'">{{
                  row.severity
                }}</ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn prop="line" label="Line" width="80" />
            <ElTableColumn prop="column" label="Column" width="90" />
            <template #empty>
              <ElEmpty description="No automated findings" :image-size="72" />
            </template>
          </ElTable>
        </section>
      </template>
    </ElDrawer>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, reactive, ref } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { Refresh, Search, View } from '@element-plus/icons-vue'
  import {
    approvePlatformAppVersion,
    fetchPlatformAppReviews,
    publishPlatformAppVersion,
    rejectPlatformAppVersion,
    rollbackPlatformAppVersion,
    unpublishPlatformAppVersion,
    type AppPackageType,
    type AppReviewQueueParams,
    type AppReviewQueueRecord
  } from '@/api/app-marketplace'

  defineOptions({ name: 'AppPlatformReviewCenterPage' })

  const records = ref<AppReviewQueueRecord[]>([])
  const loading = ref(false)
  const loadError = ref('')
  const actionLoading = ref('')
  const approvalDialogVisible = ref(false)
  const evidenceDrawerVisible = ref(false)
  const approvalRow = ref<AppReviewQueueRecord | null>(null)
  const evidenceRow = ref<AppReviewQueueRecord | null>(null)
  const approved_capabilities = ref<string[]>([])
  const approvalMessage = ref('Approved from review center')
  const filters = reactive<AppReviewQueueParams>({
    keyword: '',
    type: '',
    review_status: 'pending',
    publish_status: ''
  })
  const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
  const evidenceSnapshot = computed(() => evidenceRow.value?.review_snapshot || null)
  const evidenceTitle = computed(() => {
    const row = evidenceRow.value
    return row ? `${row.app_name}@${row.version} evidence` : 'Review evidence'
  })
  const manualReviewStatus = computed(() => reviewerSeparationStatus(evidenceRow.value))
  const manualReviewTagType = computed(() => separationTagType(manualReviewStatus.value))
  const candidateReviewStatus = computed(() => candidateSeparationStatus(evidenceRow.value))
  const candidateReviewTagType = computed(() => separationTagType(candidateReviewStatus.value))

  function cleanText(value?: string) {
    return String(value || '').trim() || undefined
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
    const map: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
      internal: 'success',
      static: 'warning',
      iframe: 'info',
      service: 'danger'
    }
    return type ? map[type] || 'info' : 'info'
  }

  function reviewTagType(status?: string) {
    if (status === 'approved') return 'success'
    if (status === 'rejected') return 'danger'
    return 'warning'
  }

  function publishTagType(status?: string) {
    if (status === 'published') return 'success'
    if (status === 'failed') return 'danger'
    if (status === 'unpublished_retired') return 'warning'
    return 'info'
  }

  function formatDateTime(value: unknown) {
    if (!value) return '-'
    const date = value instanceof Date ? value : new Date(String(value))
    return Number.isNaN(date.getTime()) ? String(value) : dateFormatter.format(date)
  }

  function actionKey(row: AppReviewQueueRecord, action: string) {
    return `${action}:${row.app_code}:${row.version}`
  }

  function capabilityLabel(capability: string) {
    return capability === 'context.read' ? 'Read tenant and user context' : capability
  }

  function formatBytes(value: number) {
    if (!Number.isFinite(value) || value < 0) return '-'
    if (value < 1024) return `${value} B`
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
    return `${(value / 1024 / 1024).toFixed(1)} MB`
  }

  function sameOperator(left?: number | null, right?: number | null) {
    return left != null && right != null && String(left) === String(right)
  }

  function reviewerSeparationStatus(row: AppReviewQueueRecord | null) {
    if (!row?.reviewer_id) return 'Pending'
    return sameOperator(row.reviewer_id, row.submitted_by) ? 'Conflict' : 'Independent'
  }

  function candidateSeparationStatus(row: AppReviewQueueRecord | null) {
    if (!row?.candidate_reviewed_by || !row.candidate_reviewed_time) return 'Pending'
    if (
      sameOperator(row.candidate_reviewed_by, row.submitted_by) ||
      sameOperator(row.candidate_reviewed_by, row.reviewer_id)
    ) {
      return 'Conflict'
    }
    return 'Independent'
  }

  function separationTagType(status: string) {
    if (status === 'Independent') return 'success' as const
    if (status === 'Conflict') return 'danger' as const
    return 'info' as const
  }

  function openEvidence(row: AppReviewQueueRecord) {
    evidenceRow.value = row
    evidenceDrawerVisible.value = true
  }

  async function loadReviews() {
    loading.value = true
    loadError.value = ''
    try {
      records.value = await fetchPlatformAppReviews({
        keyword: cleanText(filters.keyword),
        type: (filters.type || undefined) as AppPackageType | undefined,
        review_status: filters.review_status || undefined,
        publish_status: filters.publish_status || undefined
      })
    } catch (error) {
      console.error('[AppPlatformReviewCenterPage] load reviews failed:', error)
      loadError.value = 'Review queue failed to load'
      ElMessage.error(loadError.value)
    } finally {
      loading.value = false
    }
  }

  function resetFilters() {
    filters.keyword = ''
    filters.type = ''
    filters.review_status = 'pending'
    filters.publish_status = ''
    loadReviews()
  }

  async function reviewVersion(row: AppReviewQueueRecord, action: 'approve' | 'reject') {
    if (action === 'approve' && row.requested_capabilities?.length) {
      approvalRow.value = row
      approved_capabilities.value = [...row.requested_capabilities]
      approvalMessage.value = 'Approved from review center'
      approvalDialogVisible.value = true
      return
    }
    const actionText = action === 'approve' ? 'Approve' : 'Reject'
    const { value } = await ElMessageBox.prompt(
      `Reason for ${actionText.toLowerCase()} ${row.app_name}@${row.version}`,
      actionText,
      {
        confirmButtonText: actionText,
        cancelButtonText: 'Cancel',
        inputValue:
          action === 'approve' ? 'Approved from review center' : 'Rejected from review center'
      }
    )
    actionLoading.value = actionKey(row, action)
    try {
      if (action === 'approve') {
        await approvePlatformAppVersion(row.app_code, row.version, String(value || ''), [])
      } else {
        await rejectPlatformAppVersion(row.app_code, row.version, String(value || ''))
      }
      ElMessage.success(`${actionText} completed`)
      await loadReviews()
    } finally {
      actionLoading.value = ''
    }
  }

  async function confirmCapabilityApproval() {
    const row = approvalRow.value
    if (!row) return
    actionLoading.value = actionKey(row, 'approve')
    try {
      await approvePlatformAppVersion(
        row.app_code,
        row.version,
        approvalMessage.value,
        approved_capabilities.value
      )
      ElMessage.success('Approve completed')
      approvalDialogVisible.value = false
      await loadReviews()
    } finally {
      actionLoading.value = ''
    }
  }

  async function publishVersion(row: AppReviewQueueRecord) {
    actionLoading.value = actionKey(row, 'publish')
    try {
      await publishPlatformAppVersion(row.app_code, row.version)
      ElMessage.success('Publish completed')
      await loadReviews()
    } finally {
      actionLoading.value = ''
    }
  }

  async function versionGovernance(row: AppReviewQueueRecord, action: 'rollback' | 'unpublish') {
    const actionText = action === 'rollback' ? 'Rollback' : 'Unpublish'
    const { value } = await ElMessageBox.prompt(
      `Reason for ${actionText.toLowerCase()} ${row.app_name}@${row.version}`,
      actionText,
      {
        confirmButtonText: actionText,
        cancelButtonText: 'Cancel',
        inputValue: action === 'rollback' ? 'Restore stable version' : 'Retire version'
      }
    )
    actionLoading.value = actionKey(row, action)
    try {
      if (action === 'rollback') {
        await rollbackPlatformAppVersion(row.app_code, row.version, String(value || ''))
      } else {
        await unpublishPlatformAppVersion(row.app_code, row.version, String(value || ''))
      }
      ElMessage.success(`${actionText} completed`)
      await loadReviews()
    } finally {
      actionLoading.value = ''
    }
  }

  onMounted(() => {
    loadReviews()
  })
</script>

<style scoped>
  .app-review-page {
    min-height: 100%;
  }

  .app-review-page__header,
  .app-review-page__filters {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .app-review-page__header {
    align-items: flex-start;
    justify-content: space-between;
  }

  .app-review-page__title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.4;
    letter-spacing: 0;
  }

  .app-review-page__subtitle {
    margin: 6px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.5;
  }

  .app-review-page__filters {
    margin-bottom: 16px;
  }

  .app-review-page__filter-item {
    width: 240px;
  }

  .app-review-page__select {
    width: 150px;
  }

  .app-review-page__load-error {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .app-review-page__app-name {
    color: var(--el-text-color-primary);
    font-weight: 500;
  }

  .app-review-page__muted {
    margin-top: 2px;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  .app-review-page__version {
    display: inline-flex;
    min-width: 0;
    align-items: center;
    gap: 8px;
  }

  .app-review-page__capabilities,
  .app-review-page__capability-options {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .app-review-page__capability-options {
    margin: 18px 0;
  }

  .app-review-page__evidence-section + .app-review-page__evidence-section {
    margin-top: 28px;
  }

  .app-review-page__evidence-section h2 {
    margin: 0 0 12px;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0;
  }

  .app-review-page__evidence-section code {
    overflow-wrap: anywhere;
    color: var(--el-text-color-primary);
    font-size: 12px;
  }

  .app-review-page__evidence-list {
    display: grid;
    grid-template-columns: 130px minmax(0, 1fr);
    align-items: start;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .app-review-page__evidence-label {
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }

  @media (max-width: 760px) {
    .app-review-page__header {
      display: grid;
    }

    .app-review-page__filter-item,
    .app-review-page__select {
      width: 100%;
    }

    .app-review-page__evidence-list {
      grid-template-columns: 1fr;
      gap: 8px;
    }
  }
</style>
