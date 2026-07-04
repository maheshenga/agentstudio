import { AUTH_RATE_LIMITS } from './auth-rate-limit.config';

describe('AUTH_RATE_LIMITS', () => {
  it('uses independent limits for login, signup, and tenant lookup', () => {
    expect(AUTH_RATE_LIMITS.login).not.toBe(AUTH_RATE_LIMITS.signup);
    expect(AUTH_RATE_LIMITS.login).not.toBe(AUTH_RATE_LIMITS.tenantLookup);
    expect(AUTH_RATE_LIMITS.signup).not.toBe(AUTH_RATE_LIMITS.tenantLookup);
    expect(AUTH_RATE_LIMITS.tenantLookup.max).toBeGreaterThan(AUTH_RATE_LIMITS.login.max);
    expect(AUTH_RATE_LIMITS.signup.max).toBeLessThan(AUTH_RATE_LIMITS.tenantLookup.max);
  });
});
