export const SIGNUP_PASSWORD_MIN_LENGTH = 8
export const SIGNUP_PASSWORD_MAX_LENGTH = 100
export const SIGNUP_PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,100}$/
export const SIGNUP_PASSWORD_MESSAGE = '密码长度需在 8 到 100 个字符之间，且必须包含字母和数字'
export const SIGNUP_PASSWORD_MESSAGE_EN =
  'Password must be 8 to 100 characters and include at least one letter and one number'

export function isStrongSignupPassword(password: string) {
  return SIGNUP_PASSWORD_PATTERN.test(String(password || ''))
}
