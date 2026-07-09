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
  'web/src/api/app-marketplace.ts',
  'web/src/views/app-platform/apps/index.vue',
  'web/src/views/app-center/marketplace/index.vue',
  'web/src/views/app-center/installed/index.vue',
  'web/src/views/app-center/open/index.vue',
  'server/src/module/app/app-platform.controller.ts',
  'server/src/module/app/app-tenant.controller.ts',
  'server/src/migrations/1760000000029-SeedAppMarketplaceMenus.ts'
]

for (const file of expectedFiles) {
  assert(existsSync(resolve(repoRoot, file)), `${file} must exist`)
}

const apiSource = readFile('web/src/api/app-marketplace.ts')
for (const token of [
  '/api/app-platform/apps',
  '/api/app-platform/apps/${code}/versions/upload',
  '/api/app-platform/apps/${code}/versions/${version}/approve',
  '/api/app-platform/apps/${code}/versions/${version}/publish',
  '/api/app-tenant/marketplace',
  '/api/app-tenant/installed',
  '/api/app-tenant/apps/${code}/install',
  '/api/app-tenant/apps/${code}/open',
  'multipart/form-data'
]) {
  assertIncludes(apiSource, token, 'app marketplace API')
}

const platformPage = readFile('web/src/views/app-platform/apps/index.vue')
for (const token of [
  'fetchPlatformApps',
  'createPlatformApp',
  'uploadPlatformStaticAppVersion',
  'approvePlatformAppVersion',
  'publishPlatformAppVersion',
  'ElTable',
  'ElDialog',
  'ElDrawer'
]) {
  assertIncludes(platformPage, token, 'platform apps page')
}

const marketplacePage = readFile('web/src/views/app-center/marketplace/index.vue')
for (const token of ['fetchTenantAppMarketplace', 'installTenantApp', '/app-center/open', 'ElTable']) {
  assertIncludes(marketplacePage, token, 'tenant marketplace page')
}

const installedPage = readFile('web/src/views/app-center/installed/index.vue')
for (const token of ['fetchTenantInstalledApps', 'uninstallTenantApp', '/app-center/open', 'row.app?.name']) {
  assertIncludes(installedPage, token, 'tenant installed page')
}

const runnerPage = readFile('web/src/views/app-center/open/index.vue')
for (const token of [
  'fetchTenantAppOpenMetadata',
  'router.replace(data.entry_url)',
  'sandbox',
  'allow-scripts allow-forms allow-popups allow-downloads',
  "item !== 'allow-same-origin'"
]) {
  assertIncludes(runnerPage, token, 'app runner page')
}

const menuMigration = readFile('server/src/migrations/1760000000029-SeedAppMarketplaceMenus.ts')
for (const token of [
  'AppPlatform',
  '/app-platform',
  '/app-platform/apps',
  'AppCenter',
  '/app-center',
  '/app-center/marketplace',
  '/app-center/installed',
  '/app-center/open',
  'isHidden: 1',
  'app:platform:list',
  'app:platform:upload',
  'app:platform:review',
  'app:platform:publish',
  'app:tenant:marketplace',
  'app:tenant:install',
  'app:tenant:open'
]) {
  assertIncludes(menuMigration, token, 'app marketplace menu migration')
}

const mainSource = readFile('server/src/main.ts')
assertIncludes(mainSource, "appMarketplace.publicDir", 'server main')
assertIncludes(mainSource, "appMarketplace.publicPrefix", 'server main')
assertIncludes(mainSource, 'app.useStaticAssets(appPublicPath', 'server main')
assertIncludes(mainSource, 'req.path.startsWith(appPublicPrefix)', 'server main')

const configurationSource = readFile('server/src/config/configuration.ts')
assertIncludes(configurationSource, 'appMarketplace', 'server configuration')
assertIncludes(configurationSource, '/apps-static/', 'server configuration')

const packageJson = JSON.parse(readFile('web/package.json'))
assert(
  packageJson.scripts?.['verify:app-marketplace-readiness'] === 'tsx scripts/verify-app-marketplace-readiness.ts',
  'web/package.json must define verify:app-marketplace-readiness'
)

const checklist = readFile('docs/saas-launch-readiness-checklist.md')
assertIncludes(checklist, 'pnpm.cmd run verify:app-marketplace-readiness', 'launch readiness checklist')
assertIncludes(checklist, '/#/app-center/marketplace', 'launch readiness checklist')
assertIncludes(checklist, '/#/app-platform/apps', 'launch readiness checklist')

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('App marketplace readiness verified.')
