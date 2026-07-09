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
  'web/src/views/app-platform/reviews/index.vue',
  'web/src/views/app-center/marketplace/index.vue',
  'web/src/views/app-center/installed/index.vue',
  'web/src/views/app-center/open/index.vue',
  'server/src/module/app/app-platform.controller.ts',
  'server/src/module/app/app-platform-review.controller.ts',
  'server/src/module/app/app-tenant.controller.ts',
  'server/src/migrations/1760000000029-SeedAppMarketplaceMenus.ts',
  'server/src/migrations/1760000000034-SeedAppReviewCenterMenus.ts'
]

for (const file of expectedFiles) {
  assert(existsSync(resolve(repoRoot, file)), `${file} must exist`)
}

const apiSource = readFile('web/src/api/app-marketplace.ts')
for (const token of [
  '/api/app-platform/apps',
  '/api/app-platform/reviews',
  '/api/app-platform/apps/${code}/versions/upload',
  '/api/app-platform/apps/${code}/versions/${version}/approve',
  '/api/app-platform/apps/${code}/versions/${version}/publish',
  '/api/app-platform/apps/${code}/versions/${version}/unpublish',
  '/api/app-platform/apps/${code}/versions/${version}/rollback',
  '/api/app-tenant/marketplace',
  '/api/app-tenant/installed',
  '/api/app-tenant/apps/${code}/install',
  '/api/app-tenant/apps/${code}/open',
  'multipart/form-data',
  'available',
  'availability_status',
  'availability_reason',
  'required_saas_module_code',
  'required_system_module_code',
  'unpublishPlatformAppVersion',
  'rollbackPlatformAppVersion',
  'fetchPlatformAppReviews',
  'is_active',
  'entry_url'
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
  'fetchPlatformModules',
  'fetchSystemModules',
  'saasModuleOptions',
  'systemModuleOptions',
  'unpublishPlatformAppVersion',
  'rollbackPlatformAppVersion',
  'versionGovernance',
  'Rollback',
  'Unpublish',
  'is_active',
  'entry_url',
  'ElOption',
  'ElTable',
  'ElDialog',
  'ElDrawer'
]) {
  assertIncludes(platformPage, token, 'platform apps page')
}

const reviewPage = readFile('web/src/views/app-platform/reviews/index.vue')
for (const token of [
  'Review Center',
  'fetchPlatformAppReviews',
  'approvePlatformAppVersion',
  'rejectPlatformAppVersion',
  'publishPlatformAppVersion',
  'rollbackPlatformAppVersion',
  'unpublishPlatformAppVersion',
  'ElTable',
  'ElMessageBox'
]) {
  assertIncludes(reviewPage, token, 'platform review center page')
}

const marketplacePage = readFile('web/src/views/app-center/marketplace/index.vue')
for (const token of [
  'fetchTenantAppMarketplace',
  'installTenantApp',
  '/app-center/open',
  'ElTable',
  'availability_reason',
  ':disabled="!row.available"',
  'Upgrade'
]) {
  assertIncludes(marketplacePage, token, 'tenant marketplace page')
}

const installedPage = readFile('web/src/views/app-center/installed/index.vue')
for (const token of [
  'fetchTenantInstalledApps',
  'uninstallTenantApp',
  '/app-center/open',
  'row.app?.name',
  'availability_reason',
  ':disabled="isOpenDisabled(row)"',
  'row.app?.available === false'
]) {
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

const reviewMenuMigration = readFile('server/src/migrations/1760000000034-SeedAppReviewCenterMenus.ts')
for (const token of [
  'AppReviewCenter',
  '/app-platform/reviews',
  'app:platform:review'
]) {
  assertIncludes(reviewMenuMigration, token, 'app review center menu migration')
}

const mainSource = readFile('server/src/main.ts')
assertIncludes(mainSource, "appMarketplace.publicDir", 'server main')
assertIncludes(mainSource, "appMarketplace.publicPrefix", 'server main')
assertIncludes(mainSource, 'app.useStaticAssets(appPublicPath', 'server main')
assertIncludes(mainSource, 'req.path.startsWith(appPublicPrefix)', 'server main')

const configurationSource = readFile('server/src/config/configuration.ts')
assertIncludes(configurationSource, 'appMarketplace', 'server configuration')
assertIncludes(configurationSource, '/apps-static/', 'server configuration')
assertIncludes(configurationSource, 'maxPackageSizeMb', 'server configuration')
assertIncludes(configurationSource, 'maxPackageFiles', 'server configuration')

const platformService = readFile('server/src/module/app/services/app-platform.service.ts')
assertIncludes(platformService, 'normalizeExternalHttpUrl', 'app platform service')
assertIncludes(platformService, 'normalizeInternalRoute', 'app platform service')

const storageService = readFile('server/src/module/app/services/app-package-storage.service.ts')
assertIncludes(storageService, 'getMaxPackageSizeBytes', 'app package storage service')
assertIncludes(storageService, 'getMaxPackageFiles', 'app package storage service')

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
