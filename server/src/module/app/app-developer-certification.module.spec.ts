import { MODULE_METADATA } from '@nestjs/common/constants';

import { AppDeveloperCertificationController } from './app-developer-certification.controller';
import { AppDeveloperProfileController } from './app-developer-profile.controller';
import { AppMarketplaceModule } from './app.module';
import { AppDeveloperCertificationService } from './services/app-developer-certification.service';

describe('AppMarketplaceModule developer certification registration', () => {
  it('registers certification controllers and service', () => {
    const controllers = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AppMarketplaceModule);
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AppMarketplaceModule);

    expect(controllers).toEqual(
      expect.arrayContaining([
        AppDeveloperProfileController,
        AppDeveloperCertificationController,
      ]),
    );
    expect(providers).toContain(AppDeveloperCertificationService);
  });
});
