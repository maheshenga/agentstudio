import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppServiceProcessManager } from './app-service-process-manager';
import {
  AppServiceRuntimeDriver,
  type AppServiceRuntimeDriverName,
} from './app-service-runtime-driver';

export const APP_SERVICE_PODMAN_RUNTIME_DRIVER = Symbol('APP_SERVICE_PODMAN_RUNTIME_DRIVER');

@Injectable()
export class AppServiceRuntimeDriverRegistry {
  constructor(
    private readonly configService: ConfigService,
    private readonly pm2Driver: AppServiceProcessManager,
    @Inject(APP_SERVICE_PODMAN_RUNTIME_DRIVER)
    private readonly podmanDriver: AppServiceRuntimeDriver,
  ) {}

  configuredName(): AppServiceRuntimeDriverName {
    const value = String(
      this.configService.get<string>('appMarketplace.serviceRuntime.driver') || 'pm2',
    )
      .trim()
      .toLowerCase();
    if (value !== 'pm2' && value !== 'podman') {
      throw new ServiceUnavailableException('Unsupported service runtime driver');
    }
    return value;
  }

  forNewInstance(): AppServiceRuntimeDriver {
    const name = this.configuredName();
    const appEnv = String(this.configService.get<string>('app.env') || 'development').toLowerCase();
    if (appEnv === 'production' && name !== 'podman') {
      throw new ServiceUnavailableException('Production service runtime requires Podman isolation');
    }
    return this.forInstance(name);
  }

  forInstance(name: AppServiceRuntimeDriverName): AppServiceRuntimeDriver {
    if (name === 'pm2') return this.pm2Driver;
    if (name === 'podman') return this.podmanDriver;
    throw new ServiceUnavailableException('Unsupported service runtime driver');
  }
}
