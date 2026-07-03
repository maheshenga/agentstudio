<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="tenant-member-page">
      <template #header>
        <div class="tenant-member-page__header">
          <div>
            <h1 class="tenant-member-page__title">成员管理</h1>
            <p class="tenant-member-page__subtitle">管理当前租户的管理员和普通成员。</p>
          </div>
          <div class="tenant-member-page__actions">
            <ElButton :loading="loading" @click="loadMembers">刷新</ElButton>
            <ElButton type="primary" @click="openCreateDialog">添加成员</ElButton>
          </div>
        </div>
      </template>

      <ElTable v-loading="loading" :data="members" border>
        <ElTableColumn prop="username" label="账号" min-width="150" />
        <ElTableColumn prop="realname" label="姓名" min-width="150" />
        <ElTableColumn prop="phone" label="手机" min-width="140" />
        <ElTableColumn prop="email" label="邮箱" min-width="180" />
        <ElTableColumn label="角色" width="120">
          <template #default="{ row }">
            <ElTag :type="roleTagType(row.role)" effect="plain">{{ roleLabel(row.role) }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="状态" width="100">
          <template #default="{ row }">
            <ElTag :type="row.status === 1 ? 'success' : 'info'" effect="plain">
              {{ row.status === 1 ? '启用' : '停用' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="创建时间" min-width="180">
          <template #default="{ row }">{{ formatDate(row.create_time) }}</template>
        </ElTableColumn>
        <template #empty>
          <ElEmpty description="暂无成员" />
        </template>
      </ElTable>

      <div class="tenant-member-page__pager">
        <ElPagination
          v-model:current-page="pager.page"
          v-model:page-size="pager.limit"
          background
          layout="total, sizes, prev, pager, next"
          :total="pager.total"
          @current-change="loadMembers"
          @size-change="handleSizeChange"
        />
      </div>
    </ElCard>

    <ElDialog v-model="dialogVisible" title="添加成员" width="520px">
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="88px">
        <ElFormItem label="账号" prop="username">
          <ElInput v-model="form.username" maxlength="64" />
        </ElFormItem>
        <ElFormItem label="初始密码" prop="password">
          <ElInput v-model="form.password" type="password" maxlength="100" show-password />
        </ElFormItem>
        <ElFormItem label="姓名" prop="realname">
          <ElInput v-model="form.realname" maxlength="64" />
        </ElFormItem>
        <ElFormItem label="手机" prop="phone">
          <ElInput v-model="form.phone" maxlength="20" />
        </ElFormItem>
        <ElFormItem label="邮箱" prop="email">
          <ElInput v-model="form.email" maxlength="128" />
        </ElFormItem>
        <ElFormItem label="角色" prop="role">
          <ElSelect v-model="form.role" class="tenant-member-page__select">
            <ElOption label="管理员" value="admin" />
            <ElOption label="普通成员" value="member" />
          </ElSelect>
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="saving" @click="submitMember">保存</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
  import {
    createTenantMember,
    fetchTenantMembers,
    type CreateSaasTenantMemberParams,
    type SaasTenantMemberRecord
  } from '@/api/saas'

  defineOptions({ name: 'SaasTenantMemberPage' })

  const members = ref<SaasTenantMemberRecord[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const dialogVisible = ref(false)
  const formRef = ref<FormInstance>()
  const pager = reactive({ page: 1, limit: 10, total: 0 })
  const form = reactive<CreateSaasTenantMemberParams>({
    username: '',
    password: '',
    realname: '',
    phone: '',
    email: '',
    role: 'member'
  })
  const rules: FormRules = {
    username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
    password: [{ required: true, min: 6, message: '请输入至少 6 位密码', trigger: 'blur' }],
    role: [{ required: true, message: '请选择角色', trigger: 'change' }]
  }

  function roleLabel(role: string) {
    if (role === 'owner') return '所有者'
    if (role === 'admin') return '管理员'
    if (role === 'member') return '普通成员'
    return role || '-'
  }

  function roleTagType(role: string) {
    if (role === 'owner') return 'danger'
    if (role === 'admin') return 'warning'
    return 'info'
  }

  function formatDate(value?: string | Date) {
    if (!value) return '-'
    return new Date(value).toLocaleString('zh-CN', { hour12: false })
  }

  function resetForm() {
    Object.assign(form, {
      username: '',
      password: '',
      realname: '',
      phone: '',
      email: '',
      role: 'member'
    })
    formRef.value?.clearValidate()
  }

  function openCreateDialog() {
    resetForm()
    dialogVisible.value = true
  }

  async function loadMembers() {
    loading.value = true
    try {
      const result = await fetchTenantMembers({ page: pager.page, limit: pager.limit })
      members.value = result.list || []
      pager.total = Number(result.total) || 0
    } catch (error) {
      console.error('[SaasTenantMemberPage] load members failed:', error)
      ElMessage.error('加载成员失败')
    } finally {
      loading.value = false
    }
  }

  function handleSizeChange() {
    pager.page = 1
    loadMembers()
  }

  async function submitMember() {
    await formRef.value?.validate()
    saving.value = true
    try {
      const payload: CreateSaasTenantMemberParams = {
        username: form.username,
        password: form.password,
        role: form.role
      }
      if (form.realname) payload.realname = form.realname
      if (form.phone) payload.phone = form.phone
      if (form.email) payload.email = form.email

      await createTenantMember(payload)
      ElMessage.success('成员已添加')
      dialogVisible.value = false
      await loadMembers()
    } catch (error) {
      console.error('[SaasTenantMemberPage] create member failed:', error)
      ElMessage.error('添加成员失败')
    } finally {
      saving.value = false
    }
  }

  onMounted(loadMembers)
</script>

<style scoped>
  .tenant-member-page {
    min-height: 100%;
  }

  .tenant-member-page__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .tenant-member-page__title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.4;
  }

  .tenant-member-page__subtitle {
    margin: 6px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.5;
  }

  .tenant-member-page__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: flex-end;
  }

  .tenant-member-page__pager {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }

  .tenant-member-page__select {
    width: 100%;
  }

  @media (max-width: 640px) {
    .tenant-member-page__header {
      flex-direction: column;
      align-items: stretch;
    }

    .tenant-member-page__actions {
      justify-content: flex-start;
    }
  }
</style>
