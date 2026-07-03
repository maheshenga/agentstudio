<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="tenant-usage-page">
      <template #header>
        <div class="tenant-usage-page__header">
          <div>
            <h1 class="tenant-usage-page__title">租户用量中心</h1>
            <p class="tenant-usage-page__subtitle">查看核心资源的当前用量和配额。</p>
          </div>
          <ElButton :loading="loading" @click="loadUsage">刷新</ElButton>
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
        sub-title="请稍后重试。"
      >
        <template #extra>
          <ElButton type="primary" :loading="loading" @click="loadUsage">重试</ElButton>
        </template>
      </ElResult>

      <div v-else-if="!usageRecords.length" class="tenant-usage-page__state">
        <ElEmpty description="暂无用量信息" />
        <ElButton type="primary" :loading="loading" @click="loadUsage">刷新</ElButton>
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
                  已用 {{ card.usedText }} / {{ card.quotaText }} · 剩余 {{ card.remainingText }}
                </p>
              </div>
              <ElTag v-if="card.isUnlimited" type="info" effect="plain">不限</ElTag>
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
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { fetchTenantUsage, type TenantUsageQuotaRecord } from '@/api/saas'

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
  const loading = ref(false)
  const errorMessage = ref('')

  const quotaConfigs = [
    { resourceType: 'users', label: '用户数', formatter: formatCount },
    { resourceType: 'storage_mb', label: '存储空间', formatter: formatStorageMb },
    { resourceType: 'ai_calls', label: 'AI 调用次数', formatter: formatCount },
    { resourceType: 'rag_documents', label: '知识库文档数', formatter: formatCount },
    { resourceType: 'tokens', label: 'Token 用量', formatter: formatCount }
  ] as const

  const quotaConfigMap = {
    users: { label: '用户数', formatter: formatCount },
    storage_mb: { label: '存储空间', formatter: formatStorageMb },
    ai_calls: { label: 'AI 调用次数', formatter: formatCount },
    rag_documents: { label: '知识库文档数', formatter: formatCount },
    tokens: { label: 'Token 用量', formatter: formatCount }
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

  function formatStorageMb(value: unknown) {
    const numericValue = toNumber(value)
    if (numericValue === null) {
      return '-'
    }

    return `${new Intl.NumberFormat('zh-CN').format(numericValue)} MB`
  }

  function formatQuotaValue(record: TenantUsageQuotaRecord, formatter: (value: unknown) => string) {
    if (record.resource_type === 'storage_mb') {
      return formatStorageMb(record.quota)
    }

    return formatter(record.quota)
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
      quotaText: isUnlimited ? '不限' : formatQuotaValue(record, formatter),
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
    loading.value = true
    errorMessage.value = ''

    try {
      const payload = await fetchTenantUsage()
      usageRecords.value = normalizePayload(payload)
    } catch (error) {
      console.error('[SaasTenantUsagePage] load usage failed:', error)
      errorMessage.value = '加载用量信息失败'
      usageRecords.value = []
    } finally {
      loading.value = false
    }
  }

  onMounted(() => {
    loadUsage()
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
</style>
