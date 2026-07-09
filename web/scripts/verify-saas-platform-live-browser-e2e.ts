import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium, type Browser, type BrowserContext, type Page, type Route } from 'playwright'

type ApiEnvelope<T = unknown> = {
  code?: number
  msg?: string
  message?: string
  data?: T
}

type TenantItem = {
  id?: number | string
  name?: string
  code?: string
}

type LoginData = {
  access_token?: string
  refresh_token?: string
  tenant_id?: number | string
}

type UserProfile = {
  is_platform_admin?: boolean
  is_admin?: boolean
  account_scope?: string
  username?: string
  tenant_id?: number | string
}

type RequestOptions = {
  method?: 'GET' | 'POST'
  token?: string
  body?: Record<string, unknown>
  query?: Record<string, unknown>
}

type PlatformRoute = {
  label: string
  hashPath: string
}

const webRoot = process.cwd()
const failures: string[] = []
const baseUrl = requiredEnv('SAAS_PLATFORM_LIVE_E2E_BASE_URL')
const username = requiredEnv('SAAS_PLATFORM_LIVE_E2E_USERNAME')
const password = requiredEnv('SAAS_PLATFORM_LIVE_E2E_PASSWORD')
const requestedTenantId = process.env.SAAS_PLATFORM_LIVE_E2E_TENANT_ID?.trim()
const requestedWebUrl = process.env.SAAS_PLATFORM_LIVE_E2E_WEB_URL?.trim()
const appVersion = process.env.SAAS_PLATFORM_LIVE_E2E_APP_VERSION?.trim() || '3.0.1'
const host = '127.0.0.1'
const webPort = Number(process.env.SAAS_PLATFORM_LIVE_E2E_WEB_PORT || 4183)
const previewBaseUrl = `http://${host}:${webPort}`
const webUrl = requestedWebUrl || previewBaseUrl
const distIndex = resolve(webRoot, 'dist/index.html')
const viteCli = resolve(webRoot, 'node_modules/vite/bin/vite.js')
const checkedRoutes: string[] = []

const platformRoutes: PlatformRoute[] = [
  { label: 'platform tenants page', hashPath: '/saas-platform/tenants' },
  { label: 'platform plans page', hashPath: '/saas-platform/plans' },
  { label: 'platform modules page', hashPath: '/saas-platform/module' },
  { label: 'platform subscriptions page', hashPath: '/saas-platform/subscription' },
  { label: 'platform usage page', hashPath: '/saas-platform/usage' },
  { label: 'platform revenue page', hashPath: '/saas-platform/revenue' },
  { label: 'platform resource packs page', hashPath: '/saas-platform/resource-packs' },
  { label: 'platform resource-pack orders page', hashPath: '/saas-platform/resource-pack-orders' },
  { label: 'platform payment config page', hashPath: '/saas-platform/payment-config' }
]

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    failures.push(`${name} is required for platform live SaaS browser E2E`)
    return ''
  }
  return value
}

function assert(condition: unknown, message: string) {
  if (!condition) failures.push(message)
}

function isSuccessEnvelope(value: ApiEnvelope): boolean {
  return Number(value.code) === 200
}

function describeApiError(label: string, status: number, body: ApiEnvelope | undefined, raw: string) {
  const message = body?.message || body?.msg || raw.slice(0, 200)
  return `${label} failed with HTTP ${status}, code ${body?.code ?? 'unknown'}: ${message}`
}

function sanitizeBaseUrl(value: string) {
  return value.replace(/\/$/, '')
}

async function requestJson<T>(path: string, options: RequestOptions = {}) {
  const url = new URL(path.replace(/^\//, ''), `${sanitizeBaseUrl(baseUrl)}/`)
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  }

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      accept: 'application/json',
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  })

  const raw = await response.text()
  let json: ApiEnvelope<T> | undefined
  try {
    json = raw ? (JSON.parse(raw) as ApiEnvelope<T>) : {}
  } catch {
    json = undefined
  }

  return { response, json, raw }
}

function assertOk<T>(label: string, result: Awaited<ReturnType<typeof requestJson<T>>>) {
  assert(result.response.ok, `${label} must return HTTP 2xx, got ${result.response.status}`)
  assert(Boolean(result.json), `${label} must return JSON`)
  if (!result.response.ok || !result.json) {
    failures.push(describeApiError(label, result.response.status, result.json, result.raw))
    return undefined
  }

  assert(isSuccessEnvelope(result.json), describeApiError(label, result.response.status, result.json, result.raw))
  return isSuccessEnvelope(result.json) ? result.json.data : undefined
}

function selectTenant(tenants: TenantItem[]) {
  if (!requestedTenantId) return tenants[0]
  return tenants.find((tenant) => String(tenant.id) === requestedTenantId)
}

async function authenticatePlatformAdmin() {
  const tenants = assertOk<TenantItem[]>(
    'credential-gated tenant lookup',
    await requestJson('/api/core/tenants-by-credentials', {
      method: 'POST',
      body: { username, password }
    })
  )
  assert(Array.isArray(tenants) && tenants.length > 0, 'credential-gated tenant lookup must return at least one tenant')
  if (!Array.isArray(tenants) || tenants.length === 0) return undefined

  const selectedTenant = selectTenant(tenants)
  assert(
    selectedTenant?.id,
    requestedTenantId
      ? `SAAS_PLATFORM_LIVE_E2E_TENANT_ID ${requestedTenantId} was not found for the supplied credentials`
      : 'credential-gated tenant lookup returned a tenant without id'
  )
  if (!selectedTenant?.id) return undefined

  const selectedTenantId = Number(selectedTenant.id)
  const loginData = assertOk<LoginData>(
    'tenant-scoped platform login bootstrap',
    await requestJson('/api/core/login', {
      method: 'POST',
      body: { username, password, tenant_id: selectedTenantId }
    })
  )
  assert(loginData?.access_token, 'tenant-scoped platform login must return data.access_token')
  assert(loginData?.refresh_token, 'tenant-scoped platform login must return data.refresh_token')
  assert(Number(loginData?.tenant_id) === selectedTenantId, 'tenant-scoped platform login must preserve selected tenant_id')
  if (!loginData?.access_token) return undefined

  const profile = assertOk<UserProfile>(
    'current platform user profile',
    await requestJson('/api/core/system/user', { token: loginData.access_token })
  )
  assert(profile, 'current platform user profile must return user data')
  assert(
    profile?.is_platform_admin === true || profile?.is_admin === true || profile?.account_scope === 'platform',
    'current user must be a platform administrator for platform live browser E2E'
  )
  if (!profile) return undefined

  return {
    tenantId: selectedTenantId,
    accessToken: loginData.access_token,
    refreshToken: loginData.refresh_token || '',
    profile
  }
}

function assertPreviewPrerequisites() {
  assert(existsSync(distIndex), 'dist/index.html must exist; run pnpm.cmd build before platform live browser E2E')
  assert(existsSync(viteCli), 'node_modules/vite/bin/vite.js must exist')
  if (existsSync(distIndex)) {
    const builtIndex = readFileSync(distIndex, 'utf8')
    assert(builtIndex.includes('<div id="app"'), 'dist/index.html must contain the Vue app mount point')
  }
}

function startPreview() {
  if (requestedWebUrl) return undefined
  assertPreviewPrerequisites()
  if (failures.length) return undefined

  const child = spawn(
    process.execPath,
    [viteCli, 'preview', '--host', host, '--port', String(webPort), '--strictPort'],
    {
      cwd: webRoot,
      stdio: ['ignore', 'pipe', 'pipe']
    }
  )

  child.stdout.on('data', (data) => process.stdout.write(data))
  child.stderr.on('data', (data) => process.stderr.write(data))
  return child
}

async function waitForWeb() {
  const deadline = Date.now() + 30_000
  let lastError = ''

  while (Date.now() < deadline) {
    try {
      const response = await fetch(webUrl)
      if (response.ok) return
      lastError = `HTTP ${response.status}`
    } catch (error) {
      lastError = (error as Error).message
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500))
  }

  failures.push(`web app did not become ready at ${webUrl}: ${lastError}`)
}

function mapBrowserApiUrl(browserUrl: string) {
  const requestUrl = new URL(browserUrl)
  let targetPath = requestUrl.pathname
  if (targetPath.startsWith('/nest-api/')) {
    targetPath = `/api/${targetPath.slice('/nest-api/'.length)}`
  }
  const targetUrl = new URL(targetPath.replace(/^\//, ''), `${sanitizeBaseUrl(baseUrl)}/`)
  targetUrl.search = requestUrl.search
  return targetUrl
}

function buildForwardHeaders(headers: Record<string, string>) {
  const nextHeaders: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    const normalized = key.toLowerCase()
    if (['host', 'content-length', 'origin', 'referer'].includes(normalized)) continue
    nextHeaders[key] = value
  }
  return nextHeaders
}

function pickFulfillHeaders(headers: Headers) {
  const nextHeaders: Record<string, string> = {}
  for (const key of ['content-type', 'cache-control']) {
    const value = headers.get(key)
    if (value) nextHeaders[key] = value
  }
  return nextHeaders
}

async function proxyLiveBackendApi(route: Route) {
  const request = route.request()
  const targetUrl = mapBrowserApiUrl(request.url())
  const method = request.method()
  const body = method === 'GET' || method === 'HEAD' ? undefined : request.postDataBuffer() || undefined

  try {
    const backendResponse = await fetch(targetUrl, {
      method,
      headers: buildForwardHeaders(request.headers()),
      body
    })
    const responseBuffer = Buffer.from(await backendResponse.arrayBuffer())

    await route.fulfill({
      status: backendResponse.status,
      headers: pickFulfillHeaders(backendResponse.headers),
      body: responseBuffer
    })
  } catch (error) {
    await route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 500,
        message: `platform live browser E2E proxy failed: ${(error as Error).message}`
      })
    })
  }
}

async function wireBrowserContext(
  context: BrowserContext,
  auth: {
    accessToken: string
    refreshToken: string
    profile: UserProfile
  }
) {
  await context.route('**/api/**', proxyLiveBackendApi)
  await context.route('**/nest-api/**', proxyLiveBackendApi)
  await context.addInitScript(
    ({ version, accessToken, refreshToken, userInfo }) => {
      window.localStorage.setItem(
        `sys-v${version}-user`,
        JSON.stringify({
          isLogin: true,
          accessToken,
          refreshToken,
          info: userInfo,
          language: 'zh',
          isLock: false,
          lockPassword: '',
          searchHistory: []
        })
      )
    },
    {
      version: appVersion,
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
      userInfo: auth.profile
    }
  )
}

async function assertHealthyPlatformPage(page: Page, route: PlatformRoute) {
  const targetUrl = `${webUrl.replace(/\/$/, '')}/#${route.hashPath}`
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined)
  await page.waitForFunction(() => document.body.innerText.trim().length > 0, undefined, {
    timeout: 30_000
  })

  const currentUrl = page.url()
  assert(!currentUrl.includes('#/auth/login'), `${route.label} must not redirect to login, got ${currentUrl}`)
  assert(!currentUrl.includes('exception'), `${route.label} must not route to exception page, got ${currentUrl}`)

  const bodyText = await page.locator('body').innerText({ timeout: 5_000 }).catch(() => '')
  assert(bodyText.trim().length > 0, `${route.label} must render visible text`)
  assert(!/\b(404|500)\b/.test(bodyText), `${route.label} must not render an exception status`)
  checkedRoutes.push(route.hashPath)
}

async function verifyPlatformLiveBrowserE2E(auth: Awaited<ReturnType<typeof authenticatePlatformAdmin>>) {
  if (!auth) return

  const preview = startPreview()
  if (failures.length) return

  let browser: Browser | undefined
  const pageErrors: string[] = []

  try {
    await waitForWeb()
    if (failures.length) return

    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext()
    await wireBrowserContext(context, auth)
    const page = await context.newPage()
    page.on('pageerror', (error) => pageErrors.push(error.message))

    for (const platformRoute of platformRoutes) {
      await assertHealthyPlatformPage(page, platformRoute)
    }

    assert(pageErrors.length === 0, `platform live browser E2E must not emit page errors: ${pageErrors.join('; ')}`)

    if (!failures.length) {
      console.log(
        JSON.stringify(
          {
            base_url: baseUrl,
            web_url: webUrl,
            tenant_id: auth.tenantId,
            routes_checked: checkedRoutes,
            mutation_checked: false
          },
          null,
          2
        )
      )
    }
  } finally {
    if (browser) await browser.close()
    if (preview) await stopPreview(preview)
  }
}

async function stopPreview(preview: ChildProcessWithoutNullStreams) {
  if (preview.killed) return

  await new Promise<void>((resolveStop) => {
    const timeout = setTimeout(resolveStop, 3_000)
    preview.once('close', () => {
      clearTimeout(timeout)
      resolveStop()
    })
    preview.kill()
  })
}

async function main() {
  try {
    if (failures.length) return

    const auth = await authenticatePlatformAdmin()
    if (failures.length) return

    await verifyPlatformLiveBrowserE2E(auth)
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error))
  } finally {
    if (failures.length) {
      console.error(failures.join('\n'))
      process.exit(1)
    }
  }

  console.log('SaaS platform live browser E2E verified.')
}

void main()
