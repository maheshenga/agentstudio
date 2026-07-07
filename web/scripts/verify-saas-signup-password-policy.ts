import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  SIGNUP_PASSWORD_MAX_LENGTH,
  SIGNUP_PASSWORD_MESSAGE,
  SIGNUP_PASSWORD_MESSAGE_EN,
  SIGNUP_PASSWORD_MIN_LENGTH,
  isStrongSignupPassword
} from '../src/utils/saas/signup-password-policy'

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message)
  }
}

assert(SIGNUP_PASSWORD_MIN_LENGTH === 8, 'signup password minimum length must be 8')
assert(SIGNUP_PASSWORD_MAX_LENGTH === 100, 'signup password maximum length must be 100')
assert(!isStrongSignupPassword('123456'), 'numeric 6-character password must be rejected')
assert(!isStrongSignupPassword('12345678'), 'numeric-only 8-character password must be rejected')
assert(!isStrongSignupPassword('abcdefgh'), 'letter-only 8-character password must be rejected')
assert(isStrongSignupPassword('abc12345'), 'letter+digit 8-character password must be accepted')
assert(
  SIGNUP_PASSWORD_MESSAGE.includes('8') &&
    SIGNUP_PASSWORD_MESSAGE.includes('字母') &&
    SIGNUP_PASSWORD_MESSAGE.includes('数字'),
  'Chinese signup copy must describe the policy'
)
assert(
  SIGNUP_PASSWORD_MESSAGE_EN.includes('8') &&
    SIGNUP_PASSWORD_MESSAGE_EN.includes('letter') &&
    SIGNUP_PASSWORD_MESSAGE_EN.includes('number'),
  'English signup copy must describe the policy'
)

const signupVue = readFileSync(resolve(process.cwd(), 'src/views/saas/signup/index.vue'), 'utf8')

assert(
  signupVue.includes("from '@/utils/saas/signup-password-policy'"),
  'signup page must import shared password policy'
)
assert(
  !signupVue.includes('PASSWORD_MIN_LENGTH = 6'),
  'signup page must not keep stale 6-character policy'
)
