import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const failures: string[] = []
const expectedScripts = [
  'verify-saas-launch-flow-readiness.ts',
  'verify-saas-route-contract.ts',
  'verify-saas-doc-route-baseline.ts',
  'verify-saas-ui-state-readiness.ts',
  'verify-saas-tenant-ui-state-readiness.ts',
  'verify-saas-visible-copy-encoding.ts',
  'verify-saas-signup-route.ts',
  'verify-saas-signup-password-policy.ts',
  'verify-saas-signup-activation.ts',
  'verify-saas-platform-tenant-page.ts',
  'verify-saas-payment-path-copy.ts',
  'verify-saas-resource-pack-crud.ts',
  'verify-no-legacy-saiadmin-composable.ts',
  'verify-saas-public-brand-surfaces.ts',
  'verify-saas-public-origin.ts',
  'verify-saas-readiness-command.ts'
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
const previewSmokePath = resolve(process.cwd(), 'scripts/verify-saas-preview-smoke.ts')
assert(existsSync(previewSmokePath), 'scripts/verify-saas-preview-smoke.ts must exist')
assert(
  packageJson.scripts?.['verify:saas-preview-smoke'] ===
    'tsx scripts/verify-saas-preview-smoke.ts',
  'package.json must define verify:saas-preview-smoke'
)
const browserSmokePath = resolve(process.cwd(), 'scripts/verify-saas-browser-smoke.ts')
assert(existsSync(browserSmokePath), 'scripts/verify-saas-browser-smoke.ts must exist')
assert(
  packageJson.scripts?.['verify:saas-browser-smoke'] ===
    'tsx scripts/verify-saas-browser-smoke.ts',
  'package.json must define verify:saas-browser-smoke'
)
const liveBrowserE2EPath = resolve(process.cwd(), 'scripts/verify-saas-live-browser-e2e.ts')
assert(existsSync(liveBrowserE2EPath), 'scripts/verify-saas-live-browser-e2e.ts must exist')
assert(
  packageJson.scripts?.['verify:saas-live-browser-e2e'] ===
    'tsx scripts/verify-saas-live-browser-e2e.ts',
  'package.json must define verify:saas-live-browser-e2e'
)
const platformLiveBrowserE2EPath = resolve(
  process.cwd(),
  'scripts/verify-saas-platform-live-browser-e2e.ts'
)
assert(
  existsSync(platformLiveBrowserE2EPath),
  'scripts/verify-saas-platform-live-browser-e2e.ts must exist'
)
assert(
  packageJson.scripts?.['verify:saas-platform-live-browser-e2e'] ===
    'tsx scripts/verify-saas-platform-live-browser-e2e.ts',
  'package.json must define verify:saas-platform-live-browser-e2e'
)

const checklist = readFile('../docs/saas-launch-readiness-checklist.md')
assertIncludes(checklist, 'pnpm.cmd run verify:saas-readiness', 'launch readiness checklist')
for (const script of expectedScripts) {
  assertIncludes(
    checklist,
    `pnpm.cmd exec tsx scripts/${script}`,
    'launch readiness checklist'
  )
}
assertIncludes(
  checklist,
  'pnpm.cmd run verify:saas-preview-smoke',
  'launch readiness checklist'
)
assertIncludes(
  checklist,
  'pnpm.cmd run verify:saas-browser-smoke',
  'launch readiness checklist'
)
assertIncludes(
  checklist,
  'pnpm.cmd run verify:saas-live-browser-e2e',
  'launch readiness checklist'
)
assertIncludes(
  checklist,
  'SAAS_LIVE_E2E_WEB_URL',
  'launch readiness checklist'
)
assertIncludes(
  checklist,
  'pnpm.cmd run verify:saas-platform-live-browser-e2e',
  'launch readiness checklist'
)
assertIncludes(
  checklist,
  'SAAS_PLATFORM_LIVE_E2E_WEB_URL',
  'launch readiness checklist'
)

const rootRunner = readFile('../scripts/run-saas-readiness.cjs')
for (const token of [
  'verify:saas-readiness',
  'build',
  'verify:saas-preview-smoke',
  'verify:saas-browser-smoke'
]) {
  assertIncludes(rootRunner, token, 'root readiness runner')
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('SaaS readiness command verified.')
