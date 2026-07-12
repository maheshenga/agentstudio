import { BadRequestException } from '@nestjs/common';

import { APP_RUNTIME_CAPABILITIES, normalizeApprovedCapabilities } from './app-runtime.constants';

describe('app runtime capability contract', () => {
  it('exposes the complete P9-C capability allowlist in stable order', () => {
    expect(APP_RUNTIME_CAPABILITIES).toEqual([
      'context.read',
      'kv.read',
      'kv.write',
      'kv.delete',
      'files.read',
      'files.write',
      'http.request',
      'webhook.emit',
    ]);
  });

  it('deduplicates and sorts approved capabilities while rejecting unknown values', () => {
    expect(normalizeApprovedCapabilities(['kv.write', 'context.read', 'kv.write'])).toEqual([
      'context.read',
      'kv.write',
    ]);
    expect(() => normalizeApprovedCapabilities(['database.raw'])).toThrow(BadRequestException);
  });
});
