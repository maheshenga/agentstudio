import assert from 'node:assert/strict'
import {
  spawn,
  spawnSync,
  type ChildProcess,
  type SpawnOptions,
  type SpawnSyncOptions
} from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { basename, resolve } from 'node:path'
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Frame,
  type Page,
  type Route
} from 'playwright'

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
  user?: {
    id?: number | string
    username?: string
    nickname?: string
    is_admin?: boolean
  }
}

type SignupData = {
  userId?: number | string
  tenantId?: number | string
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT'
  token?: string
  body?: Record<string, unknown>
}

type E2EConfig = {
  dbHost: string
  dbPort: string
  dbUsername: string
  dbPassword: string
  platformUsername: string
  platformPassword: string
  redisHost: string
  redisPort: string
  redisPassword: string
  redisDb: string
  keep: boolean
}

type AuthSession = {
  tenantId: number
  accessToken: string
  refreshToken: string
  profile: Record<string, unknown>
  login: LoginData
}

const webRoot = process.cwd()
const repoRoot = resolve(webRoot, '..')
const serverRoot = resolve(repoRoot, 'server')
const zipPath = resolve(webRoot, '.artifacts/runtime-starter.zip')
const viteCli = resolve(webRoot, 'node_modules/vite/bin/vite.js')
const serverEntry = resolve(serverRoot, 'dist/main.js')
const sensitiveValues = new Set<string>()
const processLogs = new Map<ChildProcess, { label: string; output: string }>()
const safeSteps: Array<{ label: string; at: string }> = []

let backend: ChildProcess | undefined
let preview: ChildProcess | undefined
let browser: Browser | undefined
let page: Page | undefined
let artifactRoot = ''
let databaseName = ''
let config: E2EConfig
const browserConsole: string[] = []

function requiredEnv(name: string): string {
  return String(process.env[name] || '').trim()
}

function loadConfig(): E2EConfig {
  const required = [
    'APP_RUNTIME_E2E_DB_HOST',
    'APP_RUNTIME_E2E_DB_PORT',
    'APP_RUNTIME_E2E_DB_USERNAME',
    'APP_RUNTIME_E2E_DB_PASSWORD',
    'APP_RUNTIME_E2E_PLATFORM_USERNAME',
    'APP_RUNTIME_E2E_PLATFORM_PASSWORD'
  ]
  const missing = required.filter((name) => !requiredEnv(name))
  if (missing.length) {
    throw new Error(`Missing required App Runtime E2E variables: ${missing.join(', ')}`)
  }

  const result: E2EConfig = {
    dbHost: requiredEnv('APP_RUNTIME_E2E_DB_HOST'),
    dbPort: requiredEnv('APP_RUNTIME_E2E_DB_PORT'),
    dbUsername: requiredEnv('APP_RUNTIME_E2E_DB_USERNAME'),
    dbPassword: requiredEnv('APP_RUNTIME_E2E_DB_PASSWORD'),
    platformUsername: requiredEnv('APP_RUNTIME_E2E_PLATFORM_USERNAME'),
    platformPassword: requiredEnv('APP_RUNTIME_E2E_PLATFORM_PASSWORD'),
    redisHost: requiredEnv('APP_RUNTIME_E2E_REDIS_HOST') || '127.0.0.1',
    redisPort: requiredEnv('APP_RUNTIME_E2E_REDIS_PORT') || '6379',
    redisPassword: requiredEnv('APP_RUNTIME_E2E_REDIS_PASSWORD'),
    redisDb: requiredEnv('APP_RUNTIME_E2E_REDIS_DB') || '15',
    keep: requiredEnv('APP_RUNTIME_E2E_KEEP') === '1'
  }
  for (const value of [result.dbPassword, result.platformPassword, result.redisPassword]) {
    if (value) sensitiveValues.add(value)
  }
  return result
}

function redact(value: string): string {
  let output = String(value || '')
  for (const secret of [...sensitiveValues].filter(Boolean).sort((a, b) => b.length - a.length)) {
    output = output.split(secret).join('[REDACTED]')
  }
  return output
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(
      /("(?:password|token|secret|authorization|cookie)[^"]*"\s*:\s*")[^"]*(")/gi,
      '$1[REDACTED]$2'
    )
    .replace(/(set-cookie\s*:\s*)[^\r\n]+/gi, '$1[REDACTED]')
}

function tail(value: string, maxLines = 80, maxChars = 20_000) {
  const lines = redact(value).split(/\r?\n/).slice(-maxLines).join('\n')
  return lines.slice(-maxChars)
}

function addStep(label: string) {
  safeSteps.push({ label, at: new Date().toISOString() })
}

function runChecked(
  label: string,
  command: string,
  args: string[],
  options: SpawnSyncOptions = {}
) {
  const result = spawnSync(command, args, {
    ...options,
    encoding: 'utf8',
    stdio: 'pipe'
  })
  if (result.error) throw new Error(`${label} failed to start: ${redact(result.error.message)}`)
  if (result.status !== 0) {
    throw new Error(
      `${label} failed with exit code ${result.status}\n${tail(`${result.stdout || ''}\n${result.stderr || ''}`)}`
    )
  }
}

function quoteWindowsArg(value: string) {
  return /[\s"]/u.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value
}

function runPnpm(label: string, cwd: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  if (process.platform === 'win32') {
    runChecked(
      label,
      'cmd.exe',
      ['/d', '/s', '/c', `pnpm.cmd ${args.map(quoteWindowsArg).join(' ')}`],
      {
        cwd,
        env
      }
    )
    return
  }
  runChecked(label, 'pnpm', args, { cwd, env })
}

function appendProcessLog(child: ChildProcess, chunk: unknown) {
  const record = processLogs.get(child)
  if (!record) return
  record.output = tail(`${record.output}${String(chunk)}`)
}

function startProcess(
  label: string,
  command: string,
  args: string[],
  options: SpawnOptions
): ChildProcess {
  const child = spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] })
  processLogs.set(child, { label, output: '' })
  child.stdout?.on('data', (chunk) => appendProcessLog(child, chunk))
  child.stderr?.on('data', (chunk) => appendProcessLog(child, chunk))
  return child
}

async function stopProcess(child: ChildProcess | undefined) {
  if (!child || child.exitCode !== null) return
  child.kill('SIGTERM')
  await Promise.race([
    new Promise<void>((resolveExit) => child.once('exit', () => resolveExit())),
    new Promise<void>((resolveDelay) => setTimeout(resolveDelay, 3000))
  ])
  if (child.exitCode === null) child.kill('SIGKILL')
}

async function findFreePort(preferred?: number) {
  return new Promise<number>((resolvePort, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(preferred || 0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close((error) => (error ? reject(error) : resolvePort(port)))
    })
  })
}

async function waitForHttp(url: string, child: ChildProcess, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs
  let lastError = ''
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      const logs = processLogs.get(child)
      throw new Error(`${logs?.label || 'process'} exited early\n${logs?.output || ''}`)
    }
    try {
      const response = await fetch(url)
      if (response.ok) return
      lastError = `HTTP ${response.status}`
    } catch (error) {
      lastError = (error as Error).message
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 400))
  }
  const logs = processLogs.get(child)
  throw new Error(`Timed out waiting for ${url}: ${redact(lastError)}\n${logs?.output || ''}`)
}

function mysqlArgs(extra: string[]) {
  return [
    '--default-character-set=utf8mb4',
    '-h',
    config.dbHost,
    '-P',
    config.dbPort,
    '-u',
    config.dbUsername,
    ...extra
  ]
}

function databaseEnv() {
  return {
    ...process.env,
    DB_HOST: config.dbHost,
    DB_PORT: config.dbPort,
    DB_USERNAME: config.dbUsername,
    DB_PASSWORD: config.dbPassword,
    MYSQL_PWD: config.dbPassword
  }
}

function dropDatabase() {
  if (!databaseName || config.keep) return
  runChecked(
    'drop disposable App Runtime database',
    'mysql',
    mysqlArgs(['--execute', `DROP DATABASE IF EXISTS \`${databaseName}\`;`]),
    { cwd: serverRoot, env: databaseEnv() }
  )
}

async function requestJson<T>(baseUrl: string, path: string, options: RequestOptions = {}) {
  const response = await fetch(new URL(path, `${baseUrl}/`), {
    method: options.method || 'GET',
    headers: {
      accept: 'application/json',
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  })
  const raw = await response.text()
  let envelope: ApiEnvelope<T> | undefined
  try {
    envelope = raw ? (JSON.parse(raw) as ApiEnvelope<T>) : {}
  } catch {
    envelope = undefined
  }
  if (!response.ok || Number(envelope?.code) !== 200) {
    const message = envelope?.message || envelope?.msg || 'non-JSON response'
    throw new Error(
      `${options.method || 'GET'} ${path} failed with HTTP ${response.status}, code ${envelope?.code ?? 'unknown'}: ${redact(message)}`
    )
  }
  return envelope?.data as T
}

async function uploadZip<T>(baseUrl: string, path: string, token: string) {
  const form = new FormData()
  form.append(
    'file',
    new Blob([readFileSync(zipPath)], { type: 'application/zip' }),
    basename(zipPath)
  )
  const response = await fetch(new URL(path, `${baseUrl}/`), {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: form
  })
  const raw = await response.text()
  let envelope: ApiEnvelope<T> | undefined
  try {
    envelope = raw ? (JSON.parse(raw) as ApiEnvelope<T>) : {}
  } catch {
    envelope = undefined
  }
  if (!response.ok || Number(envelope?.code) !== 200) {
    throw new Error(
      `POST ${path} failed with HTTP ${response.status}, code ${envelope?.code ?? 'unknown'}: ${redact(envelope?.message || envelope?.msg || 'non-JSON response')}`
    )
  }
  return envelope?.data as T
}

async function authenticate(
  backendUrl: string,
  username: string,
  password: string,
  requestedTenantId?: number
): Promise<AuthSession> {
  const tenants = await requestJson<TenantItem[]>(backendUrl, '/api/core/tenants-by-credentials', {
    method: 'POST',
    body: { username, password }
  })
  assert.ok(Array.isArray(tenants) && tenants.length > 0, 'credential lookup must return a tenant')
  const tenant = requestedTenantId
    ? tenants.find((item) => Number(item.id) === requestedTenantId)
    : tenants[0]
  assert.ok(tenant?.id, 'credential lookup must return the requested tenant')

  const login = await requestJson<LoginData>(backendUrl, '/api/core/login', {
    method: 'POST',
    body: { username, password, tenant_id: Number(tenant.id) }
  })
  assert.ok(login.access_token, 'login must return an access token')
  assert.ok(login.refresh_token, 'login must return a refresh token')
  assert.equal(Number(login.tenant_id), Number(tenant.id))
  sensitiveValues.add(login.access_token)
  sensitiveValues.add(login.refresh_token)

  const profile = await requestJson<Record<string, unknown>>(backendUrl, '/api/core/system/user', {
    token: login.access_token
  })
  return {
    tenantId: Number(tenant.id),
    accessToken: login.access_token,
    refreshToken: login.refresh_token,
    profile,
    login
  }
}

function safeResponseHeaders(headers: Headers) {
  const result: Record<string, string> = {}
  for (const [key, value] of headers.entries()) {
    if (
      ['content-length', 'content-encoding', 'transfer-encoding', 'set-cookie'].includes(
        key.toLowerCase()
      )
    )
      continue
    result[key] = value
  }
  return result
}

export function mapBrowserPathToBackend(pathname: string) {
  if (pathname.startsWith('/nest-api/')) {
    const stripped = pathname.slice('/nest-api'.length)
    return stripped.startsWith('/api/') ? stripped : `/api${stripped}`
  }
  if (pathname.startsWith('/api/api/')) return pathname.slice('/api'.length)
  return pathname
}

assert.equal(mapBrowserPathToBackend('/nest-api/api/core/system/user'), '/api/core/system/user')
assert.equal(mapBrowserPathToBackend('/nest-api/core/system/user'), '/api/core/system/user')
assert.equal(mapBrowserPathToBackend('/api/api/core/system/user'), '/api/core/system/user')

async function proxyBackendRequest(
  route: Route,
  backendUrl: string,
  observeOpen: (value: unknown) => void
) {
  const request = route.request()
  const browserUrl = new URL(request.url())
  const pathname = mapBrowserPathToBackend(browserUrl.pathname)
  const target = new URL(`${pathname}${browserUrl.search}`, `${backendUrl}/`)
  const headers: Record<string, string> = {}
  for (const [key, value] of Object.entries(request.headers())) {
    if (['host', 'content-length', 'origin', 'referer'].includes(key.toLowerCase())) continue
    headers[key] = value
  }

  try {
    const response = await fetch(target, {
      method: request.method(),
      headers,
      body: ['GET', 'HEAD'].includes(request.method()) ? undefined : request.postDataBuffer(),
      redirect: 'manual'
    })
    const body = Buffer.from(await response.arrayBuffer())
    if (request.method() === 'GET' && pathname === '/api/app-tenant/apps/runtime_starter/open') {
      try {
        observeOpen((JSON.parse(body.toString('utf8')) as ApiEnvelope).data)
      } catch {
        observeOpen(undefined)
      }
    }
    await route.fulfill({
      status: response.status,
      headers: safeResponseHeaders(response.headers),
      body
    })
  } catch (error) {
    await route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({ code: 500, message: redact((error as Error).message) })
    })
  }
}

async function configureBrowserContext(
  context: BrowserContext,
  auth: AuthSession,
  backendUrl: string,
  observeOpen: (value: unknown) => void
) {
  const proxy = (route: Route) => proxyBackendRequest(route, backendUrl, observeOpen)
  await context.route('**/api/**', proxy)
  await context.route('**/nest-api/**', proxy)
  await context.route('**/apps-static/**', proxy)
  await context.addInitScript(
    ({ version, accessToken, refreshToken, userInfo }) => {
      const runtimeMessages: unknown[] = []
      Object.defineProperty(window, '__agentStudioRuntimeMessages', {
        value: runtimeMessages,
        configurable: false
      })
      window.addEventListener('message', (event) => {
        const value = event.data
        if (value && typeof value === 'object' && value.channel === 'agentstudio:app-runtime') {
          runtimeMessages.push(JSON.parse(JSON.stringify(value)))
        }
      })
      try {
        if (window.top === window) {
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
        }
      } catch {
        // Sandboxed static applications have an opaque origin and no storage access.
      }
    },
    {
      version: process.env.APP_RUNTIME_E2E_WEB_VERSION || '3.0.1',
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
      userInfo: auth.profile
    }
  )
}

async function getRuntimeFrame(currentPage: Page) {
  const iframe = currentPage.locator('iframe.app-runner-page__iframe')
  await iframe.waitFor({ state: 'visible', timeout: 30_000 })
  const sandbox = (await iframe.getAttribute('sandbox')) || ''
  assert.match(sandbox, /(?:^|\s)allow-scripts(?:\s|$)/)
  assert.doesNotMatch(sandbox, /(?:^|\s)allow-same-origin(?:\s|$)/)
  const handle = await iframe.elementHandle()
  const frame = await handle?.contentFrame()
  assert.ok(frame, 'runtime iframe must expose a Playwright frame')
  await frame.waitForFunction(
    () =>
      document.getElementById('runtime-status')?.textContent?.includes('Runtime context is ready'),
    undefined,
    { timeout: 30_000 }
  )
  return frame
}

async function readRenderedContext(frame: Frame) {
  const read = (selector: string) =>
    frame
      .locator(selector)
      .textContent()
      .then((value) => value || '')
  return {
    tenant: { id: await read('#tenant-id'), name: await read('#tenant-name') },
    user: { id: await read('#user-id'), display_name: await read('#user-name') },
    app: {
      code: await read('#app-code'),
      name: await read('#app-name'),
      version: await read('#app-version')
    }
  }
}

async function readRuntimeResult(frame: Frame) {
  const messages = await frame.evaluate(
    () =>
      (window as unknown as { __agentStudioRuntimeMessages?: unknown[] })
        .__agentStudioRuntimeMessages || []
  )
  const results = messages.filter(
    (value: any) => value?.channel === 'agentstudio:app-runtime' && value?.type === 'context.result'
  ) as Array<{ request_id: string; data: unknown }>
  assert.equal(results.length, 1, 'each page load must receive exactly one runtime result')
  return results[0]
}

function assertNoSensitiveValue(label: string, value: string, extraValues: string[] = []) {
  const text = String(value || '')
  for (const secret of [...sensitiveValues, ...extraValues].filter((item) => item.length >= 4)) {
    assert.equal(text.includes(secret), false, `${label} must not expose a sensitive value`)
  }
}

async function verifyBrowserFlow(input: {
  previewUrl: string
  backendUrl: string
  auth: AuthSession
  expectedContext: {
    tenant: { id: string; name: string }
    user: { id: string; display_name: string }
    app: { code: string; name: string; version: string }
  }
  forbiddenIdentityValues: string[]
}) {
  let observedOpenMetadata: unknown
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  await configureBrowserContext(context, input.auth, input.backendUrl, (value) => {
    observedOpenMetadata = value
  })
  page = await context.newPage()
  page.on('console', (message) => browserConsole.push(tail(message.text(), 1, 500)))
  page.on('pageerror', (error) => browserConsole.push(tail(error.message, 1, 500)))

  await page.goto(`${input.previewUrl}/#/app-center/open?code=runtime_starter`, {
    waitUntil: 'domcontentloaded'
  })
  const firstFrame = await getRuntimeFrame(page)
  assert.deepEqual(await readRenderedContext(firstFrame), input.expectedContext)
  const firstResult = await readRuntimeResult(firstFrame)
  assert.deepEqual(firstResult.data, input.expectedContext)
  assert.equal(typeof firstResult.request_id, 'string')

  const firstIframeText = await firstFrame.locator('body').innerText()
  const firstHostText = await page.locator('body').innerText()
  const firstMetadataText = JSON.stringify(observedOpenMetadata)
  const firstRuntimeText = JSON.stringify(firstResult)
  for (const [label, text] of [
    ['iframe body', firstIframeText],
    ['host page', firstHostText],
    ['open metadata', firstMetadataText],
    ['runtime result', firstRuntimeText],
    ['browser console', browserConsole.join('\n')]
  ] as const) {
    assertNoSensitiveValue(label, text, input.forbiddenIdentityValues)
  }
  assert.doesNotMatch(
    firstRuntimeText,
    /username|email|phone|password|token|authorization|cookie|roles|permissions|ipaddr|user-agent/i
  )

  await page.reload({ waitUntil: 'domcontentloaded' })
  const secondFrame = await getRuntimeFrame(page)
  const secondResult = await readRuntimeResult(secondFrame)
  assert.deepEqual(secondResult.data, input.expectedContext)
  assert.notEqual(secondResult.request_id, firstResult.request_id)

  await context.close()
}

async function writeFailureEvidence(error: unknown) {
  if (!artifactRoot) return
  mkdirSync(artifactRoot, { recursive: true })
  if (page) {
    await page
      .screenshot({ path: resolve(artifactRoot, 'failure.png'), fullPage: true })
      .catch(() => undefined)
  }
  writeFileSync(
    resolve(artifactRoot, 'browser-console.txt'),
    tail(browserConsole.join('\n'), 100, 20_000),
    'utf8'
  )
  writeFileSync(
    resolve(artifactRoot, 'steps.json'),
    JSON.stringify(
      {
        database: databaseName,
        app_code: 'runtime_starter',
        steps: safeSteps,
        error: tail(error instanceof Error ? error.message : String(error), 10, 2000)
      },
      null,
      2
    ),
    'utf8'
  )
}

async function main() {
  config = loadConfig()
  const suffix = `${Date.now().toString(36)}_${process.pid}`.toLowerCase()
  databaseName = `agentstudio_runtime_e2e_test_${suffix}`
  if (
    !/^[a-z0-9_]+$/.test(databaseName) ||
    !databaseName.includes('_e2e_') ||
    /prod|production|live/.test(databaseName)
  ) {
    throw new Error('Generated App Runtime E2E database name is unsafe')
  }
  artifactRoot = resolve(webRoot, '.artifacts', 'app-runtime-e2e', databaseName)
  mkdirSync(artifactRoot, { recursive: true })

  const ownerUsername = `runtime_e2e_${suffix}`.slice(0, 60)
  const ownerPassword = `Rt${randomBytes(12).toString('hex')}9`
  const ownerRealname = `Runtime Owner ${suffix}`
  const tenantName = `Runtime E2E ${suffix}`
  const ownerPhone = `139${String(Date.now()).slice(-8)}`
  const ownerEmail = `${ownerUsername}@example.test`
  const jwtSecret = randomBytes(48).toString('base64url')
  for (const value of [ownerPassword, jwtSecret]) sensitiveValues.add(value)

  addStep('initialize disposable database')
  runChecked(
    'initialize disposable App Runtime database',
    process.execPath,
    [resolve(serverRoot, 'scripts/verify-db-init.cjs')],
    {
      cwd: serverRoot,
      env: {
        ...databaseEnv(),
        DB_VERIFY_NAME: databaseName,
        DB_VERIFY_KEEP: '1'
      }
    }
  )

  addStep('build backend')
  runPnpm('build backend', serverRoot, ['run', 'build'])
  addStep('build frontend')
  runPnpm('build frontend', webRoot, ['run', 'build'])
  addStep('build runtime starter')
  runPnpm('build runtime starter', webRoot, ['run', 'build:app-runtime-starter'])
  for (const required of [serverEntry, resolve(webRoot, 'dist/index.html'), zipPath, viteCli]) {
    assert.ok(existsSync(required), `Required E2E artifact is missing: ${basename(required)}`)
  }

  const backendPort = await findFreePort(
    Number(requiredEnv('APP_RUNTIME_E2E_SERVER_PORT')) || undefined
  )
  const webPort = await findFreePort(Number(requiredEnv('APP_RUNTIME_E2E_WEB_PORT')) || undefined)
  const backendUrl = `http://127.0.0.1:${backendPort}`
  const previewUrl = `http://127.0.0.1:${webPort}`

  addStep('start backend')
  backend = startProcess('App Runtime backend', process.execPath, [serverEntry], {
    cwd: serverRoot,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      NO_CLUSTER: '1',
      DEBUG: 'true',
      APP_PORT: String(backendPort),
      APP_API_PREFIX: '',
      DB_HOST: config.dbHost,
      DB_PORT: config.dbPort,
      DB_USERNAME: config.dbUsername,
      DB_PASSWORD: config.dbPassword,
      DB_NAME: databaseName,
      DB_SYNC: 'false',
      REDIS_HOST: config.redisHost,
      REDIS_PORT: config.redisPort,
      REDIS_PASSWORD: config.redisPassword,
      REDIS_DB: config.redisDb,
      JWT_SECRET: jwtSecret,
      LOGIN_CAPTCHA_ENABLED: 'false',
      LOG_CONSOLE_ENABLED: 'false',
      LOG_FILE_ENABLED: 'false',
      APP_PACKAGE_DIR: resolve(artifactRoot, 'packages'),
      APP_PUBLIC_DIR: resolve(artifactRoot, 'public'),
      APP_PUBLIC_PREFIX: '/apps-static/',
      FILE_UPLOAD_DIR: resolve(artifactRoot, 'uploads')
    }
  })
  await waitForHttp(`${backendUrl}/api/core/login-captcha`, backend)

  addStep('start frontend preview')
  preview = startProcess(
    'App Runtime frontend preview',
    process.execPath,
    [viteCli, 'preview', '--host', '127.0.0.1', '--port', String(webPort), '--strictPort'],
    { cwd: webRoot, env: process.env }
  )
  await waitForHttp(previewUrl, preview)

  addStep('authenticate platform administrator')
  const platform = await authenticate(backendUrl, config.platformUsername, config.platformPassword)
  assert.equal(
    platform.login.user?.is_admin === true ||
      platform.profile.is_platform_admin === true ||
      platform.profile.is_admin === true ||
      platform.profile.account_scope === 'platform',
    true,
    'seeded account must be a platform administrator'
  )

  addStep('create review and publish runtime starter')
  await requestJson(backendUrl, '/api/app-platform/apps', {
    method: 'POST',
    token: platform.accessToken,
    body: {
      code: 'runtime_starter',
      name: 'Runtime Starter',
      type: 'static',
      category: 'developer_tools',
      summary: 'Runtime context starter',
      visibility: 'marketplace',
      developer_name: 'AgentStudio'
    }
  })
  await uploadZip(
    backendUrl,
    '/api/app-platform/apps/runtime_starter/versions/upload',
    platform.accessToken
  )
  await requestJson(backendUrl, '/api/app-platform/apps/runtime_starter/versions/1.0.0/approve', {
    method: 'POST',
    token: platform.accessToken,
    body: { message: 'P9-A automated review' }
  })
  await requestJson(backendUrl, '/api/app-platform/apps/runtime_starter/versions/1.0.0/publish', {
    method: 'POST',
    token: platform.accessToken,
    body: {}
  })

  addStep('register and authenticate tenant owner')
  const signup = await requestJson<SignupData>(backendUrl, '/api/saas/signup', {
    method: 'POST',
    body: {
      username: ownerUsername,
      password: ownerPassword,
      realname: ownerRealname,
      tenant_name: tenantName,
      phone: ownerPhone,
      email: ownerEmail,
      industry: 'software',
      team_size: '1-10'
    }
  })
  assert.ok(signup.userId && signup.tenantId, 'signup must return userId and tenantId')
  const tenant = await authenticate(
    backendUrl,
    ownerUsername,
    ownerPassword,
    Number(signup.tenantId)
  )
  await requestJson(backendUrl, '/api/app-tenant/apps/runtime_starter/install', {
    method: 'POST',
    token: tenant.accessToken,
    body: {}
  })
  const openMetadata = await requestJson<any>(
    backendUrl,
    '/api/app-tenant/apps/runtime_starter/open',
    { token: tenant.accessToken }
  )
  assert.equal(openMetadata.runtime?.protocol_version, 1)
  assert.deepEqual(openMetadata.runtime?.scopes, ['runtime:context:read'])

  const expectedContext = {
    tenant: { id: String(signup.tenantId), name: tenantName },
    user: { id: String(signup.userId), display_name: ownerRealname },
    app: { code: 'runtime_starter', name: 'Runtime Starter', version: '1.0.0' }
  }
  assert.deepEqual(openMetadata.runtime?.context, expectedContext)

  addStep('verify sandboxed browser runtime')
  await verifyBrowserFlow({
    previewUrl,
    backendUrl,
    auth: tenant,
    expectedContext,
    forbiddenIdentityValues: [ownerUsername, ownerEmail, ownerPhone]
  })

  addStep('complete')
  console.log('App runtime live E2E verified.')
}

try {
  await main()
} catch (error) {
  await writeFailureEvidence(error)
  throw new Error(redact(error instanceof Error ? error.message : String(error)))
} finally {
  await browser?.close().catch(() => undefined)
  await stopProcess(preview)
  await stopProcess(backend)
  try {
    dropDatabase()
  } catch (error) {
    process.stderr.write(`Database cleanup warning: ${redact((error as Error).message)}\n`)
  }
  if (!config?.keep && artifactRoot) {
    rmSync(resolve(artifactRoot, 'packages'), { recursive: true, force: true })
    rmSync(resolve(artifactRoot, 'public'), { recursive: true, force: true })
    rmSync(resolve(artifactRoot, 'uploads'), { recursive: true, force: true })
  }
}
