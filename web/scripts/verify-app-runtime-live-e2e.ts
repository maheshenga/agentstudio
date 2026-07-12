import assert from 'node:assert/strict'
import {
  spawn,
  spawnSync,
  type ChildProcess,
  type SpawnOptions,
  type SpawnSyncOptions
} from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
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
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  token?: string
  body?: Record<string, unknown>
}

type RuntimeResponse<T = unknown> = {
  status: number
  envelope?: ApiEnvelope<T>
  body: Buffer
  headers: Headers
}

type RuntimeSessionMetadata = {
  token?: string
  expires_at?: string
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
  redisIsolated: boolean
  httpUrl: string
  webhookUrl: string
  redirectPrivateUrl: string
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
const runtimeSdkBundle = resolve(
  webRoot,
  'packages/app-runtime-sdk/dist/agentstudio-runtime.global.js'
)
const iframeFixtureOrigin = 'https://runtime-e2e.invalid'
const iframeFixtureUrl = `${iframeFixtureOrigin}/app`
const iframeFixturePattern = `${iframeFixtureOrigin}/**`
const iframeAttackerOrigin = 'https://runtime-e2e-attacker.invalid'
const iframeAttackerPattern = `${iframeAttackerOrigin}/**`
const sharedRuntimeCapabilities = [
  'context.read',
  'kv.read',
  'kv.write',
  'kv.delete',
  'files.read',
  'files.write',
  'http.request',
  'webhook.emit'
] as const
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
let redisLeaseAcquired = false
let cleanupPromise: Promise<void> | undefined
let terminationStarted = false
let receivedSignal: 'SIGINT' | 'SIGTERM' | undefined
const browserConsole: string[] = []
const redisOwnerKey = 'agentstudio:app-runtime-e2e:owner'
const terminationController = new AbortController()
const claimRedisScript = `
  if redis.call('DBSIZE') ~= 0 then return 0 end
  if redis.call('SET', KEYS[1], ARGV[1], 'NX') then return 1 end
  return 0
`
const releaseRedisScript = `
  if redis.call('GET', KEYS[1]) ~= ARGV[1] then return -1 end
  redis.call('FLUSHDB')
  return redis.call('DBSIZE')
`

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
    'APP_RUNTIME_E2E_PLATFORM_PASSWORD',
    'APP_RUNTIME_E2E_REDIS_DB',
    'APP_RUNTIME_E2E_REDIS_ISOLATED',
    'APP_RUNTIME_E2E_HTTP_URL',
    'APP_RUNTIME_E2E_WEBHOOK_URL',
    'APP_RUNTIME_E2E_REDIRECT_PRIVATE_URL'
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
    redisDb: requiredEnv('APP_RUNTIME_E2E_REDIS_DB'),
    redisIsolated: requiredEnv('APP_RUNTIME_E2E_REDIS_ISOLATED') === '1',
    httpUrl: requiredEnv('APP_RUNTIME_E2E_HTTP_URL'),
    webhookUrl: requiredEnv('APP_RUNTIME_E2E_WEBHOOK_URL'),
    redirectPrivateUrl: requiredEnv('APP_RUNTIME_E2E_REDIRECT_PRIVATE_URL'),
    keep: requiredEnv('APP_RUNTIME_E2E_KEEP') === '1'
  }
  const redisDb = Number(result.redisDb)
  if (!result.redisIsolated || !Number.isInteger(redisDb) || redisDb < 1 || redisDb > 15) {
    throw new Error(
      'App Runtime E2E requires an explicitly isolated Redis DB from 1 to 15 and APP_RUNTIME_E2E_REDIS_ISOLATED=1'
    )
  }
  for (const [label, value] of [
    ['APP_RUNTIME_E2E_HTTP_URL', result.httpUrl],
    ['APP_RUNTIME_E2E_WEBHOOK_URL', result.webhookUrl],
    ['APP_RUNTIME_E2E_REDIRECT_PRIVATE_URL', result.redirectPrivateUrl]
  ] as const) {
    let parsed: URL
    try {
      parsed = new URL(value)
    } catch {
      throw new Error(`${label} must be a valid HTTPS URL`)
    }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
      throw new Error(`${label} must be a credential-free HTTPS URL`)
    }
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

function describeError(error: unknown): string {
  if (error instanceof AggregateError) {
    return [error.message, ...error.errors.map((item) => describeError(item))].join('\n')
  }
  return error instanceof Error ? error.message : String(error)
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
  if (await waitForChildExit(child, 3000)) return
  child.kill('SIGKILL')
  await waitForForcedExit(child)
}

async function waitForChildExit(child: ChildProcess, timeoutMs: number) {
  if (child.exitCode !== null || child.signalCode !== null) return true
  return new Promise<boolean>((resolveExit) => {
    const onExit = () => {
      clearTimeout(timeout)
      resolveExit(true)
    }
    const timeout = setTimeout(() => {
      child.off('exit', onExit)
      resolveExit(child.exitCode !== null || child.signalCode !== null)
    }, timeoutMs)
    child.once('exit', onExit)
  })
}

async function waitForForcedExit(child: ChildProcess) {
  if (!(await waitForChildExit(child, 5000))) {
    const label = processLogs.get(child)?.label || 'child process'
    throw new Error(`${label} did not exit after SIGKILL`)
  }
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
      const response = await fetch(url, { signal: terminationController.signal })
      if (response.ok) return
      lastError = `HTTP ${response.status}`
    } catch (error) {
      if (terminationController.signal.aborted) throw terminationController.signal.reason
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

function redisEnv() {
  return {
    ...process.env,
    ...(config.redisPassword ? { REDISCLI_AUTH: config.redisPassword } : {})
  }
}

function redisCommand(command: string, ...args: string[]) {
  const result = spawnSync(
    'redis-cli',
    [
      '--raw',
      '-h',
      config.redisHost,
      '-p',
      config.redisPort,
      '-n',
      config.redisDb,
      command,
      ...args
    ],
    {
      cwd: webRoot,
      env: redisEnv(),
      encoding: 'utf8',
      stdio: 'pipe'
    }
  )
  if (result.error)
    throw new Error(`Redis ${command} failed to start: ${redact(result.error.message)}`)
  if (result.status !== 0) {
    throw new Error(
      `Redis ${command} failed with exit code ${result.status}: ${tail(result.stderr || '')}`
    )
  }
  return String(result.stdout || '').trim()
}

function claimRedisDatabase() {
  const claimed = Number(redisCommand('EVAL', claimRedisScript, '1', redisOwnerKey, databaseName))
  if (claimed !== 1) {
    throw new Error(`Isolated Redis DB ${config.redisDb} must be empty and unclaimed`)
  }
  redisLeaseAcquired = true
}

function releaseRedisDatabase() {
  if (!redisLeaseAcquired) return
  const launchNonceKeys = redisCommand('KEYS', 'app-runtime:iframe-launch:*')
  if (launchNonceKeys) addStep('cleanup iframe launch nonces')
  const remaining = Number(
    redisCommand('EVAL', releaseRedisScript, '1', redisOwnerKey, databaseName)
  )
  if (remaining === -1) {
    throw new Error('Refusing to clean Redis DB because its App Runtime E2E ownership changed')
  }
  if (remaining !== 0) throw new Error('Isolated Redis DB cleanup did not remove all keys')
  redisLeaseAcquired = false
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

function mysqlAdminQuery(sql: string) {
  const result = spawnSync(
    'mysql',
    mysqlArgs(['--batch', '--skip-column-names', '--execute', sql]),
    {
      cwd: serverRoot,
      env: databaseEnv(),
      encoding: 'utf8',
      stdio: 'pipe'
    }
  )
  if (result.error)
    throw new Error(`MySQL admin query failed to start: ${redact(result.error.message)}`)
  if (result.status !== 0) {
    throw new Error(
      `MySQL admin query failed with exit code ${result.status}: ${tail(result.stderr || '')}`
    )
  }
  return String(result.stdout || '').trim()
}

function assertDatabaseRemoved() {
  if (!databaseName || config.keep) return
  const escaped = databaseName.replace(/'/g, "''")
  const remaining = Number(
    mysqlAdminQuery(
      `SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name='${escaped}';`
    )
  )
  assert.equal(remaining, 0, 'disposable App Runtime database cleanup must be complete')
}

function assertArtifactCleanup() {
  if (!artifactRoot || config.keep) return
  for (const path of ['packages', 'public', 'uploads', 'runtime-storage']) {
    assert.equal(
      existsSync(resolve(artifactRoot, path)),
      false,
      `App Runtime E2E artifact cleanup must remove ${path}`
    )
  }
}

function mysqlQuery(sql: string) {
  const result = spawnSync(
    'mysql',
    mysqlArgs(['--batch', '--skip-column-names', databaseName, '--execute', sql]),
    {
      cwd: serverRoot,
      env: databaseEnv(),
      encoding: 'utf8',
      stdio: 'pipe'
    }
  )
  if (result.error) throw new Error(`MySQL query failed to start: ${redact(result.error.message)}`)
  if (result.status !== 0) {
    throw new Error(
      `MySQL query failed with exit code ${result.status}: ${tail(result.stderr || '')}`
    )
  }
  return String(result.stdout || '').trim()
}

function assertNumericId(value: unknown, label: string) {
  const numeric = Number(value)
  assert.ok(Number.isSafeInteger(numeric) && numeric > 0, `${label} must be a positive integer`)
  return numeric
}

function hashRuntimeToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

function readRuntimeSession(metadata: any) {
  const session = metadata?.runtime?.session as RuntimeSessionMetadata | undefined
  assert.equal(metadata?.runtime?.context, null, 'session mode must not inline runtime context')
  assert.match(String(session?.token || ''), /^[A-Za-z0-9_-]{43}$/)
  assert.ok(Number.isFinite(Date.parse(String(session?.expires_at || ''))))
  const token = String(session?.token)
  sensitiveValues.add(token)
  return { token, expiresAt: String(session?.expires_at) }
}

async function requestRuntimeContext(baseUrl: string, token: string) {
  const response = await fetch(new URL('/api/app-runtime/context', `${baseUrl}/`), {
    headers: {
      accept: 'application/json',
      'x-app-runtime-token': token
    },
    signal: terminationController.signal
  })
  const raw = await response.text()
  let envelope: ApiEnvelope | undefined
  try {
    envelope = raw ? (JSON.parse(raw) as ApiEnvelope) : {}
  } catch {
    envelope = undefined
  }
  return { status: response.status, envelope }
}

async function requestRuntime<T>(
  baseUrl: string,
  path: string,
  token: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    body?: unknown
    form?: FormData
  } = {}
): Promise<RuntimeResponse<T>> {
  const response = await fetch(new URL(path, `${baseUrl}/`), {
    method: options.method || 'GET',
    headers: {
      accept: 'application/json',
      'x-app-runtime-token': token,
      ...(options.body === undefined ? {} : { 'content-type': 'application/json' })
    },
    body: options.form || (options.body === undefined ? undefined : JSON.stringify(options.body)),
    signal: terminationController.signal
  })
  const body = Buffer.from(await response.arrayBuffer())
  let envelope: ApiEnvelope<T> | undefined
  try {
    envelope = body.length ? (JSON.parse(body.toString('utf8')) as ApiEnvelope<T>) : undefined
  } catch {
    envelope = undefined
  }
  return { status: response.status, envelope, body, headers: response.headers }
}

function assertRuntimeSuccess<T>(response: RuntimeResponse<T>, label: string): T {
  assert.equal(response.status, 200, `${label} must return HTTP 200`)
  assert.equal(Number(response.envelope?.code), 200, `${label} must return business success`)
  return response.envelope?.data as T
}

function assertRuntimeDenied(response: RuntimeResponse, label: string, expectedStatuses: number[]) {
  assert.ok(
    expectedStatuses.includes(response.status),
    `${label} must fail closed with one of: ${expectedStatuses.join(', ')}`
  )
  assert.notEqual(Number(response.envelope?.code), 200, `${label} must not return business success`)
}

function launchTokenFromMetadata(metadata: any) {
  const fragment = String(metadata?.launch?.fragment || '')
  const prefix = '#agentstudio_launch='
  assert.ok(fragment.startsWith(prefix), 'iframe open metadata must contain a launch fragment')
  const token = fragment.slice(prefix.length)
  assert.match(token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
  sensitiveValues.add(token)
  return token
}

async function openAndExchangeIframeSession(
  baseUrl: string,
  auth: AuthSession,
  appCode = 'runtime_shared'
) {
  const metadata = await requestJson<any>(baseUrl, `/api/app-tenant/apps/${appCode}/open`, {
    token: auth.accessToken
  })
  const launchToken = launchTokenFromMetadata(metadata)
  const session = await requestJson<RuntimeSessionMetadata>(
    baseUrl,
    '/api/app-tenant/runtime/iframe/exchange',
    {
      method: 'POST',
      token: auth.accessToken,
      body: { launch_token: launchToken }
    }
  )
  assert.match(String(session?.token || ''), /^[A-Za-z0-9_-]{43}$/)
  assert.ok(Number.isFinite(Date.parse(String(session?.expires_at || ''))))
  sensitiveValues.add(String(session.token))
  return { metadata, launchToken, token: String(session.token) }
}

async function expectRuntimeDenied(baseUrl: string, token: string, label: string) {
  const response = await requestRuntimeContext(baseUrl, token)
  assert.ok([401, 403].includes(response.status), `${label} must return HTTP 401 or 403`)
  assert.notEqual(Number(response.envelope?.code), 200, `${label} must not return business success`)
}

async function requestJson<T>(baseUrl: string, path: string, options: RequestOptions = {}) {
  const response = await fetch(new URL(path, `${baseUrl}/`), {
    method: options.method || 'GET',
    headers: {
      accept: 'application/json',
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: terminationController.signal
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

async function requestProtected(
  baseUrl: string,
  path: string,
  token: string,
  body: Record<string, unknown>
) {
  const response = await fetch(new URL(path, `${baseUrl}/`), {
    method: 'POST',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(body),
    signal: terminationController.signal
  })
  const raw = await response.text()
  let envelope: ApiEnvelope | undefined
  try {
    envelope = raw ? (JSON.parse(raw) as ApiEnvelope) : undefined
  } catch {
    envelope = undefined
  }
  return { status: response.status, envelope }
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
    body: form,
    signal: terminationController.signal
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
      redirect: 'manual',
      signal: terminationController.signal
    })
    const body = Buffer.from(await response.arrayBuffer())
    if (
      request.method() === 'GET' &&
      /^\/api\/app-tenant\/apps\/[a-z0-9_]+\/open$/.test(pathname)
    ) {
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

function iframeFixtureHtml() {
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Runtime E2E Fixture</title></head>
  <body>
    <main id="runtime-state">Waiting for runtime</main>
    <script src="/runtime-sdk.js"></script>
    <script>
      (async function () {
        try {
          const context = await window.AgentStudioRuntime.runtime.context.get({ timeoutMs: 10000 });
          window.__runtimeContext = context;
          document.getElementById('runtime-state').textContent = 'Runtime iframe ready';
        } catch (error) {
          document.getElementById('runtime-state').textContent = 'Runtime iframe failed: ' + (error && error.code || 'unknown');
        }
      })();
    </script>
  </body>
</html>`
}

function iframeAttackerHtml() {
  return `<!doctype html>
<html lang="en">
  <body data-response="none">
    <script>
      window.addEventListener('message', function (event) {
        if (event.data && event.data.request_id === 'wrong-origin-request') {
          document.body.dataset.response = 'received';
        }
      });
      parent.postMessage({
        channel: 'agentstudio:app-runtime',
        version: 1,
        type: 'context.get.request',
        request_id: 'wrong-origin-request',
        data: {}
      }, '*');
      document.body.dataset.posted = 'true';
    </script>
  </body>
</html>`
}

async function routeIframeFixture(route: Route) {
  const pathname = new URL(route.request().url()).pathname
  if (pathname === '/runtime-sdk.js') {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript; charset=utf-8',
      body: readFileSync(runtimeSdkBundle)
    })
    return
  }
  await route.fulfill({
    status: 200,
    contentType: 'text/html; charset=utf-8',
    body: iframeFixtureHtml()
  })
}

async function configureBrowserContext(
  context: BrowserContext,
  auth: AuthSession,
  backendUrl: string,
  observeOpen: (value: unknown) => void
) {
  const proxy = (route: Route) => proxyBackendRequest(route, backendUrl, observeOpen)
  await context.route(iframeFixturePattern, routeIframeFixture)
  await context.route(iframeAttackerPattern, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: iframeAttackerHtml()
    })
  )
  await context.route('**/api/**', proxy)
  await context.route('**/nest-api/**', proxy)
  await context.route('**/apps-static/**', proxy)
  await context.addInitScript({
    content: `
      const runtimeMessages = [];
      Object.defineProperty(window, '__agentStudioRuntimeMessages', {
        value: runtimeMessages,
        configurable: false
      });
      if (window.top === window) {
        const messageListeners = new Set();
        const originalAddEventListener = window.addEventListener.bind(window);
        const originalRemoveEventListener = window.removeEventListener.bind(window);
        window.addEventListener = function(type, listener, options) {
          if (type === 'message') messageListeners.add(listener);
          return originalAddEventListener(type, listener, options);
        };
        window.removeEventListener = function(type, listener, options) {
          if (type === 'message') messageListeners.delete(listener);
          return originalRemoveEventListener(type, listener, options);
        };
        Object.defineProperty(window, '__agentStudioMessageListenerCount', {
          get: function() { return messageListeners.size; },
          configurable: false
        });
      }
      window.addEventListener('message', function(event) {
        const value = event.data;
        if (value && typeof value === 'object' && value.channel === 'agentstudio:app-runtime') {
          runtimeMessages.push(JSON.parse(JSON.stringify(value)));
        }
      });
    `
  })
  await context.addInitScript(
    ({ version, accessToken, refreshToken, userInfo }) => {
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
    const metadata = value as any
    const runtimeToken = String(metadata?.runtime?.session?.token || '')
    if (runtimeToken) sensitiveValues.add(runtimeToken)
    observedOpenMetadata = metadata?.runtime?.session
      ? {
          ...metadata,
          runtime: {
            ...metadata.runtime,
            session: { ...metadata.runtime.session, token: '[REDACTED]' }
          }
        }
      : metadata
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
  const firstListenerCount = await page.evaluate(
    () =>
      (window as unknown as { __agentStudioMessageListenerCount?: number })
        .__agentStudioMessageListenerCount || 0
  )
  assert.ok(firstListenerCount >= 2, 'host must register the runtime listener and the E2E observer')

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

  const reloadButton = page.getByRole('button', { name: 'Reload' })
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/api/app-tenant/apps/runtime_starter/open')
    ),
    reloadButton.click()
  ])
  const secondFrame = await getRuntimeFrame(page)
  const secondResult = await readRuntimeResult(secondFrame)
  assert.deepEqual(secondResult.data, input.expectedContext)
  assert.notEqual(secondResult.request_id, firstResult.request_id)
  const secondListenerCount = await page.evaluate(
    () =>
      (window as unknown as { __agentStudioMessageListenerCount?: number })
        .__agentStudioMessageListenerCount || 0
  )
  assert.equal(
    secondListenerCount,
    firstListenerCount,
    'runner reload must not duplicate host listeners'
  )
  const secondIframeText = await secondFrame.locator('body').innerText()
  const secondHostText = await page.locator('body').innerText()
  const secondMetadataText = JSON.stringify(observedOpenMetadata)
  const secondRuntimeText = JSON.stringify(secondResult)
  for (const [label, text] of [
    ['reloaded iframe body', secondIframeText],
    ['reloaded host page', secondHostText],
    ['reloaded open metadata', secondMetadataText],
    ['reloaded runtime result', secondRuntimeText],
    ['reloaded browser console', browserConsole.join('\n')]
  ] as const) {
    assertNoSensitiveValue(label, text, input.forbiddenIdentityValues)
  }
  assert.doesNotMatch(
    secondRuntimeText,
    /username|email|phone|password|token|authorization|cookie|roles|permissions|ipaddr|user-agent/i
  )

  await context.close()
}

async function verifyIframeBrowserFlow(input: {
  previewUrl: string
  backendUrl: string
  auth: AuthSession
  expectedContext: Record<string, unknown>
  forbiddenIdentityValues: string[]
}) {
  let observedOpenMetadata: any
  if (!browser) browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  await configureBrowserContext(context, input.auth, input.backendUrl, (value) => {
    const metadata = value as any
    if (metadata?.code !== 'runtime_shared') return
    const launchToken = String(metadata?.launch?.fragment || '').replace('#agentstudio_launch=', '')
    if (launchToken) sensitiveValues.add(launchToken)
    observedOpenMetadata = metadata
  })
  page = await context.newPage()
  let runtimeContextRequests = 0
  page.on('request', (request) => {
    if (mapBrowserPathToBackend(new URL(request.url()).pathname) === '/api/app-runtime/context') {
      runtimeContextRequests += 1
    }
  })
  page.on('console', (message) => browserConsole.push(tail(message.text(), 1, 500)))
  page.on('pageerror', (error) => browserConsole.push(tail(error.message, 1, 500)))

  addStep('verify iframe exact-origin handshake')
  await page.goto(`${input.previewUrl}/#/app-center/open?code=runtime_shared`, {
    waitUntil: 'domcontentloaded'
  })
  const iframe = page.locator('iframe.app-runner-page__iframe')
  await iframe.waitFor({ state: 'visible', timeout: 30_000 })
  const sandbox = (await iframe.getAttribute('sandbox')) || ''
  assert.match(sandbox, /(?:^|\s)allow-scripts(?:\s|$)/)
  assert.match(sandbox, /(?:^|\s)allow-same-origin(?:\s|$)/)
  const handle = await iframe.elementHandle()
  const frame = await handle?.contentFrame()
  assert.ok(frame, 'external runtime iframe must expose a Playwright frame')
  await frame.waitForFunction(
    () => document.getElementById('runtime-state')?.textContent === 'Runtime iframe ready',
    undefined,
    { timeout: 30_000 }
  )
  assert.equal(new URL(frame.url()).origin, iframeFixtureOrigin)
  assert.equal(observedOpenMetadata?.launch?.origin, iframeFixtureOrigin)
  assert.deepEqual(
    await frame.evaluate(
      () => (window as unknown as { __runtimeContext?: unknown }).__runtimeContext
    ),
    input.expectedContext
  )
  assert.equal(runtimeContextRequests, 1, 'exact-origin handshake must issue one context request')

  const launchToken = launchTokenFromMetadata(observedOpenMetadata)
  const iframeText = await frame.locator('body').innerText()
  const hostText = await page.locator('body').innerText()
  const frameMessages = JSON.stringify(
    await frame.evaluate(
      () =>
        (window as unknown as { __agentStudioRuntimeMessages?: unknown[] })
          .__agentStudioRuntimeMessages || []
    )
  )
  for (const [label, value] of [
    ['iframe fixture body', iframeText],
    ['iframe host body', hostText],
    ['iframe runtime messages', frameMessages],
    ['iframe browser console', browserConsole.join('\n')]
  ] as const) {
    assertNoSensitiveValue(label, value, input.forbiddenIdentityValues)
  }
  assert.doesNotMatch(frameMessages, /token|authorization|cookie|password/i)

  addStep('verify iframe launch replay denial')
  const replay = await requestProtected(
    input.backendUrl,
    '/api/app-tenant/runtime/iframe/exchange',
    input.auth.accessToken,
    { launch_token: launchToken }
  )
  assert.ok([401, 403].includes(replay.status), 'consumed iframe launch must reject replay')
  assert.notEqual(Number(replay.envelope?.code), 200)

  addStep('verify iframe origin denial')
  await iframe.evaluate((element, value) => {
    ;(element as HTMLIFrameElement).src = value
  }, `${iframeAttackerOrigin}/attack`)
  await page.waitForFunction(
    (origin) =>
      Array.from(document.querySelectorAll('iframe')).some((element) =>
        String((element as HTMLIFrameElement).src || '').startsWith(String(origin))
      ),
    iframeAttackerOrigin
  )
  const attackerFrame = page
    .frames()
    .find((candidate) => candidate.url().startsWith(iframeAttackerOrigin))
  assert.ok(attackerFrame, 'wrong-origin iframe fixture must load')
  await attackerFrame.waitForFunction(() => document.body.dataset.posted === 'true')
  await page.waitForTimeout(500)
  assert.equal(await attackerFrame.locator('body').getAttribute('data-response'), 'none')
  assert.equal(
    runtimeContextRequests,
    1,
    'wrong-origin iframe messages must not reach the runtime backend'
  )

  await context.close()
  return launchToken
}

async function createSharedRuntimeApp(backendUrl: string, platformToken: string) {
  const allowedOrigins = [
    iframeFixtureOrigin,
    new URL(config.httpUrl).origin,
    new URL(config.webhookUrl).origin,
    new URL(config.redirectPrivateUrl).origin
  ].filter((value, index, values) => values.indexOf(value) === index)
  await requestJson(backendUrl, '/api/app-platform/apps', {
    method: 'POST',
    token: platformToken,
    body: {
      code: 'runtime_shared',
      name: 'Runtime Shared Capabilities',
      type: 'iframe',
      category: 'developer_tools',
      summary: 'Disposable shared capability lifecycle fixture',
      visibility: 'marketplace',
      developer_name: 'AgentStudio E2E',
      entry_url: iframeFixtureUrl,
      version: '1.0.0',
      allowed_origins: allowedOrigins,
      requested_capabilities: [...sharedRuntimeCapabilities]
    }
  })
}

async function verifySharedCapabilityLifecycle(input: {
  backendUrl: string
  previewUrl: string
  tenant: AuthSession
  otherTenant: AuthSession
  expectedContext: Record<string, unknown>
  forbiddenIdentityValues: string[]
}) {
  const browserLaunchToken = await verifyIframeBrowserFlow({
    previewUrl: input.previewUrl,
    backendUrl: input.backendUrl,
    auth: input.tenant,
    expectedContext: input.expectedContext,
    forbiddenIdentityValues: input.forbiddenIdentityValues
  })
  const ownerSession = await openAndExchangeIframeSession(input.backendUrl, input.tenant)
  const namespace = 'lifecycle'
  const key = `key_${Date.now().toString(36)}`
  const kvPath = `/api/app-runtime/kv/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`

  addStep('verify runtime KV lifecycle')
  const setKv = assertRuntimeSuccess<any>(
    await requestRuntime(input.backendUrl, kvPath, ownerSession.token, {
      method: 'PUT',
      body: { value: { state: 'ready', count: 1 }, ttl_seconds: 600 }
    }),
    'runtime KV set'
  )
  assert.equal(setKv.namespace, namespace)
  assert.equal(setKv.key, key)
  assert.deepEqual(setKv.value, { state: 'ready', count: 1 })
  assert.equal(setKv.version, 1)
  const getKv = assertRuntimeSuccess<any>(
    await requestRuntime(input.backendUrl, kvPath, ownerSession.token),
    'runtime KV get'
  )
  assert.deepEqual(getKv, setKv)
  assert.equal(
    Number(
      mysqlQuery(
        `SELECT COUNT(*) FROM app_runtime_kv WHERE namespace='${namespace}' AND \`key\`='${key}'`
      )
    ),
    1
  )

  addStep('verify runtime file lifecycle')
  const fileBytes = Buffer.from(`runtime-file-${Date.now().toString(36)}`, 'utf8')
  const form = new FormData()
  form.append('file', new Blob([fileBytes], { type: 'text/plain' }), 'runtime-e2e.txt')
  const fileMetadata = assertRuntimeSuccess<any>(
    await requestRuntime(input.backendUrl, '/api/app-runtime/files', ownerSession.token, {
      method: 'POST',
      form
    }),
    'runtime file upload'
  )
  assert.match(String(fileMetadata.id || ''), /^[A-Za-z0-9_-]{43}$/)
  assert.equal(fileMetadata.name, 'runtime-e2e.txt')
  assert.equal(fileMetadata.mime_type, 'text/plain')
  assert.equal(fileMetadata.size, fileBytes.length)
  assert.doesNotMatch(JSON.stringify(fileMetadata), /storage[_-]?key|path|directory/i)
  const fileRead = await requestRuntime(
    input.backendUrl,
    `/api/app-runtime/files/${encodeURIComponent(fileMetadata.id)}`,
    ownerSession.token
  )
  assert.equal(fileRead.status, 200)
  assert.deepEqual(fileRead.body, fileBytes)
  assert.match(String(fileRead.headers.get('content-type') || ''), /^text\/plain/)
  assert.equal(
    Number(
      mysqlQuery(`SELECT COUNT(*) FROM app_storage_object WHERE object_id='${fileMetadata.id}'`)
    ),
    1
  )

  addStep('verify runtime HTTP lifecycle')
  const httpSession = await openAndExchangeIframeSession(input.backendUrl, input.tenant)
  const httpResult = assertRuntimeSuccess<any>(
    await requestRuntime(input.backendUrl, '/api/app-runtime/http', httpSession.token, {
      method: 'POST',
      body: { url: config.httpUrl, method: 'GET', headers: { accept: 'application/json' } }
    }),
    'runtime HTTP request'
  )
  assert.ok(Number(httpResult.status) >= 200 && Number(httpResult.status) < 400)
  assert.equal(typeof httpResult.body, 'string')
  assert.equal(typeof httpResult.truncated, 'boolean')

  addStep('verify runtime webhook lifecycle')
  const webhookSession = await openAndExchangeIframeSession(input.backendUrl, input.tenant)
  const webhookResult = assertRuntimeSuccess<any>(
    await requestRuntime(input.backendUrl, '/api/app-runtime/webhooks', webhookSession.token, {
      method: 'POST',
      body: {
        url: config.webhookUrl,
        event: 'runtime.e2e',
        payload: { state: 'ready' }
      }
    }),
    'runtime webhook emit'
  )
  assert.ok(Number(webhookResult.status) >= 200 && Number(webhookResult.status) < 400)

  addStep('verify private-address denial')
  const privateSession = await openAndExchangeIframeSession(input.backendUrl, input.tenant)
  assertRuntimeDenied(
    await requestRuntime(input.backendUrl, '/api/app-runtime/http', privateSession.token, {
      method: 'POST',
      body: { url: 'https://127.0.0.1/', method: 'GET' }
    }),
    'private-address runtime request',
    [400]
  )

  addStep('verify runtime origin denial')
  const originSession = await openAndExchangeIframeSession(input.backendUrl, input.tenant)
  assertRuntimeDenied(
    await requestRuntime(input.backendUrl, '/api/app-runtime/http', originSession.token, {
      method: 'POST',
      body: { url: 'https://1.1.1.1/', method: 'GET' }
    }),
    'unapproved-origin runtime request',
    [400]
  )

  addStep('verify redirected private-address denial')
  const redirectSession = await openAndExchangeIframeSession(input.backendUrl, input.tenant)
  assertRuntimeDenied(
    await requestRuntime(input.backendUrl, '/api/app-runtime/http', redirectSession.token, {
      method: 'POST',
      body: { url: config.redirectPrivateUrl, method: 'GET' }
    }),
    'redirected private-address runtime request',
    [400]
  )

  const otherSession = await openAndExchangeIframeSession(input.backendUrl, input.otherTenant)
  addStep('verify cross-tenant KV denial')
  assertRuntimeDenied(
    await requestRuntime(input.backendUrl, kvPath, otherSession.token),
    'cross-tenant KV read',
    [404]
  )
  addStep('verify cross-tenant file denial')
  assertRuntimeDenied(
    await requestRuntime(
      input.backendUrl,
      `/api/app-runtime/files/${encodeURIComponent(fileMetadata.id)}`,
      otherSession.token
    ),
    'cross-tenant file read',
    [404]
  )

  addStep('verify capability revocation')
  const revocationSession = await openAndExchangeIframeSession(input.backendUrl, input.tenant)
  const withoutKvRead = sharedRuntimeCapabilities.filter((value) => value !== 'kv.read')
  await requestJson(input.backendUrl, '/api/app-tenant/apps/runtime_shared/capabilities', {
    method: 'PUT',
    token: input.tenant.accessToken,
    body: { capabilities: withoutKvRead }
  })
  assertRuntimeDenied(
    await requestRuntime(input.backendUrl, kvPath, revocationSession.token),
    'revoked KV capability',
    [403]
  )
  await requestJson(input.backendUrl, '/api/app-tenant/apps/runtime_shared/capabilities', {
    method: 'PUT',
    token: input.tenant.accessToken,
    body: { capabilities: [...sharedRuntimeCapabilities] }
  })

  const deletedKv = assertRuntimeSuccess<any>(
    await requestRuntime(input.backendUrl, kvPath, ownerSession.token, { method: 'DELETE' }),
    'runtime KV delete'
  )
  assert.equal(deletedKv.deleted, true)
  assertRuntimeDenied(
    await requestRuntime(input.backendUrl, kvPath, ownerSession.token),
    'deleted runtime KV read',
    [404]
  )
  const deletedFile = assertRuntimeSuccess<any>(
    await requestRuntime(
      input.backendUrl,
      `/api/app-runtime/files/${encodeURIComponent(fileMetadata.id)}`,
      ownerSession.token,
      { method: 'DELETE' }
    ),
    'runtime file delete'
  )
  assert.equal(deletedFile.deleted, true)
  assertRuntimeDenied(
    await requestRuntime(
      input.backendUrl,
      `/api/app-runtime/files/${encodeURIComponent(fileMetadata.id)}`,
      ownerSession.token
    ),
    'deleted runtime file read',
    [404]
  )

  const redactedDiagnostics = redact(
    `runtime=${ownerSession.token} launch=${ownerSession.launchToken} browser=${browserLaunchToken}`
  )
  assertNoSensitiveValue('redacted diagnostics', redactedDiagnostics)
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
  const launchSecret = randomBytes(48).toString('base64url')
  for (const value of [
    ownerUsername,
    ownerEmail,
    ownerPhone,
    ownerPassword,
    jwtSecret,
    launchSecret
  ])
    sensitiveValues.add(value)

  addStep('claim isolated Redis database')
  claimRedisDatabase()

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
  for (const required of [
    serverEntry,
    resolve(webRoot, 'dist/index.html'),
    zipPath,
    runtimeSdkBundle,
    viteCli
  ]) {
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
      APP_RUNTIME_CAPABILITIES_ENABLED: 'true',
      APP_RUNTIME_IFRAME_LAUNCH_ENABLED: 'true',
      APP_RUNTIME_LAUNCH_SECRET: launchSecret,
      APP_RUNTIME_SESSION_TTL_SECONDS: '300',
      APP_RUNTIME_CAPABILITY_RATE_LIMIT_PER_MINUTE: '2',
      APP_RUNTIME_STORAGE_DIR: resolve(artifactRoot, 'runtime-storage'),
      APP_RUNTIME_STORAGE_MAX_FILE_MB: '1',
      APP_RUNTIME_STORAGE_QUOTA_MB: '2',
      APP_RUNTIME_STORAGE_ALLOWED_MIME_TYPES: 'text/plain,application/json',
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
    body: { message: 'P9-B automated review', approved_capabilities: ['context.read'] }
  })
  await requestJson(backendUrl, '/api/app-platform/apps/runtime_starter/versions/1.0.0/publish', {
    method: 'POST',
    token: platform.accessToken,
    body: {}
  })
  addStep('create shared runtime iframe app')
  await createSharedRuntimeApp(backendUrl, platform.accessToken)

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
    body: { capabilities: ['context.read'] }
  })
  await requestJson(backendUrl, '/api/app-tenant/apps/runtime_shared/install', {
    method: 'POST',
    token: tenant.accessToken,
    body: { capabilities: [...sharedRuntimeCapabilities] }
  })
  const openMetadata = await requestJson<any>(
    backendUrl,
    '/api/app-tenant/apps/runtime_starter/open',
    { token: tenant.accessToken }
  )
  assert.equal(openMetadata.runtime?.protocol_version, 1)
  assert.deepEqual(openMetadata.runtime?.scopes, ['runtime:context:read'])
  const firstSession = readRuntimeSession(openMetadata)

  const expectedContext = {
    tenant: { id: String(signup.tenantId), name: tenantName },
    user: { id: String(signup.userId), display_name: ownerRealname },
    app: { code: 'runtime_starter', name: 'Runtime Starter', version: '1.0.0' }
  }
  const directContext = await requestRuntimeContext(backendUrl, firstSession.token)
  assert.equal(directContext.status, 200)
  assert.deepEqual(directContext.envelope?.data, expectedContext)

  const firstTokenHash = hashRuntimeToken(firstSession.token)
  const sessionRow = mysqlQuery(
    `SELECT id, tenant_id, user_id, app_id, version_id, install_id, token_hash FROM app_runtime_session WHERE token_hash='${firstTokenHash}'`
  ).split('\t')
  assert.equal(sessionRow.length, 7, 'session issue must persist one complete authority binding')
  assert.match(sessionRow[6], /^[a-f0-9]{64}$/)
  assert.notEqual(sessionRow[6], firstSession.token)
  const sessionId = assertNumericId(sessionRow[0], 'runtime session id')
  const originalTenantId = assertNumericId(sessionRow[1], 'runtime session tenant id')
  assert.equal(originalTenantId, Number(signup.tenantId))
  assert.equal(
    Number(
      mysqlQuery(
        `SELECT COUNT(*) FROM app_capability_grant WHERE version_id=${assertNumericId(sessionRow[4], 'runtime version id')} AND capability='context.read' AND status='approved'`
      )
    ),
    2,
    'platform approval and tenant consent must both be persisted'
  )

  addStep('verify sandboxed browser runtime')
  await verifyBrowserFlow({
    previewUrl,
    backendUrl,
    auth: tenant,
    expectedContext,
    forbiddenIdentityValues: [ownerUsername, ownerEmail, ownerPhone]
  })

  const rateLimitMetadata = await requestJson<any>(
    backendUrl,
    '/api/app-tenant/apps/runtime_starter/open',
    { token: tenant.accessToken }
  )
  const rateLimitSession = readRuntimeSession(rateLimitMetadata)
  const rateLimitSessionId = assertNumericId(
    mysqlQuery(
      `SELECT id FROM app_runtime_session WHERE token_hash='${hashRuntimeToken(rateLimitSession.token)}'`
    ),
    'rate-limited runtime session id'
  )
  addStep('verify runtime capability rate limiting')
  for (let requestNumber = 1; requestNumber <= 2; requestNumber += 1) {
    const response = await requestRuntimeContext(backendUrl, rateLimitSession.token)
    assert.equal(response.status, 200, `runtime request ${requestNumber} within quota must succeed`)
    assert.deepEqual(response.envelope?.data, expectedContext)
  }
  const rateLimited = await requestRuntimeContext(backendUrl, rateLimitSession.token)
  assert.equal(rateLimited.status, 429)
  assert.equal(Number(rateLimited.envelope?.code), 429)
  assert.equal(rateLimited.envelope?.message, 'App runtime capability rate limit exceeded')
  assert.ok(
    Number((rateLimited.envelope as ApiEnvelope & { retry_after?: number })?.retry_after) >= 1 &&
      Number((rateLimited.envelope as ApiEnvelope & { retry_after?: number })?.retry_after) <= 60,
    'rate-limit response must expose a bounded retry_after'
  )
  assert.equal(
    Number(
      mysqlQuery(
        `SELECT COUNT(*) FROM app_runtime_audit_log WHERE session_id=${rateLimitSessionId} AND reason_code='rate_limited'`
      )
    ),
    1,
    'one session capability window must persist only one rate-limit audit'
  )

  const otherUsername = `runtime_other_${suffix}`.slice(0, 60)
  const otherPassword = `Ot${randomBytes(12).toString('hex')}7`
  const otherPhone = `137${String(Date.now() + 1).slice(-8)}`
  const otherEmail = `${otherUsername}@example.test`
  for (const value of [otherUsername, otherPassword, otherPhone, otherEmail])
    sensitiveValues.add(value)
  const otherSignup = await requestJson<SignupData>(backendUrl, '/api/saas/signup', {
    method: 'POST',
    body: {
      username: otherUsername,
      password: otherPassword,
      realname: `Other Owner ${suffix}`,
      tenant_name: `Other Runtime E2E ${suffix}`,
      phone: otherPhone,
      email: otherEmail,
      industry: 'software',
      team_size: '1-10'
    }
  })
  const otherTenantId = assertNumericId(otherSignup.tenantId, 'other tenant id')
  const otherTenant = await authenticate(backendUrl, otherUsername, otherPassword, otherTenantId)
  await requestJson(backendUrl, '/api/app-tenant/apps/runtime_shared/install', {
    method: 'POST',
    token: otherTenant.accessToken,
    body: { capabilities: [...sharedRuntimeCapabilities] }
  })

  await verifySharedCapabilityLifecycle({
    backendUrl,
    previewUrl,
    tenant,
    otherTenant,
    expectedContext: {
      tenant: { id: String(signup.tenantId), name: tenantName },
      user: { id: String(signup.userId), display_name: ownerRealname },
      app: {
        code: 'runtime_shared',
        name: 'Runtime Shared Capabilities',
        version: '1.0.0'
      }
    },
    forbiddenIdentityValues: [ownerUsername, ownerEmail, ownerPhone]
  })

  addStep('verify cross-tenant runtime token denial')
  mysqlQuery(`UPDATE app_runtime_session SET tenant_id=${otherTenantId} WHERE id=${sessionId}`)
  await expectRuntimeDenied(backendUrl, firstSession.token, 'cross-tenant runtime token denial')
  mysqlQuery(`UPDATE app_runtime_session SET tenant_id=${originalTenantId} WHERE id=${sessionId}`)

  addStep('verify expired runtime token denial')
  mysqlQuery(
    `UPDATE app_runtime_session SET expires_time=DATE_SUB(NOW(), INTERVAL 1 SECOND) WHERE id=${sessionId}`
  )
  await expectRuntimeDenied(backendUrl, firstSession.token, 'expired runtime token denial')

  const revokeMetadata = await requestJson<any>(
    backendUrl,
    '/api/app-tenant/apps/runtime_starter/open',
    { token: tenant.accessToken }
  )
  const revokeSession = readRuntimeSession(revokeMetadata)
  const revokeSessionId = assertNumericId(
    mysqlQuery(
      `SELECT id FROM app_runtime_session WHERE token_hash='${hashRuntimeToken(revokeSession.token)}'`
    ),
    'revoked runtime session id'
  )
  addStep('verify revoked runtime token denial')
  mysqlQuery(
    `UPDATE app_runtime_session SET revoked_time=NOW(), revoke_reason='e2e_revoked' WHERE id=${revokeSessionId}`
  )
  await expectRuntimeDenied(backendUrl, revokeSession.token, 'revoked runtime token denial')

  const uninstallMetadata = await requestJson<any>(
    backendUrl,
    '/api/app-tenant/apps/runtime_starter/open',
    { token: tenant.accessToken }
  )
  const uninstallSession = readRuntimeSession(uninstallMetadata)
  addStep('verify uninstall runtime invalidation')
  await requestJson(backendUrl, '/api/app-tenant/apps/runtime_starter/uninstall', {
    method: 'POST',
    token: tenant.accessToken,
    body: {}
  })
  await expectRuntimeDenied(backendUrl, uninstallSession.token, 'uninstall runtime invalidation')

  assert.ok(
    Number(mysqlQuery('SELECT COUNT(*) FROM app_runtime_audit_log')) >= 5,
    'runtime lifecycle must persist bounded allow and denial audits'
  )
}

async function cleanupResources() {
  if (cleanupPromise) return cleanupPromise
  cleanupPromise = (async () => {
    const errors: unknown[] = []
    let backendStopped = !backend || backend.exitCode !== null || backend.signalCode !== null
    try {
      await browser?.close()
    } catch (error) {
      errors.push(error)
    }
    try {
      await stopProcess(preview)
    } catch (error) {
      errors.push(error)
    }
    try {
      await stopProcess(backend)
      backendStopped = !backend || backend.exitCode !== null || backend.signalCode !== null
    } catch (error) {
      errors.push(error)
    }
    if (backendStopped) {
      try {
        releaseRedisDatabase()
      } catch (error) {
        errors.push(error)
      }
      try {
        dropDatabase()
        assertDatabaseRemoved()
      } catch (error) {
        errors.push(error)
      }
    } else {
      errors.push(
        new Error('Skipped Redis and MySQL cleanup because backend termination was not confirmed')
      )
    }
    try {
      if (!config?.keep && artifactRoot) {
        rmSync(resolve(artifactRoot, 'packages'), { recursive: true, force: true })
        rmSync(resolve(artifactRoot, 'public'), { recursive: true, force: true })
        rmSync(resolve(artifactRoot, 'uploads'), { recursive: true, force: true })
        rmSync(resolve(artifactRoot, 'runtime-storage'), { recursive: true, force: true })
        assertArtifactCleanup()
      }
    } catch (error) {
      errors.push(error)
    }
    if (errors.length) throw new AggregateError(errors, 'App Runtime E2E cleanup failed')
  })()
  return cleanupPromise
}

function handleTermination(signal: 'SIGINT' | 'SIGTERM') {
  if (terminationStarted) return
  terminationStarted = true
  receivedSignal = signal
  process.exitCode = signal === 'SIGINT' ? 130 : 143
  process.stderr.write(`Received ${signal}; cleaning up App Runtime E2E resources.\n`)
  terminationController.abort(new Error(`Received ${signal}`))
}

const handleSigint = () => handleTermination('SIGINT')
const handleSigterm = () => handleTermination('SIGTERM')
process.on('SIGINT', handleSigint)
process.on('SIGTERM', handleSigterm)

let mainFailure: unknown
let cleanupFailure: unknown
try {
  await main()
} catch (error) {
  mainFailure = error
  if (!terminationStarted) {
    try {
      await writeFailureEvidence(error)
    } catch (evidenceError) {
      mainFailure = new AggregateError([error, evidenceError], 'Failure evidence collection failed')
    }
  }
}
try {
  await cleanupResources()
} catch (error) {
  cleanupFailure = error
}
process.off('SIGINT', handleSigint)
process.off('SIGTERM', handleSigterm)

if (cleanupFailure) {
  const message = redact(describeError(cleanupFailure))
  if (receivedSignal) {
    process.stderr.write(`App Runtime E2E cleanup failed after ${receivedSignal}: ${message}\n`)
    process.exitCode = 1
  } else {
    throw new Error(message)
  }
} else if (receivedSignal) {
  process.exitCode = receivedSignal === 'SIGINT' ? 130 : 143
} else if (mainFailure) {
  throw new Error(redact(describeError(mainFailure)))
} else {
  addStep('complete')
  console.log('App runtime live E2E verified.')
}
