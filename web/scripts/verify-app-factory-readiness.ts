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
  'server/src/module/app/app-factory-template-contract.ts',
  'server/src/module/app/services/app-factory.service.ts',
  'server/src/module/app/services/app-factory-template.service.ts',
  'server/src/migrations/1760000000033-SeedAppFactoryTemplates.ts',
  'server/src/migrations/1760000000055-VersionAppFactoryTemplates.ts',
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
  '/api/app-platform/factory/modules/${code}/manifest-preview',
  '/api/app-platform/factory/templates',
  '/api/app-platform/factory/templates/${code}',
  'fetchAppFactoryModules',
  'fetchAppFactoryModule',
  'createAppFactoryModule',
  'updateAppFactoryModule',
  'publishAppFactoryModule',
  'fetchAppFactoryTemplates',
  'fetchAppFactoryTemplate',
  'previewAppFactoryManifest',
  'template_version',
  'runtime_target',
  'manifest_defaults',
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
  '模块工厂',
  '构建可版本化的静态模块',
  '使用模板',
  '工厂页面会拒绝脚本',
  'templateDrawerVisible',
  'applyTemplate',
  'fetchAppFactoryTemplates',
  'previewAppFactoryManifest',
  'openManifestPreview',
  'template_version',
  'schema_version',
  'runtime_target',
  'manifest_defaults',
  '服务模板只生成清单'
]) {
  assertIncludes(pageSource, token, 'app factory page')
}

for (const token of [
  'Module Factory',
  'Build versioned static modules',
  'Use Template',
  'Create Module',
  'Factory Templates',
  'Code is required',
  'Name is required'
]) {
  assert(!pageSource.includes(token), `app factory page must not include legacy English copy: ${token}`)
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

const templateSeedMigration = readFile(
  'server/src/migrations/1760000000033-SeedAppFactoryTemplates.ts'
)
for (const token of [
  'landing_page',
  'job_board',
  'classifieds',
  'team_directory',
  'app:factory:template:list'
]) {
  assertIncludes(templateSeedMigration, token, 'app factory template seed migration')
}

const versionedTemplateMigration = readFile(
  'server/src/migrations/1760000000055-VersionAppFactoryTemplates.ts'
)
for (const token of [
  'schema_version',
  'template_version',
  'runtime_target',
  'manifest_defaults',
  'uk_app_factory_template_code_version',
  'job_board',
  'classifieds',
  "'2.0.0'"
]) {
  assertIncludes(versionedTemplateMigration, token, 'versioned app factory migration')
}

const controllerSource = readFile('server/src/module/app/app-factory.controller.ts')
for (const token of ['manifest-preview', 'previewManifest', 'template_version']) {
  assertIncludes(controllerSource, token, 'app factory controller')
}

const factoryServiceSource = readFile('server/src/module/app/services/app-factory.service.ts')
for (const token of [
  'buildFactoryAppManifest',
  'manifest.json',
  'hashDirectory',
  'expectedContentHash',
  'Service factory output must be submitted through App Platform review'
]) {
  assertIncludes(factoryServiceSource, token, 'app factory service')
}

const packageJson = JSON.parse(readFile('web/package.json'))
assert(
  packageJson.scripts?.['verify:app-factory-readiness'] ===
    'tsx scripts/verify-app-factory-readiness.ts',
  'web/package.json must define verify:app-factory-readiness'
)

const checklist = readFile('docs/saas-launch-readiness-checklist.md')
assertIncludes(checklist, 'pnpm.cmd run verify:app-factory-readiness', 'launch readiness checklist')
assertIncludes(checklist, '/#/app-platform/factory', 'launch readiness checklist')
assertIncludes(checklist, 'static HTML/CSS modules', 'launch readiness checklist')
assertIncludes(checklist, 'service Manifest V2', 'launch readiness checklist')
assertIncludes(checklist, 'must enter App Platform review', 'launch readiness checklist')

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('App factory readiness verified.')
