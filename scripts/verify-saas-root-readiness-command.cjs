const { existsSync, readFileSync } = require('node:fs')
const { resolve } = require('node:path')

const failures = []

function readFile(path) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

function assert(condition, message) {
  if (!condition) failures.push(message)
}

function assertIncludes(source, token, label) {
  assert(source.includes(token), `${label} must include ${token}`)
}

function readPackage(path) {
  return JSON.parse(readFile(path))
}

const runnerPath = 'scripts/run-saas-readiness.cjs'
assert(existsSync(resolve(process.cwd(), runnerPath)), `${runnerPath} must exist`)

const runner = existsSync(resolve(process.cwd(), runnerPath)) ? readFile(runnerPath) : ''
for (const token of [
  'spawnSync',
  "path.join(rootDir, 'web')",
  "path.join(rootDir, 'server')",
  "process.platform === 'win32'",
  'cmd.exe',
  "pnpm.cmd",
  "spawnSync('pnpm'",
  'verify:saas-readiness',
  'SaaS repository readiness verified.'
]) {
  assertIncludes(runner, token, 'root readiness runner')
}

const webPackage = readPackage('web/package.json')
const serverPackage = readPackage('server/package.json')
assert(webPackage.scripts?.['verify:saas-readiness'], 'web/package.json must define verify:saas-readiness')
assert(serverPackage.scripts?.['verify:saas-readiness'], 'server/package.json must define verify:saas-readiness')

const checklist = readFile('docs/saas-launch-readiness-checklist.md')
assertIncludes(checklist, 'node scripts/run-saas-readiness.cjs', 'launch readiness checklist')
assertIncludes(checklist, 'cd web', 'launch readiness checklist')
assertIncludes(checklist, 'cd server', 'launch readiness checklist')

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('SaaS root readiness command verified.')
