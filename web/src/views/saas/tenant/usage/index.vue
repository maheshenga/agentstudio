<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="tenant-usage-page">
      <template #header>
        <div class="tenant-usage-page__header">
          <div>
            <h1 class="tenant-usage-page__title">Tenant Usage</h1>
            <p class="tenant-usage-page__subtitle">Review current SaaS quotas, usage, and recent quota changes.</p>
          </div>
          <ElButton :loading="loading" @click="loadPage">Refresh</ElButton>
        </div>
      </template>

      <div v-if="loading" class="tenant-usage-page__grid">
        <ElCard
          v-for="index in 5"
          :key="index"
          shadow="never"
          class="tenant-usage-page__quota-card"
        >
          <ElSkeleton animated :rows="3" />
        </ElCard>
      </div>

      <ElResult
        v-else-if="errorMessage"
        icon="error"
        :title="errorMessage"
        sub-title="Please try again later."
      >
        <template #extra>
          <ElButton type="primary" :loading="loading" @click="loadPage">Retry</ElButton>
        </template>
      </ElResult>

      <template v-else>
        <div v-if="!usageRecords.length" class="tenant-usage-page__state">
          <ElEmpty description="No usage records" />
          <ElButton type="primary" :loading="loading" @click="loadPage">Refresh</ElButton>
        </div>

        <div v-else class="tenant-usage-page__grid">
          <ElCard
            v-for="card in quotaCards"
            :key="card.resourceType"
            shadow="never"
            class="tenant-usage-page__quota-card"
          >
            <div class="tenant-usage-page__quota-card-content">
              <div class="tenant-usage-page__quota-header">
                <div>
                  <p class="tenant-usage-page__quota-label">{{ card.label }}</p>
                  <p class="tenant-usage-page__quota-meta">
                    Used {{ card.usedText }} / {{ card.quotaText }} · Remaining {{ card.remainingText }}
                  </p>
                </div>
                <ElTag v-if="card.isUnlimited" type="info" effect="plain">Unlimited</ElTag>
              </div>

              <div class="tenant-usage-page__quota-value">{{ card.usedText }}</div>

              <ElProgress
                v-if="card.hasProgress"
                :percentage="card.percent"
                :stroke-width="10"
                :show-text="false"
              />
            </div>
          </ElCard>
        </div>

        <section class="tenant-usage-page__ledger">
          <div class="tenant-usage-page__section-header">
            <div>
              <h2>Quota Ledger</h2>
              <p>Recent quota grants and consumption records.</p>
            </div>
            <ElButton :loading="ledgerLoading" @click="loadLedgers">Refresh ledger</ElButton>
          </div>

          <ElTable v-loading="ledgerLoading" :data="ledgerRecords" border>
            <ElTableColumn label="Resource" min-width="130">
              <template #default="{ row }">{{ getResourceLabel(row.resource_type) }}</template>
            </ElTableColumn>
            <ElTableColumn label="Change" width="120">
              <template #default="{ row }">
                <ElTag :type="row.change_type === 'grant' ? 'success' : 'warning'" effect="light">
                  {{ changeTypeLabel(row.change_type) }}
                </ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn label="Quota delta" min-width="130" align="right">
              <template #default="{ row }">{{ formatSignedNumber(row.quota_delta) }}</template>
            </ElTableColumn>
            <ElTableColumn label="Used delta" min-width="130" align="right">
              <template #default="{ row }">{{ formatSignedNumber(row.used_delta) }}</template>
            </ElTableColumn>
            <ElTableColumn label="Balance" min-width="170" align="right">
              <template #default="{ row }">
                {{ formatCount(row.balance_used_quota) }} / {{ formatCount(row.balance_total_quota) }}
              </template>
            </ElTableColumn>
            <ElTableColumn label="Source" min-width="160">
              <template #default="{ row }">{{ formatSource(row) }}</template>
            </ElTableColumn>
            <ElTableColumn label="Time" min-width="180">
              <template #default="{ row }">{{ formatDate(row.create_time) }}</template>
            </ElTableColumn>
            <template #empty>
              <ElEmpty description="No quota ledger records" />
            </template>
          </ElTable>
        </section>
      </template>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import {
    fetchTenantQuotaLedgers,
    fetchTenantUsage,
    type TenantQuotaLedgerRecord,
    type TenantUsageQuotaRecord
  } from '@/api/saas'

  defineOptions({ name: 'SaasTenantUsagePage' })

  type UsageCard = {
    resourceType: string
    label: string
    usedText: string
    quotaText: string
    remainingText: string
    isUnlimited: boolean
    hasProgress: boolean
    percent: number
  }

  const usageRecords = ref<TenantUsageQuotaRecord[]>([])
  const ledgerRecords = ref<TenantQuotaLedgerRecord[]>([])
  const loading = ref(false)
  const ledgerLoading = ref(false)
  const errorMessage = ref('')

  const quotaConfigs = [
    { resourceType: 'users', label: 'Users', formatter: formatCount },
    { resourceType: 'storage_mb', label: 'Storage', formatter: formatStorageMb },
    { resourceType: 'ai_calls', label: 'AI Calls', formatter: formatCount },
    { resourceType: 'rag_documents', label: 'RAG Documents', formatter: formatCount },
    { resourceType: 'tokens', label: 'Tokens', formatter: formatCount }
  ] as const

  const quotaConfigMap = {
    users: { label: 'Users', formatter: formatCount },
    storage_mb: { label: 'Storage', formatter: formatStorageMb },
    ai_calls: { label: 'AI Calls', formatter: formatCount },
    rag_documents: { label: 'RAG Documents', formatter: formatCount },
    tokens: { label: 'Tokens', formatter: formatCount }
  } as const

  function normalizePayload(payload: any): TenantUsageQuotaRecord[] {
    const data = payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload

    if (!Array.isArray(data)) {
      return []
    }

    return data.filter((item): item is TenantUsageQuotaRecord => {
      return item !== null && typeof item === 'object' && typeof item.resource_type === 'string'
    })
  }

  function toNumber(value: unknown) {
    if (value === undefined || value === null || value === '') {
      return null
    }

    const numericValue = Number(value)
    return Number.isFinite(numericValue) ? numericValue : null
  }

  function formatCount(value: unknown) {
    const numericValue = toNumber(value)
    if (numericValue === null) {
      return '-'
    }

    return new Intl.NumberFormat('zh-CN').format(numericValue)
  }

  function formatSignedNumber(value: unknown) {
    const numericValue = toNumber(value)
    if (numericValue === null || numericValue === 0) return '0'
    const formatted = formatCount(Math.abs(numericValue))
    return numericValue > 0 ? `+${formatted}` : `-${formatted}`
  }

  function formatStorageMb(value: unknown) {
    const numericValue = toNumber(value)
    if (numericValue === null) {
      return '-'
    }

    return `${new Intl.NumberFormat('zh-CN').format(numericValue)} MB`
  }

  function formatDate(value?: string | Date) {
    if (!value) return '-'
    return new Date(value).toLocaleString('zh-CN', { hour12: false })
  }

  function formatQuotaValue(record: TenantUsageQuotaRecord, formatter: (value: unknown) => string) {
    if (record.resource_type === 'storage_mb') {
      return formatStorageMb(record.quota)
    }

    return formatter(record.quota)
  }

  function getResourceLabel(resourceType: string) {
    return quotaConfigMap[resourceType as keyof typeof quotaConfigMap]?.label ?? resourceType
  }

  function changeTypeLabel(changeType: string) {
    if (changeType === 'grant') return 'Grant'
    if (changeType === 'consume') return 'Consume'
    return changeType || '-'
  }

  function formatSource(row: TenantQuotaLedgerRecord) {
    const sourceType = row.source_type || '-'
    return row.source_id ? `${sourceType} / ${row.source_id}` : sourceType
  }

  function getCard(record: TenantUsageQuotaRecord): UsageCard {
    const config = quotaConfigMap[record.resource_type as keyof typeof quotaConfigMap]
    const formatter = config?.formatter ?? formatCount
    const quotaNumber = toNumber(record.quota)
    const usedNumber = toNumber(record.used)
    const remainingNumber = toNumber(record.remaining)
    const isUnlimited = quotaNumber === null || quotaNumber <= 0

    return {
      resourceType: record.resource_type,
      label: config?.label ?? record.resource_type,
      usedText: formatter(record.used),
      quotaText: isUnlimited ? 'Unlimited' : formatQuotaValue(record, formatter),
      remainingText: remainingNumber === null
        ? '-'
        : record.resource_type === 'storage_mb'
          ? formatStorageMb(remainingNumber)
          : formatCount(remainingNumber),
      isUnlimited,
      hasProgress: !isUnlimited && usedNumber !== null,
      percent:
        !isUnlimited && usedNumber !== null && quotaNumber !== null && quotaNumber > 0
          ? Math.min(100, Math.round((usedNumber / quotaNumber) * 100))
          : 0
    }
  }

  const usageRecordMap = computed(() => new Map(usageRecords.value.map((record) => [record.resource_type, record])))

  const quotaCards = computed(() =>
    quotaConfigs.map((config) => {
      const record = usageRecordMap.value.get(config.resourceType)

      if (!record) {
        return {
          resourceType: config.resourceType,
          label: config.label,
          usedText: '-',
          quotaText: '-',
          remainingText: '-',
          isUnlimited: true,
          hasProgress: false,
          percent: 0
        }
      }

      return getCard(record)
    })
  )

  const loadUsage = async () => {
    const payload = await fetchTenantUsage()
    usageRecords.value = normalizePayload(payload)
  }

  const loadLedgers = async () => {
    ledgerLoading.value = true
    try {
      const result = await fetchTenantQuotaLedgers({ page: 1, limit: 20 })
      ledgerRecords.value = Array.isArray(result?.list) ? result.list : []
    } catch (error) {
      console.error('[SaasTenantUsagePage] load quota ledgers failed:', error)
      ledgerRecords.value = []
    } finally {
      ledgerLoading.value = false
    }
  }

  const loadPage = async () => {
    loading.value = true
    errorMessage.value = ''

    try {
      await Promise.all([loadUsage(), loadLedgers()])
    } catch (error) {
      console.error('[SaasTenantUsagePage] load usage failed:', error)
      errorMessage.value = 'Load usage failed'
      usageRecords.value = []
    } finally {
      loading.value = false
    }
  }

  onMounted(() => {
    loadPage()
  })
</script>

<style scoped>
  .tenant-usage-page {
    min-height: 100%;
  }

  .tenant-usage-page__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .tenant-usage-page__title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.4;
  }

  .tenant-usage-page__subtitle {
    margin: 6px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.5;
  }

  .tenant-usage-page__state {
    display: grid;
    gap: 16px;
    justify-items: start;
    padding: 24px 0;
  }

  .tenant-usage-page__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 16px;
  }

  .tenant-usage-page__quota-card {
    min-height: 176px;
  }

  .tenant-usage-page__quota-card-content {
    display: grid;
    gap: 16px;
  }

  .tenant-usage-page__quota-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .tenant-usage-page__quota-label {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    line-height: 1.4;
  }

  .tenant-usage-page__quota-meta {
    margin: 6px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.5;
  }

  .tenant-usage-page__quota-value {
    font-size: 28px;
    font-weight: 600;
    line-height: 1.2;
    letter-spacing: 0;
  }

  .tenant-usage-page__ledger {
    margin-top: 20px;
  }

  .tenant-usage-page__section-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
  }

  .tenant-usage-page__section-header h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    line-height: 1.4;
  }

  .tenant-usage-page__section-header p {
    margin: 4px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.5;
  }

  @media (max-width: 640px) {
    .tenant-usage-page__header,
    .tenant-usage-page__section-header {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>
