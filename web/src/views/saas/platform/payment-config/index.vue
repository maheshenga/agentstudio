<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="saas-payment-config-page">
      <template #header>
        <div class="saas-payment-config-page__header">
          <div>
            <h1 class="saas-payment-config-page__title">支付宝配置</h1>
            <p class="saas-payment-config-page__subtitle">配置 SaaS 订单支付使用的支付宝参数。</p>
          </div>
          <ElButton :loading="loading" @click="loadConfig">刷新</ElButton>
        </div>
      </template>

      <div v-if="status" class="saas-payment-config-page__status">
        <ElTag :type="status.configured ? 'success' : 'warning'" effect="light">
          {{ status.configured ? '已配置' : '未完成' }}
        </ElTag>
        <span>App ID: {{ status.app_id_masked || '-' }}</span>
        <span>私钥: {{ status.private_key_configured ? '已保存' : '未保存' }}</span>
        <span>公钥: {{ status.public_key_configured ? '已保存' : '未保存' }}</span>
      </div>

      <ElAlert
        v-if="status && status.missing_keys.length"
        class="saas-payment-config-page__alert"
        type="warning"
        :closable="false"
        :title="`缺少配置: ${status.missing_keys.join(', ')}`"
      />

      <ElForm label-position="top" class="saas-payment-config-page__form">
        <ElFormItem label="启用支付宝支付">
          <ElSwitch v-model="form.enabled" />
        </ElFormItem>
        <ElFormItem label="App ID">
          <ElInput v-model="form.app_id" clearable placeholder="留空不显示已保存 App ID" />
        </ElFormItem>
        <ElFormItem label="应用私钥">
          <ElInput v-model="form.private_key" type="textarea" :rows="6" placeholder="留空则保留已保存私钥" />
        </ElFormItem>
        <ElFormItem label="支付宝公钥">
          <ElInput v-model="form.public_key" type="textarea" :rows="6" placeholder="留空则保留已保存公钥" />
        </ElFormItem>
        <ElFormItem label="网关地址">
          <ElInput v-model="form.gateway_url" clearable />
        </ElFormItem>
        <ElFormItem label="异步通知地址">
          <ElInput v-model="form.notify_url" clearable />
        </ElFormItem>
        <ElFormItem label="同步返回地址">
          <ElInput v-model="form.return_url" clearable />
        </ElFormItem>
        <ElFormItem label="备注">
          <ElInput v-model="form.remark" type="textarea" :rows="3" />
        </ElFormItem>
        <ElFormItem>
          <ElButton type="primary" :loading="saving" @click="saveConfig">保存配置</ElButton>
        </ElFormItem>
      </ElForm>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import {
    fetchPlatformAlipayConfig,
    updatePlatformAlipayConfig,
    type PlatformAlipayConfigStatus
  } from '@/api/saas'

  defineOptions({ name: 'SaasPlatformPaymentConfigPage' })

  const loading = ref(false)
  const saving = ref(false)
  const status = ref<PlatformAlipayConfigStatus | null>(null)
  const form = reactive({
    enabled: false,
    app_id: '',
    private_key: '',
    public_key: '',
    gateway_url: '',
    notify_url: '',
    return_url: '',
    remark: ''
  })

  async function loadConfig() {
    loading.value = true
    try {
      const result = await fetchPlatformAlipayConfig()
      status.value = result
      form.enabled = result.enabled
      form.app_id = ''
      form.private_key = ''
      form.public_key = ''
      form.gateway_url = result.gateway_url || ''
      form.notify_url = result.notify_url || ''
      form.return_url = result.return_url || ''
      form.remark = result.remark || ''
    } finally {
      loading.value = false
    }
  }

  async function saveConfig() {
    saving.value = true
    try {
      status.value = await updatePlatformAlipayConfig({ ...form })
      form.private_key = ''
      form.public_key = ''
      form.app_id = ''
      await loadConfig()
      ElMessage.success('支付宝配置已保存')
    } finally {
      saving.value = false
    }
  }

  onMounted(() => {
    loadConfig()
  })
</script>

<style scoped>
  .saas-payment-config-page {
    min-height: 100%;
  }

  .saas-payment-config-page__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .saas-payment-config-page__title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.4;
    letter-spacing: 0;
  }

  .saas-payment-config-page__subtitle {
    margin: 6px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.5;
  }

  .saas-payment-config-page__status {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    margin-bottom: 16px;
    color: var(--el-text-color-regular);
    font-size: 13px;
  }

  .saas-payment-config-page__alert {
    margin-bottom: 16px;
  }

  .saas-payment-config-page__form {
    max-width: 760px;
  }

  @media (max-width: 768px) {
    .saas-payment-config-page__header {
      display: grid;
    }
  }
</style>
