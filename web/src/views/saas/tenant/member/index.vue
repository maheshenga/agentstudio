<template>
  <div class="art-full-height p-5">
    <ElCard v-if="moduleEnabled" shadow="never" class="tenant-member-page">
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
        <ElTableColumn label="操作" width="300" fixed="right">
          <template #default="{ row }">
            <ElSpace v-if="row.role !== 'owner'" wrap>
              <ElButton link type="primary" @click="openRoleDialog(row)">角色</ElButton>
              <ElButton link :type="row.status === 1 ? 'warning' : 'success'" @click="toggleStatus(row)">
                {{ row.status === 1 ? '停用' : '启用' }}
              </ElButton>
              <ElButton link type="primary" @click="openResetPasswordDialog(row)">重置密码</ElButton>
              <ElButton link type="danger" @click="removeMember(row)">移除</ElButton>
            </ElSpace>
            <ElTag v-else type="danger" effect="plain">负责人</ElTag>
          </template>
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

    <ElResult v-else-if="moduleErrorMessage" icon="error" :title="moduleErrorMessage" sub-title="请稍后重试。">
      <template #extra>
        <ElButton type="primary" @click="loadPage">重试</ElButton>
      </template>
    </ElResult>

    <ElEmpty v-else-if="moduleChecked" description="当前套餐未开通成员管理" />

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

    <ElDialog v-model="roleDialogVisible" title="调整角色" width="420px">
      <ElForm label-width="88px">
        <ElFormItem label="账号">
          <ElInput :model-value="selectedMember?.username || ''" disabled />
        </ElFormItem>
        <ElFormItem label="角色">
          <ElSelect v-model="roleForm.role" class="tenant-member-page__select">
            <ElOption label="管理员" value="admin" />
            <ElOption label="普通成员" value="member" />
          </ElSelect>
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="roleDialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="saving" @click="submitRoleChange">保存</ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="passwordDialogVisible" title="重置密码" width="420px">
      <ElForm ref="passwordFormRef" :model="passwordForm" :rules="passwordRules" label-width="88px">
        <ElFormItem label="账号">
          <ElInput :model-value="selectedMember?.username || ''" disabled />
        </ElFormItem>
        <ElFormItem label="新密码" prop="password">
          <ElInput v-model="passwordForm.password" type="password" maxlength="100" show-password />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="passwordDialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="saving" @click="submitPasswordReset">保存</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
  import {
    changeTenantMemberRole,
    createTenantMember,
    fetchTenantModules,
    fetchTenantMembers,
    removeTenantMember,
    resetTenantMemberPassword,
    type CreateSaasTenantMemberParams,
    type SaasTenantMemberRecord,
    updateTenantMemberStatus
  } from '@/api/saas'

  defineOptions({ name: 'SaasTenantMemberPage' })

  const members = ref<SaasTenantMemberRecord[]>([])
  const moduleChecked = ref(false)
  const moduleEnabled = ref(false)
  const moduleErrorMessage = ref('')
  const loading = ref(false)
  const saving = ref(false)
  const dialogVisible = ref(false)
  const roleDialogVisible = ref(false)
  const passwordDialogVisible = ref(false)
  const formRef = ref<FormInstance>()
  const passwordFormRef = ref<FormInstance>()
  const selectedMember = ref<SaasTenantMemberRecord | null>(null)
  const pager = reactive({ page: 1, limit: 10, total: 0 })
  const form = reactive<CreateSaasTenantMemberParams>({
    username: '',
    password: '',
    realname: '',
    phone: '',
    email: '',
    role: 'member'
  })
  const roleForm = reactive<{ role: 'admin' | 'member' }>({ role: 'member' })
  const passwordForm = reactive({ password: '' })
  const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,100}$/
  const PASSWORD_MESSAGE = '请输入至少 8 位且包含字母和数字的密码'
  const rules: FormRules = {
    username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
    password: [{ required: true, pattern: PASSWORD_PATTERN, message: PASSWORD_MESSAGE, trigger: 'blur' }],
    role: [{ required: true, message: '请选择角色', trigger: 'change' }]
  }
  const passwordRules: FormRules = {
    password: [{ required: true, pattern: PASSWORD_PATTERN, message: PASSWORD_MESSAGE, trigger: 'blur' }]
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

  function openRoleDialog(row: SaasTenantMemberRecord) {
    selectedMember.value = row
    roleForm.role = row.role === 'admin' ? 'admin' : 'member'
    roleDialogVisible.value = true
  }

  function openResetPasswordDialog(row: SaasTenantMemberRecord) {
    selectedMember.value = row
    passwordForm.password = ''
    passwordFormRef.value?.clearValidate()
    passwordDialogVisible.value = true
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

  async function loadPage() {
    moduleChecked.value = false
    moduleErrorMessage.value = ''
    try {
      const modules = await fetchTenantModules()
      moduleEnabled.value = modules.some((module) => module.code === 'member_management' && module.status === 1)
      moduleChecked.value = true
      if (moduleEnabled.value) {
        await loadMembers()
      }
    } catch (error) {
      console.error('[SaasTenantMemberPage] load module access failed:', error)
      moduleEnabled.value = false
      moduleChecked.value = true
      moduleErrorMessage.value = '加载模块权限失败'
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

  async function submitRoleChange() {
    if (!selectedMember.value) return
    saving.value = true
    try {
      await changeTenantMemberRole(selectedMember.value.user_id, roleForm.role)
      ElMessage.success('角色已更新')
      roleDialogVisible.value = false
      await loadMembers()
    } catch (error) {
      console.error('[SaasTenantMemberPage] change role failed:', error)
      ElMessage.error('更新角色失败')
    } finally {
      saving.value = false
    }
  }

  async function toggleStatus(row: SaasTenantMemberRecord) {
    const nextStatus = row.status === 1 ? 0 : 1
    try {
      await ElMessageBox.confirm(`确认${nextStatus === 1 ? '启用' : '停用'}成员「${row.username}」？`, '成员状态')
      await updateTenantMemberStatus(row.user_id, nextStatus)
      ElMessage.success(nextStatus === 1 ? '成员已启用' : '成员已停用')
      await loadMembers()
    } catch (error) {
      if (error !== 'cancel') {
        console.error('[SaasTenantMemberPage] update status failed:', error)
      }
    }
  }

  async function removeMember(row: SaasTenantMemberRecord) {
    try {
      await ElMessageBox.confirm(`确认移除成员「${row.username}」？`, '移除成员', { type: 'warning' })
      await removeTenantMember(row.user_id)
      ElMessage.success('成员已移除')
      await loadMembers()
    } catch (error) {
      if (error !== 'cancel') {
        console.error('[SaasTenantMemberPage] remove member failed:', error)
      }
    }
  }

  async function submitPasswordReset() {
    if (!selectedMember.value) return
    await passwordFormRef.value?.validate()
    saving.value = true
    try {
      await resetTenantMemberPassword(selectedMember.value.user_id, passwordForm.password)
      ElMessage.success('密码已重置')
      passwordDialogVisible.value = false
    } catch (error) {
      console.error('[SaasTenantMemberPage] reset password failed:', error)
      ElMessage.error('重置密码失败')
    } finally {
      saving.value = false
    }
  }

  onMounted(loadPage)
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
