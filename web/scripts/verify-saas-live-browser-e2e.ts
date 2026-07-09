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

type ResourcePackItem = {
  code?: string
  name?: string
  status?: number | string
}

type RequestOptions = {
  method?: 'GET' | 'POST'
  token?: string
  body?: Record<string, unknown>
  query?: Record<string, unknown>
}

const webRoot = process.cwd()
const failures: string[] = []
const baseUrl = requiredEnv('SAAS_LIVE_E2E_BASE_URL')
const username = requiredEnv('SAAS_LIVE_E2E_USERNAME')
const password = requiredEnv('SAAS_LIVE_E2E_PASSWORD')
const requestedTenantId = process.env.SAAS_LIVE_E2E_TENANT_ID?.trim()
const requestedWebUrl = process.env.SAAS_LIVE_E2E_WEB_URL?.trim()
const requestedPlanCode = process.env.SAAS_LIVE_E2E_PLAN_CODE?.trim()
const billingCycle = process.env.SAAS_LIVE_E2E_BILLING_CYCLE?.trim() || 'monthly'
const runPayment = process.env.SAAS_LIVE_E2E_RUN_PAYMENT === '1'
const runResourcePack = process.env.SAAS_LIVE_E2E_RUN_RESOURCE_PACK === '1'
const runResourcePackPayment = process.env.SAAS_LIVE_E2E_RUN_RESOURCE_PACK_PAYMENT === '1'
const requestedResourcePackCode = process.env.SAAS_LIVE_E2E_RESOURCE_PACK_CODE?.trim()
const appVersion = process.env.SAAS_LIVE_E2E_APP_VERSION?.trim() || '3.0.1'
const host = '127.0.0.1'
const webPort = Number(process.env.SAAS_LIVE_E2E_WEB_PORT || 4182)
const previewBaseUrl = `http://${host}:${webPort}`
const webUrl = requestedWebUrl || previewBaseUrl
const distIndex = resolve(webRoot, 'dist/index.html')
const viteCli = resolve(webRoot, 'node_modules/vite/bin/vite.js')

let observedCreatedOrderNo = ''
let observedDevPaymentStatus = ''
let observedCreatedResourcePackOrderNo = ''
let observedResourcePackDevPaymentStatus = ''
let observedResourcePackCode = ''
let observedResourcePacks: ResourcePackItem[] = []

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    failures.push(`${name} is required for live SaaS browser E2E`)
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

async function authenticate() {
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
      ? `SAAS_LIVE_E2E_TENANT_ID ${requestedTenantId} was not found for the supplied credentials`
      : 'credential-gated tenant lookup returned a tenant without id'
  )
  if (!selectedTenant?.id) return undefined

  const selectedTenantId = Number(selectedTenant.id)
  const loginData = assertOk<LoginData>(
    'tenant-scoped login',
    await requestJson('/api/core/login', {
      method: 'POST',
      body: { username, password, tenant_id: selectedTenantId }
    })
  )
  assert(loginData?.access_token, 'tenant-scoped login must return data.access_token')
  assert(loginData?.refresh_token, 'tenant-scoped login must return data.refresh_token')
  assert(Number(loginData?.tenant_id) === selectedTenantId, 'tenant-scoped login must preserve selected tenant_id')
  if (!loginData?.access_token) return undefined

  const userInfo = assertOk<Record<string, unknown>>(
    'current user profile',
    await requestJson('/api/core/system/user', { token: loginData.access_token })
  )
  assert(userInfo, 'current user profile must return user data')
  if (!userInfo) return undefined

  return {
    tenantId: selectedTenantId,
    accessToken: loginData.access_token,
    refreshToken: loginData.refresh_token || '',
    userInfo
  }
}

function assertPreviewPrerequisites() {
  assert(existsSync(distIndex), 'dist/index.html must exist; run pnpm.cmd build before live browser E2E')
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

function observeApiResponse(targetUrl: URL, method: string, requestBodyText: string, bodyText: string) {
  if (method === 'GET' && targetUrl.pathname === '/api/saas/tenant/resource-packs') {
    const parsed = tryParseJson<ApiEnvelope<ResourcePackItem[]>>(bodyText)
    observedResourcePacks = Array.isArray(parsed?.data) ? parsed.data : observedResourcePacks
  }

  if (method === 'POST' && targetUrl.pathname === '/api/saas/tenant/orders') {
    const parsed = tryParseJson<ApiEnvelope<{ order_no?: string }>>(bodyText)
    observedCreatedOrderNo = parsed?.data?.order_no || observedCreatedOrderNo
  }

  if (method === 'POST' && targetUrl.pathname === '/api/saas/tenant/resource-pack-orders') {
    const parsed = tryParseJson<ApiEnvelope<{ order_no?: string; resource_pack_code?: string }>>(bodyText)
    observedCreatedResourcePackOrderNo = parsed?.data?.order_no || observedCreatedResourcePackOrderNo
    observedResourcePackCode = parsed?.data?.resource_pack_code || observedResourcePackCode
  }

  if (method === 'POST' && targetUrl.pathname === '/api/saas/payment/dev-confirm') {
    const requestPayload = tryParseJson<{ order_type?: string }>(requestBodyText)
    const parsed = tryParseJson<ApiEnvelope<{ status?: string }>>(bodyText)
    if (requestPayload?.order_type === 'resource_pack') {
      observedResourcePackDevPaymentStatus = parsed?.data?.status || observedResourcePackDevPaymentStatus
    } else {
      observedDevPaymentStatus = parsed?.data?.status || observedDevPaymentStatus
    }
  }
}

function tryParseJson<T>(value: string) {
  try {
    return JSON.parse(value) as T
  } catch {
    return undefined
  }
}

async function proxyLiveBackendApi(route: Route) {
  const request = route.request()
  const targetUrl = mapBrowserApiUrl(request.url())
  const method = request.method()
  const body = method === 'GET' || method === 'HEAD' ? undefined : request.postDataBuffer() || undefined
  const requestBodyText = body ? Buffer.from(body).toString('utf8') : ''

  try {
    const backendResponse = await fetch(targetUrl, {
      method,
      headers: buildForwardHeaders(request.headers()),
      body
    })
    const responseBuffer = Buffer.from(await backendResponse.arrayBuffer())
    const responseText = responseBuffer.toString('utf8')
    observeApiResponse(targetUrl, method, requestBodyText, responseText)

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
        message: `live browser E2E proxy failed: ${(error as Error).message}`
      })
    })
  }
}

async function wireBrowserContext(
  context: BrowserContext,
  auth: {
    accessToken: string
    refreshToken: string
    userInfo: Record<string, unknown>
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
      userInfo: auth.userInfo
    }
  )
}

async function assertHealthyTenantPlanPage(page: Page) {
  await page.goto(`${webUrl.replace(/\/$/, '')}/#/tenant-saas/plan`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.tenant-plan-page__plan-card', { timeout: 30_000 })
  await page.waitForSelector('.tenant-plan-page__orders', { timeout: 30_000 })

  const currentUrl = page.url()
  assert(!currentUrl.includes('#/auth/login'), `tenant plan page must not redirect to login, got ${currentUrl}`)
  assert(!currentUrl.includes('exception'), `tenant plan page must not route to exception page, got ${currentUrl}`)

  const bodyText = await page.locator('body').innerText({ timeout: 5_000 }).catch(() => '')
  assert(bodyText.trim().length > 0, 'tenant plan page must render visible text')
  assert(!/\b(404|500)\b/.test(bodyText), 'tenant plan page must not render an exception status')
}

async function findOrderButton(page: Page) {
  const cards = page.locator('.tenant-plan-page__plan-card')
  const cardCount = await cards.count()
  assert(cardCount > 0, 'tenant plan page must render at least one plan card')
  if (!cardCount) return undefined

  if (requestedPlanCode) {
    for (let index = 0; index < cardCount; index += 1) {
      const card = cards.nth(index)
      const text = await card.innerText().catch(() => '')
      if (!text.includes(requestedPlanCode)) continue
      const enabledButton = card.locator('button:not([disabled])').first()
      assert(
        (await enabledButton.count()) > 0,
        `plan ${requestedPlanCode} must have an enabled order button`
      )
      return (await enabledButton.count()) > 0 ? enabledButton : undefined
    }

    failures.push(`SAAS_LIVE_E2E_PLAN_CODE ${requestedPlanCode} was not found on tenant plan page`)
    return undefined
  }

  for (let index = 0; index < cardCount; index += 1) {
    const card = cards.nth(index)
    const enabledButton = card.locator('button:not([disabled])').first()
    if ((await enabledButton.count()) > 0) return enabledButton
  }

  failures.push('tenant plan page must expose at least one enabled upgrade order button')
  return undefined
}

async function waitForObservedOrderNo() {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    if (observedCreatedOrderNo) return observedCreatedOrderNo
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250))
  }
  return ''
}

async function waitForObservedResourcePackOrderNo() {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    if (observedCreatedResourcePackOrderNo) return observedCreatedResourcePackOrderNo
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250))
  }
  return ''
}

async function waitForResourcePackDevPaymentPaid() {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline && observedResourcePackDevPaymentStatus !== 'paid') {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250))
  }
  assert(
    observedResourcePackDevPaymentStatus === 'paid',
    `resource-pack development payment confirmation must return paid status, got ${observedResourcePackDevPaymentStatus || 'empty'}`
  )
}

async function verifyOrderFlow(page: Page) {
  const orderButton = await findOrderButton(page)
  if (!orderButton || failures.length) return

  await orderButton.click()
  await page.waitForSelector('.tenant-plan-page__order', { timeout: 30_000 })
  const orderNo = await waitForObservedOrderNo()
  assert(orderNo, 'tenant plan UI order creation must return data.order_no')

  if (!runPayment) {
    console.log('Skipping UI payment mutation; set SAAS_LIVE_E2E_RUN_PAYMENT=1 to click development payment confirmation.')
    return
  }

  const devPaymentButton = page.getByRole('button', { name: /本地模拟支付成功/ })
  assert(
    (await devPaymentButton.count()) > 0,
    'development payment button must be visible; rebuild with VITE_ENABLE_DEV_PAYMENT_CONFIRM=true before running SAAS_LIVE_E2E_RUN_PAYMENT=1'
  )
  if ((await devPaymentButton.count()) === 0) return

  await devPaymentButton.first().click()
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline && observedDevPaymentStatus !== 'paid') {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250))
  }
  assert(
    observedDevPaymentStatus === 'paid',
    `development payment confirmation must return paid status, got ${observedDevPaymentStatus || 'empty'}`
  )
}

async function assertHealthyTenantResourcePackPage(page: Page) {
  await page.goto(`${webUrl.replace(/\/$/, '')}/#/tenant-saas/resource-packs`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.tenant-resource-pack-page__pack', { timeout: 30_000 })
  await page.waitForSelector('.tenant-resource-pack-page__orders', { timeout: 30_000 })

  const currentUrl = page.url()
  assert(!currentUrl.includes('#/auth/login'), `tenant resource-pack page must not redirect to login, got ${currentUrl}`)
  assert(!currentUrl.includes('exception'), `tenant resource-pack page must not route to exception page, got ${currentUrl}`)

  const bodyText = await page.locator('body').innerText({ timeout: 5_000 }).catch(() => '')
  assert(bodyText.trim().length > 0, 'tenant resource-pack page must render visible text')
  assert(!/\b(404|500)\b/.test(bodyText), 'tenant resource-pack page must not render an exception status')
}

async function findResourcePackOrderButton(page: Page) {
  const cards = page.locator('.tenant-resource-pack-page__pack')
  const cardCount = await cards.count()
  assert(cardCount > 0, 'tenant resource-pack page must render at least one resource-pack card')
  if (!cardCount) return undefined

  let selectedIndex = 0
  if (requestedResourcePackCode) {
    selectedIndex = observedResourcePacks.findIndex((pack) => pack.code === requestedResourcePackCode)
    assert(
      selectedIndex >= 0,
      `SAAS_LIVE_E2E_RESOURCE_PACK_CODE ${requestedResourcePackCode} was not found in tenant resource packs`
    )
    if (selectedIndex < 0) return undefined
    assert(
      selectedIndex < cardCount,
      `resource-pack card for ${requestedResourcePackCode} was not rendered; API index ${selectedIndex}, card count ${cardCount}`
    )
    if (selectedIndex >= cardCount) return undefined
  }

  const card = cards.nth(selectedIndex)
  const enabledButton = card.locator('button:not([disabled])').first()
  assert((await enabledButton.count()) > 0, 'selected resource-pack card must have an enabled order button')
  return (await enabledButton.count()) > 0 ? enabledButton : undefined
}

async function verifyResourcePackOrderFlow(page: Page) {
  if (!runResourcePack && !runResourcePackPayment) {
    console.log('Skipping UI resource-pack mutation; set SAAS_LIVE_E2E_RUN_RESOURCE_PACK=1 to click a resource-pack order button.')
    return
  }

  await assertHealthyTenantResourcePackPage(page)
  if (failures.length) return

  const orderButton = await findResourcePackOrderButton(page)
  if (!orderButton || failures.length) return

  await orderButton.click()
  await page.waitForSelector('.tenant-resource-pack-page__order', { timeout: 30_000 })
  const orderNo = await waitForObservedResourcePackOrderNo()
  assert(orderNo, 'tenant resource-pack UI order creation must return data.order_no')
  if (!orderNo || !runResourcePackPayment) return

  const devPaymentButton = page
    .locator('.tenant-resource-pack-page__order')
    .getByRole('button', { name: /本地模拟支付成功/ })
  assert(
    (await devPaymentButton.count()) > 0,
    'resource-pack development payment button must be visible; rebuild with VITE_ENABLE_DEV_PAYMENT_CONFIRM=true before running SAAS_LIVE_E2E_RUN_RESOURCE_PACK_PAYMENT=1'
  )
  if ((await devPaymentButton.count()) === 0) return

  await devPaymentButton.first().click()
  await waitForResourcePackDevPaymentPaid()
}

async function verifyLiveBrowserE2E(auth: Awaited<ReturnType<typeof authenticate>>) {
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

    await assertHealthyTenantPlanPage(page)
    if (failures.length) return

    await verifyOrderFlow(page)
    await verifyResourcePackOrderFlow(page)
    assert(pageErrors.length === 0, `live browser E2E must not emit page errors: ${pageErrors.join('; ')}`)

    if (!failures.length) {
      console.log(
        JSON.stringify(
          {
            base_url: baseUrl,
            web_url: webUrl,
            tenant_id: auth.tenantId,
            order_checked: Boolean(observedCreatedOrderNo),
            payment_checked: runPayment,
            plan_code: requestedPlanCode || 'first-enabled',
            resource_pack_order_checked: Boolean(observedCreatedResourcePackOrderNo),
            resource_pack_payment_checked: runResourcePackPayment,
            resource_pack_code: requestedResourcePackCode || observedResourcePackCode || undefined
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
    assert(
      ['monthly', 'yearly'].includes(billingCycle),
      'SAAS_LIVE_E2E_BILLING_CYCLE must be either monthly or yearly'
    )
    if (failures.length) return

    const auth = await authenticate()
    if (failures.length) return

    await verifyLiveBrowserE2E(auth)
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error))
  } finally {
    if (failures.length) {
      console.error(failures.join('\n'))
      process.exit(1)
    }
  }

  console.log('SaaS live browser E2E verified.')
}

void main()
