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

const expectedFiles = [
  'web/src/api/app-analytics.ts',
  'web/src/views/app-platform/analytics/index.vue',
  'web/src/views/app-center/usage/index.vue',
  'server/src/module/app/app-analytics.controller.ts',
  'server/src/module/app/services/app-analytics.service.ts',
  'server/src/migrations/1760000000037-SeedAppAnalyticsMenus.ts'
]

for (const file of expectedFiles) {
  assert(existsSync(resolve(repoRoot, file)), `${file} must exist`)
}

const apiSource = readFile('web/src/api/app-analytics.ts')
for (const token of [
  '/api/app-analytics/platform/overview',
  '/api/app-analytics/platform/apps/',
  '/api/app-analytics/tenant/overview',
  'fetchPlatformAppAnalyticsOverview',
  'fetchPlatformAppAnalyticsDetail',
  'fetchTenantAppUsageOverview',
  'AppAnalyticsTrendPoint',
  'AppAnalyticsFailure'
]) {
  assertIncludes(apiSource, token, 'app analytics API')
}

const controllerSource = readFile('server/src/module/app/app-analytics.controller.ts')
for (const token of [
  "@Get('platform/overview')",
  "@Get('platform/apps/:code')",
  "@Get('tenant/overview')",
  "@RequirePermission('app:analytics:platform')",
  "@RequirePermission('app:analytics:tenant')",
  'ignoreTenant: true',
  'getTenantId()'
]) {
  assertIncludes(controllerSource, token, 'app analytics controller')
}

const platformPage = readFile('web/src/views/app-platform/analytics/index.vue')
for (const token of [
  'App Analytics',
  'ElSegmented',
  'ArtLineChart',
  'ElTooltip',
  'ElTable',
  'ElDrawer',
  'version_adoption',
  'tenant_adoption',
  'recent_failures',
  'Refresh',
  'Retry',
  'ElEmpty',
  'loadError'
]) {
  assertIncludes(platformPage, token, 'platform analytics page')
}

const tenantPage = readFile('web/src/views/app-center/usage/index.vue')
for (const token of [
  '应用使用情况',
  'ElSegmented',
  'ArtLineChart',
  'ElTooltip',
  'ElTable',
  'version_adoption',
  'recent_failures',
  'Refresh',
  '重试',
  'ElEmpty',
  'loadError'
]) {
  assertIncludes(tenantPage, token, 'tenant app usage page')
}

for (const reasonCode of [
  'app_not_found',
  'app_not_published',
  'app_not_installed',
  'missing_plan_module',
  'missing_system_module',
  'system_module_unavailable',
  'published_version_missing',
  'open_metadata_error'
]) {
  assertIncludes(platformPage, reasonCode, 'platform analytics failure labels')
  assertIncludes(tenantPage, reasonCode, 'tenant app usage failure labels')
}

assert(
  /async function loadOverview\(\)[\s\S]*?catch \{\s*overview\.value = null/.test(platformPage),
  'platform analytics page must clear stale overview data after a failed refresh'
)
assert(
  /async function loadUsage\(\)[\s\S]*?catch \{\s*overview\.value = null/.test(tenantPage),
  'tenant app usage page must clear stale overview data after a failed refresh'
)

const forbiddenSensitiveFields = [
  /\bip\b/i,
  /user[_-]?agent/i,
  /authorization/i,
  /\bcookie\b/i,
  /\btoken\b/i
]
for (const [label, source] of [
  ['platform analytics page', platformPage],
  ['tenant app usage page', tenantPage]
] as const) {
  for (const pattern of forbiddenSensitiveFields) {
    assert(!pattern.test(source), `${label} must not render sensitive field ${pattern}`)
  }
  assert(
    !/\bconsole\.(?:error|log|warn)\b/.test(source),
    `${label} must not write request failures to the browser console`
  )
}
assert(
  !/tenant_id|user_id/i.test(tenantPage),
  'tenant app usage page must not render tenant or user ids'
)

const menuMigration = readFile('server/src/migrations/1760000000037-SeedAppAnalyticsMenus.ts')
for (const token of [
  'AppPlatformAnalytics',
  '/app-platform/analytics',
  'app:analytics:platform',
  'AppTenantUsage',
  '/app-center/usage',
  'app:analytics:tenant'
]) {
  assertIncludes(menuMigration, token, 'app analytics menu migration')
}

const packageJson = JSON.parse(readFile('web/package.json'))
assert(
  packageJson.scripts?.['verify:app-analytics-readiness'] ===
    'tsx scripts/verify-app-analytics-readiness.ts',
  'web/package.json must define verify:app-analytics-readiness'
)

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('App analytics readiness verified.')
