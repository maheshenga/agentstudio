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
  'web/src/api/app-commerce.ts',
  'web/src/views/app-center/marketplace/index.vue',
  'web/src/views/app-center/installed/index.vue',
  'web/src/views/app-center/orders/index.vue',
  'web/src/views/app-center/developer-revenue/index.vue',
  'web/src/views/app-platform/commercial/index.vue',
  'server/src/migrations/1760000000045-SeedAppCommercializationMenus.ts'
]
for (const file of expectedFiles) assert(existsSync(resolve(repoRoot, file)), `${file} must exist`)

const apiSource = readFile('web/src/api/app-commerce.ts')
for (const token of [
  'AppPricePlanRecord',
  'TenantAppCommerceAccess',
  'AppOrderRecord',
  'TenantAppLicenseRecord',
  'AppRevenueOverview',
  'AppSettlementRecord',
  '/api/app-tenant/commerce/apps/${code}',
  '/api/app-tenant/commerce/apps/${code}/trial',
  '/api/app-tenant/commerce/apps/${code}/orders',
  '/api/app-tenant/commerce/orders',
  '/api/saas/payment/alipay/create',
  "order_type: 'app'",
  '/api/app-platform/commerce/apps/${code}/prices',
  '/api/app-platform/commerce/orders',
  '/api/app-platform/commerce/licenses',
  '/api/app-platform/commerce/revenue',
  '/api/app-platform/commerce/settlements',
  '/api/app-developer/commerce/revenue',
  '/api/app-developer/commerce/settlements'
]) {
  assertIncludes(apiSource, token, 'app commerce API')
}

const marketplaceApi = readFile('web/src/api/app-marketplace.ts')
for (const token of ['TenantAppCommerceAccess', 'commerce_action', 'can_install', 'can_open']) {
  assertIncludes(marketplaceApi, token, 'app marketplace commerce contract')
}

const marketplacePage = readFile('web/src/views/app-center/marketplace/index.vue')
for (const token of [
  'lowestPlan',
  'formatMoney',
  'purchaseDialogVisible',
  'startTenantAppTrial',
  'createTenantAppOrder',
  'startAppAlipayPayment',
  'commerce_action',
  'Continue payment',
  'Contact administrator',
  'ElDialog',
  'ElEmpty',
  'loadError',
  'Retry'
]) {
  assertIncludes(marketplacePage, token, 'tenant marketplace conversion page')
}

const installedPage = readFile('web/src/views/app-center/installed/index.vue')
for (const token of [
  'commerceLabel',
  'license_expires_at',
  'commerce_action',
  'Renew',
  'Contact administrator',
  'ElEmpty',
  'loadError',
  'Retry'
]) {
  assertIncludes(installedPage, token, 'tenant installed commerce page')
}

const ordersPage = readFile('web/src/views/app-center/orders/index.vue')
for (const token of [
  'App Orders',
  'fetchTenantAppOrders',
  'startAppAlipayPayment',
  'Continue payment',
  'ElTable',
  'ElEmpty',
  'loadError',
  'Retry'
]) {
  assertIncludes(ordersPage, token, 'tenant app orders page')
}

const developerPage = readFile('web/src/views/app-center/developer-revenue/index.vue')
for (const token of [
  'Developer Revenue',
  'fetchDeveloperAppRevenue',
  'fetchDeveloperAppSettlements',
  'unsettled_developer_amount_cents',
  'refund_amount_cents',
  'ElTable',
  'ElEmpty',
  'loadError',
  'Retry'
]) {
  assertIncludes(developerPage, token, 'developer revenue page')
}
for (const forbidden of [
  'tenant_id',
  'alipay_trade_no',
  'payment_reference',
  'platform_amount_cents'
]) {
  assert(!developerPage.includes(forbidden), `developer revenue page must not render ${forbidden}`)
}

const platformPage = readFile('web/src/views/app-platform/commercial/index.vue')
for (const token of [
  'Commercial Operations',
  'Price Plans',
  'Orders',
  'Licenses',
  'Revenue',
  'Settlements',
  'ElTabs',
  'refundPlatformAppOrder',
  'revokePlatformAppLicense',
  'approvePlatformAppSettlement',
  'markPlatformAppSettlementPaid',
  'ElMessageBox.confirm',
  'ElDialog',
  'ElEmpty',
  'loadError',
  'Retry'
]) {
  assertIncludes(platformPage, token, 'platform commercial operations page')
}

const menuMigration = readFile(
  'server/src/migrations/1760000000045-SeedAppCommercializationMenus.ts'
)
for (const token of [
  '/app-platform/commercial',
  '/app-center/orders',
  '/app-center/developer-revenue',
  'app:commerce:view',
  'app:commerce:manage',
  'app:settlement:manage',
  'app:tenant:purchase',
  'app:tenant:orders',
  'app:developer:revenue'
]) {
  assertIncludes(menuMigration, token, 'app commercialization menu migration')
}

const packageJson = JSON.parse(readFile('web/package.json'))
assert(
  packageJson.scripts?.['verify:app-commerce-readiness'] ===
    'tsx scripts/verify-app-commerce-readiness.ts',
  'web/package.json must define verify:app-commerce-readiness'
)

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('App commerce readiness verified.')
