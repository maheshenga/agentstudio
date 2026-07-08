import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const failures: string[] = []
const expectedScripts = [
  'verify-saas-launch-flow-readiness.ts',
  'verify-saas-ui-state-readiness.ts',
  'verify-saas-tenant-ui-state-readiness.ts',
  'verify-saas-signup-activation.ts',
  'verify-saas-platform-tenant-page.ts',
  'verify-saas-payment-path-copy.ts',
  'verify-saas-resource-pack-crud.ts',
  'verify-no-legacy-saiadmin-composable.ts',
  'verify-saas-public-brand-surfaces.ts'
]

function readFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

function assert(condition: unknown, message: string) {
  if (!condition) failures.push(message)
}

function assertIncludes(source: string, token: string, label: string) {
  assert(source.includes(token), `${label} must include ${token}`)
}

const runnerPath = resolve(process.cwd(), 'scripts/run-saas-readiness.ts')
assert(existsSync(runnerPath), 'scripts/run-saas-readiness.ts must exist')
const runnerSource = existsSync(runnerPath) ? readFile('scripts/run-saas-readiness.ts') : ''
let lastIndex = -1
for (const script of expectedScripts) {
  const index = runnerSource.indexOf(script)
  assert(index > lastIndex, `runner must include ${script} in order`)
  lastIndex = index
}
for (const token of ['spawnSync', "stdio: 'inherit'", 'process.exit(result.status || 1)', 'SaaS frontend readiness verified.']) {
  assertIncludes(runnerSource, token, 'runner')
}

const packageJson = JSON.parse(readFile('package.json'))
assert(
  packageJson.scripts?.['verify:saas-readiness'] === 'tsx scripts/run-saas-readiness.ts',
  'package.json must define verify:saas-readiness'
)

const checklist = readFile('../docs/saas-launch-readiness-checklist.md')
assertIncludes(checklist, 'pnpm.cmd run verify:saas-readiness', 'launch readiness checklist')

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('SaaS readiness command verified.')
