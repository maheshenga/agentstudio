import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const failures: string[] = []
const webRoot = process.cwd()

type ReadableCopyExpectation = {
  file: string
  label: string
  expectedReadable: string[]
}

const mojibakeMarkers = ['鐧', '绉', '鏆', '鍔', '璇', '涓', '槸', '澶']

const criticalFiles: ReadableCopyExpectation[] = [
  {
    file: 'src/views/auth/login/index.vue',
    label: 'login page',
    expectedReadable: ['注册成功']
  },
  {
    file: 'src/locales/langs/zh.json',
    label: 'Chinese login locale',
    expectedReadable: [
      '请选择租户',
      '请先输入账号',
      '请先输入密码',
      '正在查询可用租户',
      '未找到可用租户',
      '租户查询失败，请重试'
    ]
  },
  {
    file: 'src/locales/langs/en.json',
    label: 'English login locale',
    expectedReadable: [
      'Select a tenant',
      'Enter your account first',
      'Enter your password first',
      'Looking up available tenants',
      'No available tenants found',
      'Tenant lookup failed. Please retry'
    ]
  },
  {
    file: 'src/views/saas/signup/index.vue',
    label: 'saas signup page',
    expectedReadable: ['创建租户账号', '租户名称', '注册成功']
  },
  {
    file: 'src/views/saas/tenant/usage/index.vue',
    label: 'tenant usage page',
    expectedReadable: ['用量中心', '暂无额度流水', '刷新']
  },
  {
    file: 'src/views/saas/tenant/plan/index.vue',
    label: 'tenant plan page',
    expectedReadable: ['当前套餐', '订单记录', '支付宝']
  },
  {
    file: 'src/views/saas/tenant/modules/index.vue',
    label: 'tenant modules page',
    expectedReadable: ['查看原因', '当前租户未启用该系统模块', '租户模块加载失败']
  },
  {
    file: 'src/views/saas/tenant/member/index.vue',
    label: 'tenant member page',
    expectedReadable: ['成员管理', '添加成员', '重置密码']
  },
  {
    file: 'src/views/saas/tenant/resource-pack/index.vue',
    label: 'tenant resource pack page',
    expectedReadable: ['资源包', '订单记录', '支付宝']
  },
  {
    file: 'src/views/saas/platform/usage/index.vue',
    label: 'platform usage page',
    expectedReadable: ['SaaS Usage', 'Payment reconciliation', 'Recent payment callbacks', 'Scan']
  },
  {
    file: 'src/views/saas/platform/payment-config/index.vue',
    label: 'platform payment config page',
    expectedReadable: ['支付宝配置', '保存配置', '网关地址']
  }
]

function readWebFile(path: string) {
  const fullPath = resolve(webRoot, path)
  if (!existsSync(fullPath)) {
    failures.push(`${path} must exist`)
    return ''
  }
  return readFileSync(fullPath, 'utf8')
}

function assertIncludes(source: string, token: string, label: string) {
  if (!source.includes(token)) {
    failures.push(`${label} must include readable copy: ${token}`)
  }
}

for (const item of criticalFiles) {
  const source = readWebFile(item.file)
  for (const marker of mojibakeMarkers) {
    if (source.includes(marker)) {
      failures.push(`${item.label} must not contain mojibake marker ${marker}`)
    }
  }
  for (const token of item.expectedReadable) {
    assertIncludes(source, token, item.label)
  }
}

const checklist = readWebFile('../docs/saas-launch-readiness-checklist.md')
assertIncludes(checklist, 'verify-saas-visible-copy-encoding.ts', 'launch readiness checklist')

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('SaaS visible copy encoding verified.')
