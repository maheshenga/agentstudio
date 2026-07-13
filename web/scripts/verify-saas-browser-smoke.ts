import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { resolve } from 'node:path'
import { chromium, type Browser, type BrowserContext, type Page, type Route } from 'playwright'

const webRoot = process.cwd()
const failures: string[] = []
const host = '127.0.0.1'
const port = Number(process.env.SAAS_BROWSER_SMOKE_PORT || 4181)
const apiMockPort = Number(process.env.SAAS_BROWSER_SMOKE_API_PORT || 8181)
const baseUrl = `http://${host}:${port}`
const distIndex = resolve(webRoot, 'dist/index.html')
const viteCli = resolve(webRoot, 'node_modules/vite/bin/vite.js')
const transparentGif =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

function assert(condition: unknown, message: string) {
  if (!condition) failures.push(message)
}

function readBuiltIndex() {
  assert(existsSync(distIndex), 'dist/index.html must exist; run pnpm.cmd build before browser smoke')
  return existsSync(distIndex) ? readFileSync(distIndex, 'utf8') : ''
}

function startPreview() {
  assert(existsSync(viteCli), 'node_modules/vite/bin/vite.js must exist')
  if (!existsSync(viteCli)) return null

  const child = spawn(
    process.execPath,
    [viteCli, 'preview', '--host', host, '--port', String(port), '--strictPort'],
    {
      cwd: webRoot,
      stdio: ['ignore', 'pipe', 'pipe']
    }
  )

  child.stdout.on('data', (data) => process.stdout.write(data))
  child.stderr.on('data', (data) => process.stderr.write(data))
  return child
}

function getMockBackendData(url: string) {
  if (url.includes('/core/login-captcha')) {
    return { enabled: false }
  }

  if (url.includes('/core/config/public/site_name')) {
    return { key: 'site_name', value: 'FssAdmin后台管理系统' }
  }

  if (url.includes('/core/tenants-by-credentials')) {
    return []
  }

  if (url.includes('/core/captcha')) {
    return { uuid: 'browser-smoke', image: transparentGif }
  }

  return {}
}

function getMockBackendBody(url: string) {
  return JSON.stringify({ code: 200, message: 'success', data: getMockBackendData(url) })
}

async function startMockApiServer() {
  const server = createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(getMockBackendBody(request.url || '/'))
  })

  await new Promise<void>((resolveStart, rejectStart) => {
    server.once('error', rejectStart)
    server.listen(apiMockPort, host, resolveStart)
  }).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'EADDRINUSE') throw error
    return undefined
  })

  return server.listening ? server : undefined
}

async function waitForPreview() {
  const deadline = Date.now() + 30_000
  let lastError = ''

  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl)
      if (response.ok) return
      lastError = `HTTP ${response.status}`
    } catch (error) {
      lastError = (error as Error).message
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500))
  }

  failures.push(`vite preview did not become ready at ${baseUrl}: ${lastError}`)
}

async function fulfillMockBackendApi(route: Route) {
  const url = route.request().url()

  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: getMockBackendBody(url)
  })
}

async function mockBackendApis(context: BrowserContext) {
  await context.route('**/api/**', fulfillMockBackendApi)
  await context.route('**/nest-api/**', fulfillMockBackendApi)
}

async function assertHealthyPage(page: Page, label: string) {
  await page.waitForSelector('#app > *', { timeout: 15_000 })
  const bodyText = await page.locator('body').innerText({ timeout: 5_000 }).catch(() => '')
  assert(bodyText.trim().length > 0, `${label} must render visible text`)
  assert(!/\b(404|500)\b/.test(bodyText), `${label} must not render an exception page`)
}

async function verifySignupPage(page: Page) {
  await page.goto(`${baseUrl}/#/saas/signup`, { waitUntil: 'domcontentloaded' })
  await assertHealthyPage(page, 'SaaS signup page')
  await page.waitForSelector('.signup-form', { timeout: 15_000 })

  const inputCount = await page.locator('.signup-form input').count()
  const hasAgreement = (await page.locator('.signup-form .signup-form__agreement').count()) > 0
  const hasSubmit = (await page.locator('.signup-form__submit button').count()) > 0
  const signupBrand = await page.locator('.login-left-view .logo .title').innerText()

  assert(inputCount >= 6, `SaaS signup page must render form inputs, got ${inputCount}`)
  assert(hasAgreement, 'SaaS signup page must render agreement checkbox')
  assert(hasSubmit, 'SaaS signup page must render submit button')
  assert(signupBrand === 'AgentStudio', `SaaS signup brand must be AgentStudio, got ${signupBrand}`)
}

async function verifyLoginInitialState(context: BrowserContext) {
  const page = await context.newPage()
  const pageErrors: string[] = []
  const consoleWarnings: string[] = []

  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'warning') {
      consoleWarnings.push(message.text())
    }
  })

  try {
    await page.goto(`${baseUrl}/#/auth/login`, { waitUntil: 'domcontentloaded' })
    await assertHealthyPage(page, 'Login page')
    await page.waitForTimeout(2_200)

    const visibleWelcomeDialogs = await page.locator('.welcome-dialog:visible').count()
    const visibleValidationErrors = await page
      .locator('.login-form .el-form-item__error:visible')
      .count()
    const loginBrand = await page.locator('.login-page-logo .title').innerText()
    const accountInput = page.locator('input[placeholder="请输入账号"]')
    const passwordInput = page.locator('input[placeholder="请输入密码"]')
    const tenantPlaceholder = page.locator('.login-form .el-select__placeholder')
    const initialTenantPlaceholder = await tenantPlaceholder.innerText()

    await accountInput.fill('a')
    await page.waitForTimeout(50)
    const shortAccountTenantPlaceholder = await tenantPlaceholder.innerText()

    await accountInput.fill('tenant-browser-smoke')
    await page.waitForTimeout(50)
    const passwordTenantPlaceholder = await tenantPlaceholder.innerText()

    await passwordInput.fill('tenant-browser-password')
    await page.waitForTimeout(700)
    const emptyTenantPlaceholder = await tenantPlaceholder.innerText()

    assert(visibleWelcomeDialogs === 0, 'login page must not show the debug welcome dialog')
    assert(
      visibleValidationErrors === 0,
      `untouched login form must not show validation errors, got ${visibleValidationErrors}`
    )
    assert(loginBrand === 'AgentStudio', `login brand must be AgentStudio, got ${loginBrand}`)
    assert(
      initialTenantPlaceholder === '请先输入账号',
      `initial tenant placeholder must request an account, got ${initialTenantPlaceholder}`
    )
    assert(
      shortAccountTenantPlaceholder === '请先输入账号',
      `short account placeholder must still request an account, got ${shortAccountTenantPlaceholder}`
    )
    assert(
      passwordTenantPlaceholder === '请先输入密码',
      `tenant placeholder must request a password after account entry, got ${passwordTenantPlaceholder}`
    )
    assert(
      emptyTenantPlaceholder === '未找到可用租户',
      `tenant placeholder must explain an empty lookup, got ${emptyTenantPlaceholder}`
    )
    assert(
      pageErrors.length === 0,
      `login page must not emit page errors: ${pageErrors.join('; ')}`
    )
    assert(
      consoleWarnings.length === 0,
      `login page must not emit console warnings: ${consoleWarnings.join('; ')}`
    )
  } finally {
    await page.close()
  }
}

async function verifyProtectedRedirect(page: Page, routePath: string) {
  await page.goto(`${baseUrl}/#${routePath}`, { waitUntil: 'domcontentloaded' })
  await page.waitForURL(
    (url) => url.hash.startsWith('#/auth/login') && decodeURIComponent(url.hash).includes(routePath),
    { timeout: 15_000 }
  )
  await assertHealthyPage(page, `${routePath} protected redirect`)

  const hash = decodeURIComponent(new URL(page.url()).hash)
  const hasLoginForm = (await page.locator('.login-form').count()) > 0

  assert(hash.startsWith('#/auth/login'), `${routePath} must redirect to login, got ${hash}`)
  assert(hash.includes(`redirect=${routePath}`), `${routePath} login redirect must preserve original path`)
  assert(hasLoginForm, `${routePath} redirect must render the login form`)
}

async function runBrowserSmoke() {
  const builtIndex = readBuiltIndex()
  assert(builtIndex.includes('<div id="app"'), 'dist/index.html must contain the Vue app mount point')
  if (failures.length) return

  const mockApi = await startMockApiServer()
  const preview = startPreview()
  if (!preview) {
    if (mockApi) await stopMockApiServer(mockApi)
    return
  }

  let browser: Browser | undefined
  const pageErrors: string[] = []

  try {
    await waitForPreview()
    if (failures.length) return

    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext()
    await mockBackendApis(context)

    await verifyLoginInitialState(context)

    const page = await context.newPage()
    page.on('pageerror', (error) => pageErrors.push(error.message))

    await verifySignupPage(page)
    await verifyProtectedRedirect(page, '/tenant-saas/usage')
    await verifyProtectedRedirect(page, '/saas-platform/usage')

    assert(pageErrors.length === 0, `browser smoke must not emit page errors: ${pageErrors.join('; ')}`)
  } finally {
    if (browser) await browser.close()
    await stopPreview(preview)
    if (mockApi) await stopMockApiServer(mockApi)
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

async function stopMockApiServer(server: Server) {
  await new Promise<void>((resolveStop, rejectStop) => {
    server.close((error) => {
      if (error) rejectStop(error)
      else resolveStop()
    })
  })
}

await runBrowserSmoke()

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('SaaS browser smoke verified.')
