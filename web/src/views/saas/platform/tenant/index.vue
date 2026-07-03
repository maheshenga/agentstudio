<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="saas-platform-page">
      <template #header>
        <div class="saas-platform-page__header">
          <div>
            <h1 class="saas-platform-page__title">SaaS Tenants</h1>
            <p class="saas-platform-page__subtitle">Create a tenant and its first owner account.</p>
          </div>
        </div>
      </template>

      <ElForm
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="150px"
        class="saas-platform-page__form"
      >
        <ElFormItem label="Tenant name" prop="tenant_name">
          <ElInput v-model="form.tenant_name" maxlength="100" clearable />
        </ElFormItem>

        <ElFormItem label="Tenant code" prop="tenant_code">
          <ElInput v-model="form.tenant_code" maxlength="50" clearable />
        </ElFormItem>

        <ElFormItem label="Owner username" prop="owner_username">
          <ElInput v-model="form.owner_username" maxlength="64" clearable />
        </ElFormItem>

        <ElFormItem label="Owner password" prop="owner_password">
          <ElInput v-model="form.owner_password" maxlength="100" show-password clearable />
        </ElFormItem>

        <ElFormItem label="Owner name" prop="owner_realname">
          <ElInput v-model="form.owner_realname" maxlength="64" clearable />
        </ElFormItem>

        <ElFormItem label="Initial plan" prop="plan_code">
          <ElSelect v-model="form.plan_code" class="saas-platform-page__select">
            <ElOption label="Free" value="free" />
            <ElOption label="Pro" value="pro" />
            <ElOption label="Enterprise" value="enterprise" />
          </ElSelect>
        </ElFormItem>

        <ElFormItem label="Trial">
          <ElSwitch v-model="form.with_trial" />
        </ElFormItem>

        <ElFormItem>
          <ElButton type="primary" :loading="submitting" @click="submit">Create tenant</ElButton>
          <ElButton :disabled="submitting" @click="resetForm">Reset</ElButton>
        </ElFormItem>
      </ElForm>

      <ElAlert
        v-if="createdTenant"
        class="saas-platform-page__result"
        type="success"
        :closable="false"
        show-icon
        :title="createdTenantText"
      />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import type { FormInstance, FormRules } from 'element-plus'
  import { ElMessage } from 'element-plus'
  import { createSaasTenantFromPlatform, type SaasTenantProvisionParams } from '@/api/saas'

  defineOptions({ name: 'SaasPlatformTenantPage' })

  const formRef = ref<FormInstance>()
  const submitting = ref(false)
  const createdTenant = ref<{ userId: number; tenantId: number } | null>(null)

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
    tenant_name: [{ required: true, message: 'Tenant name is required', trigger: 'blur' }],
    tenant_code: [{ required: true, message: 'Tenant code is required', trigger: 'blur' }],
    owner_username: [
      { required: true, message: 'Owner username is required', trigger: 'blur' },
      { min: 2, message: 'At least 2 characters', trigger: 'blur' }
    ],
    owner_password: [
      { required: true, message: 'Owner password is required', trigger: 'blur' },
      { min: 6, message: 'At least 6 characters', trigger: 'blur' }
    ]
  }

  const createdTenantText = computed(() => {
    if (!createdTenant.value) return ''
    return `Tenant #${createdTenant.value.tenantId} created. Owner user #${createdTenant.value.userId}.`
  })

  const normalizeResult = (payload: any) => {
    return payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload
  }

  const submit = async () => {
    if (!formRef.value) return

    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) return

    submitting.value = true
    createdTenant.value = null

    try {
      const payload = await createSaasTenantFromPlatform({ ...form })
      createdTenant.value = normalizeResult(payload)
      ElMessage.success('Tenant created')
    } catch (error) {
      console.error('[SaasPlatformTenantPage] create tenant failed:', error)
      ElMessage.error('Create tenant failed')
    } finally {
      submitting.value = false
    }
  }

  const resetForm = () => {
    Object.assign(form, defaultForm())
    createdTenant.value = null
    formRef.value?.clearValidate()
  }
</script>

<style scoped>
  .saas-platform-page {
    min-height: 100%;
  }

  .saas-platform-page__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .saas-platform-page__title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.4;
  }

  .saas-platform-page__subtitle {
    margin: 6px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.5;
  }

  .saas-platform-page__form {
    max-width: 720px;
  }

  .saas-platform-page__select {
    width: 100%;
  }

  .saas-platform-page__result {
    margin-top: 20px;
    max-width: 720px;
  }
</style>
