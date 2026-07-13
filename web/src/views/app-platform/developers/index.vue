<template>
  <div class="developer-certification-page">
    <header class="developer-certification-page__header">
      <div>
        <h1>Developer Certification</h1>
        <p>Review runtime scope, risk, expiry, and account availability.</p>
      </div>
      <ElButton :icon="Refresh" :loading="loading" @click="loadProfiles">Refresh</ElButton>
    </header>

    <section class="developer-certification-page__filters">
      <ElSelect v-model="filters.certification_status" clearable placeholder="Status">
        <ElOption v-for="status in statuses" :key="status" :label="status" :value="status" />
      </ElSelect>
      <ElSelect v-model="filters.risk_level" clearable placeholder="Risk">
        <ElOption v-for="risk in risks" :key="risk" :label="risk" :value="risk" />
      </ElSelect>
      <ElSelect v-model="filters.runtime_type" clearable placeholder="Runtime">
        <ElOption
          v-for="runtime in runtimeTypes"
          :key="runtime"
          :label="runtime"
          :value="runtime"
        />
      </ElSelect>
      <ElSelect v-model="filters.disabled" clearable placeholder="Availability">
        <ElOption label="Enabled" :value="false" />
        <ElOption label="Disabled" :value="true" />
      </ElSelect>
      <ElButton type="primary" :icon="Search" @click="loadProfiles">Apply</ElButton>
      <ElButton @click="resetFilters">Reset</ElButton>
    </section>

    <ElAlert
      v-if="loadError"
      type="error"
      :title="loadError"
      show-icon
      :closable="false"
      class="developer-certification-page__alert"
    >
      <template #default>
        <ElButton link type="primary" :loading="loading" @click="loadProfiles">Retry</ElButton>
      </template>
    </ElAlert>

    <ElTable v-loading="loading" :data="profiles" border>
      <ElTableColumn label="Applicant" min-width="220">
        <template #default="{ row }">
          <strong>{{ row.display_name }}</strong>
          <div class="developer-certification-page__muted">User {{ row.user_id }}</div>
          <a v-if="row.website" :href="row.website" target="_blank" rel="noopener noreferrer">
            Website
          </a>
        </template>
      </ElTableColumn>
      <ElTableColumn label="Application" min-width="260" show-overflow-tooltip>
        <template #default="{ row }">{{ row.statement }}</template>
      </ElTableColumn>
      <ElTableColumn label="Requested runtimes" min-width="190">
        <template #default="{ row }">
          <ElTag
            v-for="runtime in row.requested_runtime_types"
            :key="runtime"
            class="tag"
            effect="plain"
          >
            {{ runtime }}
          </ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn label="Status" width="130">
        <template #default="{ row }">
          <ElTag :type="statusTag(row.certification_status)" effect="light">
            {{ row.certification_status }}
          </ElTag>
          <div v-if="row.disabled" class="developer-certification-page__disabled">Disabled</div>
        </template>
      </ElTableColumn>
      <ElTableColumn label="Risk" width="100" prop="risk_level" />
      <ElTableColumn label="Expiry" width="170">
        <template #default="{ row }">{{ formatDateTime(row.certification_expiry) }}</template>
      </ElTableColumn>
      <ElTableColumn label="Review result" min-width="240">
        <template #default="{ row }">
          <div>{{ row.review_message || '-' }}</div>
          <div class="developer-certification-page__muted">
            Reviewer {{ row.reviewer_id || '-' }} / {{ formatDateTime(row.update_time) }}
          </div>
        </template>
      </ElTableColumn>
      <ElTableColumn label="Actions" width="220" fixed="right">
        <template #default="{ row }">
          <template v-if="row.certification_status === 'pending'">
            <ElButton link type="success" @click="openDecision(row, 'certified')">Approve</ElButton>
            <ElButton link type="danger" @click="openDecision(row, 'rejected')">Reject</ElButton>
          </template>
          <ElButton link type="primary" @click="openDisabled(row)">
            {{ row.disabled ? 'Enable' : 'Disable' }}
          </ElButton>
        </template>
      </ElTableColumn>
      <template #empty>
        <ElEmpty description="No certification applications" />
      </template>
    </ElTable>

    <ElDialog
      v-model="decisionVisible"
      :title="
        decisionForm.decision === 'certified' ? 'Approve certification' : 'Reject certification'
      "
      width="620px"
    >
      <ElForm label-width="150px">
        <ElFormItem label="Applicant">
          <strong>{{ selected?.display_name }}</strong>
        </ElFormItem>
        <ElFormItem v-if="decisionForm.decision === 'certified'" label="Approved runtimes" required>
          <ElCheckboxGroup v-model="decisionForm.approved_runtime_types">
            <ElCheckbox
              v-for="runtime in selected?.requested_runtime_types || []"
              :key="runtime"
              :value="runtime"
            >
              {{ runtime }}
            </ElCheckbox>
          </ElCheckboxGroup>
        </ElFormItem>
        <ElFormItem label="Risk level" required>
          <ElSelect v-model="decisionForm.risk_level">
            <ElOption v-for="risk in risks" :key="risk" :label="risk" :value="risk" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem
          v-if="decisionForm.decision === 'certified'"
          label="Certification expiry"
          required
        >
          <ElDatePicker v-model="decisionForm.certification_expiry" type="datetime" />
        </ElFormItem>
        <ElFormItem label="Review reason" required>
          <ElInput
            v-model="decisionForm.message"
            type="textarea"
            :rows="4"
            maxlength="500"
            show-word-limit
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="decisionVisible = false">Cancel</ElButton>
        <ElButton type="primary" :loading="submitting" @click="submitDecision">Confirm</ElButton>
      </template>
    </ElDialog>

    <ElDialog
      v-model="disabledVisible"
      :title="selected?.disabled ? 'Enable developer' : 'Disable developer'"
      width="520px"
    >
      <ElInput
        v-model="disabledReason"
        type="textarea"
        :rows="4"
        maxlength="500"
        show-word-limit
        placeholder="Reason"
      />
      <template #footer>
        <ElButton @click="disabledVisible = false">Cancel</ElButton>
        <ElButton type="primary" :loading="submitting" @click="submitDisabled">Confirm</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import { Refresh, Search } from '@element-plus/icons-vue'
  import {
    decideDeveloperCertification,
    fetchDeveloperCertifications,
    setDeveloperCertificationDisabled,
    type DeveloperCertificationFilters,
    type DeveloperCertificationProfile,
    type DeveloperCertificationStatus,
    type DeveloperRiskLevel,
    type DeveloperRuntimeType
  } from '@/api/app-developer-certification'

  defineOptions({ name: 'AppDeveloperCertificationPage' })

  const statuses: DeveloperCertificationStatus[] = ['pending', 'certified', 'rejected', 'expired']
  const risks: DeveloperRiskLevel[] = ['low', 'medium', 'high']
  const runtimeTypes: DeveloperRuntimeType[] = ['static', 'iframe', 'service']
  const profiles = ref<DeveloperCertificationProfile[]>([])
  const filters = reactive<DeveloperCertificationFilters>({})
  const loading = ref(false)
  const submitting = ref(false)
  const loadError = ref('')
  const selected = ref<DeveloperCertificationProfile | null>(null)
  const decisionVisible = ref(false)
  const disabledVisible = ref(false)
  const disabledReason = ref('')
  const decisionForm = reactive({
    decision: 'certified' as 'certified' | 'rejected',
    approved_runtime_types: [] as DeveloperRuntimeType[],
    risk_level: 'medium' as DeveloperRiskLevel,
    certification_expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    message: ''
  })
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })

  function statusTag(status: DeveloperCertificationStatus) {
    if (status === 'certified') return 'success'
    if (status === 'pending') return 'warning'
    if (status === 'rejected') return 'danger'
    return 'info'
  }

  function formatDateTime(value: string | null) {
    if (!value) return '-'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '-' : formatter.format(date)
  }

  async function loadProfiles() {
    loading.value = true
    loadError.value = ''
    try {
      profiles.value = await fetchDeveloperCertifications(filters)
    } catch {
      loadError.value = 'Certification applications failed to load'
    } finally {
      loading.value = false
    }
  }

  function resetFilters() {
    Object.assign(filters, {
      certification_status: '',
      risk_level: '',
      runtime_type: '',
      disabled: undefined
    })
    loadProfiles()
  }

  function openDecision(
    profile: DeveloperCertificationProfile,
    decision: 'certified' | 'rejected'
  ) {
    selected.value = profile
    Object.assign(decisionForm, {
      decision,
      approved_runtime_types: decision === 'certified' ? [...profile.requested_runtime_types] : [],
      risk_level: profile.risk_level || 'medium',
      certification_expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      message: ''
    })
    decisionVisible.value = true
  }

  async function submitDecision() {
    if (!selected.value || decisionForm.message.trim().length < 3) {
      ElMessage.warning('Review reason must contain at least 3 characters')
      return
    }
    if (decisionForm.decision === 'certified' && !decisionForm.approved_runtime_types.length) {
      ElMessage.warning('Select at least one approved runtime')
      return
    }
    submitting.value = true
    try {
      await decideDeveloperCertification(selected.value.id, {
        decision: decisionForm.decision,
        approved_runtime_types: decisionForm.approved_runtime_types,
        risk_level: decisionForm.risk_level,
        ...(decisionForm.decision === 'certified'
          ? { certification_expiry: decisionForm.certification_expiry.toISOString() }
          : {}),
        message: decisionForm.message.trim()
      })
      ElMessage.success('Certification decision saved')
      decisionVisible.value = false
      await loadProfiles()
    } finally {
      submitting.value = false
    }
  }

  function openDisabled(profile: DeveloperCertificationProfile) {
    selected.value = profile
    disabledReason.value = ''
    disabledVisible.value = true
  }

  async function submitDisabled() {
    if (!selected.value || disabledReason.value.trim().length < 3) {
      ElMessage.warning('Reason must contain at least 3 characters')
      return
    }
    submitting.value = true
    try {
      await setDeveloperCertificationDisabled(
        selected.value.id,
        !selected.value.disabled,
        disabledReason.value.trim()
      )
      ElMessage.success(selected.value.disabled ? 'Developer enabled' : 'Developer disabled')
      disabledVisible.value = false
      await loadProfiles()
    } finally {
      submitting.value = false
    }
  }

  onMounted(loadProfiles)
</script>

<style scoped>
  .developer-certification-page {
    min-height: 100%;
    padding: 20px;
    background: var(--el-bg-color);
  }

  .developer-certification-page__header,
  .developer-certification-page__filters {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .developer-certification-page__header {
    justify-content: space-between;
  }

  .developer-certification-page__header h1 {
    margin: 0;
    font-size: 20px;
    letter-spacing: 0;
  }

  .developer-certification-page__header p {
    margin: 5px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }

  .developer-certification-page__filters {
    flex-wrap: wrap;
    margin: 18px 0 14px;
  }

  .developer-certification-page__filters :deep(.el-select) {
    width: 150px;
  }

  .developer-certification-page__alert {
    margin-bottom: 14px;
  }

  .developer-certification-page__muted,
  .developer-certification-page__disabled {
    margin-top: 4px;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  .developer-certification-page__disabled {
    color: var(--el-color-danger);
  }

  .tag {
    margin: 2px 4px 2px 0;
  }

  @media (max-width: 720px) {
    .developer-certification-page {
      padding: 14px;
    }

    .developer-certification-page__header {
      align-items: flex-start;
    }

    .developer-certification-page__filters :deep(.el-select) {
      width: calc(50% - 6px);
    }
  }
</style>
