<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="saas-resource-pack-page">
      <template #header>
        <div class="saas-resource-pack-page__header">
          <div>
            <h1 class="saas-resource-pack-page__title">资源包管理</h1>
            <p class="saas-resource-pack-page__subtitle">查看平台可售的资源包目录。</p>
          </div>
          <ElButton :loading="loading" @click="loadResourcePacks">刷新</ElButton>
        </div>
      </template>

      <div class="saas-resource-pack-page__filters">
        <ElSelect
          v-model="filters.resource_type"
          clearable
          placeholder="资源类型"
          class="saas-resource-pack-page__select"
          @change="refreshResourcePacks"
        >
          <ElOption label="AI 调用次数" value="ai_calls" />
          <ElOption label="Token" value="tokens" />
          <ElOption label="存储空间" value="storage_mb" />
          <ElOption label="知识库文档" value="rag_documents" />
        </ElSelect>
        <ElSelect
          v-model="filters.status"
          clearable
          placeholder="状态"
          class="saas-resource-pack-page__status-select"
          @change="refreshResourcePacks"
        >
          <ElOption label="启用" :value="1" />
          <ElOption label="停用" :value="0" />
        </ElSelect>
        <ElButton type="primary" :loading="loading" @click="refreshResourcePacks">查询</ElButton>
      </div>

      <div v-if="loadError" class="saas-resource-pack-page__load-error">
        <ElAlert type="error" :title="loadError" show-icon :closable="false" />
        <ElButton size="small" type="primary" link :loading="loading" @click="loadResourcePacks">重试</ElButton>
      </div>

      <ElTable v-loading="loading" :data="records" border>
        <ElTableColumn prop="code" label="编码" width="170" show-overflow-tooltip />
        <ElTableColumn prop="name" label="名称" min-width="180" show-overflow-tooltip />
        <ElTableColumn label="资源类型" width="150">
          <template #default="{ row }">{{ formatResourceType(row.resource_type) }}</template>
        </ElTableColumn>
        <ElTableColumn label="额度" width="160">
          <template #default="{ row }">{{ formatQuota(row) }}</template>
        </ElTableColumn>
        <ElTableColumn label="价格" width="130">
          <template #default="{ row }">{{ formatPrice(row.price_cents, row.currency) }}</template>
        </ElTableColumn>
        <ElTableColumn label="状态" width="100">
          <template #default="{ row }">
            <ElTag :type="row.status === 1 ? 'success' : 'info'" effect="light">
              {{ row.status === 1 ? '启用' : '停用' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="sort" label="排序" width="90" />
        <ElTableColumn prop="remark" label="说明" min-width="220" show-overflow-tooltip />
        <template #empty>
          <ElEmpty description="暂无资源包数据" />
        </template>
      </ElTable>

      <ElPagination
        v-model:current-page="pager.page"
        v-model:page-size="pager.limit"
        class="saas-resource-pack-page__pagination"
        layout="total, sizes, prev, pager, next"
        :page-sizes="[10, 20, 50, 100]"
        :total="pager.total"
        @current-change="loadResourcePacks"
        @size-change="handleSizeChange"
      />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import {
    fetchPlatformResourcePacks,
    type SaasResourcePackRecord
  } from '@/api/saas'

  defineOptions({ name: 'SaasPlatformResourcePackPage' })

  const records = ref<SaasResourcePackRecord[]>([])
  const loading = ref(false)
  const loadError = ref('')
  const filters = reactive({
    resource_type: '',
    status: '' as number | ''
  })
  const pager = reactive({
    page: 1,
    limit: 20,
    total: 0
  })

  const resourceLabels: Record<string, string> = {
    ai_calls: 'AI 调用次数',
    tokens: 'Token',
    storage_mb: '存储空间',
    rag_documents: '知识库文档'
  }

  async function loadResourcePacks() {
    loading.value = true
    loadError.value = ''

    try {
      const result = await fetchPlatformResourcePacks({
        page: pager.page,
        limit: pager.limit,
        resource_type: filters.resource_type || undefined,
        status: filters.status === '' ? undefined : filters.status
      })
      records.value = result.list || []
      pager.total = Number(result.total) || 0
    } catch (error) {
      console.error('[SaasPlatformResourcePackPage] load resource packs failed:', error)
      loadError.value = '资源包列表加载失败'
      ElMessage.error(loadError.value)
    } finally {
      loading.value = false
    }
  }

  function refreshResourcePacks() {
    pager.page = 1
    loadResourcePacks()
  }

  function handleSizeChange() {
    pager.page = 1
    loadResourcePacks()
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
  .saas-resource-pack-page {
    min-height: 100%;
  }

  .saas-resource-pack-page__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .saas-resource-pack-page__title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.4;
    letter-spacing: 0;
  }

  .saas-resource-pack-page__subtitle {
    margin: 6px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.5;
  }

  .saas-resource-pack-page__filters {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 16px;
  }

  .saas-resource-pack-page__select {
    width: 180px;
  }

  .saas-resource-pack-page__status-select {
    width: 140px;
  }

  .saas-resource-pack-page__load-error {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .saas-resource-pack-page__pagination {
    margin-top: 16px;
    justify-content: flex-end;
  }
</style>
