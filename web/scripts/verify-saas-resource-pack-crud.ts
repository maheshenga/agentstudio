import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const failures: string[] = []

function readProjectFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

function assertIncludes(source: string, token: string, label: string) {
  if (!source.includes(token)) {
    failures.push(`${label} must include ${token}`)
  }
}

const api = readProjectFile('src/api/saas.ts')
for (const token of [
  'SaveSaasResourcePackParams',
  'createPlatformResourcePack',
  'updatePlatformResourcePack',
  'updatePlatformResourcePackStatus',
  '/api/saas/platform/resource-packs'
]) {
  assertIncludes(api, token, 'saas API')
}

const page = readProjectFile('src/views/saas/platform/resource-pack/index.vue')
for (const token of [
  'createPlatformResourcePack',
  'updatePlatformResourcePack',
  'updatePlatformResourcePackStatus',
  'openCreateDialog',
  'openEditDialog',
  'saveResourcePack',
  'toggleStatus',
  '新建资源包',
  '编辑',
  '启用',
  '停用',
  '保存',
  '资源包已保存',
  '暂无资源包数据'
]) {
  assertIncludes(page, token, 'platform resource pack page')
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('SaaS resource pack CRUD verified.')
