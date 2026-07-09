import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(process.cwd(), '..')
const failures: string[] = []

const activeDocs = [
  'docs/saas-launch-readiness-checklist.md',
  'docs/saas/p0-local-stability-checklist.md'
]

const canonicalRoutes = [
  '/tenant-saas/usage',
  '/tenant-saas/plan',
  '/tenant-saas/members',
  '/tenant-saas/modules',
  '/tenant-saas/resource-packs',
  '/saas-platform/usage',
  '/saas-platform/tenants',
  '/saas-platform/plans',
  '/saas-platform/module',
  '/saas-platform/subscription',
  '/saas-platform/resource-packs',
  '/saas-platform/resource-pack-orders',
  '/saas-platform/payment-config',
  '/saas-platform/revenue'
]

const staleRoutePatterns = [
  { route: '/saas-platform/subscriptions', pattern: /\/saas-platform\/subscriptions(?![A-Za-z0-9-])/ },
  { route: '/tenant-saas/resource-pack', pattern: /\/tenant-saas\/resource-pack(?![A-Za-z0-9-])/ }
]

function assert(condition: unknown, message: string) {
  if (!condition) failures.push(message)
}

function readDoc(path: string) {
  const fullPath = resolve(repoRoot, path)
  assert(existsSync(fullPath), `${path} must exist`)
  return existsSync(fullPath) ? readFileSync(fullPath, 'utf8') : ''
}

for (const docPath of activeDocs) {
  const source = readDoc(docPath)

  for (const route of canonicalRoutes) {
    assert(source.includes(route), `${docPath} must include canonical route ${route}`)
  }

  for (const staleRoute of staleRoutePatterns) {
    assert(
      !staleRoute.pattern.test(source),
      `${docPath} must not include stale route ${staleRoute.route}`
    )
  }
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('SaaS doc route baseline verified.')
