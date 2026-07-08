import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const failures: string[] = []
const webRoot = process.cwd()

type RouteContract = {
  routePath: string
  componentPath: string
  pageFile: string
}

const criticalRoutes: RouteContract[] = [
  {
    routePath: '/saas-platform/tenants',
    componentPath: '/saas/platform/tenant',
    pageFile: 'src/views/saas/platform/tenant/index.vue'
  },
  {
    routePath: '/saas-platform/plans',
    componentPath: '/saas/platform/plan',
    pageFile: 'src/views/saas/platform/plan/index.vue'
  },
  {
    routePath: '/saas-platform/module',
    componentPath: '/saas/platform/module',
    pageFile: 'src/views/saas/platform/module/index.vue'
  },
  {
    routePath: '/saas-platform/subscription',
    componentPath: '/saas/platform/subscription',
    pageFile: 'src/views/saas/platform/subscription/index.vue'
  },
  {
    routePath: '/saas-platform/usage',
    componentPath: '/saas/platform/usage',
    pageFile: 'src/views/saas/platform/usage/index.vue'
  },
  {
    routePath: '/saas-platform/revenue',
    componentPath: '/saas/platform/revenue',
    pageFile: 'src/views/saas/platform/revenue/index.vue'
  },
  {
    routePath: '/saas-platform/resource-packs',
    componentPath: '/saas/platform/resource-pack',
    pageFile: 'src/views/saas/platform/resource-pack/index.vue'
  },
  {
    routePath: '/saas-platform/resource-pack-orders',
    componentPath: '/saas/platform/resource-pack-order',
    pageFile: 'src/views/saas/platform/resource-pack-order/index.vue'
  },
  {
    routePath: '/saas-platform/payment-config',
    componentPath: '/saas/platform/payment-config',
    pageFile: 'src/views/saas/platform/payment-config/index.vue'
  },
  {
    routePath: '/tenant-saas/usage',
    componentPath: '/saas/tenant/usage',
    pageFile: 'src/views/saas/tenant/usage/index.vue'
  },
  {
    routePath: '/tenant-saas/plan',
    componentPath: '/saas/tenant/plan',
    pageFile: 'src/views/saas/tenant/plan/index.vue'
  },
  {
    routePath: '/tenant-saas/modules',
    componentPath: '/saas/tenant/modules/index',
    pageFile: 'src/views/saas/tenant/modules/index.vue'
  },
  {
    routePath: '/tenant-saas/members',
    componentPath: '/saas/tenant/member',
    pageFile: 'src/views/saas/tenant/member/index.vue'
  },
  {
    routePath: '/tenant-saas/resource-packs',
    componentPath: '/saas/tenant/resource-pack',
    pageFile: 'src/views/saas/tenant/resource-pack/index.vue'
  }
]

function readFile(path: string): string {
  const fullPath = resolve(webRoot, path)
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

function componentExists(componentPath: string) {
  const normalized = componentPath.replace(/^\/+/, '')
  return (
    existsSync(resolve(webRoot, 'src/views', `${normalized}.vue`)) ||
    existsSync(resolve(webRoot, 'src/views', normalized, 'index.vue'))
  )
}

function extractRouteBlock(source: string, routePath: string): string {
  const pathIndex = source.indexOf(`path: '${routePath}'`)
  if (pathIndex === -1) return ''

  const blockStart = source.lastIndexOf('{', pathIndex)
  const nextRouteStart = source.indexOf('\n  {', pathIndex + routePath.length)
  const listEnd = source.indexOf('\n]', pathIndex)
  return source.slice(blockStart, nextRouteStart === -1 ? listEnd : nextRouteStart)
}

const staticRoutesSource = readFile('src/router/routes/staticRoutes.ts')
const saasSignupRoute = extractRouteBlock(staticRoutesSource, '/saas/signup')
assert(saasSignupRoute.length > 0, 'static routes must define /saas/signup')
assertIncludes(saasSignupRoute, "name: 'SaasSignup'", '/saas/signup route')
assertIncludes(saasSignupRoute, "import('@views/saas/signup/index.vue')", '/saas/signup route')
assert(
  !saasSignupRoute.includes("@views/auth/register/index.vue"),
  '/saas/signup route must not load the generic auth register wrapper'
)

const componentLoaderSource = readFile('src/router/core/ComponentLoader.ts')
assertIncludes(componentLoaderSource, 'import.meta.glob', 'ComponentLoader')
assertIncludes(componentLoaderSource, '../../views/**/*.vue', 'ComponentLoader')
assertIncludes(componentLoaderSource, 'fullPathWithIndex', 'ComponentLoader')

for (const route of criticalRoutes) {
  assert(
    existsSync(resolve(webRoot, route.pageFile)),
    `${route.routePath} page file must exist at ${route.pageFile}`
  )
  assert(
    componentExists(route.componentPath),
    `${route.routePath} component ${route.componentPath} must be loadable`
  )
}

const signupPage = readFile('src/views/saas/signup/index.vue')
assertIncludes(signupPage, 'signupTenant', 'SaaS signup page')
assertIncludes(signupPage, "name: 'Login'", 'SaaS signup page redirect')

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('SaaS route contract verified.')
