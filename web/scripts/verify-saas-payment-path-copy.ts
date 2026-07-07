import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message)
  }
}

const resourcePackSource = readFileSync(resolve(process.cwd(), 'src/views/saas/tenant/resource-pack/index.vue'), 'utf8')

for (const token of [
  'fetchAlipayConfigStatus',
  'type AlipayConfigStatus',
  'const alipayConfigStatus = ref<AlipayConfigStatus | null>(null)',
  'const alipayMissingKeysText = computed',
  '支付宝已配置',
  '支付宝未配置',
  '缺少：',
  'tenant-resource-pack-page__payment-status'
]) {
  assert(resourcePackSource.includes(token), `resource pack payment page must include token: ${token}`)
}
