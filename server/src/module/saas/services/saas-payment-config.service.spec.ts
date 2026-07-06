jest.mock('../../../common/utils/ai-crypto.util', () => ({
  encryptAiSecret: jest.fn((value) => `enc:${value}`),
  decryptAiSecret: jest.fn((value) => String(value).replace(/^enc:/, '')),
  maskAiSecret: jest.fn((value) => `mask:${value}`),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { SaasPaymentConfigEntity } from '../entities/saas-payment-config.entity';
import { SaasPaymentConfigService } from './saas-payment-config.service';

describe('SaasPaymentConfigService', () => {
  let service: SaasPaymentConfigService;

  const repo = {
    create: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    repo.create.mockImplementation((value) => value);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaasPaymentConfigService,
        {
          provide: getRepositoryToken(SaasPaymentConfigEntity),
          useValue: repo,
        },
      ],
    }).compile();

    service = module.get(SaasPaymentConfigService);
  });

  it('reports missing Alipay keys without exposing secret values', async () => {
    repo.findOne.mockResolvedValue({
      provider: 'alipay',
      scope: 'platform',
      enabled: 1,
      appId: '2026070200000001',
      privateKey: '',
      publicKey: '',
      gatewayUrl: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
      notifyUrl: '',
      returnUrl: '',
    });

    await expect(service.getAlipayConfigStatus()).resolves.toMatchObject({
      provider: 'alipay',
      enabled: true,
      configured: false,
      app_id_masked: '2026********0001',
      private_key_configured: false,
      public_key_configured: false,
    });
  });

  it('keeps existing keys when update payload leaves key fields blank', async () => {
    repo.findOne.mockResolvedValue({
      id: 1,
      provider: 'alipay',
      scope: 'platform',
      enabled: 1,
      appId: 'old-app-id',
      privateKey: 'old-private',
      publicKey: 'old-public',
      gatewayUrl: 'old-gateway',
      notifyUrl: 'old-notify',
      returnUrl: 'old-return',
    });
    repo.save.mockImplementation(async (value) => value);

    await service.updateAlipayConfig({
      enabled: true,
      app_id: 'new-app-id',
      private_key: '',
      public_key: '',
      gateway_url: 'new-gateway',
      notify_url: 'new-notify',
      return_url: 'new-return',
    });

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: 'new-app-id',
        privateKey: 'old-private',
        publicKey: 'old-public',
        gatewayUrl: 'new-gateway',
      }),
    );
  });

  it('keeps existing app id when update payload leaves app id blank', async () => {
    repo.findOne.mockResolvedValue({
      id: 1,
      provider: 'alipay',
      scope: 'platform',
      enabled: 1,
      appId: 'old-app-id',
      privateKey: 'old-private',
      publicKey: 'old-public',
      gatewayUrl: 'old-gateway',
      notifyUrl: 'old-notify',
      returnUrl: 'old-return',
    });
    repo.save.mockImplementation(async (value) => value);

    await service.updateAlipayConfig({
      enabled: true,
      app_id: '',
      gateway_url: 'new-gateway',
      notify_url: 'new-notify',
      return_url: 'new-return',
    });

    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ appId: 'old-app-id' }));
  });

  it('encrypts Alipay private and public keys before saving them', async () => {
    repo.findOne.mockResolvedValue(null);
    repo.save.mockImplementation(async (value) => value);

    await service.updateAlipayConfig({
      enabled: true,
      app_id: 'app-id',
      private_key: 'plain-private',
      public_key: 'plain-public',
      gateway_url: 'gateway',
      notify_url: 'notify',
      return_url: 'return',
    });

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        privateKey: 'enc:plain-private',
        publicKey: 'enc:plain-public',
      }),
    );
  });

  it('decrypts encrypted Alipay keys only when resolving runtime config', async () => {
    repo.findOne.mockResolvedValue({
      provider: 'alipay',
      scope: 'platform',
      enabled: 1,
      appId: 'app-id',
      privateKey: 'enc:plain-private',
      publicKey: 'enc:plain-public',
      gatewayUrl: 'gateway',
      notifyUrl: 'notify',
      returnUrl: 'return',
    });

    await expect(service.resolveAlipayConfig()).resolves.toMatchObject({
      privateKey: 'plain-private',
      publicKey: 'plain-public',
    });
  });

  it('resolves null when no database config row exists', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(service.resolveAlipayConfig()).resolves.toBeNull();
  });
});
