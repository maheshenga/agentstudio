import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message)
  }
}

const signupSource = readFileSync(resolve(process.cwd(), 'src/views/saas/signup/index.vue'), 'utf8')
const loginSource = readFileSync(resolve(process.cwd(), 'src/views/auth/login/index.vue'), 'utf8')

assert(signupSource.includes("signup_success: '1'"), 'signup success route must include signup_success query flag')
assert(signupSource.includes('username: formData.username.trim()'), 'signup success route must pass trimmed username')
assert(loginSource.includes('const route = useRoute()'), 'login page must read current route')
assert(loginSource.includes('route.query.signup_success'), 'login page must check signup_success query flag')
assert(loginSource.includes('<ElAlert'), 'login page must render signup success alert')
assert(loginSource.includes('formData.username = signupUsername'), 'login page must prefill username from signup query')
