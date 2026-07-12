<template>
  <div class="art-full-height app-runner-page">
    <div v-if="loading" class="app-runner-page__state">
      <ElIcon class="is-loading"><Loading /></ElIcon>
      <span>Opening app...</span>
    </div>

    <div v-else-if="loadError" class="app-runner-page__state">
      <ElResult icon="warning" title="App cannot be opened" :sub-title="loadError">
        <template #extra>
          <ElButton :icon="Back" @click="goBack">Back</ElButton>
          <ElButton type="primary" :icon="Refresh" @click="loadOpenMetadata">Retry</ElButton>
        </template>
      </ElResult>
    </div>

    <template v-else-if="metadata">
      <div class="app-runner-page__toolbar">
        <div>
          <h1>{{ metadata.name }}</h1>
          <p>
            {{ metadata.code }}
            <span v-if="metadata.version">· {{ metadata.version }}</span>
          </p>
        </div>
        <div class="app-runner-page__actions">
          <ElTag effect="light">{{ metadata.type }}</ElTag>
          <ElButton :icon="Back" @click="goBack">Back</ElButton>
          <ElButton type="primary" :icon="Refresh" @click="loadOpenMetadata">Reload</ElButton>
        </div>
      </div>

      <iframe
        v-if="metadata.open_mode === 'iframe'"
        ref="appFrame"
        class="app-runner-page__iframe"
        :src="metadata.entry_url"
        :title="metadata.name"
        :sandbox="safeSandbox"
        referrerpolicy="no-referrer"
      />
    </template>

    <div v-else class="app-runner-page__state">
      <ElResult
        icon="info"
        title="No app selected"
        sub-title="Open an app from Marketplace or Installed Apps."
      >
        <template #extra>
          <ElButton type="primary" @click="goMarketplace">Go to Marketplace</ElButton>
        </template>
      </ElResult>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import { Back, Loading, Refresh } from '@element-plus/icons-vue'
  import { fetchTenantAppOpenMetadata, type AppOpenMetadata } from '@/api/app-marketplace'
  import { fetchAppRuntimeContext } from '@/api/app-runtime'
  import {
    createAppRuntimeContextResponse,
    createAppRuntimeErrorResponse,
    parseAppRuntimeRequest,
    resolveAppRuntimeRequest
  } from '@/utils/app-runtime'

  defineOptions({ name: 'AppCenterOpenPage' })

  const route = useRoute()
  const router = useRouter()
  const loading = ref(false)
  const loadError = ref('')
  const metadata = ref<AppOpenMetadata | null>(null)
  const appFrame = ref<HTMLIFrameElement | null>(null)
  let loadSequence = 0
  const runtimeAbortControllers = new Set<AbortController>()
  const safeSandbox = computed(() => {
    const raw = metadata.value?.sandbox || 'allow-scripts allow-forms allow-popups allow-downloads'
    return raw
      .split(/\s+/)
      .filter((item) => item && item !== 'allow-same-origin')
      .join(' ')
  })

  function currentCode() {
    const value = route.query.code
    return Array.isArray(value) ? value[0] || '' : String(value || '')
  }

  async function loadOpenMetadata() {
    const sequence = ++loadSequence
    const code = currentCode()
    abortRuntimeRequests()
    metadata.value = null
    loadError.value = ''
    if (!code) {
      loading.value = false
      return
    }

    loading.value = true
    try {
      const data = await fetchTenantAppOpenMetadata(code)
      if (sequence !== loadSequence) return
      if (data.open_mode === 'internal_route') {
        router.replace(data.entry_url)
        return
      }
      metadata.value = data
    } catch (error: any) {
      if (sequence !== loadSequence) return
      console.error('[AppCenterOpenPage] open app failed:', error)
      loadError.value = error?.message || 'The app is not installed, disabled, or not published.'
      ElMessage.error(loadError.value)
    } finally {
      if (sequence === loadSequence) loading.value = false
    }
  }

  async function handleRuntimeMessage(event: MessageEvent<unknown>) {
    const frameWindow = appFrame.value?.contentWindow
    if (!frameWindow || event.source !== frameWindow || metadata.value?.type !== 'static') return

    const parsed = parseAppRuntimeRequest(event.data)
    if (!parsed) return
    if (parsed.response) {
      frameWindow.postMessage(parsed.response, '*')
      return
    }

    const session = metadata.value.runtime?.session
    if (!session) {
      const response = resolveAppRuntimeRequest(event.data, metadata.value.runtime)
      if (response) frameWindow.postMessage(response, '*')
      return
    }

    const runtimeAbortController = new AbortController()
    runtimeAbortControllers.add(runtimeAbortController)
    try {
      const context = await fetchAppRuntimeContext(session.token, runtimeAbortController.signal)
      if (runtimeAbortController.signal.aborted || event.source !== appFrame.value?.contentWindow) return
      frameWindow.postMessage(
        createAppRuntimeContextResponse(parsed.request.request_id, context),
        '*'
      )
    } catch (error: any) {
      if (runtimeAbortController.signal.aborted || event.source !== appFrame.value?.contentWindow) return
      const code = Number(error?.code) === 403 ? 'scope_denied' : 'context_unavailable'
      frameWindow.postMessage(createAppRuntimeErrorResponse(parsed.request.request_id, code), '*')
    } finally {
      runtimeAbortControllers.delete(runtimeAbortController)
    }
  }

  function abortRuntimeRequests() {
    for (const controller of runtimeAbortControllers) controller.abort()
    runtimeAbortControllers.clear()
  }

  function goBack() {
    router.back()
  }

  function goMarketplace() {
    router.push('/app-center/marketplace')
  }

  watch(
    () => route.query.code,
    () => {
      loadOpenMetadata()
    }
  )

  onMounted(() => {
    window.addEventListener('message', handleRuntimeMessage)
    loadOpenMetadata()
  })

  onBeforeUnmount(() => {
    loadSequence += 1
    abortRuntimeRequests()
    metadata.value = null
    window.removeEventListener('message', handleRuntimeMessage)
  })
</script>

<style scoped>
  .app-runner-page {
    display: grid;
    grid-template-rows: auto 1fr;
    min-height: 100%;
    background: var(--el-bg-color-page);
  }

  .app-runner-page__toolbar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 14px 20px;
    border-bottom: 1px solid var(--el-border-color-light);
    background: var(--el-bg-color);
  }

  .app-runner-page__toolbar h1 {
    margin: 0;
    font-size: 17px;
    font-weight: 600;
    line-height: 1.4;
    letter-spacing: 0;
  }

  .app-runner-page__toolbar p {
    margin: 4px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  .app-runner-page__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
  }

  .app-runner-page__iframe {
    width: 100%;
    height: calc(100vh - 96px);
    min-height: 520px;
    border: 0;
    background: var(--el-bg-color);
  }

  .app-runner-page__state {
    display: grid;
    min-height: 420px;
    place-items: center;
    gap: 10px;
    color: var(--el-text-color-secondary);
  }

  .app-runner-page__state .el-icon {
    font-size: 22px;
  }

  @media (max-width: 720px) {
    .app-runner-page__toolbar {
      display: grid;
    }

    .app-runner-page__actions {
      justify-content: flex-start;
    }
  }
</style>
