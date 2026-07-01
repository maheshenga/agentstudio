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

      <div v-else-if="!usageInfo" class="tenant-usage-page__state">
        <ElEmpty description="暂无用量信息" />
        <ElButton type="primary" :loading="loading" @click="loadUsage">刷新</ElButton>
      </div>

      <div v-else class="tenant-usage-page__grid">
        <ElCard
          v-for="card in quotaCards"
          :key="card.label"
          shadow="never"
          class="tenant-usage-page__quota-card"
        >
          <div class="tenant-usage-page__quota-card-content">
            <div class="tenant-usage-page__quota-header">
              <div>
                <p class="tenant-usage-page__quota-label">{{ card.label }}</p>
                <p class="tenant-usage-page__quota-meta">已用 {{ card.usedText }} / {{ card.limitText }}</p>
              </div>
              <ElTag v-if="!card.hasLimit" type="info" effect="plain">不限</ElTag>
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
  import { fetchTenantUsage, type TenantUsageSummary } from '@/api/saas'

  defineOptions({ name: 'SaasTenantUsagePage' })

  const usageInfo = ref<TenantUsageSummary | null>(null)
  const loading = ref(false)
  const errorMessage = ref('')

  const pickValue = (source: Record<string, any> | null, keys: string[]) => {
    if (!source) return undefined

    for (const key of keys) {
      const value = source[key]
      if (value !== undefined && value !== null && value !== '') {
        return value
      }
    }

    return undefined
  }

  const normalizePayload = (payload: any) => {
    if (!payload) return null
    if (typeof payload === 'object' && 'data' in payload && payload.data) {
      return payload.data
    }

    return payload
  }

  const formatCount = (value: unknown) => {
    if (value === undefined || value === null || value === '') {
      return '-'
    }

    const numericValue = Number(value)
    if (Number.isFinite(numericValue)) {
      return new Intl.NumberFormat('zh-CN').format(numericValue)
    }

    return String(value)
  }

  const formatBytes = (value: unknown) => {
    if (value === undefined || value === null || value === '') {
      return '-'
    }

    const numericValue = Number(value)
    if (!Number.isFinite(numericValue)) {
      return String(value)
    }

    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let size = numericValue
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex += 1
    }

    const displayValue = size >= 100 || unitIndex === 0 ? Math.round(size) : Number(size.toFixed(1))
    return `${displayValue} ${units[unitIndex]}`
  }

  const toNumber = (value: unknown) => {
    if (value === undefined || value === null || value === '') {
      return null
    }

    const numericValue = Number(value)
    return Number.isFinite(numericValue) ? numericValue : null
  }

  const quotaConfigs = [
    {
      label: '用户数',
      usedKeys: ['usedSeats', 'user_count', 'current_user_count', 'used_users'],
      limitKeys: ['maxSeats', 'max_users', 'seat_limit', 'user_limit'],
      formatter: formatCount
    },
    {
      label: '存储空间',
      usedKeys: ['storageUsed', 'usedStorage', 'storage_usage', 'used_storage'],
      limitKeys: ['storageQuota', 'maxStorage', 'storage_limit', 'storage_quota'],
      formatter: formatBytes
    },
    {
      label: 'AI 调用次数',
      usedKeys: ['aiCallsUsed', 'ai_call_count', 'ai_calls_used', 'used_ai_calls'],
      limitKeys: ['aiCallQuota', 'ai_call_limit', 'max_ai_calls', 'ai_calls_limit'],
      formatter: formatCount
    },
    {
      label: '知识库文档数',
      usedKeys: ['knowledgeDocsUsed', 'document_count', 'kb_doc_count', 'knowledge_doc_count'],
      limitKeys: ['knowledgeDocsQuota', 'document_limit', 'kb_doc_limit', 'knowledge_doc_limit'],
      formatter: formatCount
    },
    {
      label: 'Token 用量',
      usedKeys: ['tokenUsed', 'token_usage', 'used_tokens', 'token_count'],
      limitKeys: ['tokenQuota', 'token_limit', 'max_tokens', 'token_budget'],
      formatter: formatCount
    }
  ] as const

  const quotaCards = computed(() =>
    quotaConfigs.map((config) => {
      const usedRaw = pickValue(usageInfo.value, [...config.usedKeys])
      const limitRaw = pickValue(usageInfo.value, [...config.limitKeys])
      const usedNumber = toNumber(usedRaw)
      const limitNumber = toNumber(limitRaw)

      return {
        label: config.label,
        usedText: formatTextWithFallback(config.formatter(usedRaw), '-'),
        limitText: limitRaw === undefined ? '不限' : config.formatter(limitRaw),
        hasLimit: limitNumber !== null && limitNumber > 0,
        hasProgress: usedNumber !== null && limitNumber !== null && limitNumber > 0,
        percent:
          usedNumber !== null && limitNumber !== null && limitNumber > 0
            ? Math.min(100, Math.round((usedNumber / limitNumber) * 100))
            : 0
      }
    })
  )

  const formatTextWithFallback = (value: string, fallback: string) => {
    if (!value || value === '-') {
      return fallback
    }

    return value
  }

  const loadUsage = async () => {
    loading.value = true
    errorMessage.value = ''

    try {
      const payload = await fetchTenantUsage()
      usageInfo.value = normalizePayload(payload)
    } catch (error) {
      console.error('[SaasTenantUsagePage] load usage failed:', error)
      errorMessage.value = '加载用量信息失败'
      usageInfo.value = null
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
