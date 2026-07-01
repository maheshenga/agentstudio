<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="tenant-plan-page">
      <template #header>
        <div class="tenant-plan-page__header">
          <div>
            <h1 class="tenant-plan-page__title">租户套餐概览</h1>
            <p class="tenant-plan-page__subtitle">查看当前套餐、试用到期时间和订阅状态。</p>
          </div>
          <ElButton :loading="loading" @click="loadSubscription">刷新</ElButton>
        </div>
      </template>

      <div v-if="loading" class="tenant-plan-page__state">
        <ElSkeleton animated :rows="4" />
      </div>

      <ElResult
        v-else-if="errorMessage"
        icon="error"
        :title="errorMessage"
        sub-title="请稍后重试。"
      >
        <template #extra>
          <ElButton type="primary" :loading="loading" @click="loadSubscription">重试</ElButton>
        </template>
      </ElResult>

      <div v-else-if="!subscriptionInfo" class="tenant-plan-page__state">
        <ElEmpty description="暂无订阅信息" />
        <ElButton type="primary" :loading="loading" @click="loadSubscription">刷新</ElButton>
      </div>

      <div v-else class="tenant-plan-page__content">
        <ElDescriptions :column="1" border>
          <ElDescriptionsItem label="当前套餐">
            {{ currentPlanText }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="试用结束时间">
            {{ trialEndTimeText }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="订阅状态">
            <ElTag :type="subscriptionTagType" effect="light">
              {{ subscriptionStatusText }}
            </ElTag>
          </ElDescriptionsItem>
        </ElDescriptions>

        <div class="tenant-plan-page__actions">
          <ElButton type="primary" disabled>
            {{ disabledUpgradeText }}
          </ElButton>
        </div>
      </div>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { fetchTenantSubscription, type TenantSubscriptionSummary } from '@/api/saas'

  defineOptions({ name: 'SaasTenantPlanPage' })

  const disabledUpgradeText = '支付功能将在第二期开放'
  const subscriptionInfo = ref<TenantSubscriptionSummary | null>(null)
  const loading = ref(false)
  const errorMessage = ref('')

  const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })

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

  const formatText = (value: unknown) => {
    if (value === undefined || value === null || value === '') {
      return '-'
    }

    return String(value)
  }

  const formatDateTime = (value: unknown) => {
    if (value === undefined || value === null || value === '') {
      return '-'
    }

    const asDate =
      value instanceof Date
        ? value
        : new Date(typeof value === 'number' ? value : String(value))

    if (!Number.isNaN(asDate.getTime())) {
      return dateFormatter.format(asDate)
    }

    const numericValue = Number(value)
    if (Number.isFinite(numericValue)) {
      const numericDate = new Date(numericValue)
      if (!Number.isNaN(numericDate.getTime())) {
        return dateFormatter.format(numericDate)
      }
    }

    return String(value)
  }

  const subscriptionStatus = computed(() => {
    const rawStatus = pickValue(subscriptionInfo.value, [
      'subscription_status',
      'subscriptionStatus',
      'status'
    ])

    if (rawStatus === undefined) {
      return { text: '-', type: 'info' as const }
    }

    const normalized = String(rawStatus).trim().toLowerCase()
    const statusMap: Record<string, { text: string; type: 'success' | 'warning' | 'info' | 'danger' }> = {
      active: { text: '正常', type: 'success' },
      enabled: { text: '正常', type: 'success' },
      trial: { text: '试用中', type: 'warning' },
      expired: { text: '已过期', type: 'info' },
      cancelled: { text: '已取消', type: 'danger' },
      canceled: { text: '已取消', type: 'danger' },
      paused: { text: '已暂停', type: 'warning' },
      pending: { text: '待生效', type: 'warning' },
      inactive: { text: '未开通', type: 'info' },
      disabled: { text: '已停用', type: 'danger' },
      '1': { text: '正常', type: 'success' },
      '2': { text: '试用中', type: 'warning' },
      '0': { text: '未开通', type: 'info' }
    }

    return statusMap[normalized] ?? {
      text: formatText(rawStatus),
      type:
        normalized.includes('fail') || normalized.includes('cancel') || normalized.includes('disable')
          ? 'danger'
          : normalized.includes('trial') || normalized.includes('pending')
            ? 'warning'
            : 'info'
    }
  })

  const currentPlanText = computed(() =>
    formatText(
      pickValue(subscriptionInfo.value, ['current_plan', 'currentPlan', 'plan_name', 'planName'])
    )
  )

  const trialEndTimeText = computed(() =>
    formatDateTime(
      pickValue(subscriptionInfo.value, ['trial_end_time', 'trialEndTime', 'trial_end_at', 'trialEndAt'])
    )
  )

  const subscriptionStatusText = computed(() => subscriptionStatus.value.text)
  const subscriptionTagType = computed(() => subscriptionStatus.value.type)

  const loadSubscription = async () => {
    loading.value = true
    errorMessage.value = ''

    try {
      const payload = await fetchTenantSubscription()
      subscriptionInfo.value = normalizePayload(payload)
    } catch (error) {
      console.error('[SaasTenantPlanPage] load subscription failed:', error)
      errorMessage.value = '加载订阅信息失败'
      subscriptionInfo.value = null
    } finally {
      loading.value = false
    }
  }

  onMounted(() => {
    loadSubscription()
  })
</script>

<style scoped>
  .tenant-plan-page {
    min-height: 100%;
  }

  .tenant-plan-page__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .tenant-plan-page__title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.4;
  }

  .tenant-plan-page__subtitle {
    margin: 6px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.5;
  }

  .tenant-plan-page__state {
    display: grid;
    gap: 16px;
    justify-items: start;
    padding: 24px 0;
  }

  .tenant-plan-page__content {
    display: grid;
    gap: 20px;
  }

  .tenant-plan-page__actions {
    display: flex;
    justify-content: flex-end;
  }
</style>
