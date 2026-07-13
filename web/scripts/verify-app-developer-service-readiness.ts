import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const failures: string[] = []
const webRoot = process.cwd()
const repoRoot = resolve(webRoot, '..')

function readProjectFile(path: string) {
  const fullPath = resolve(repoRoot, path)
  if (!existsSync(fullPath)) {
    failures.push(`${path} must exist`)
    return ''
  }
  return readFileSync(fullPath, 'utf8')
}

function assertIncludes(source: string, token: string, label: string) {
  if (!source.includes(token)) failures.push(`${label} must include ${token}`)
}

const expectedFiles = [
  'web/src/api/app-developer-certification.ts',
  'web/src/views/app-center/developer-runtime/index.vue',
  'web/src/views/app-platform/developers/index.vue',
  'server/src/module/app/services/app-service-invocation-policy.service.ts',
  'server/src/migrations/1760000000043-SeedCertifiedDeveloperServiceMenus.ts'
]
for (const file of expectedFiles) {
  if (!existsSync(resolve(repoRoot, file))) failures.push(`${file} must exist`)
}

const developerApi = readProjectFile('web/src/api/app-developer.ts')
for (const token of [
  'DeveloperServiceOverview',
  'DeveloperServiceRuntimeRecord',
  'DeveloperServiceLogResponse',
  'fetchDeveloperServiceOverview',
  'fetchDeveloperServiceLogs',
  '/api/app-developer/apps/service-overview',
  '/runtime/logs'
]) {
  assertIncludes(developerApi, token, 'developer service API')
}

const certificationApi = readProjectFile('web/src/api/app-developer-certification.ts')
for (const token of [
  'DeveloperCertificationProfile',
  'fetchOwnDeveloperProfile',
  'applyDeveloperCertification',
  'fetchDeveloperCertifications',
  'decideDeveloperCertification',
  'setDeveloperCertificationDisabled',
  '/api/app-developer/profile',
  '/api/app-platform/developers'
]) {
  assertIncludes(certificationApi, token, 'developer certification API')
}

const developerPage = readProjectFile('web/src/views/app-center/developer/index.vue')
for (const token of [
  'fetchOwnDeveloperProfile',
  'applyDeveloperCertification',
  'approved_runtime_types',
  "runtime_type: 'service'",
  'scan_result',
  'review_snapshot_hash',
  'profileError',
  '/app-center/developer-runtime'
]) {
  assertIncludes(developerPage, token, 'developer workspace')
}

const runtimePage = readProjectFile('web/src/views/app-center/developer-runtime/index.vue')
for (const token of [
  'fetchDeveloperServiceOverview',
  'fetchDeveloperServiceLogs',
  'ElSegmented',
  'p95_duration_ms',
  'success_rate',
  'circuit_state',
  'ElDrawer',
  'ElEmpty',
  'ElSkeleton',
  'retryLogs'
]) {
  assertIncludes(runtimePage, token, 'developer service observability page')
}

const governancePage = readProjectFile('web/src/views/app-platform/developers/index.vue')
for (const token of [
  'fetchDeveloperCertifications',
  'decideDeveloperCertification',
  'setDeveloperCertificationDisabled',
  'requested_runtime_types',
  'certification_expiry',
  'risk_level',
  'review_message',
  'formatDateTime(row.update_time)',
  'ElDialog',
  'ElEmpty'
]) {
  assertIncludes(governancePage, token, 'developer certification governance page')
}

const developerController = readProjectFile('server/src/module/app/app-developer.controller.ts')
for (const token of [
  "@Get('service-overview')",
  "@Get(':code/runtime/logs')",
  "@RequirePermission('app:developer:observability')"
]) {
  assertIncludes(developerController, token, 'developer observability controller')
}

const developerService = readProjectFile('server/src/module/app/services/app-developer.service.ts')
for (const token of [
  'getServiceOverview',
  'getServiceLogs',
  'findOwnedApp(code, developerId)',
  'getDeveloperRuntimeLogs',
  'ROW_NUMBER() OVER',
  'p95_duration_ms'
]) {
  assertIncludes(developerService, token, 'developer observability service')
}

const invocationPolicy = readProjectFile(
  'server/src/module/app/services/app-service-invocation-policy.service.ts'
)
for (const token of ['scheduleRetentionCleanup', 'logRetentionDays', 'LessThan(cutoff)']) {
  assertIncludes(invocationPolicy, token, 'developer service retention policy')
}

const menuMigration = readProjectFile(
  'server/src/migrations/1760000000043-SeedCertifiedDeveloperServiceMenus.ts'
)
for (const token of [
  '/app-platform/developers',
  '/app-center/developer-runtime',
  'app:developer-certification:manage',
  'app:developer:observability',
  "REGEXP '^tenant:[0-9]+:(owner|admin|member)$'"
]) {
  assertIncludes(menuMigration, token, 'certified developer menu migration')
}

const sdkClient = readProjectFile('web/packages/app-runtime-sdk/src/client.ts')
assertIncludes(sdkClient, "request('services.invoke'", 'runtime SDK service invocation')

const safeSources = [developerApi, runtimePage, developerService]
for (const forbidden of [
  'package_path',
  'publish_path',
  'release_dir',
  'loopback_port',
  'process_name',
  'environment',
  'command_line',
  'raw_source',
  'cookie'
]) {
  if (safeSources.some((source) => source.toLowerCase().includes(forbidden))) {
    failures.push(`developer observability surfaces must not expose ${forbidden}`)
  }
}

const packageJson = JSON.parse(readProjectFile('web/package.json'))
if (
  packageJson.scripts?.['verify:app-developer-service-readiness'] !==
  'tsx scripts/verify-app-developer-service-readiness.ts'
) {
  failures.push('web/package.json must define verify:app-developer-service-readiness')
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('App developer service readiness verified.')
