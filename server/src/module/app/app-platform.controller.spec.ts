import * as fs from 'fs';
import * as path from 'path';

import { TenantContext } from '../../common/tenant/tenant.context';
import { AppPlatformController } from './app-platform.controller';
import { AppPlatformService } from './services/app-platform.service';

describe('AppPlatformController service uploads', () => {
  const service = { uploadServiceVersion: jest.fn() };
  let controller: AppPlatformController;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(TenantContext, 'run').mockImplementation((_, callback) => callback() as any);
    controller = new AppPlatformController(service as unknown as AppPlatformService);
  });

  afterEach(() => jest.restoreAllMocks());

  it('uploads service ZIPs for the authenticated platform operator', async () => {
    const file = { buffer: Buffer.from('zip'), size: 3 } as Express.Multer.File;
    service.uploadServiceVersion.mockResolvedValue({
      version: '1.0.0',
      review_status: 'pending',
      scan_result: { passed: true },
    });

    await controller.uploadServiceVersion('admin_echo_service', file, { userId: 9 } as any);

    expect(service.uploadServiceVersion).toHaveBeenCalledWith('admin_echo_service', file, 9);
    expect(Reflect.getMetadata('requirePermission', controller.uploadServiceVersion)).toEqual([
      'app:runtime:manage',
    ]);
  });

  it('declares a fixed multipart file-size limit for service uploads', () => {
    const source = fs.readFileSync(path.join(__dirname, 'app-platform.controller.ts'), 'utf8');
    expect(source).toMatch(
      /service-upload[\s\S]*FileInterceptor\('file',[\s\S]*fileSize:\s*50\s*\*\s*1024\s*\*\s*1024/,
    );
  });
});
