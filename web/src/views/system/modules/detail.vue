<template>
  <div class="art-full-height p-5 system-module-detail">
    <div class="system-module-detail__header">
      <ElButton :icon="Back" @click="goBack">返回</ElButton>
      <div class="system-module-detail__heading">
        <h1>模块详情</h1>
        <p>{{ moduleData?.name || moduleCode || '未选择模块' }}</p>
      </div>
    </div>

    <ElCard class="art-table-card" shadow="never">
      <ElSkeleton v-if="loading" :rows="8" animated />
      <template v-else>
        <ElEmpty v-if="!moduleData" description="未找到模块信息" />
        <div v-else class="system-module-detail__content">
          <ElDescriptions :column="2" border>
            <ElDescriptionsItem label="模块编码">{{ moduleData.code }}</ElDescriptionsItem>
            <ElDescriptionsItem label="模块名称">{{ moduleData.name }}</ElDescriptionsItem>
            <ElDescriptionsItem label="来源">{{ sourceText(moduleData.source) }}</ElDescriptionsItem>
            <ElDescriptionsItem label="版本">{{ moduleData.version || '-' }}</ElDescriptionsItem>
            <ElDescriptionsItem label="分类">{{ moduleData.category || '-' }}</ElDescriptionsItem>
            <ElDescriptionsItem label="状态">
              <ElTag :type="statusTagType(moduleData.status)" effect="light">
                {{ statusText(moduleData.status) }}
              </ElTag>
            </ElDescriptionsItem>
            <ElDescriptionsItem label="健康状态">
              {{ healthText(moduleData.health_status) }}
            </ElDescriptionsItem>
            <ElDescriptionsItem label="入口路由">
              {{ moduleData.entry_route || '-' }}
            </ElDescriptionsItem>
            <ElDescriptionsItem label="租户启用">
              {{ enabledText(moduleData.tenant_enabled) }}
            </ElDescriptionsItem>
            <ElDescriptionsItem label="授权来源">
              {{ moduleData.entitlement_source || '-' }}
            </ElDescriptionsItem>
            <ElDescriptionsItem label="创建时间">{{ formatDateTime(moduleData.create_time) }}</ElDescriptionsItem>
            <ElDescriptionsItem label="更新时间">{{ formatDateTime(moduleData.update_time) }}</ElDescriptionsItem>
            <ElDescriptionsItem label="描述" :span="2">
              {{ moduleData.description || '-' }}
            </ElDescriptionsItem>
            <ElDescriptionsItem label="备注" :span="2">
              {{ moduleData.remark || '-' }}
            </ElDescriptionsItem>
          </ElDescriptions>

          <ElTabs v-model="activeTab">
            <ElTabPane label="清单" name="manifest">
              <pre class="system-module-detail__json">{{ toPrettyJson(moduleData.manifest) }}</pre>
            </ElTabPane>
            <ElTabPane label="依赖" name="dependencies">
              <pre class="system-module-detail__json">{{ manifestSection('dependencies') }}</pre>
            </ElTabPane>
            <ElTabPane label="权限" name="permissions">
              <pre class="system-module-detail__json">{{ manifestSection('permissions') }}</pre>
            </ElTabPane>
            <ElTabPane label="接口" name="apis">
              <pre class="system-module-detail__json">{{ manifestSection('apis') }}</pre>
            </ElTabPane>
            <ElTabPane label="事件" name="events">
              <ElTable v-loading="eventsLoading" :data="events" border>
                <ElTableColumn label="事件类型" min-width="150">
                  <template #default="{ row }">{{ row.eventType || row.event_type || '-' }}</template>
                </ElTableColumn>
                <ElTableColumn prop="status" label="状态" width="110" />
                <ElTableColumn prop="message" label="消息" min-width="220" show-overflow-tooltip />
                <ElTableColumn label="时间" width="180">
                  <template #default="{ row }">{{ formatDateTime(row.createTime || row.create_time) }}</template>
                </ElTableColumn>
                <ElTableColumn label="元数据" min-width="220" show-overflow-tooltip>
                  <template #default="{ row }">{{ compactJson(row.metadata) }}</template>
                </ElTableColumn>
                <template #empty>
                  <ElEmpty description="暂无事件记录" />
                </template>
              </ElTable>
            </ElTabPane>
            <ElTabPane label="配置" name="config">
              <pre class="system-module-detail__json">{{ toPrettyJson(moduleData.config_schema) }}</pre>
            </ElTabPane>
          </ElTabs>
        </div>
      </template>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import { Back } from '@element-plus/icons-vue'
  import {
    fetchSystemModule,
    fetchSystemModuleEvents,
    type SystemModuleEventRecord,
    type SystemModuleRecord
  } from '@/api/system-module'

  defineOptions({ name: 'SystemModuleDetailPage' })

  const route = useRoute()
  const router = useRouter()
  const moduleData = ref<SystemModuleRecord | null>(null)
  const events = ref<SystemModuleEventRecord[]>([])
  const loading = ref(false)
  const eventsLoading = ref(false)
  const activeTab = ref('manifest')
  const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })

  const moduleCode = computed(() => {
    const code = route.query.code
    return Array.isArray(code) ? code[0] || '' : code || ''
  })

  function parseJsonValue(value: unknown) {
    if (typeof value !== 'string') return value
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }

  function toPrettyJson(value: unknown) {
    const parsed = parseJsonValue(value)
    if (parsed === undefined || parsed === null || parsed === '') return '{}'
    if (typeof parsed === 'string') return parsed
    return JSON.stringify(parsed, null, 2)
  }

  function compactJson(value: unknown) {
    const parsed = parseJsonValue(value)
    if (parsed === undefined || parsed === null || parsed === '') return '-'
    if (typeof parsed === 'string') return parsed
    return JSON.stringify(parsed)
  }

  function getManifestObject() {
    const parsed = parseJsonValue(moduleData.value?.manifest)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  }

  function manifestSection(key: string) {
    return toPrettyJson(getManifestObject()[key] ?? [])
  }

  function sourceText(source?: string) {
    const map: Record<string, string> = {
      built_in: '内置',
      plugin: '插件',
      extension: '扩展'
    }
    return source ? map[source] || source : '-'
  }

  function statusText(status?: string) {
    const map: Record<string, string> = {
      enabled: '已启用',
      disabled: '已禁用',
      installed: '已安装',
      failed: '异常'
    }
    return status ? map[status] || status : '-'
  }

  function statusTagType(status?: string) {
    const map: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
      enabled: 'success',
      disabled: 'info',
      installed: 'warning',
      failed: 'danger'
    }
    return status ? map[status] || 'info' : 'info'
  }

  function healthText(status?: string) {
    const map: Record<string, string> = {
      healthy: '正常',
      warning: '告警',
      failed: '异常',
      unknown: '未知'
    }
    return status ? map[status] || status : '-'
  }

  function enabledText(value?: boolean | number) {
    if (value === undefined || value === null) return '-'
    return value === true || value === 1 ? '是' : '否'
  }

  function formatDateTime(value: unknown) {
    if (!value) return '-'
    const date = value instanceof Date ? value : new Date(String(value))
    return Number.isNaN(date.getTime()) ? String(value) : dateFormatter.format(date)
  }

  async function loadDetail() {
    if (!moduleCode.value) {
      ElMessage.warning('缺少模块编码')
      return
    }
    loading.value = true
    eventsLoading.value = true
    try {
      const [detail, eventList] = await Promise.all([
        fetchSystemModule(moduleCode.value),
        fetchSystemModuleEvents(moduleCode.value)
      ])
      moduleData.value = detail
      events.value = eventList
    } finally {
      loading.value = false
      eventsLoading.value = false
    }
  }

  function goBack() {
    router.back()
  }

  onMounted(() => {
    loadDetail()
  })
</script>

<style scoped>
  .system-module-detail {
    display: grid;
    align-content: start;
    gap: 16px;
  }

  .system-module-detail__header {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .system-module-detail__heading h1 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.4;
    letter-spacing: 0;
  }

  .system-module-detail__heading p {
    margin: 4px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.5;
  }

  .system-module-detail__content {
    display: grid;
    gap: 18px;
  }

  .system-module-detail__json {
    min-height: 220px;
    max-height: 520px;
    margin: 0;
    overflow: auto;
    border: 1px solid var(--el-border-color-light);
    border-radius: 6px;
    background: var(--el-fill-color-lighter);
    padding: 14px;
    color: var(--el-text-color-primary);
    font-size: 13px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
  }

  @media (max-width: 640px) {
    .system-module-detail__header {
      align-items: flex-start;
    }
  }
</style>
