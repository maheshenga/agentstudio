import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const failures: string[] = []

function readWebFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
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

const tenantModulesPage = readWebFile('src/views/saas/tenant/modules/index.vue')
const systemModuleApi = readWebFile('src/api/system-module.ts')
for (const token of [
  'export interface SystemModuleAccessDiagnosis',
  'fetchTenantSystemModuleAccessDiagnosis',
  "/api/tenant/modules/${code}/access-diagnosis"
]) {
  assertIncludes(systemModuleApi, token, 'tenant module diagnosis api')
}
for (const token of [
  'const loadError = ref',
  "loadError.value = ''",
  'tenant-modules-page__load-error',
  '<ElAlert type="error" :title="loadError"',
  '@click="loadModules"',
  '<template #empty>',
  'ElEmpty',
  'catch (error)',
  "console.error('[TenantModulesPage] load modules failed:'",
  'ElMessage.error(loadError.value)',
  'diagnosisByCode',
  '查看原因',
  '当前租户未启用该系统模块',
  "loadError.value = '租户模块加载失败，请稍后重试'"
]) {
  assertIncludes(tenantModulesPage, token, 'tenant modules page')
}
assertNotIncludes(tenantModulesPage, 'throw error', 'tenant modules page load failure handling')

const tenantUsagePage = readWebFile('src/views/saas/tenant/usage/index.vue')
for (const token of [
  'const errorMessage = ref',
  'ElResult',
  '<ElEmpty',
  'v-loading="ledgerLoading"',
  "console.error('[SaasTenantUsagePage] load usage failed:'"
]) {
  assertIncludes(tenantUsagePage, token, 'tenant usage page')
}

const tenantPlanPage = readWebFile('src/views/saas/tenant/plan/index.vue')
for (const token of [
  'const errorMessage = ref',
  'ElSkeleton',
  'ElResult',
  '<ElEmpty',
  'v-loading="orderHistoryLoading"',
  "console.error('[SaasTenantPlanPage] load page data failed:'"
]) {
  assertIncludes(tenantPlanPage, token, 'tenant plan page')
}

const tenantMemberPage = readWebFile('src/views/saas/tenant/member/index.vue')
for (const token of [
  'const moduleErrorMessage = ref',
  '<ElResult v-else-if="moduleErrorMessage"',
  '<ElEmpty v-else-if="moduleChecked"',
  '<template #empty>',
  'v-loading="loading"',
  "console.error('[SaasTenantMemberPage] load members failed:'"
]) {
  assertIncludes(tenantMemberPage, token, 'tenant member page')
}

const tenantResourcePackPage = readWebFile('src/views/saas/tenant/resource-pack/index.vue')
for (const token of [
  'const errorMessage = ref',
  'ElSkeleton',
  'ElResult',
  '<ElEmpty',
  'v-loading="orderHistoryLoading"',
  "console.error('[SaasTenantResourcePackPage] load resource packs failed:'"
]) {
  assertIncludes(tenantResourcePackPage, token, 'tenant resource pack page')
}

const checklist = readWebFile('../docs/saas-launch-readiness-checklist.md')
assertIncludes(checklist, 'verify-saas-tenant-ui-state-readiness.ts', 'launch readiness checklist')

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('SaaS tenant UI state readiness verified.')
