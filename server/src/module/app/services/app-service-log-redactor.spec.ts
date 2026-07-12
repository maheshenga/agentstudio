import { AppServiceLogRedactor } from './app-service-log-redactor';

describe('AppServiceLogRedactor', () => {
  const service = new AppServiceLogRedactor();

  it('redacts credentials, tokens, cookies, URLs, and registered runtime secrets', () => {
    const runtimeSecret = 'runtime-secret-value-123';
    const jwt =
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.abcdefghijklmnopqrstuvwxyz0123456789';
    const value = [
      'Authorization: Bearer bearer-token-value',
      `jwt=${jwt}`,
      '{"password":"db-pass","access_token":"access-value","cookie":"sid=abc"}',
      'https://admin:password@example.com/private',
      'Set-Cookie: session=private; HttpOnly',
      `runtime=${runtimeSecret}`,
    ].join('\n');

    const redacted = service.redact(value, [runtimeSecret]);

    for (const secret of [
      'bearer-token-value',
      jwt,
      'db-pass',
      'access-value',
      'sid=abc',
      'admin:password',
      'session=private',
      runtimeSecret,
    ]) {
      expect(redacted).not.toContain(secret);
    }
    expect(redacted).toContain('[REDACTED]');
  });

  it('limits each stream to the newest 200 lines and 64 kilobytes', () => {
    const input = Array.from({ length: 260 }, (_, index) => `${index}:${'x'.repeat(500)}`).join(
      '\n',
    );

    const result = service.redactStreams({ stdout: input, stderr: input });

    for (const value of [result.stdout, result.stderr]) {
      expect(value.split('\n').length).toBeLessThanOrEqual(200);
      expect(Buffer.byteLength(value, 'utf8')).toBeLessThanOrEqual(64 * 1024);
      expect(value).toContain('259:');
      expect(value.split('\n').some((line) => line.startsWith('0:'))).toBe(false);
    }
  });

  it('does not expose secret values supplied more than once or as regex-like text', () => {
    const result = service.redact('a+b*c a+b*c', ['a+b*c', 'a+b*c']);

    expect(result).toBe('[REDACTED] [REDACTED]');
  });
});
