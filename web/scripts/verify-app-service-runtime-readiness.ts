import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const failures: string[] = []
const webRoot = process.cwd()
const repoRoot = resolve(webRoot, '..')

function readFile(path: string) {
  const fullPath = resolve(repoRoot, path)
  if (!existsSync(fullPath)) {
    failures.push(`${path} must exist`)
    return ''
  }
  return readFileSync(fullPath, 'utf8')
}

function assert(condition: unknown, message: string) {
  if (!condition) failures.push(message)
}

function assertIncludes(source: string, token: string, label: string) {
  assert(source.includes(token), `${label} must include ${token}`)
}

function assertExcludes(source: string, token: string, label: string) {
  assert(!source.includes(token), `${label} must not include ${token}`)
}

const runtimeApi = readFile('web/src/api/app-service-runtime.ts')
const runtimePage = readFile('web/src/views/app-platform/runtime/index.vue')
const runtimeDisplay = readFile('web/src/views/app-platform/runtime/runtime-display.ts')
const appsApi = readFile('web/src/api/app-marketplace.ts')
const appsPage = readFile('web/src/views/app-platform/apps/index.vue')
const menuMigration = readFile('server/src/migrations/1760000000041-SeedAppServiceRuntimeMenus.ts')

for (const token of [
  '/api/app-platform/runtime/instances',
  '/api/app-platform/runtime/apps/${code}',
  '/versions/${version}/candidate',
  '/versions/${version}/candidate/stop',
  '/versions/${version}/publish',
  '/versions/${version}/rollback',
  '/api/app-platform/runtime/apps/${code}/probe',
  '/api/app-platform/runtime/apps/${code}/logs',
  '/api/app-platform/runtime/reconcile'
]) {
  assertIncludes(runtimeApi, token, 'service runtime API')
}

for (const token of [
  'fetchAppServiceInstances',
  'fetchAppServiceRuntimeDetail',
  'startAppServiceCandidate',
  'stopAppServiceCandidate',
  'publishAppServiceCandidate',
  'rollbackAppServiceVersion',
  'probeAppService',
  'fetchAppServiceLogs',
  'reconcileAppServiceRuntime',
  'loadError',
  'ElAlert',
  'ElEmpty',
  'v-loading',
  'canStartCandidate',
  'canPublishCandidate',
  'canStopCandidate',
  'canRollbackInstance',
  ':disabled=',
  'stopReason',
  'rollbackReason',
  'ElDialog',
  'ElDrawer',
  'app:runtime:list',
  'app:runtime:manage',
  'app:runtime:probe',
  'app:runtime:logs',
  'runtime_driver',
  'runtimeDriverLabel',
  'runtimeDriverTagType'
]) {
  assertIncludes(runtimePage, token, 'service runtime page')
}

for (const token of [
  'ElCard',
  'releaseDir',
  'release_dir',
  'package_path',
  'publish_path',
  'socket_path',
  'container_id',
  'podman_home',
  'podman_image'
]) {
  assertExcludes(runtimePage, token, 'service runtime page')
}

for (const token of [
  'environment',
  'command_line',
  'tenant_id',
  'tenantIds',
  'raw_source',
  'socket_path',
  'container_id',
  'podman_home',
  'podman_image'
]) {
  assertExcludes(`${runtimeApi}\n${runtimePage}`, token, 'service runtime client')
}

for (const token of ['runtimeDriverLabel', 'runtimeDriverTagType', "'Podman'", "'PM2'"]) {
  assertIncludes(runtimeDisplay, token, 'service runtime display helpers')
}

for (const token of [
  "'service'",
  '/api/app-platform/apps/${code}/versions/service-upload',
  'uploadPlatformServiceAppVersion',
  'multipart/form-data'
]) {
  assertIncludes(appsApi, token, 'app marketplace API')
}

for (const token of [
  "value: 'service'",
  "row.type === 'service'",
  'uploadPlatformServiceAppVersion',
  '平台可信',
  'scan_result',
  'scanStatusText',
  '服务应用'
]) {
  assertIncludes(appsPage, token, 'platform apps page')
}

for (const token of ['dependency', 'lifecycle script', 'secret field', 'environment variable']) {
  assertExcludes(appsPage.toLowerCase(), token, 'platform apps page')
}

for (const token of [
  'AppServiceRuntime',
  '/app-platform/runtime',
  'app:runtime:list',
  'app:runtime:manage',
  'app:runtime:probe',
  'app:runtime:logs',
  "('admin', 'super_admin')"
]) {
  assertIncludes(menuMigration, token, 'service runtime menu migration')
}

const packageJson = JSON.parse(readFile('web/package.json'))
assert(
  packageJson.scripts?.['verify:app-service-runtime-readiness'] ===
    'tsx scripts/verify-app-service-runtime-readiness.ts',
  'web/package.json must define verify:app-service-runtime-readiness'
)

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('App service runtime readiness verified.')
