import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const expectations: Record<string, string[]> = {
  'src/views/app-center/marketplace/index.vue': ['应用市场', '查看详情', '升级应用'],
  'src/views/app-center/installed/index.vue': ['已安装应用', '权限设置', '卸载'],
  'src/views/app-center/open/index.vue': ['应用无法打开', '返回', '重试'],
  'src/views/app-center/orders/index.vue': ['应用订单', '订单号', '继续支付'],
  'src/views/app-center/usage/index.vue': ['应用使用情况', '打开趋势', '最近失败'],
  'src/views/app-center/developer-runtime/index.vue': ['服务运行监控', '调用次数', '脱敏日志'],
  'src/views/app-center/developer-revenue/index.vue': ['开发者收入', '应用收入', '结算记录']
}

const forbidden = [
  'Installed Apps',
  'App cannot be opened',
  'App Orders',
  'App Usage',
  'Service Observability',
  'Developer Revenue'
]
const failures: string[] = []

for (const [path, tokens] of Object.entries(expectations)) {
  const source = readFileSync(resolve(process.cwd(), path), 'utf8')
  for (const token of tokens) {
    if (!source.includes(token)) failures.push(`${path} must include ${token}`)
  }
  for (const token of forbidden) {
    if (source.includes(token)) failures.push(`${path} must not include ${token}`)
  }
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('App center localization verified.')
