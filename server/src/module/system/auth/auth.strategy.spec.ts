import { ConfigService } from '@nestjs/config';
import { AuthStrategy } from './auth.strategy';

describe('AuthStrategy JWT secret configuration', () => {
  const config = (values: Record<string, unknown>) =>
    ({
      get: jest.fn((key: string) => values[key]),
    }) as unknown as ConfigService;

  const redisService = {
    get: jest.fn(),
  };

  it('uses jwt.secret when configured', () => {
    expect(() => new AuthStrategy(config({ 'jwt.secret': 'safe-secret' }), redisService as any)).not.toThrow();
  });

  it('uses legacy jwt.secretkey when jwt.secret is absent', () => {
    expect(() => new AuthStrategy(config({ 'jwt.secretkey': 'legacy-secret' }), redisService as any)).not.toThrow();
  });

  it('fails fast when no jwt secret is configured', () => {
    expect(() => new AuthStrategy(config({}), redisService as any)).toThrow('JWT secret is not configured');
  });
});
