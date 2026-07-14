<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="app-review-page">
      <template #header>
        <div class="app-review-page__header">
          <div>
            <h1 class="app-review-page__title">应用审核中心</h1>
            <p class="app-review-page__subtitle">统一处理应用版本审核、发布、下线和回滚。</p>
          </div>
          <ElButton :icon="Refresh" :loading="loading" @click="loadReviews">刷新</ElButton>
        </div>
      </template>

      <div class="app-review-page__filters">
        <ElInput
          v-model="filters.keyword"
          clearable
          class="app-review-page__filter-item"
          placeholder="应用、版本或开发者"
          @keyup.enter="loadReviews"
        />
        <ElSelect
          v-model="filters.type"
          clearable
          class="app-review-page__select"
          placeholder="应用类型"
        >
          <ElOption label="内置页面" value="internal" />
          <ElOption label="静态应用" value="static" />
          <ElOption label="外部应用" value="iframe" />
          <ElOption label="服务应用" value="service" />
        </ElSelect>
        <ElSelect
          v-model="filters.review_status"
          clearable
          class="app-review-page__select"
          placeholder="审核状态"
        >
          <ElOption label="待审核" value="pending" />
          <ElOption label="已通过" value="approved" />
          <ElOption label="已驳回" value="rejected" />
        </ElSelect>
        <ElSelect
          v-model="filters.publish_status"
          clearable
          class="app-review-page__select"
          placeholder="发布状态"
        >
          <ElOption label="未发布" value="unpublished" />
          <ElOption label="已发布" value="published" />
          <ElOption label="发布失败" value="failed" />
          <ElOption label="已下线" value="unpublished_retired" />
        </ElSelect>
        <ElButton type="primary" :icon="Search" :loading="loading" @click="loadReviews"
          >查询</ElButton
        >
        <ElButton @click="resetFilters">重置</ElButton>
      </div>

      <div v-if="loadError" class="app-review-page__load-error">
        <ElAlert type="error" :title="loadError" show-icon :closable="false" />
        <ElButton size="small" type="primary" link :loading="loading" @click="loadReviews"
          >重试</ElButton
        >
      </div>

      <ElTable v-loading="loading" :data="records" border>
        <ElTableColumn label="应用" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="app-review-page__app-name">{{ row.app_name || '-' }}</div>
            <div class="app-review-page__muted">{{ row.app_code || '-' }}</div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="版本" width="140">
          <template #default="{ row }">
            <div class="app-review-page__version">
              <span>{{ row.version }}</span>
              <ElTag v-if="row.is_active" size="small" type="success" effect="light"
                >当前版本</ElTag
              >
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="类型" width="110">
          <template #default="{ row }">
            <ElTag :type="typeTagType(row.app_type)" effect="light">{{
              typeText(row.app_type)
            }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="审核状态" width="120">
          <template #default="{ row }">
            <ElTag :type="reviewTagType(row.review_status)" effect="light">{{
              reviewText(row.review_status)
            }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="发布状态" width="140">
          <template #default="{ row }">
            <ElTag :type="publishTagType(row.publish_status)" effect="light">{{
              publishText(row.publish_status)
            }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="开发者" width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ row.developer_name || '-' }}</template>
        </ElTableColumn>
        <ElTableColumn label="申请能力" min-width="180">
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
            <span v-else class="app-review-page__muted">无</span>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="entry_url" label="运行地址" min-width="240" show-overflow-tooltip />
        <ElTableColumn label="更新时间" width="170">
          <template #default="{ row }">{{
            formatDateTime(row.update_time || row.create_time)
          }}</template>
        </ElTableColumn>
        <ElTableColumn label="操作" :fixed="actionColumnFixed" width="500">
          <template #default="{ row }">
            <ElButton link :icon="View" @click="openEvidence(row)">审核证据</ElButton>
            <ElButton
              link
              type="success"
              :loading="actionLoading === `approve:${row.app_code}:${row.version}`"
              :disabled="row.review_status !== 'pending'"
              @click="reviewVersion(row, 'approve')"
            >
              通过
            </ElButton>
            <ElButton
              link
              type="warning"
              :loading="actionLoading === `reject:${row.app_code}:${row.version}`"
              :disabled="row.review_status !== 'pending'"
              @click="reviewVersion(row, 'reject')"
            >
              驳回
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
              发布
            </ElButton>
            <ElButton
              link
              type="warning"
              :loading="actionLoading === `rollback:${row.app_code}:${row.version}`"
              :disabled="row.review_status !== 'approved' || !row.publish_path || row.is_active"
              @click="versionGovernance(row, 'rollback')"
            >
              回滚
            </ElButton>
            <ElButton
              link
              type="danger"
              :loading="actionLoading === `unpublish:${row.app_code}:${row.version}`"
              :disabled="row.publish_status !== 'published'"
              @click="versionGovernance(row, 'unpublish')"
            >
              下线
            </ElButton>
          </template>
        </ElTableColumn>
        <template #empty>
          <ElEmpty description="暂无待处理的应用版本" />
        </template>
      </ElTable>
    </ElCard>

    <ElDialog v-model="approvalDialogVisible" title="确认授权能力" width="520px">
      <ElAlert
        type="info"
        title="只有勾选的能力才会进入租户授权范围。"
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
        <ElButton @click="approvalDialogVisible = false">取消</ElButton>
        <ElButton
          type="primary"
          :loading="Boolean(actionLoading)"
          @click="confirmCapabilityApproval"
          >确认通过</ElButton
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
        title="冻结的审核证据不可用"
        :closable="false"
        show-icon
      />
      <template v-else>
        <section class="app-review-page__evidence-section">
          <h2>审核完整性</h2>
          <ElDescriptions :column="2" border>
            <ElDescriptionsItem label="可信级别">
              <ElTag type="warning" effect="light">{{
                trustLevelText(evidenceRow?.trust_level)
              }}</ElTag>
            </ElDescriptionsItem>
            <ElDescriptionsItem label="提交时间">{{
              formatDateTime(evidenceSnapshot.submitted_at)
            }}</ElDescriptionsItem>
            <ElDescriptionsItem label="快照 SHA-256" :span="2">
              <code>{{ evidenceRow?.review_snapshot_hash || '-' }}</code>
            </ElDescriptionsItem>
            <ElDescriptionsItem label="安装包 SHA-256" :span="2">
              <code>{{ evidenceSnapshot.version.package_sha256 }}</code>
            </ElDescriptionsItem>
            <ElDescriptionsItem label="入口文件 SHA-256" :span="2">
              <code>{{ evidenceSnapshot.version.entry_sha256 }}</code>
            </ElDescriptionsItem>
            <ElDescriptionsItem label="人工审核">
              <ElTag :type="manualReviewTagType">{{ manualReviewStatus }}</ElTag>
            </ElDescriptionsItem>
            <ElDescriptionsItem label="候选版本审核">
              <ElTag :type="candidateReviewTagType">{{ candidateReviewStatus }}</ElTag>
            </ElDescriptionsItem>
          </ElDescriptions>
        </section>

        <section class="app-review-page__evidence-section">
          <h2>提交快照</h2>
          <ElDescriptions :column="2" border>
            <ElDescriptionsItem label="应用">{{ evidenceSnapshot.app.name }}</ElDescriptionsItem>
            <ElDescriptionsItem label="应用编码"
              ><code>{{ evidenceSnapshot.app.code }}</code></ElDescriptionsItem
            >
            <ElDescriptionsItem label="开发者">{{
              evidenceSnapshot.app.developer_name
            }}</ElDescriptionsItem>
            <ElDescriptionsItem label="开发者档案"
              ><code>{{ evidenceSnapshot.developer.profile_id }}</code></ElDescriptionsItem
            >
            <ElDescriptionsItem label="风险级别">{{
              riskLevelText(evidenceSnapshot.developer.risk_level)
            }}</ElDescriptionsItem>
            <ElDescriptionsItem label="认证到期时间">
              {{ formatDateTime(evidenceSnapshot.developer.certification_expiry) }}
            </ElDescriptionsItem>
            <ElDescriptionsItem label="文件大小">{{
              formatBytes(evidenceSnapshot.version.file_size)
            }}</ElDescriptionsItem>
            <ElDescriptionsItem label="扫描文件数">{{
              evidenceSnapshot.version.scan.scanned_files
            }}</ElDescriptionsItem>
          </ElDescriptions>
        </section>

        <section class="app-review-page__evidence-section">
          <h2>能力与服务目标</h2>
          <div class="app-review-page__evidence-list">
            <span class="app-review-page__evidence-label">申请能力</span>
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
                >无</span
              >
            </div>
          </div>
          <div class="app-review-page__evidence-list">
            <span class="app-review-page__evidence-label">服务目标</span>
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
                >无</span
              >
            </div>
          </div>
        </section>

        <section class="app-review-page__evidence-section">
          <h2>自动扫描结果</h2>
          <ElTable :data="evidenceSnapshot.version.scan.findings" border>
            <ElTableColumn prop="code" label="问题编码" min-width="220" />
            <ElTableColumn label="严重度" width="110">
              <template #default="{ row }">
                <ElTag :type="row.severity === 'warning' ? 'warning' : 'danger'">{{
                  severityText(row.severity)
                }}</ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn prop="line" label="行" width="80" />
            <ElTableColumn prop="column" label="列" width="90" />
            <template #empty>
              <ElEmpty description="未发现自动扫描问题" :image-size="72" />
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
  import { useWindowSize } from '@vueuse/core'
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
  import {
    appReviewTypeTagType as typeTagType,
    appTypeText as typeText,
    candidateSeparationStatus,
    capabilityLabel,
    cleanOptionalText as cleanText,
    formatAppBytes as formatBytes,
    formatAppDateTime as formatDateTime,
    publishStatusTagType as publishTagType,
    publishStatusText as publishText,
    reviewStatusTagType as reviewTagType,
    reviewStatusText as reviewText,
    reviewFindingSeverityText as severityText,
    reviewRiskLevelText as riskLevelText,
    reviewTrustLevelText as trustLevelText,
    reviewerSeparationStatus,
    separationTagType
  } from '../shared/app-display'

  defineOptions({ name: 'AppPlatformReviewCenterPage' })

  const { width: viewportWidth } = useWindowSize()
  const actionColumnFixed = computed(() => (viewportWidth.value > 800 ? 'right' : false))
  const records = ref<AppReviewQueueRecord[]>([])
  const loading = ref(false)
  const loadError = ref('')
  const actionLoading = ref('')
  const approvalDialogVisible = ref(false)
  const evidenceDrawerVisible = ref(false)
  const approvalRow = ref<AppReviewQueueRecord | null>(null)
  const evidenceRow = ref<AppReviewQueueRecord | null>(null)
  const approved_capabilities = ref<string[]>([])
  const approvalMessage = ref('审核中心已通过')
  const filters = reactive<AppReviewQueueParams>({
    keyword: '',
    type: '',
    review_status: 'pending',
    publish_status: ''
  })
  const evidenceSnapshot = computed(() => evidenceRow.value?.review_snapshot || null)
  const evidenceTitle = computed(() => {
    const row = evidenceRow.value
    return row ? `${row.app_name}@${row.version} 审核证据` : '审核证据'
  })
  const manualReviewStatus = computed(() => reviewerSeparationStatus(evidenceRow.value))
  const manualReviewTagType = computed(() => separationTagType(manualReviewStatus.value))
  const candidateReviewStatus = computed(() => candidateSeparationStatus(evidenceRow.value))
  const candidateReviewTagType = computed(() => separationTagType(candidateReviewStatus.value))

  function actionKey(row: AppReviewQueueRecord, action: string) {
    return `${action}:${row.app_code}:${row.version}`
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
      loadError.value = '审核队列加载失败'
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
      approvalMessage.value = '审核中心已通过'
      approvalDialogVisible.value = true
      return
    }
    const actionText = action === 'approve' ? '通过' : '驳回'
    const { value } = await ElMessageBox.prompt(
      `请输入${actionText} ${row.app_name}@${row.version} 的原因`,
      actionText,
      {
        confirmButtonText: actionText,
        cancelButtonText: '取消',
        inputValue: action === 'approve' ? '审核中心已通过' : '审核中心已驳回'
      }
    )
    actionLoading.value = actionKey(row, action)
    try {
      if (action === 'approve') {
        await approvePlatformAppVersion(row.app_code, row.version, String(value || ''), [])
      } else {
        await rejectPlatformAppVersion(row.app_code, row.version, String(value || ''))
      }
      ElMessage.success(`${actionText}操作已完成`)
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
      ElMessage.success('审核通过操作已完成')
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
      ElMessage.success('发布操作已完成')
      await loadReviews()
    } finally {
      actionLoading.value = ''
    }
  }

  async function versionGovernance(row: AppReviewQueueRecord, action: 'rollback' | 'unpublish') {
    const actionText = action === 'rollback' ? '回滚' : '下线'
    const { value } = await ElMessageBox.prompt(
      `请输入${actionText} ${row.app_name}@${row.version} 的原因`,
      actionText,
      {
        confirmButtonText: actionText,
        cancelButtonText: '取消',
        inputValue: action === 'rollback' ? '恢复稳定版本' : '下线当前版本'
      }
    )
    actionLoading.value = actionKey(row, action)
    try {
      if (action === 'rollback') {
        await rollbackPlatformAppVersion(row.app_code, row.version, String(value || ''))
      } else {
        await unpublishPlatformAppVersion(row.app_code, row.version, String(value || ''))
      }
      ElMessage.success(`${actionText}操作已完成`)
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
