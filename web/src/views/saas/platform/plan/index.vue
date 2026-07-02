<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="saas-plan-page">
      <template #header>
        <div class="saas-plan-page__header">
          <div>
            <h1 class="saas-plan-page__title">SaaS 套餐管理</h1>
            <p class="saas-plan-page__subtitle">维护平台可售套餐、价格和资源配额。</p>
          </div>
          <ElButton type="primary" @click="openCreateDialog">新增套餐</ElButton>
        </div>
      </template>

      <div class="saas-plan-page__filters">
        <ElInput v-model="filters.keyword" clearable class="saas-plan-page__filter-item" placeholder="套餐编码或名称" @keyup.enter="loadPlans" />
        <ElSelect v-model="filters.status" clearable class="saas-plan-page__filter-item" placeholder="状态">
          <ElOption label="启用" :value="1" />
          <ElOption label="停用" :value="0" />
        </ElSelect>
        <ElButton type="primary" :loading="loading" @click="loadPlans">查询</ElButton>
        <ElButton @click="resetFilters">重置</ElButton>
      </div>

      <ElTable v-loading="loading" :data="records" border>
        <ElTableColumn prop="code" label="编码" width="150" />
        <ElTableColumn prop="name" label="名称" min-width="160" />
        <ElTableColumn label="默认周期" width="110">
          <template #default="{ row }">{{ row.billing_cycle === 'yearly' ? '年付' : '月付' }}</template>
        </ElTableColumn>
        <ElTableColumn label="月付价格" width="130">
          <template #default="{ row }">{{ formatMoney(row.price_monthly) }}</template>
        </ElTableColumn>
        <ElTableColumn label="年付价格" width="130">
          <template #default="{ row }">{{ formatMoney(row.price_yearly) }}</template>
        </ElTableColumn>
        <ElTableColumn label="状态" width="100">
          <template #default="{ row }">
            <ElTag :type="row.status === 1 ? 'success' : 'info'" effect="light">{{ row.status === 1 ? '启用' : '停用' }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="sort" label="排序" width="90" />
        <ElTableColumn prop="remark" label="备注" min-width="180" show-overflow-tooltip />
        <ElTableColumn label="更新时间" width="180">
          <template #default="{ row }">{{ formatDateTime(row.update_time) }}</template>
        </ElTableColumn>
        <ElTableColumn label="操作" fixed="right" width="260">
          <template #default="{ row }">
            <ElButton link type="primary" @click="openEditDialog(row)">编辑</ElButton>
            <ElButton link type="primary" @click="openQuotaDialog(row)">配额</ElButton>
            <ElButton link :type="row.status === 1 ? 'warning' : 'success'" @click="toggleStatus(row)">
              {{ row.status === 1 ? '停用' : '启用' }}
            </ElButton>
          </template>
        </ElTableColumn>
      </ElTable>

      <ElPagination
        v-model:current-page="pager.page"
        v-model:page-size="pager.limit"
        class="saas-plan-page__pagination"
        layout="total, sizes, prev, pager, next"
        :page-sizes="[10, 20, 50, 100]"
        :total="pager.total"
        @current-change="loadPlans"
        @size-change="handleSizeChange"
      />
    </ElCard>

    <ElDialog v-model="planDialogVisible" :title="editingCode ? '编辑套餐' : '新增套餐'" width="560px">
      <ElForm label-width="96px">
        <ElFormItem label="编码">
          <ElInput v-model="planForm.code" :disabled="Boolean(editingCode)" maxlength="50" />
        </ElFormItem>
        <ElFormItem label="名称">
          <ElInput v-model="planForm.name" maxlength="100" />
        </ElFormItem>
        <ElFormItem label="默认周期">
          <ElRadioGroup v-model="planForm.billing_cycle">
            <ElRadioButton value="monthly">月付</ElRadioButton>
            <ElRadioButton value="yearly">年付</ElRadioButton>
          </ElRadioGroup>
        </ElFormItem>
        <ElFormItem label="月付价格">
          <ElInputNumber v-model="planForm.price_monthly_yuan" :min="0" :precision="2" :step="10" />
        </ElFormItem>
        <ElFormItem label="年付价格">
          <ElInputNumber v-model="planForm.price_yearly_yuan" :min="0" :precision="2" :step="100" />
        </ElFormItem>
        <ElFormItem label="状态">
          <ElSwitch v-model="planForm.status" :active-value="1" :inactive-value="0" />
        </ElFormItem>
        <ElFormItem label="排序">
          <ElInputNumber v-model="planForm.sort" :min="0" :step="10" />
        </ElFormItem>
        <ElFormItem label="备注">
          <ElInput v-model="planForm.remark" type="textarea" maxlength="255" show-word-limit />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="planDialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="savingPlan" @click="savePlan">保存</ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="quotaDialogVisible" title="套餐配额" width="680px">
      <ElTable :data="quotaRows" border>
        <ElTableColumn label="资源" min-width="160">
          <template #default="{ row }">{{ quotaLabels[row.quota_type] || row.quota_type }}</template>
        </ElTableColumn>
        <ElTableColumn label="额度" width="180">
          <template #default="{ row }">
            <ElInputNumber v-model="row.total_quota" :min="0" :step="100" controls-position="right" />
          </template>
        </ElTableColumn>
        <ElTableColumn label="启用" width="100">
          <template #default="{ row }">
            <ElSwitch v-model="row.status" :active-value="1" :inactive-value="0" />
          </template>
        </ElTableColumn>
        <ElTableColumn label="备注" min-width="180">
          <template #default="{ row }">
            <ElInput v-model="row.remark" maxlength="255" />
          </template>
        </ElTableColumn>
      </ElTable>
      <template #footer>
        <ElButton @click="quotaDialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="savingQuotas" @click="saveQuotas">保存</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import {
    createPlatformPlan,
    fetchPlatformPlans,
    updatePlatformPlan,
    updatePlatformPlanQuotas,
    updatePlatformPlanStatus,
    type SaasPlanQuotaRecord,
    type SaasPlatformPlanRecord
  } from '@/api/saas'

  defineOptions({ name: 'SaasPlatformPlanPage' })

  const records = ref<SaasPlatformPlanRecord[]>([])
  const loading = ref(false)
  const filters = reactive<{ keyword: string; status: number | string }>({ keyword: '', status: '' })
  const pager = reactive({ page: 1, limit: 20, total: 0 })
  const planDialogVisible = ref(false)
  const quotaDialogVisible = ref(false)
  const savingPlan = ref(false)
  const savingQuotas = ref(false)
  const editingCode = ref('')
  const quotaEditingCode = ref('')
  const planForm = reactive({ code: '', name: '', billing_cycle: 'monthly' as 'monthly' | 'yearly', price_monthly_yuan: 0, price_yearly_yuan: 0, status: 1, sort: 100, remark: '' })
  const quotaRows = ref<SaasPlanQuotaRecord[]>([])

  const quotaTypes = ['users', 'storage_mb', 'ai_calls', 'rag_documents', 'tokens']
  const quotaLabels: Record<string, string> = {
    users: '用户数',
    storage_mb: '存储 MB',
    ai_calls: 'AI 调用',
    rag_documents: '知识库文档',
    tokens: 'Token'
  }

  const dateFormatter = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

  function centsToYuan(value: number) {
    return Number(((Number(value) || 0) / 100).toFixed(2))
  }

  function yuanToCents(value: number) {
    return Math.round((Number(value) || 0) * 100)
  }

  function formatMoney(value: number) {
    return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format((Number(value) || 0) / 100)
  }

  function formatDateTime(value: unknown) {
    if (!value) return '-'
    const date = value instanceof Date ? value : new Date(String(value))
    return Number.isNaN(date.getTime()) ? String(value) : dateFormatter.format(date)
  }

  async function loadPlans() {
    loading.value = true
    try {
      const result = await fetchPlatformPlans({ page: pager.page, limit: pager.limit, keyword: filters.keyword || undefined, status: filters.status === '' ? undefined : filters.status })
      records.value = result.list || []
      pager.total = Number(result.total) || 0
    } finally {
      loading.value = false
    }
  }

  function resetFilters() {
    filters.keyword = ''
    filters.status = ''
    pager.page = 1
    loadPlans()
  }

  function handleSizeChange() {
    pager.page = 1
    loadPlans()
  }

  function openCreateDialog() {
    editingCode.value = ''
    Object.assign(planForm, { code: '', name: '', billing_cycle: 'monthly', price_monthly_yuan: 0, price_yearly_yuan: 0, status: 1, sort: 100, remark: '' })
    planDialogVisible.value = true
  }

  function openEditDialog(row: SaasPlatformPlanRecord) {
    editingCode.value = row.code
    Object.assign(planForm, { code: row.code, name: row.name, billing_cycle: row.billing_cycle as 'monthly' | 'yearly', price_monthly_yuan: centsToYuan(row.price_monthly), price_yearly_yuan: centsToYuan(row.price_yearly), status: row.status, sort: row.sort, remark: row.remark || '' })
    planDialogVisible.value = true
  }

  async function savePlan() {
    savingPlan.value = true
    try {
      const payload = { name: planForm.name, billing_cycle: planForm.billing_cycle, price_monthly: yuanToCents(planForm.price_monthly_yuan), price_yearly: yuanToCents(planForm.price_yearly_yuan), status: planForm.status, sort: planForm.sort, remark: planForm.remark }
      if (editingCode.value) {
        await updatePlatformPlan(editingCode.value, payload)
      } else {
        await createPlatformPlan({ ...payload, code: planForm.code })
      }
      ElMessage.success('套餐已保存')
      planDialogVisible.value = false
      await loadPlans()
    } finally {
      savingPlan.value = false
    }
  }

  function openQuotaDialog(row: SaasPlatformPlanRecord) {
    quotaEditingCode.value = row.code
    const quotaMap = new Map((row.quotas || []).map((item) => [item.quota_type, item]))
    quotaRows.value = quotaTypes.map((type) => ({ quota_type: type, total_quota: Number(quotaMap.get(type)?.total_quota) || 0, status: quotaMap.get(type)?.status ?? 1, remark: quotaMap.get(type)?.remark || '' }))
    quotaDialogVisible.value = true
  }

  async function saveQuotas() {
    if (!quotaEditingCode.value) return
    savingQuotas.value = true
    try {
      await updatePlatformPlanQuotas(quotaEditingCode.value, quotaRows.value)
      ElMessage.success('配额已保存')
      quotaDialogVisible.value = false
      await loadPlans()
    } finally {
      savingQuotas.value = false
    }
  }

  async function toggleStatus(row: SaasPlatformPlanRecord) {
    await updatePlatformPlanStatus(row.code, row.status === 1 ? 0 : 1)
    ElMessage.success(row.status === 1 ? '套餐已停用' : '套餐已启用')
    await loadPlans()
  }

  onMounted(() => {
    loadPlans()
  })
</script>

<style scoped>
  .saas-plan-page {
    min-height: 100%;
  }

  .saas-plan-page__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .saas-plan-page__title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.4;
  }

  .saas-plan-page__subtitle {
    margin: 6px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.5;
  }

  .saas-plan-page__filters {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 16px;
  }

  .saas-plan-page__filter-item {
    width: 200px;
  }

  .saas-plan-page__pagination {
    margin-top: 16px;
    justify-content: flex-end;
  }
</style>