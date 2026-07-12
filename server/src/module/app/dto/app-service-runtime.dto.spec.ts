import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import {
  AppServiceLogQueryDto,
  AppServiceProbeDto,
  AppServiceReasonDto,
  AppServiceRuntimeListQueryDto,
} from './app-service-runtime.dto';

describe('App service runtime DTOs', () => {
  it('requires bounded audit reasons for stop and rollback', async () => {
    await expect(validate(plainToInstance(AppServiceReasonDto, { reason: '' }))).resolves.not.toEqual(
      [],
    );
    await expect(
      validate(plainToInstance(AppServiceReasonDto, { reason: 'restore stable release' })),
    ).resolves.toEqual([]);
  });

  it('bounds log lines to 1..200 and transforms query strings', async () => {
    const valid = plainToInstance(AppServiceLogQueryDto, { lines: '100' });
    expect(valid.lines).toBe(100);
    await expect(validate(valid)).resolves.toEqual([]);
    await expect(
      validate(plainToInstance(AppServiceLogQueryDto, { lines: '201' })),
    ).resolves.not.toEqual([]);
  });

  it('allows only a JSON object payload up to 64 kilobytes', async () => {
    await expect(
      validate(plainToInstance(AppServiceProbeDto, { payload: { ping: true } })),
    ).resolves.toEqual([]);
    await expect(
      validate(plainToInstance(AppServiceProbeDto, { payload: 'not-an-object' })),
    ).resolves.not.toEqual([]);
    await expect(
      validate(
        plainToInstance(AppServiceProbeDto, { payload: { value: 'x'.repeat(64 * 1024) } }),
      ),
    ).resolves.not.toEqual([]);
  });

  it('rejects unknown runtime list enum filters', async () => {
    await expect(
      validate(plainToInstance(AppServiceRuntimeListQueryDto, { role: 'owner' })),
    ).resolves.not.toEqual([]);
  });
});
