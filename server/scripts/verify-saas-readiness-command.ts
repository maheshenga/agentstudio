import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const failures: string[] = []
const expectedSuites = [
  'saas-main-flow.integration.spec.ts',
  'saas-route-consistency.spec.ts',
  'saas-tenant.controller.spec.ts',
  'saas-platform.controller.spec.ts',
  'saas-payment.controller.spec.ts'
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

function extractServerGate(checklist: string) {
  const serverBlockStart = checklist.indexOf('cd server')
  if (serverBlockStart === -1) return ''

  const nextSection = checklist.indexOf('## Manual Visitor Flow', serverBlockStart)
  return checklist.slice(serverBlockStart, nextSection === -1 ? checklist.length : nextSection)
}

const packageJson = JSON.parse(readFile('package.json'))
const readinessScript = packageJson.scripts?.['verify:saas-readiness'] || ''

assert(readinessScript.startsWith('jest --'), 'package.json must define verify:saas-readiness with jest')
for (const suite of expectedSuites) {
  assertIncludes(readinessScript, suite, 'verify:saas-readiness script')
}
for (const token of ['--runInBand', '--forceExit']) {
  assertIncludes(readinessScript, token, 'verify:saas-readiness script')
}

const checklist = readFile('../docs/saas-launch-readiness-checklist.md')
const serverGate = extractServerGate(checklist)
assertIncludes(serverGate, 'cd server', 'launch readiness checklist backend gate')
assertIncludes(serverGate, 'pnpm.cmd run verify:saas-readiness', 'launch readiness checklist backend gate')
assertIncludes(serverGate, '# Expanded backend gate', 'launch readiness checklist backend gate')
for (const suite of expectedSuites) {
  assertIncludes(serverGate, suite, 'launch readiness checklist backend gate')
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('SaaS backend readiness command verified.')
