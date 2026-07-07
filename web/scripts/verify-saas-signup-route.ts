import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message)
  }
}

const source = readFileSync(resolve(process.cwd(), 'src/router/routes/staticRoutes.ts'), 'utf8')
const routeBlockMatch = source.match(/\{\s*path:\s*'\/saas\/signup'[\s\S]*?\n\s*\}/)

assert(routeBlockMatch, 'staticRoutes must define /saas/signup')

const routeBlock = routeBlockMatch![0]

assert(routeBlock.includes("name: 'SaasSignup'"), 'route alias must have stable name SaasSignup')
assert(routeBlock.includes('@views/auth/register/index.vue'), 'route alias must reuse register page')
assert(routeBlock.includes('isHideTab: true'), 'route alias must hide worktab')
