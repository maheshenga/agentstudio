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
  'web/src/api/app-runtime.ts',
  'web/src/views/app-platform/apps/index.vue',
  'web/src/views/app-platform/reviews/index.vue',
  'web/src/views/app-center/marketplace/index.vue',
  'web/src/views/app-center/installed/index.vue',
  'web/src/views/app-center/open/index.vue',
  'web/scripts/verify-build-budget.ts',
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
  '/api/app-platform/apps/${code}/versions/service-upload',
  '/api/app-platform/apps/${code}/versions/${version}/approve',
  '/api/app-platform/apps/${code}/versions/${version}/publish',
  '/api/app-platform/apps/${code}/versions/${version}/unpublish',
  '/api/app-platform/apps/${code}/versions/${version}/rollback',
  '/api/app-tenant/marketplace',
  '/api/app-tenant/installed',
  '/api/app-tenant/apps/${code}/install',
  '/api/app-tenant/apps/${code}/upgrade',
  '/api/app-tenant/apps/${code}/open',
  '/api/app-tenant/runtime/iframe/exchange',
  '/api/app-tenant/apps/${code}/capabilities',
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
  'entry_url',
  'launch',
  'allowed_origins',
  'requested_capabilities',
  "'service'",
  'runtime_type',
  'trust_level',
  'scan_result',
  'uploadPlatformServiceAppVersion',
  'upgradeTenantApp',
  'update_available',
  'latest_version',
  'screenshots',
  'documentation_url',
  'support_url',
  'changelog',
  'AppPageResult',
  'AppMarketplaceListParams',
  'page?: number',
  'limit?: number'
]) {
  assertIncludes(apiSource, token, 'app marketplace API')
}

const platformPage = readFile('web/src/views/app-platform/apps/index.vue')
for (const token of [
  'fetchPlatformApps',
  'createPlatformApp',
  'uploadPlatformStaticAppVersion',
  'uploadPlatformServiceAppVersion',
  'publishPlatformAppVersion',
  'fetchPlatformModules',
  'fetchSystemModules',
  'saasModuleOptions',
  'systemModuleOptions',
  'unpublishPlatformAppVersion',
  'rollbackPlatformAppVersion',
  'versionGovernance',
  '回滚',
  '下线',
  'is_active',
  'entry_url',
  'ElOption',
  'ElTable',
  'ElDialog',
  'ElDrawer',
  "value: 'service'",
  '平台可信',
  'scanStatusText',
  'ElPagination',
  'appPage.list',
  'pagination.page',
  'appForm.screenshots',
  'appForm.documentation_url',
  'appForm.support_url'
]) {
  assertIncludes(platformPage, token, 'platform apps page')
}

const reviewPage = readFile('web/src/views/app-platform/reviews/index.vue')
for (const token of [
  '应用审核中心',
  'fetchPlatformAppReviews',
  'approvePlatformAppVersion',
  'rejectPlatformAppVersion',
  'publishPlatformAppVersion',
  'rollbackPlatformAppVersion',
  'unpublishPlatformAppVersion',
  'ElTable',
  'ElMessageBox',
  'requested_capabilities',
  'approved_capabilities',
  'ElCheckboxGroup',
  'capabilityLabel'
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
  ':disabled="!row.can_install"',
  'Upgrade',
  'requested_capabilities',
  'consentDialogVisible',
  'ElCheckboxGroup',
  'installTenantApp(consentApp.code, selectedCapabilities)',
  'upgradeTenantApp',
  'upgradeDialogVisible',
  'new_capabilities',
  'detailDrawerVisible',
  'selectedDetail',
  '应用市场',
  '查看详情',
  'rel="noopener noreferrer"',
  'ElPagination',
  'appPage.list',
  'pagination.page'
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
  'row.app?.available === false',
  'permissionDialogVisible',
  'updateTenantAppCapabilities',
  'tenant_approved_capabilities',
  'ElCheckboxGroup',
  'revokeAllCapabilities',
  '全部撤销'
]) {
  assertIncludes(installedPage, token, 'tenant installed page')
}

const runnerPage = readFile('web/src/views/app-center/open/index.vue')
for (const token of [
  'fetchTenantAppOpenMetadata',
  'exchangeIframeLaunch',
  'dispatchRuntimeCapability',
  'event.source !== frameWindow',
  'event.origin !== runtimeTargetOrigin.value',
  'frameWindow.postMessage(response, targetOrigin)',
  "metadata.value?.type === 'static'",
  "metadata.value?.type === 'iframe'",
  'router.replace(data.entry_url)',
  'sandbox',
  'allow-scripts allow-forms allow-popups allow-downloads',
  'allow-same-origin'
]) {
  assertIncludes(runnerPage, token, 'app runner page')
}

const runtimeApi = readFile('web/src/api/app-runtime.ts')
for (const token of [
  'X-App-Runtime-Token',
  '/api/app-runtime/context',
  '/api/app-runtime/kv/',
  '/api/app-runtime/files',
  '/api/app-runtime/http',
  '/api/app-runtime/webhooks'
]) {
  assertIncludes(runtimeApi, token, 'app runtime API')
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

const reviewMenuMigration = readFile(
  'server/src/migrations/1760000000034-SeedAppReviewCenterMenus.ts'
)
for (const token of ['AppReviewCenter', '/app-platform/reviews', 'app:platform:review']) {
  assertIncludes(reviewMenuMigration, token, 'app review center menu migration')
}

const mainSource = readFile('server/src/main.ts')
assertIncludes(mainSource, 'appMarketplace.publicDir', 'server main')
assertIncludes(mainSource, 'appMarketplace.publicPrefix', 'server main')
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
  packageJson.scripts?.['verify:app-marketplace-readiness'] ===
    'tsx scripts/verify-app-marketplace-readiness.ts',
  'web/package.json must define verify:app-marketplace-readiness'
)
assert(
  packageJson.scripts?.build?.includes('verify-build-budget.ts'),
  'web build must enforce the generated asset budget'
)
const viteConfig = readFile('web/vite.config.ts')
assertIncludes(viteConfig, 'chunkSizeWarningLimit: 900', 'Vite build config')

const checklist = readFile('docs/saas-launch-readiness-checklist.md')
assertIncludes(
  checklist,
  'pnpm.cmd run verify:app-marketplace-readiness',
  'launch readiness checklist'
)
assertIncludes(checklist, '/#/app-center/marketplace', 'launch readiness checklist')
assertIncludes(checklist, '/#/app-platform/apps', 'launch readiness checklist')
assertIncludes(
  checklist,
  'P9-C Shared Runtime Capability Verification',
  'launch readiness checklist'
)
assertIncludes(checklist, 'APP_RUNTIME_E2E_HTTP_URL', 'launch readiness checklist')
assertIncludes(checklist, 'APP_RUNTIME_E2E_WEBHOOK_URL', 'launch readiness checklist')
assertIncludes(checklist, 'APP_RUNTIME_E2E_REDIRECT_PRIVATE_URL', 'launch readiness checklist')

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('App marketplace readiness verified.')
