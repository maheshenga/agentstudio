<template>
  <div class="art-full-height p-5 tenant-resource-pack-page">
    <section class="tenant-resource-pack-page__header">
      <div>
        <h1 class="tenant-resource-pack-page__title">资源包</h1>
        <p class="tenant-resource-pack-page__subtitle">按需查看可购买的额外资源包。</p>
      </div>
      <ElButton :loading="loading" @click="loadResourcePacks">刷新</ElButton>
    </section>

    <ElSkeleton v-if="loading && !records.length" animated :rows="6" />

    <ElResult v-else-if="errorMessage" icon="error" :title="errorMessage" sub-title="请稍后重试。">
      <template #extra>
        <ElButton type="primary" :loading="loading" @click="loadResourcePacks">重试</ElButton>
      </template>
    </ElResult>

    <section v-else-if="!records.length" class="tenant-resource-pack-page__state">
      <ElEmpty description="暂无可购买资源包" />
      <ElButton type="primary" :loading="loading" @click="loadResourcePacks">刷新</ElButton>
    </section>

    <section v-else class="tenant-resource-pack-page__grid">
      <article v-for="pack in records" :key="pack.code" class="tenant-resource-pack-page__pack">
        <div class="tenant-resource-pack-page__pack-header">
          <div>
            <p class="tenant-resource-pack-page__pack-type">{{ formatResourceType(pack.resource_type) }}</p>
            <h2 class="tenant-resource-pack-page__pack-name">{{ pack.name }}</h2>
          </div>
          <ElTag effect="light">即将开放</ElTag>
        </div>

        <div class="tenant-resource-pack-page__quota">{{ formatQuota(pack) }}</div>
        <div class="tenant-resource-pack-page__price">{{ formatPrice(pack.price_cents, pack.currency) }}</div>
        <p class="tenant-resource-pack-page__remark">{{ pack.remark || '资源包说明待补充' }}</p>
        <ElButton type="primary" disabled>即将开放</ElButton>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
  import {
    fetchTenantResourcePacks,
    type SaasResourcePackRecord
  } from '@/api/saas'

  defineOptions({ name: 'SaasTenantResourcePackPage' })

  const records = ref<SaasResourcePackRecord[]>([])
  const loading = ref(false)
  const errorMessage = ref('')

  const resourceLabels: Record<string, string> = {
    ai_calls: 'AI 调用次数',
    tokens: 'Token',
    storage_mb: '存储空间',
    rag_documents: '知识库文档'
  }

  async function loadResourcePacks() {
    loading.value = true
    errorMessage.value = ''

    try {
      records.value = await fetchTenantResourcePacks()
    } catch (error) {
      console.error('[SaasTenantResourcePackPage] load resource packs failed:', error)
      records.value = []
      errorMessage.value = '加载资源包失败'
    } finally {
      loading.value = false
    }
  }

  function formatResourceType(resourceType: string) {
    return resourceLabels[resourceType] || resourceType
  }

  function formatQuota(record: SaasResourcePackRecord) {
    const amount = Number(record.quota_amount) || 0
    const formattedAmount = new Intl.NumberFormat('zh-CN').format(amount)

    if (record.resource_type === 'storage_mb') {
      return `${formattedAmount} MB`
    }

    return formattedAmount
  }

  function formatPrice(priceCents: number, currency = 'CNY') {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency
    }).format((Number(priceCents) || 0) / 100)
  }

  onMounted(() => {
    loadResourcePacks()
  })
</script>

<style scoped>
  .tenant-resource-pack-page {
    display: grid;
    align-content: start;
    gap: 20px;
  }

  .tenant-resource-pack-page__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .tenant-resource-pack-page__title,
  .tenant-resource-pack-page__pack-name {
    margin: 0;
    line-height: 1.4;
    letter-spacing: 0;
  }

  .tenant-resource-pack-page__title {
    font-size: 20px;
    font-weight: 600;
  }

  .tenant-resource-pack-page__subtitle,
  .tenant-resource-pack-page__pack-type,
  .tenant-resource-pack-page__remark {
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.5;
  }

  .tenant-resource-pack-page__subtitle,
  .tenant-resource-pack-page__pack-type,
  .tenant-resource-pack-page__remark {
    margin: 6px 0 0;
  }

  .tenant-resource-pack-page__state {
    display: grid;
    justify-items: start;
    gap: 16px;
    padding: 24px 0;
  }

  .tenant-resource-pack-page__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 16px;
  }

  .tenant-resource-pack-page__pack {
    display: grid;
    align-content: start;
    gap: 16px;
    min-height: 250px;
    border: 1px solid var(--el-border-color);
    border-radius: 8px;
    background: var(--el-bg-color);
    padding: 18px;
  }

  .tenant-resource-pack-page__pack-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .tenant-resource-pack-page__pack-name {
    font-size: 17px;
    font-weight: 600;
  }

  .tenant-resource-pack-page__quota {
    font-size: 30px;
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: 0;
  }

  .tenant-resource-pack-page__price {
    font-size: 16px;
    font-weight: 600;
    line-height: 1.4;
  }

  .tenant-resource-pack-page__remark {
    min-height: 40px;
  }

  @media (max-width: 768px) {
    .tenant-resource-pack-page__header {
      display: grid;
    }
  }
</style>
