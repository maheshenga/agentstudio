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

  it('resolves null when no database config row exists', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(service.resolveAlipayConfig()).resolves.toBeNull();
  });
});
