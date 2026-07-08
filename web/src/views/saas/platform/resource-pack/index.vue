<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="saas-resource-pack-page">
      <template #header>
        <div class="saas-resource-pack-page__header">
          <div>
            <h1 class="saas-resource-pack-page__title">资源包管理</h1>
            <p class="saas-resource-pack-page__subtitle">维护平台可售资源包目录，控制租户可购买的额外额度。</p>
          </div>
          <div class="saas-resource-pack-page__actions">
            <ElButton :loading="loading" @click="loadResourcePacks">刷新</ElButton>
            <ElButton type="primary" @click="openCreateDialog">新建资源包</ElButton>
          </div>
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
          <ElOption v-for="item in resourceTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
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
        <ElButton @click="resetFilters">重置</ElButton>
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
        <ElTableColumn label="操作" fixed="right" width="170">
          <template #default="{ row }">
            <ElButton type="primary" link @click="openEditDialog(row)">编辑</ElButton>
            <ElButton link :type="row.status === 1 ? 'warning' : 'success'" @click="toggleStatus(row)">
              {{ row.status === 1 ? '停用' : '启用' }}
            </ElButton>
          </template>
        </ElTableColumn>
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

    <ElDialog v-model="dialogVisible" :title="editingCode ? '编辑资源包' : '新建资源包'" width="620px">
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="112px">
        <ElFormItem label="编码" prop="code">
          <ElInput v-model.trim="form.code" :disabled="Boolean(editingCode)" maxlength="50" clearable />
        </ElFormItem>
        <ElFormItem label="名称" prop="name">
          <ElInput v-model.trim="form.name" maxlength="100" clearable />
        </ElFormItem>
        <ElFormItem label="资源类型" prop="resource_type">
          <ElSelect v-model="form.resource_type" class="saas-resource-pack-page__form-control">
            <ElOption v-for="item in resourceTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="额度" prop="quota_amount">
          <ElInputNumber v-model="form.quota_amount" :min="1" :step="100" controls-position="right" />
        </ElFormItem>
        <ElFormItem label="价格（分）" prop="price_cents">
          <ElInputNumber v-model="form.price_cents" :min="0" :step="100" controls-position="right" />
        </ElFormItem>
        <ElFormItem label="币种" prop="currency">
          <ElInput v-model.trim="form.currency" maxlength="10" clearable />
        </ElFormItem>
        <ElFormItem label="状态">
          <ElSwitch v-model="form.status" :active-value="1" :inactive-value="0" />
        </ElFormItem>
        <ElFormItem label="排序">
          <ElInputNumber v-model="form.sort" :min="0" :step="10" controls-position="right" />
        </ElFormItem>
        <ElFormItem label="说明">
          <ElInput v-model="form.remark" type="textarea" maxlength="255" show-word-limit />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="saving" @click="saveResourcePack">保存</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import type { FormInstance, FormRules } from 'element-plus'
  import {
    createPlatformResourcePack,
    fetchPlatformResourcePacks,
    updatePlatformResourcePack,
    updatePlatformResourcePackStatus,
    type SaasResourcePackRecord,
    type SaveSaasResourcePackParams
  } from '@/api/saas'

  defineOptions({ name: 'SaasPlatformResourcePackPage' })

  const records = ref<SaasResourcePackRecord[]>([])
  const loading = ref(false)
  const loadError = ref('')
  const saving = ref(false)
  const dialogVisible = ref(false)
  const editingCode = ref('')
  const formRef = ref<FormInstance>()
  const filters = reactive({
    resource_type: '',
    status: '' as number | ''
  })
  const pager = reactive({
    page: 1,
    limit: 20,
    total: 0
  })
  const resourceTypeOptions = [
    { label: '用户数', value: 'users' },
    { label: 'AI 调用次数', value: 'ai_calls' },
    { label: 'Token', value: 'tokens' },
    { label: '存储空间', value: 'storage_mb' },
    { label: '知识库文档', value: 'rag_documents' }
  ]
  const form = reactive({
    code: '',
    name: '',
    resource_type: 'tokens',
    quota_amount: 1000,
    price_cents: 0,
    currency: 'CNY',
    status: 1,
    sort: 100,
    remark: ''
  })
  const rules: FormRules = {
    code: [
      { required: true, message: '请输入资源包编码', trigger: 'blur' },
      { pattern: /^[a-z0-9_-]+$/, message: '编码只能使用小写字母、数字、下划线或连字符', trigger: 'blur' }
    ],
    name: [{ required: true, message: '请输入资源包名称', trigger: 'blur' }],
    resource_type: [{ required: true, message: '请选择资源类型', trigger: 'change' }],
    quota_amount: [{ required: true, type: 'number', min: 1, message: '额度必须大于 0', trigger: 'change' }],
    price_cents: [{ required: true, type: 'number', min: 0, message: '价格不能小于 0', trigger: 'change' }]
  }
  const resourceLabels = Object.fromEntries(resourceTypeOptions.map((item) => [item.value, item.label])) as Record<string, string>

  function resetForm() {
    Object.assign(form, {
      code: '',
      name: '',
      resource_type: 'tokens',
      quota_amount: 1000,
      price_cents: 0,
      currency: 'CNY',
      status: 1,
      sort: 100,
      remark: ''
    })
    formRef.value?.clearValidate()
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

  function resetFilters() {
    filters.resource_type = ''
    filters.status = ''
    refreshResourcePacks()
  }

  function handleSizeChange() {
    pager.page = 1
    loadResourcePacks()
  }

  function openCreateDialog() {
    editingCode.value = ''
    resetForm()
    dialogVisible.value = true
  }

  function openEditDialog(row: SaasResourcePackRecord) {
    editingCode.value = row.code
    Object.assign(form, {
      code: row.code,
      name: row.name,
      resource_type: row.resource_type,
      quota_amount: Number(row.quota_amount) || 1,
      price_cents: Number(row.price_cents) || 0,
      currency: row.currency || 'CNY',
      status: row.status,
      sort: row.sort ?? 100,
      remark: row.remark || ''
    })
    formRef.value?.clearValidate()
    dialogVisible.value = true
  }

  function buildPayload(): SaveSaasResourcePackParams {
    return {
      code: form.code.trim(),
      name: form.name.trim(),
      resource_type: form.resource_type,
      quota_amount: Number(form.quota_amount) || 0,
      price_cents: Number(form.price_cents) || 0,
      currency: form.currency.trim() || 'CNY',
      status: form.status,
      sort: Number(form.sort) || 0,
      remark: form.remark.trim() || undefined
    }
  }

  async function saveResourcePack() {
    await formRef.value?.validate()
    saving.value = true
    try {
      const payload = buildPayload()
      if (editingCode.value) {
        await updatePlatformResourcePack(editingCode.value, payload)
      } else {
        await createPlatformResourcePack(payload)
      }
      ElMessage.success('资源包已保存')
      dialogVisible.value = false
      await loadResourcePacks()
    } finally {
      saving.value = false
    }
  }

  async function toggleStatus(row: SaasResourcePackRecord) {
    await updatePlatformResourcePackStatus(row.code, row.status === 1 ? 0 : 1)
    ElMessage.success(row.status === 1 ? '资源包已停用' : '资源包已启用')
    await loadResourcePacks()
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

  .saas-resource-pack-page__actions,
  .saas-resource-pack-page__filters {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
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
    margin-bottom: 16px;
  }

  .saas-resource-pack-page__select {
    width: 180px;
  }

  .saas-resource-pack-page__status-select {
    width: 140px;
  }

  .saas-resource-pack-page__form-control {
    width: 100%;
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

  @media (max-width: 640px) {
    .saas-resource-pack-page__header {
      flex-direction: column;
    }

    .saas-resource-pack-page__actions,
    .saas-resource-pack-page__select,
    .saas-resource-pack-page__status-select {
      width: 100%;
    }
  }
</style>
