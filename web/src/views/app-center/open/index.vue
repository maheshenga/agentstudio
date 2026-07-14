<template>
  <div class="art-full-height app-runner-page">
    <div v-if="loading" class="app-runner-page__state">
      <ElIcon class="is-loading"><Loading /></ElIcon>
      <span>正在打开应用...</span>
    </div>

    <div v-else-if="loadError" class="app-runner-page__state">
      <ElResult icon="warning" title="应用无法打开" :sub-title="loadError">
        <template #extra>
          <ElButton :icon="Back" @click="goBack">返回</ElButton>
          <ElButton type="primary" :icon="Refresh" @click="loadOpenMetadata">重试</ElButton>
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
          <ElButton :icon="Back" @click="goBack">返回</ElButton>
          <ElButton type="primary" :icon="Refresh" @click="loadOpenMetadata">重新加载</ElButton>
        </div>
      </div>

      <iframe
        v-if="metadata.open_mode === 'iframe'"
        ref="appFrame"
        class="app-runner-page__iframe"
        :src="appFrameSrc"
        :title="metadata.name"
        :sandbox="safeSandbox"
        referrerpolicy="no-referrer"
      />
    </template>

    <div v-else class="app-runner-page__state">
      <ElResult icon="info" title="未选择应用" sub-title="请从应用市场或已安装应用中打开。">
        <template #extra>
          <ElButton type="primary" @click="goMarketplace">前往应用市场</ElButton>
        </template>
      </ElResult>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import { Back, Loading, Refresh } from '@element-plus/icons-vue'
  import {
    exchangeIframeLaunch,
    fetchTenantAppOpenMetadata,
    type AppOpenMetadata,
    type AppRuntimeSessionMetadata
  } from '@/api/app-marketplace'
  import {
    deleteAppRuntimeFile,
    deleteAppRuntimeKv,
    emitAppRuntimeWebhook,
    fetchAppRuntimeContext,
    fetchAppRuntimeKv,
    invokeAppRuntimeService,
    readAppRuntimeFile,
    requestAppRuntimeHttp,
    setAppRuntimeKv,
    uploadAppRuntimeFile
  } from '@/api/app-runtime'
  import {
    createAppRuntimeContextResponse,
    createAppRuntimeErrorResponse,
    createAppRuntimeOperationErrorResponse,
    createAppRuntimeOperationSuccessResponse,
    parseAppRuntimeRequest,
    resolveAppRuntimeRequest,
    type AppRuntimeJsonValue,
    type ParsedAppRuntimeRequest
  } from '@/utils/app-runtime'

  defineOptions({ name: 'AppCenterOpenPage' })

  const route = useRoute()
  const router = useRouter()
  const loading = ref(false)
  const loadError = ref('')
  const metadata = ref<AppOpenMetadata | null>(null)
  const appFrame = ref<HTMLIFrameElement | null>(null)
  let runtimeSession: AppRuntimeSessionMetadata | null = null
  let loadSequence = 0
  let launchExchangePromise: Promise<AppRuntimeSessionMetadata> | null = null
  const runtimeAbortControllers = new Set<AbortController>()
  const appFrameSrc = computed(() => {
    const value = metadata.value
    if (!value) return ''
    return value.type === 'iframe' && value.launch?.fragment
      ? `${value.entry_url}${value.launch.fragment}`
      : value.entry_url
  })
  const runtimeTargetOrigin = computed(() =>
    metadata.value?.type === 'iframe' ? metadata.value.launch?.origin || '' : '*'
  )
  const safeSandbox = computed(() => {
    const raw = metadata.value?.sandbox || 'allow-scripts allow-forms allow-popups allow-downloads'
    const allowed = new Set([
      'allow-scripts',
      'allow-forms',
      'allow-popups',
      'allow-downloads',
      'allow-same-origin'
    ])
    return raw
      .split(/\s+/)
      .filter(
        (item) =>
          allowed.has(item) && !(metadata.value?.type === 'static' && item === 'allow-same-origin')
      )
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
    runtimeSession = null
    launchExchangePromise = null
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
      runtimeSession = data.runtime?.session || null
    } catch (error: any) {
      if (sequence !== loadSequence) return
      console.error('[AppCenterOpenPage] open app failed:', error)
      loadError.value = error?.message || '应用可能尚未安装、已停用或未发布。'
      ElMessage.error(loadError.value)
    } finally {
      if (sequence === loadSequence) loading.value = false
    }
  }

  function launchTokenFromMetadata() {
    const fragment = metadata.value?.launch?.fragment || ''
    const prefix = '#agentstudio_launch='
    return fragment.startsWith(prefix) ? fragment.slice(prefix.length) : ''
  }

  function exchangeLaunchToken(launchToken: string, signal: AbortSignal) {
    if (runtimeSession) return Promise.resolve(runtimeSession)
    if (!launchToken || launchToken !== launchTokenFromMetadata()) {
      return Promise.reject(new Error('Iframe launch is invalid'))
    }
    if (!launchExchangePromise) {
      launchExchangePromise = exchangeIframeLaunch(launchToken, signal).then((session) => {
        runtimeSession = session
        return session
      })
      launchExchangePromise.catch(() => {
        launchExchangePromise = null
      })
    }
    return launchExchangePromise
  }

  async function dispatchRuntimeCapability(
    request: ParsedAppRuntimeRequest,
    token: string,
    signal: AbortSignal
  ) {
    const data = request.data
    switch (request.operation) {
      case 'context.get':
        return fetchAppRuntimeContext(token, signal)
      case 'kv.get':
        return fetchAppRuntimeKv(token, String(data.namespace), String(data.key), signal)
      case 'kv.set':
        return setAppRuntimeKv(
          token,
          String(data.namespace),
          String(data.key),
          {
            value: data.value as AppRuntimeJsonValue,
            ...(data.expected_version === undefined
              ? {}
              : { expected_version: Number(data.expected_version) }),
            ...(data.ttl_seconds === undefined ? {} : { ttl_seconds: Number(data.ttl_seconds) })
          },
          signal
        )
      case 'kv.delete':
        return deleteAppRuntimeKv(token, String(data.namespace), String(data.key), signal)
      case 'files.upload':
        return uploadAppRuntimeFile(
          token,
          data.file as Blob,
          typeof data.name === 'string' ? data.name : undefined,
          signal
        )
      case 'files.read': {
        const file = await readAppRuntimeFile(token, String(data.id), signal)
        return {
          data: await file.arrayBuffer(),
          mime_type: file.type || 'application/octet-stream'
        }
      }
      case 'files.delete':
        return deleteAppRuntimeFile(token, String(data.id), signal)
      case 'http.request':
        return requestAppRuntimeHttp(token, data, signal)
      case 'webhooks.emit':
        return emitAppRuntimeWebhook(token, data, signal)
      case 'services.invoke':
        return invokeAppRuntimeService(
          token,
          String(data.target_code),
          data.input as AppRuntimeJsonValue,
          signal
        )
      default:
        throw new Error('Runtime operation is not supported')
    }
  }

  function runtimeErrorCode(error: unknown) {
    const status = Number((error as { code?: unknown })?.code)
    if (status === 401 || status === 403) return 'capability_denied'
    if ([409, 429, 503].includes(status)) return 'request_failed'
    return 'request_failed'
  }

  async function handleRuntimeMessage(event: MessageEvent<unknown>) {
    const frameWindow = appFrame.value?.contentWindow
    const activeMetadata = metadata.value
    if (!frameWindow || !activeMetadata || event.source !== frameWindow) return
    const targetOrigin = activeMetadata.type === 'iframe' ? runtimeTargetOrigin.value : '*'
    if (activeMetadata.type === 'iframe' && event.origin !== runtimeTargetOrigin.value) return

    const parsed = parseAppRuntimeRequest(event.data)
    if (!parsed) return
    if (parsed.response) {
      frameWindow.postMessage(parsed.response, targetOrigin)
      return
    }

    const sequence = loadSequence
    const runtimeAbortController = new AbortController()
    runtimeAbortControllers.add(runtimeAbortController)
    try {
      const request = parsed.request
      if (request.operation === 'launch.exchange') {
        await exchangeLaunchToken(
          String(request.data.launch_token || ''),
          runtimeAbortController.signal
        )
        if (sequence !== loadSequence || event.source !== appFrame.value?.contentWindow) return
        const response = createAppRuntimeOperationSuccessResponse(
          request.request_id,
          'launch.exchange',
          { ready: true }
        )
        frameWindow.postMessage(response, targetOrigin)
        return
      }

      const session = runtimeSession
      if (!session) {
        const response =
          request.operation === 'context.get'
            ? resolveAppRuntimeRequest(event.data, activeMetadata.runtime)
            : createAppRuntimeOperationErrorResponse(
                request.request_id,
                request.operation,
                'capability_denied'
              )
        if (response) frameWindow.postMessage(response, targetOrigin)
        return
      }

      const data = await dispatchRuntimeCapability(
        request,
        session.token,
        runtimeAbortController.signal
      )
      if (
        runtimeAbortController.signal.aborted ||
        sequence !== loadSequence ||
        event.source !== appFrame.value?.contentWindow
      ) {
        return
      }
      const response = request.legacy
        ? createAppRuntimeContextResponse(request.request_id, data)
        : createAppRuntimeOperationSuccessResponse(request.request_id, request.operation, data)
      frameWindow.postMessage(response, targetOrigin)
    } catch (error: unknown) {
      if (
        runtimeAbortController.signal.aborted ||
        sequence !== loadSequence ||
        event.source !== appFrame.value?.contentWindow
      ) {
        return
      }
      const request = parsed.request
      const response = request.legacy
        ? createAppRuntimeErrorResponse(
            request.request_id,
            runtimeErrorCode(error) === 'capability_denied' ? 'scope_denied' : 'context_unavailable'
          )
        : createAppRuntimeOperationErrorResponse(
            request.request_id,
            request.operation,
            runtimeErrorCode(error)
          )
      frameWindow.postMessage(response, targetOrigin)
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
    runtimeSession = null
    launchExchangePromise = null
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
