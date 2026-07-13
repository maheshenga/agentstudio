import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const failures: string[] = []
const webRoot = process.cwd()
const repoRoot = resolve(webRoot, '..')

function readFile(path: string) {
  const fullPath = resolve(repoRoot, path)
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

const expectedFiles = [
  'web/src/api/app-developer.ts',
  'web/src/views/app-center/developer/index.vue',
  'server/src/module/app/app-developer.controller.ts',
  'server/src/module/app/services/app-developer.service.ts',
  'server/src/migrations/1760000000035-SeedAppDeveloperMenus.ts',
  'server/src/migrations/1760000000043-SeedCertifiedDeveloperServiceMenus.ts'
]

for (const file of expectedFiles) {
  assert(existsSync(resolve(repoRoot, file)), `${file} must exist`)
}

const apiSource = readFile('web/src/api/app-developer.ts')
for (const token of [
  '/api/app-developer/apps',
  'fetchDeveloperApps',
  'fetchDeveloperApp',
  'createDeveloperApp',
  'updateDeveloperApp',
  'uploadDeveloperAppVersion',
  'submitDeveloperAppVersion',
  'FormData'
]) {
  assertIncludes(apiSource, token, 'developer app API')
}

const pageSource = readFile('web/src/views/app-center/developer/index.vue')
for (const token of [
  'Developer Apps',
  'fetchDeveloperApps',
  'fetchDeveloperApp',
  'createDeveloperApp',
  'updateDeveloperApp',
  'uploadDeveloperAppVersion',
  'submitDeveloperAppVersion',
  'review_message',
  'ElTable',
  'ElDialog',
  'ElDrawer',
  'ElUpload',
  'ElEmpty'
]) {
  assertIncludes(pageSource, token, 'developer app page')
}

for (const forbidden of [
  'approvePlatformAppVersion',
  'rejectPlatformAppVersion',
  'publishPlatformAppVersion',
  'rollbackPlatformAppVersion',
  'unpublishPlatformAppVersion'
]) {
  assert(!pageSource.includes(forbidden), `developer app page must not include ${forbidden}`)
}

const controllerSource = readFile('server/src/module/app/app-developer.controller.ts')
for (const permission of [
  'app:developer:list',
  'app:developer:read',
  'app:developer:create',
  'app:developer:update',
  'app:developer:upload',
  'app:developer:submit'
]) {
  assertIncludes(controllerSource, permission, 'developer app controller')
}
assert(
  !controllerSource.includes('app:platform:'),
  'developer app controller must not use platform permissions'
)

const serviceSource = readFile('server/src/module/app/services/app-developer.service.ts')
for (const token of [
  'developerId',
  'findOwnedApp',
  'deleteTime: IsNull()',
  'Disabled or archived apps'
]) {
  assertIncludes(serviceSource, token, 'developer app service')
}

const menuMigration = readFile('server/src/migrations/1760000000035-SeedAppDeveloperMenus.ts')
for (const token of [
  'AppDeveloperApps',
  '/app-center/developer',
  'app:developer:list',
  'app:developer:read',
  'app:developer:create',
  'app:developer:update',
  'app:developer:upload',
  'app:developer:submit'
]) {
  assertIncludes(menuMigration, token, 'developer app menu migration')
}
const certifiedMenuMigration = readFile(
  'server/src/migrations/1760000000043-SeedCertifiedDeveloperServiceMenus.ts'
)
for (const token of [
  "REGEXP '^tenant:[0-9]+:(owner|admin|member)$'",
  'AppDeveloperApps',
  'app:developer:create',
  'app:developer:upload',
  'app:developer:observability'
]) {
  assertIncludes(certifiedMenuMigration, token, 'certified developer menu migration')
}

for (const token of [
  "runtimeType === 'service'",
  "assertRuntimeApproved(developerId, 'service')",
  'uploadServiceVersion'
]) {
  assertIncludes(serviceSource, token, 'developer service certification guard')
}

const packageJson = JSON.parse(readFile('web/package.json'))
assert(
  packageJson.scripts?.['verify:app-developer-readiness'] ===
    'tsx scripts/verify-app-developer-readiness.ts',
  'web/package.json must define verify:app-developer-readiness'
)

const checklist = readFile('docs/saas-launch-readiness-checklist.md')
assertIncludes(
  checklist,
  'pnpm.cmd run verify:app-developer-readiness',
  'launch readiness checklist'
)
assertIncludes(checklist, '/#/app-center/developer', 'launch readiness checklist')
assertIncludes(checklist, 'foreign app', 'launch readiness checklist')

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('App developer readiness verified.')
