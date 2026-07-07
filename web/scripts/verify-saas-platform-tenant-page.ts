import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message)
  }
}

const apiSource = readFileSync(resolve(process.cwd(), 'src/api/saas.ts'), 'utf8')
const pageSource = readFileSync(resolve(process.cwd(), 'src/views/saas/platform/tenant/index.vue'), 'utf8')

assert(apiSource.includes('export interface SaasPlatformTenantRecord'), 'saas API must define platform tenant record type')
assert(apiSource.includes('export interface SaasPlatformTenantListParams'), 'saas API must define platform tenant list params')
assert(apiSource.includes('export function fetchPlatformTenants'), 'saas API must export fetchPlatformTenants')
assert(apiSource.includes("url: '/api/saas/platform/tenants'"), 'platform tenant API path must be /api/saas/platform/tenants')

assert(pageSource.includes('fetchPlatformTenants'), 'platform tenant page must load tenants from API')
assert(pageSource.includes('<ElTable'), 'platform tenant page must render a tenant table')
assert(pageSource.includes('<ElPagination'), 'platform tenant page must render pagination')
assert(pageSource.includes('<ElDialog'), 'tenant creation form must be inside a dialog')

for (const label of ['租户运营', '新建租户', '当前套餐', '成员数']) {
  assert(pageSource.includes(label), `platform tenant page must include label: ${label}`)
}
