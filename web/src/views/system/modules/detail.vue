<template>
  <div class="art-full-height p-5 system-module-detail">
    <div class="system-module-detail__header">
      <ElButton :icon="Back" circle title="返回" @click="router.back()" />
      <div class="system-module-detail__heading">
        <h1>{{ moduleData?.name || '模块详情' }}</h1>
        <p>{{ moduleData?.code || moduleCode || '未选择模块' }}</p>
      </div>
      <ElButton
        type="primary"
        :icon="Refresh"
        :loading="healthLoading"
        :disabled="!moduleData"
        @click="checkHealth"
      >
        立即检查
      </ElButton>
    </div>

    <ElSkeleton v-if="loading" :rows="8" animated />
    <ElEmpty v-else-if="!moduleData" description="未找到模块信息" />
    <template v-else>
      <ElDescriptions :column="2" border>
        <ElDescriptionsItem label="模块名称">{{ moduleData.name }}</ElDescriptionsItem>
        <ElDescriptionsItem label="模块编码">{{ moduleData.code }}</ElDescriptionsItem>
        <ElDescriptionsItem label="来源">{{ sourceText(moduleData.source) }}</ElDescriptionsItem>
        <ElDescriptionsItem label="版本">{{ moduleData.version || '-' }}</ElDescriptionsItem>
        <ElDescriptionsItem label="状态">
          <ElTag :type="statusTagType(moduleData.status)" effect="light">
            {{ statusText(moduleData.status) }}
          </ElTag>
        </ElDescriptionsItem>
        <ElDescriptionsItem label="健康状态">
          <ElTag :type="healthTagType(moduleData.health_status)" effect="light">
            {{ healthText(moduleData.health_status) }}
          </ElTag>
        </ElDescriptionsItem>
        <ElDescriptionsItem label="入口路由">{{ moduleData.entry_route || '-' }}</ElDescriptionsItem>
        <ElDescriptionsItem label="分类">{{ moduleData.category || '-' }}</ElDescriptionsItem>
        <ElDescriptionsItem label="描述" :span="2">{{ moduleData.description || '-' }}</ElDescriptionsItem>
      </ElDescriptions>

      <ElTabs v-model="activeTab">
        <ElTabPane label="依赖" name="dependencies">
          <ElTable :data="moduleData.dependencies || []" border>
            <ElTableColumn prop="depends_on_code" label="依赖模块" min-width="180" />
            <ElTableColumn prop="version_range" label="版本范围" min-width="140" />
            <ElTableColumn label="必需" width="100">
              <template #default="{ row }">{{ row.required ? '是' : '否' }}</template>
            </ElTableColumn>
          </ElTable>
        </ElTabPane>
        <ElTabPane label="权限" name="permissions">
          <ElTable :data="moduleData.permissions || []" border>
            <ElTableColumn prop="permission_slug" label="权限标识" min-width="220" />
            <ElTableColumn prop="binding_type" label="绑定类型" width="140" />
          </ElTable>
        </ElTabPane>
        <ElTabPane label="接口" name="apis">
          <ElTable :data="moduleData.apis || []" border>
            <ElTableColumn prop="method" label="方法" width="100" />
            <ElTableColumn prop="path" label="路径" min-width="260" />
            <ElTableColumn prop="permission_slug" label="权限" min-width="180" />
            <ElTableColumn label="租户隔离" width="110">
              <template #default="{ row }">{{ row.tenant_scoped ? '是' : '否' }}</template>
            </ElTableColumn>
          </ElTable>
        </ElTabPane>
        <ElTabPane label="配置" name="config">
          <div class="system-module-detail__config-toolbar">
            <span>平台默认配置</span>
            <ElButton type="primary" :icon="Check" :loading="savingConfig" @click="saveConfig">
              保存配置
            </ElButton>
          </div>
          <ElInput
            v-model="configText"
            type="textarea"
            :rows="14"
            resize="vertical"
            spellcheck="false"
            placeholder="请输入 JSON 对象"
          />
          <ElCollapse class="system-module-detail__schema">
            <ElCollapseItem title="配置 Schema" name="schema">
              <pre>{{ prettyJson(configSchema) }}</pre>
            </ElCollapseItem>
          </ElCollapse>
        </ElTabPane>
        <ElTabPane label="事件" name="events">
          <ElTable v-loading="eventsLoading" :data="events" border>
            <ElTableColumn prop="event_type" label="事件" width="150" />
            <ElTableColumn prop="status" label="结果" width="100" />
            <ElTableColumn prop="message" label="消息" min-width="240" show-overflow-tooltip />
            <ElTableColumn label="时间" width="180">
              <template #default="{ row }">{{ formatDateTime(row.create_time) }}</template>
            </ElTableColumn>
          </ElTable>
        </ElTabPane>
        <ElTabPane label="清单" name="manifest">
          <pre class="system-module-detail__json">{{ prettyJson(moduleData.manifest || {}) }}</pre>
        </ElTabPane>
      </ElTabs>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import { Back, Check, Refresh } from '@element-plus/icons-vue'
  import {
    fetchSystemModule,
    fetchSystemModuleConfig,
    fetchSystemModuleEvents,
    runSystemModuleHealthCheck,
    saveSystemModuleConfig,
    type SystemModuleEventRecord,
    type SystemModuleRecord
  } from '@/api/system-module'

  defineOptions({ name: 'SystemModuleDetailPage' })

  const route = useRoute()
  const router = useRouter()
  const moduleData = ref<SystemModuleRecord | null>(null)
  const events = ref<SystemModuleEventRecord[]>([])
  const configText = ref('{}')
  const configSchema = ref<Record<string, any>>({})
  const loading = ref(false)
  const eventsLoading = ref(false)
  const savingConfig = ref(false)
  const healthLoading = ref(false)
  const activeTab = ref('dependencies')
  const moduleCode = computed(() => {
    const code = route.query.code
    return Array.isArray(code) ? code[0] || '' : code || ''
  })

  function parseConfig() {
    const value = JSON.parse(configText.value)
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('配置必须是 JSON 对象')
    return value as Record<string, any>
  }

  function prettyJson(value: unknown) {
    return JSON.stringify(value ?? {}, null, 2)
  }

  async function loadDetail() {
    if (!moduleCode.value) return
    loading.value = true
    eventsLoading.value = true
    try {
      const [detail, config, eventRows] = await Promise.all([
        fetchSystemModule(moduleCode.value),
        fetchSystemModuleConfig(moduleCode.value),
        fetchSystemModuleEvents(moduleCode.value)
      ])
      moduleData.value = detail
      configText.value = prettyJson(config.config || {})
      configSchema.value = config.config_schema || {}
      events.value = eventRows
    } finally {
      loading.value = false
      eventsLoading.value = false
    }
  }

  async function saveConfig() {
    if (!moduleCode.value) return
    let config: Record<string, any>
    try {
      config = parseConfig()
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '配置 JSON 无效')
      return
    }
    savingConfig.value = true
    try {
      const result = await saveSystemModuleConfig(moduleCode.value, config)
      configText.value = prettyJson(result.config || {})
      ElMessage.success('平台配置已保存')
      events.value = await fetchSystemModuleEvents(moduleCode.value)
    } finally {
      savingConfig.value = false
    }
  }

  async function checkHealth() {
    if (!moduleCode.value) return
    healthLoading.value = true
    try {
      const result = await runSystemModuleHealthCheck(moduleCode.value)
      ElMessage[result.health_status === 'healthy' ? 'success' : 'warning'](
        result.health_status === 'healthy' ? '模块检查通过' : `模块检查未通过：${result.findings.join('、')}`
      )
      await loadDetail()
    } finally {
      healthLoading.value = false
    }
  }

  function sourceText(source?: string) {
    return ({ built_in: '内置', plugin: '插件', extension: '扩展' } as Record<string, string>)[source || ''] || source || '-'
  }
  function statusText(status?: string) {
    return ({ enabled: '已启用', disabled: '已禁用', installed: '已安装', draft: '草稿', upgrading: '升级中', failed: '异常', uninstalled: '未安装' } as Record<string, string>)[status || ''] || status || '-'
  }
  function statusTagType(status?: string) {
    return ({ enabled: 'success', disabled: 'info', installed: 'warning', failed: 'danger' } as Record<string, any>)[status || ''] || 'info'
  }
  function healthText(status?: string) {
    return ({ healthy: '正常', degraded: '降级', failed: '异常', unknown: '未知' } as Record<string, string>)[status || ''] || status || '-'
  }
  function healthTagType(status?: string) {
    return ({ healthy: 'success', degraded: 'warning', failed: 'danger', unknown: 'info' } as Record<string, any>)[status || ''] || 'info'
  }
  function formatDateTime(value: unknown) {
    if (!value) return '-'
    const date = new Date(String(value))
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('zh-CN', { hour12: false })
  }

  onMounted(loadDetail)
</script>

<style scoped>
  .system-module-detail { display: grid; align-content: start; gap: 18px; }
  .system-module-detail__header { display: flex; align-items: center; gap: 14px; }
  .system-module-detail__heading { flex: 1; min-width: 0; }
  .system-module-detail__heading h1 { margin: 0; font-size: 18px; line-height: 1.4; letter-spacing: 0; }
  .system-module-detail__heading p { margin: 3px 0 0; color: var(--el-text-color-secondary); font-size: 13px; }
  .system-module-detail__config-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; font-weight: 600; }
  .system-module-detail__schema { margin-top: 14px; }
  .system-module-detail__schema pre, .system-module-detail__json { max-height: 480px; margin: 0; overflow: auto; padding: 14px; border: 1px solid var(--el-border-color-light); border-radius: 6px; background: var(--el-fill-color-lighter); font-size: 13px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
  @media (max-width: 640px) { .system-module-detail__header { align-items: flex-start; flex-wrap: wrap; } }
</style>
