import { BadRequestException } from '@nestjs/common';

import {
  APP_RUNTIME_CAPABILITIES,
  normalizeApprovedCapabilities,
  normalizeRuntimeCapabilities,
} from './app-runtime.constants';

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
      'service.invoke',
    ]);
  });

  it('rejects capabilities that the selected runtime cannot execute', () => {
    expect(normalizeRuntimeCapabilities('service', ['context.read'])).toEqual(['context.read']);
    expect(() => normalizeRuntimeCapabilities('iframe', ['service.invoke'])).toThrow(
      'Capability service.invoke is not available for iframe apps',
    );
    expect(() => normalizeRuntimeCapabilities('service', ['kv.read'])).toThrow(
      'Capability kv.read is not available for service apps',
    );
    expect(() => normalizeRuntimeCapabilities('native', ['context.read'])).toThrow(
      'Capability context.read is not available for native apps',
    );
  });

  it('deduplicates and sorts approved capabilities while rejecting unknown values', () => {
    expect(normalizeApprovedCapabilities(['kv.write', 'context.read', 'kv.write'])).toEqual([
      'context.read',
      'kv.write',
    ]);
    expect(() => normalizeApprovedCapabilities(['database.raw'])).toThrow(BadRequestException);
  });
});
