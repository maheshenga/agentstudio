import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const webRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))

const files = [
  'src/utils/sys/console.ts',
  'src/views/dashboard/console/modules/about-project.vue',
  'src/views/dashboard/hrm/index.vue',
  'index.html',
  'src/config/index.ts'
]

const forbiddenPatterns = [
  /Fssphp/i,
  /FSSPHP/,
  /FSSADMIN/,
  /phpframe\.org/i,
  /fsscms/i,
  /NovaFrame/i,
  /SpeedThinkphp/i,
  /FSSDB/i,
  /xuey490\/project/i
]

const failures: string[] = []

for (const file of files) {
  const content = readFileSync(resolve(webRoot, file), 'utf8')
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(content)) {
      failures.push(`${file} contains legacy brand pattern ${pattern}`)
    }
  }
}

const consoleContent = readFileSync(resolve(webRoot, 'src/utils/sys/console.ts'), 'utf8')
if (!consoleContent.includes('AgentStudio SaaS')) {
  failures.push('src/utils/sys/console.ts should keep the AgentStudio SaaS console greeting')
}

const aboutProjectContent = readFileSync(
  resolve(webRoot, 'src/views/dashboard/console/modules/about-project.vue'),
  'utf8'
)
for (const expected of ['AgentStudio', 'https://github.com/maheshenga/agentstudio']) {
  if (!aboutProjectContent.includes(expected)) {
    failures.push(`about-project.vue should include ${expected}`)
  }
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('SaaS public brand surfaces verified.')
