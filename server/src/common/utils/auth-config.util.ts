export const LOGIN_CAPTCHA_ENABLED_ENV = 'LOGIN_CAPTCHA_ENABLED';

export function isLoginCaptchaEnabled(): boolean {
  return String(process.env[LOGIN_CAPTCHA_ENABLED_ENV] ?? 'true').toLowerCase() !== 'false';
}
