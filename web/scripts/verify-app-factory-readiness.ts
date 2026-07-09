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
  'web/src/api/app-factory.ts',
  'web/src/views/app-platform/factory/index.vue',
  'server/src/module/app/app-factory.controller.ts',
  'server/src/module/app/services/app-factory.service.ts',
  'server/src/module/app/services/app-factory-template.service.ts',
  'server/src/migrations/1760000000033-SeedAppFactoryTemplates.ts',
  'server/src/migrations/1760000000031-SeedAppFactoryMenus.ts'
]

for (const file of expectedFiles) {
  assert(existsSync(resolve(repoRoot, file)), `${file} must exist`)
}

const apiSource = readFile('web/src/api/app-factory.ts')
for (const token of [
  '/api/app-platform/factory/modules',
  '/api/app-platform/factory/modules/${code}',
  '/api/app-platform/factory/modules/${code}/publish',
  '/api/app-platform/factory/templates',
  '/api/app-platform/factory/templates/${code}',
  'fetchAppFactoryModules',
  'fetchAppFactoryModule',
  'createAppFactoryModule',
  'updateAppFactoryModule',
  'publishAppFactoryModule',
  'fetchAppFactoryTemplates',
  'fetchAppFactoryTemplate',
  'html_content',
  'css_content'
]) {
  assertIncludes(apiSource, token, 'app factory API')
}

const pageSource = readFile('web/src/views/app-platform/factory/index.vue')
for (const token of [
  'fetchAppFactoryModules',
  'fetchAppFactoryModule',
  'createAppFactoryModule',
  'updateAppFactoryModule',
  'publishAppFactoryModule',
  'html_content',
  'css_content',
  'saas_module_code',
  'system_module_code',
  'ElDialog',
  'ElTable',
  'ElMessageBox',
  'Factory page rejects scripts',
  'templateDrawerVisible',
  'applyTemplate',
  'Use Template',
  'fetchAppFactoryTemplates'
]) {
  assertIncludes(pageSource, token, 'app factory page')
}

const menuMigration = readFile('server/src/migrations/1760000000031-SeedAppFactoryMenus.ts')
for (const token of [
  'AppFactory',
  '/app-platform/factory',
  'app:factory:list',
  'app:factory:create',
  'app:factory:update',
  'app:factory:publish'
]) {
  assertIncludes(menuMigration, token, 'app factory menu migration')
}

const templateSeedMigration = readFile('server/src/migrations/1760000000033-SeedAppFactoryTemplates.ts')
for (const token of [
  'landing_page',
  'job_board',
  'classifieds',
  'team_directory',
  'app:factory:template:list'
]) {
  assertIncludes(templateSeedMigration, token, 'app factory template seed migration')
}

const packageJson = JSON.parse(readFile('web/package.json'))
assert(
  packageJson.scripts?.['verify:app-factory-readiness'] === 'tsx scripts/verify-app-factory-readiness.ts',
  'web/package.json must define verify:app-factory-readiness'
)

const checklist = readFile('docs/saas-launch-readiness-checklist.md')
assertIncludes(checklist, 'pnpm.cmd run verify:app-factory-readiness', 'launch readiness checklist')
assertIncludes(checklist, '/#/app-platform/factory', 'launch readiness checklist')
assertIncludes(checklist, 'static HTML/CSS modules', 'launch readiness checklist')

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('App factory readiness verified.')
