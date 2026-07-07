<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="saas-platform-tenant-page">
      <template #header>
        <div class="saas-platform-tenant-page__header">
          <div>
            <h1 class="saas-platform-tenant-page__title">租户运营</h1>
            <p class="saas-platform-tenant-page__subtitle">查看租户状态、成员规模和当前套餐，快速创建新租户。</p>
          </div>
          <div class="saas-platform-tenant-page__header-actions">
            <ElButton :icon="Refresh" :loading="loading" @click="loadTenants">刷新</ElButton>
            <ElButton type="primary" :icon="Plus" @click="openCreateDialog">新建租户</ElButton>
          </div>
        </div>
      </template>

      <div class="saas-platform-tenant-page__filters">
        <ElInput
          v-model="filters.keyword"
          clearable
          class="saas-platform-tenant-page__filter-item"
          placeholder="租户名称、编码、联系人或邮箱"
          @clear="refreshTenants"
          @keyup.enter="refreshTenants"
        />
        <ElSelect
          v-model="filters.status"
          clearable
          class="saas-platform-tenant-page__filter-item"
          placeholder="租户状态"
          @change="refreshTenants"
        >
          <ElOption label="启用" value="1" />
          <ElOption label="停用" value="0" />
        </ElSelect>
        <ElButton type="primary" :icon="Search" :loading="loading" @click="refreshTenants">查询</ElButton>
        <ElButton @click="resetFilters">重置</ElButton>
      </div>

      <ElTable v-loading="loading" :data="records" border>
        <ElTableColumn prop="tenant_name" label="租户名称" min-width="180" show-overflow-tooltip />
        <ElTableColumn prop="tenant_code" label="租户编码" min-width="140" show-overflow-tooltip />
        <ElTableColumn label="当前套餐" min-width="150">
          <template #default="{ row }">{{ formatPlan(row) }}</template>
        </ElTableColumn>
        <ElTableColumn label="成员数" width="100" align="right">
          <template #default="{ row }">{{ formatNumber(row.user_count) }}</template>
        </ElTableColumn>
        <ElTableColumn label="订阅状态" width="120">
          <template #default="{ row }">
            <ElTag :type="subscriptionTagType(row.subscription_status)" effect="light">
              {{ subscriptionStatusLabel(row.subscription_status) }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="租户状态" width="110">
          <template #default="{ row }">
            <ElTag :type="row.status === 1 ? 'success' : 'info'" effect="light">
              {{ row.status === 1 ? '启用' : '停用' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="contact_name" label="联系人" min-width="120" show-overflow-tooltip />
        <ElTableColumn prop="contact_phone" label="联系电话" min-width="140" show-overflow-tooltip />
        <ElTableColumn prop="contact_email" label="联系邮箱" min-width="180" show-overflow-tooltip />
        <ElTableColumn label="到期时间" min-width="170">
          <template #default="{ row }">{{ formatDate(row.subscription_end_time) }}</template>
        </ElTableColumn>
        <ElTableColumn label="创建时间" min-width="170">
          <template #default="{ row }">{{ formatDate(row.create_time) }}</template>
        </ElTableColumn>
        <template #empty>
          <ElEmpty description="暂无租户数据" />
        </template>
      </ElTable>

      <ElPagination
        v-model:current-page="pager.page"
        v-model:page-size="pager.limit"
        class="saas-platform-tenant-page__pagination"
        layout="total, sizes, prev, pager, next"
        :page-sizes="[10, 20, 50, 100]"
        :total="pager.total"
        @current-change="loadTenants"
        @size-change="handleSizeChange"
      />
    </ElCard>

    <ElDialog v-model="createDialogVisible" title="新建租户" width="620px">
      <ElForm
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="110px"
        class="saas-platform-tenant-page__form"
      >
        <ElFormItem label="租户名称" prop="tenant_name">
          <ElInput v-model.trim="form.tenant_name" maxlength="100" clearable />
        </ElFormItem>

        <ElFormItem label="租户编码" prop="tenant_code">
          <ElInput v-model.trim="form.tenant_code" maxlength="50" clearable />
        </ElFormItem>

        <ElFormItem label="管理员账号" prop="owner_username">
          <ElInput v-model.trim="form.owner_username" maxlength="64" clearable />
        </ElFormItem>

        <ElFormItem label="管理员密码" prop="owner_password">
          <ElInput v-model.trim="form.owner_password" maxlength="100" show-password clearable />
        </ElFormItem>

        <ElFormItem label="管理员姓名" prop="owner_realname">
          <ElInput v-model.trim="form.owner_realname" maxlength="64" clearable />
        </ElFormItem>

        <ElFormItem label="初始套餐" prop="plan_code">
          <ElSelect v-model="form.plan_code" class="saas-platform-tenant-page__select">
            <ElOption label="Free" value="free" />
            <ElOption label="Pro" value="pro" />
            <ElOption label="Enterprise" value="enterprise" />
          </ElSelect>
        </ElFormItem>

        <ElFormItem label="开通试用">
          <ElSwitch v-model="form.with_trial" />
        </ElFormItem>
      </ElForm>

      <template #footer>
        <ElButton :disabled="submitting" @click="createDialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="submitting" @click="submit">创建</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { Plus, Refresh, Search } from '@element-plus/icons-vue'
  import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
  import {
    createSaasTenantFromPlatform,
    fetchPlatformTenants,
    type SaasPlatformTenantRecord,
    type SaasTenantProvisionParams
  } from '@/api/saas'

  defineOptions({ name: 'SaasPlatformTenantPage' })

  const records = ref<SaasPlatformTenantRecord[]>([])
  const loading = ref(false)
  const submitting = ref(false)
  const createDialogVisible = ref(false)
  const formRef = ref<FormInstance>()
  const filters = reactive<{ keyword: string; status: string }>({ keyword: '', status: '' })
  const pager = reactive({ page: 1, limit: 20, total: 0 })

  const defaultForm = (): SaasTenantProvisionParams => ({
    tenant_name: '',
    tenant_code: '',
    owner_username: '',
    owner_password: '',
    owner_realname: '',
    plan_code: 'free',
    with_trial: true
  })

  const form = reactive<SaasTenantProvisionParams>(defaultForm())

  const rules: FormRules<SaasTenantProvisionParams> = {
    tenant_name: [{ required: true, message: '请输入租户名称', trigger: 'blur' }],
    tenant_code: [{ required: true, message: '请输入租户编码', trigger: 'blur' }],
    owner_username: [
      { required: true, message: '请输入管理员账号', trigger: 'blur' },
      { min: 2, message: '至少 2 个字符', trigger: 'blur' }
    ],
    owner_password: [
      { required: true, message: '请输入管理员密码', trigger: 'blur' },
      { min: 8, message: '至少 8 个字符', trigger: 'blur' }
    ]
  }

  function formatNumber(value: number) {
    return new Intl.NumberFormat('zh-CN').format(Number(value) || 0)
  }

  function formatDate(value?: string | Date | null) {
    if (!value) return '-'
    const date = value instanceof Date ? value : new Date(value)
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('zh-CN', { hour12: false })
  }

  function formatPlan(row: SaasPlatformTenantRecord) {
    if (row.plan_name && row.plan_code) return `${row.plan_name} / ${row.plan_code}`
    return row.plan_name || row.plan_code || '-'
  }

  function subscriptionStatusLabel(status: string) {
    const labels: Record<string, string> = {
      active: '生效中',
      trialing: '试用中',
      expired: '已过期',
      canceled: '已取消'
    }
    return labels[status] || status || '-'
  }

  function subscriptionTagType(status: string) {
    if (status === 'active') return 'success'
    if (status === 'trialing') return 'warning'
    if (status === 'expired' || status === 'canceled') return 'danger'
    return 'info'
  }

  async function loadTenants() {
    loading.value = true
    try {
      const result = await fetchPlatformTenants({
        page: pager.page,
        limit: pager.limit,
        keyword: filters.keyword || undefined,
        status: filters.status || undefined
      })
      records.value = Array.isArray(result?.list) ? result.list : []
      pager.total = Number(result?.total) || 0
    } catch (error) {
      console.error('[SaasPlatformTenantPage] load tenants failed:', error)
      records.value = []
      pager.total = 0
      ElMessage.error('租户列表加载失败')
    } finally {
      loading.value = false
    }
  }

  function refreshTenants() {
    pager.page = 1
    loadTenants()
  }

  function resetFilters() {
    filters.keyword = ''
    filters.status = ''
    refreshTenants()
  }

  function handleSizeChange() {
    pager.page = 1
    loadTenants()
  }

  function openCreateDialog() {
    Object.assign(form, defaultForm())
    formRef.value?.clearValidate()
    createDialogVisible.value = true
  }

  async function submit() {
    if (!formRef.value) return

    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) return

    submitting.value = true
    try {
      await createSaasTenantFromPlatform({ ...form })
      ElMessage.success('租户已创建')
      createDialogVisible.value = false
      await refreshTenants()
    } catch (error) {
      console.error('[SaasPlatformTenantPage] create tenant failed:', error)
      ElMessage.error('租户创建失败')
    } finally {
      submitting.value = false
    }
  }

  onMounted(() => {
    loadTenants()
  })
</script>

<style scoped>
  .saas-platform-tenant-page {
    min-height: 100%;
  }

  .saas-platform-tenant-page__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .saas-platform-tenant-page__header-actions,
  .saas-platform-tenant-page__filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }

  .saas-platform-tenant-page__title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.4;
  }

  .saas-platform-tenant-page__subtitle {
    margin: 6px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.5;
  }

  .saas-platform-tenant-page__filters {
    margin-bottom: 16px;
  }

  .saas-platform-tenant-page__filter-item {
    width: 260px;
  }

  .saas-platform-tenant-page__pagination {
    margin-top: 16px;
    justify-content: flex-end;
  }

  .saas-platform-tenant-page__select {
    width: 100%;
  }

  @media (max-width: 640px) {
    .saas-platform-tenant-page__header {
      flex-direction: column;
      align-items: stretch;
    }

    .saas-platform-tenant-page__header-actions,
    .saas-platform-tenant-page__filter-item {
      width: 100%;
    }
  }
</style>
