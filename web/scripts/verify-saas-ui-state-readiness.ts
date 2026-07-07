import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

type PageExpectation = {
  file: string
  label: string
  blockClass: string
  loadFunction: string
  emptyText: string
  errorText: string
}

const pages: PageExpectation[] = [
  {
    file: 'src/views/saas/platform/plan/index.vue',
    label: 'platform plan page',
    blockClass: 'saas-plan-page__load-error',
    loadFunction: 'loadPlans',
    emptyText: '暂无套餐数据',
    errorText: '套餐列表加载失败'
  },
  {
    file: 'src/views/saas/platform/module/index.vue',
    label: 'platform module page',
    blockClass: 'saas-module-page__load-error',
    loadFunction: 'loadModules',
    emptyText: '暂无模块数据',
    errorText: '模块列表加载失败'
  },
  {
    file: 'src/views/saas/platform/resource-pack/index.vue',
    label: 'platform resource pack page',
    blockClass: 'saas-resource-pack-page__load-error',
    loadFunction: 'loadResourcePacks',
    emptyText: '暂无资源包数据',
    errorText: '资源包列表加载失败'
  },
  {
    file: 'src/views/saas/platform/resource-pack-order/index.vue',
    label: 'platform resource pack order page',
    blockClass: 'saas-resource-pack-order-page__load-error',
    loadFunction: 'loadOrders',
    emptyText: '暂无资源包订单',
    errorText: '资源包订单加载失败'
  }
]

const failures: string[] = []

function readProjectFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

function assertIncludes(source: string, token: string, label: string) {
  if (!source.includes(token)) {
    failures.push(`${label} must include ${token}`)
  }
}

for (const page of pages) {
  const source = readProjectFile(page.file)
  assertIncludes(source, 'const loadError = ref', page.label)
  assertIncludes(source, page.blockClass, page.label)
  assertIncludes(source, '<template #empty>', page.label)
  assertIncludes(source, `<ElEmpty description="${page.emptyText}"`, page.label)
  assertIncludes(source, page.errorText, page.label)
  assertIncludes(source, 'catch (error)', page.label)
  assertIncludes(source, 'ElMessage.error(loadError.value)', page.label)
  assertIncludes(source, `@click="${page.loadFunction}"`, page.label)
}

const checklist = readFileSync(resolve(process.cwd(), '../docs/saas-launch-readiness-checklist.md'), 'utf8')
assertIncludes(checklist, 'verify-saas-ui-state-readiness.ts', 'launch readiness checklist')

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('SaaS UI state readiness verified.')
