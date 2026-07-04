const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

const commonAuthRateLimitOptions = {
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  standardHeaders: true,
  legacyHeaders: false,
};

export const AUTH_RATE_LIMITS = {
  login: {
    ...commonAuthRateLimitOptions,
    max: 60,
  },
  signup: {
    ...commonAuthRateLimitOptions,
    max: 30,
  },
  tenantLookup: {
    ...commonAuthRateLimitOptions,
    max: 240,
  },
} as const;
