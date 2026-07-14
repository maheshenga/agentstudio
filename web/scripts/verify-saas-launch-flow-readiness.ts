import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(process.cwd(), '..')
const webRoot = resolve(repoRoot, 'web')
const serverRoot = resolve(repoRoot, 'server')
const failures: string[] = []

function readProjectFile(root: string, path: string): string {
  const fullPath = resolve(root, path)
  if (!existsSync(fullPath)) {
    failures.push(`${path} must exist`)
    return ''
  }
  return readFileSync(fullPath, 'utf8')
}

function assertIncludes(source: string, token: string, label: string) {
  if (!source.includes(token)) {
    failures.push(`${label} must include ${token}`)
  }
}

function assertNotIncludes(source: string, token: string, label: string) {
  if (source.includes(token)) {
    failures.push(`${label} must not include ${token}`)
  }
}

function assertFileExists(root: string, path: string) {
  if (!existsSync(resolve(root, path))) {
    failures.push(`${path} must exist`)
  }
}

const requiredWebPages = [
  'src/views/saas/signup/index.vue',
  'src/views/auth/login/index.vue',
  'src/views/saas/tenant/usage/index.vue',
  'src/views/saas/tenant/plan/index.vue',
  'src/views/saas/tenant/modules/index.vue',
  'src/views/saas/tenant/member/index.vue',
  'src/views/saas/tenant/resource-pack/index.vue',
  'src/views/saas/platform/tenant/index.vue',
  'src/views/saas/platform/plan/index.vue',
  'src/views/saas/platform/module/index.vue',
  'src/views/saas/platform/subscription/index.vue',
  'src/views/saas/platform/usage/index.vue',
  'src/views/saas/platform/revenue/index.vue',
  'src/views/saas/platform/resource-pack/index.vue',
  'src/views/saas/platform/resource-pack-order/index.vue',
  'src/views/saas/platform/payment-config/index.vue'
]

for (const page of requiredWebPages) {
  assertFileExists(webRoot, page)
}

const staticRoutesSource = readProjectFile(webRoot, 'src/router/routes/staticRoutes.ts')
for (const token of ["path: '/auth/login'", "path: '/auth/register'", "path: '/saas/signup'"]) {
  assertIncludes(staticRoutesSource, token, 'static auth/signup routes')
}

const apiSource = readProjectFile(webRoot, 'src/api/saas.ts')
const systemModuleApiSource = readProjectFile(webRoot, 'src/api/system-module.ts')
for (const token of [
  "url: '/api/saas/signup'",
  "url: '/api/saas/tenant/usage'",
  "url: '/api/saas/tenant/subscription'",
  "url: '/api/saas/tenant/plans'",
  "url: '/api/saas/tenant/orders'",
  "url: '/api/saas/tenant/members'",
  "url: '/api/saas/tenant/resource-packs'",
  "url: '/api/saas/tenant/resource-pack-orders'",
  "url: '/api/saas/payment/alipay/create'",
  "url: '/api/saas/payment/alipay/config-status'",
  "url: '/api/saas/platform/tenants'",
  "url: '/api/saas/platform/usage/overview'",
  "url: '/api/saas/platform/revenue/overview'",
  "url: '/api/saas/platform/orders'",
  "url: '/api/saas/platform/payment/notify-logs'",
  "url: '/api/saas/platform/subscriptions'",
  "url: '/api/saas/platform/plans'",
  "url: '/api/saas/platform/modules'",
  "url: '/api/saas/platform/resource-packs'",
  "url: '/api/saas/platform/resource-pack-orders'",
  "url: '/api/saas/platform/payment/alipay/config'"
]) {
  assertIncludes(apiSource, token, 'saas api')
}

assertIncludes(systemModuleApiSource, "url: '/api/tenant/modules'", 'tenant system module api')

for (const token of [
  'signupTenant',
  'fetchTenantUsage',
  'fetchTenantSubscription',
  'fetchTenantPlans',
  'createTenantUpgradeOrder',
  'fetchTenantMembers',
  'createTenantMember',
  'fetchTenantResourcePacks',
  'createTenantResourcePackOrder',
  'createAlipayPayment',
  'fetchAlipayConfigStatus',
  'createSaasTenantFromPlatform',
  'fetchPlatformTenants',
  'fetchPlatformUsageOverview',
  'fetchPlatformRevenueOverview',
  'fetchPlatformOrders',
  'fetchPlatformSubscriptions',
  'fetchPlatformPlans',
  'fetchPlatformModules',
  'fetchPlatformResourcePacks',
  'fetchPlatformResourcePackOrders',
  'fetchPlatformAlipayConfig',
  'updatePlatformAlipayConfig'
]) {
  assertIncludes(apiSource, `export function ${token}`, 'saas api export')
}

assertIncludes(systemModuleApiSource, 'export function fetchTenantSystemModules', 'tenant system module api export')

const signupPage = readProjectFile(webRoot, 'src/views/saas/signup/index.vue')
assertIncludes(signupPage, 'signupTenant', 'signup page')
assertIncludes(signupPage, "signup_success: '1'", 'signup success activation')
assertIncludes(signupPage, "name: 'Login'", 'signup success login route')

const loginPage = readProjectFile(webRoot, 'src/views/auth/login/index.vue')
assertIncludes(loginPage, 'route.query.signup_success', 'login activation alert')
assertIncludes(loginPage, 'formData.username = signupUsername', 'login username prefill')
assertIncludes(loginPage, 'fetchLogin(loginParams)', 'login submit')

const tenantUsagePage = readProjectFile(webRoot, 'src/views/saas/tenant/usage/index.vue')
for (const token of ['fetchTenantUsage', 'fetchTenantQuotaLedgers']) {
  assertIncludes(tenantUsagePage, token, 'tenant usage page')
}

const tenantPlanPage = readProjectFile(webRoot, 'src/views/saas/tenant/plan/index.vue')
for (const token of ['fetchTenantPlans', 'createTenantUpgradeOrder', 'createAlipayPayment', 'fetchAlipayConfigStatus']) {
  assertIncludes(tenantPlanPage, token, 'tenant plan page')
}

const tenantModulesPage = readProjectFile(webRoot, 'src/views/saas/tenant/modules/index.vue')
assertIncludes(tenantModulesPage, 'fetchTenantSystemModules', 'tenant modules page')

const tenantMemberPage = readProjectFile(webRoot, 'src/views/saas/tenant/member/index.vue')
for (const token of [
  'fetchTenantMembers',
  'createTenantMember',
  'changeTenantMemberRole',
  'updateTenantMemberStatus',
  'removeTenantMember'
]) {
  assertIncludes(tenantMemberPage, token, 'tenant member page')
}
assertNotIncludes(tenantMemberPage, 'resetTenantMemberPassword', 'tenant member page')
assertNotIncludes(apiSource, 'export function resetTenantMemberPassword', 'saas api export')

const tenantResourcePackPage = readProjectFile(webRoot, 'src/views/saas/tenant/resource-pack/index.vue')
for (const token of [
  'fetchTenantResourcePacks',
  'createTenantResourcePackOrder',
  'fetchTenantResourcePackOrders',
  'createAlipayPayment',
  'fetchAlipayConfigStatus',
  'tenant-resource-pack-page__payment-status'
]) {
  assertIncludes(tenantResourcePackPage, token, 'tenant resource pack page')
}

const platformTenantPage = readProjectFile(webRoot, 'src/views/saas/platform/tenant/index.vue')
for (const token of ['fetchPlatformTenants', 'createSaasTenantFromPlatform', '<ElTable', '<ElPagination', '<ElDialog']) {
  assertIncludes(platformTenantPage, token, 'platform tenant page')
}

const platformPlanPage = readProjectFile(webRoot, 'src/views/saas/platform/plan/index.vue')
for (const token of ['fetchPlatformPlans', 'createPlatformPlan', 'updatePlatformPlan', 'updatePlatformPlanStatus', 'updatePlatformPlanQuotas']) {
  assertIncludes(platformPlanPage, token, 'platform plan page')
}

const platformModulePage = readProjectFile(webRoot, 'src/views/saas/platform/module/index.vue')
for (const token of ['fetchPlatformModules', 'createPlatformModule', 'updatePlatformModule', 'updatePlatformModuleStatus']) {
  assertIncludes(platformModulePage, token, 'platform module page')
}

const platformSubscriptionPage = readProjectFile(webRoot, 'src/views/saas/platform/subscription/index.vue')
for (const token of ['fetchPlatformSubscriptions', 'fetchPlatformOrders', 'fetchPlatformOrderRiskOverview', 'fetchPlatformSubscriptionLifecycleOverview']) {
  assertIncludes(platformSubscriptionPage, token, 'platform subscription page')
}

const platformUsagePage = readProjectFile(webRoot, 'src/views/saas/platform/usage/index.vue')
for (const token of [
  'fetchPlatformUsageOverview',
  'fetchPlatformPaymentReconciliationOverview',
  'scanPlatformPaymentReconciliation',
  'fetchPlatformPaymentNotifyLogs',
  'saas-platform-usage-page__notify-logs',
  'fetchPlatformQuotaLedgers'
]) {
  assertIncludes(platformUsagePage, token, 'platform usage page')
}

const platformPaymentConfigPage = readProjectFile(webRoot, 'src/views/saas/platform/payment-config/index.vue')
for (const token of ['fetchPlatformAlipayConfig', 'updatePlatformAlipayConfig']) {
  assertIncludes(platformPaymentConfigPage, token, 'platform payment config page')
}

const publicController = readProjectFile(serverRoot, 'src/module/saas/saas-public.controller.ts')
assertIncludes(publicController, '@Public()', 'saas public signup controller')
assertIncludes(publicController, "@Post('signup')", 'saas public signup controller')
assertIncludes(publicController, 'this.provisioning.signup(body)', 'saas public signup controller')

const tenantController = readProjectFile(serverRoot, 'src/module/saas/saas-tenant.controller.ts')
for (const token of [
  "@Get('usage')",
  "@Get('subscription')",
  "@Get('plans')",
  "@Post('orders')",
  "@Get('modules')",
  "@Get('members')",
  "@Post('members')",
  "@Get('resource-packs')",
  "@Post('resource-pack-orders')",
  "@Get('resource-pack-orders')"
]) {
  assertIncludes(tenantController, token, 'saas tenant controller')
}

const platformController = readProjectFile(serverRoot, 'src/module/saas/saas-platform.controller.ts')
for (const token of [
  "@Get('tenants')",
  "@Post('tenants')",
  "@Get('usage/overview')",
  "@Get('revenue/overview')",
  "@Get('subscriptions')",
  "@Get('plans')",
  "@Get('modules')",
  "@Get('resource-packs')",
  "@Get('resource-pack-orders')",
  "@Get('payment/alipay/config')",
  "@Get('payment/notify-logs')",
  "@Put('payment/alipay/config')"
]) {
  assertIncludes(platformController, token, 'saas platform controller')
}

const paymentController = readProjectFile(serverRoot, 'src/module/saas/saas-payment.controller.ts')
assertIncludes(paymentController, "@Controller('api/saas/payment')", 'saas payment controller')
for (const token of ["@Post('alipay/create')", "@Get('alipay/config-status')", "@Post('dev-confirm')"]) {
  assertIncludes(paymentController, token, 'saas payment controller')
}

const moduleManifest = readProjectFile(serverRoot, 'src/module/system-module/manifests/built-in-modules.ts')
for (const token of ['saas_platform', 'tenant_saas', '/saas-platform/usage', '/tenant-saas/usage', '/api/saas/platform', '/api/saas/tenant']) {
  assertIncludes(moduleManifest, token, 'system module manifest')
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('SaaS launch flow readiness verified.')
