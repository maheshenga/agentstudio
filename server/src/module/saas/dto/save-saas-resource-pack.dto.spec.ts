import { validate } from 'class-validator';

import { SaveSaasResourcePackDto, UpdateSaasResourcePackStatusDto } from './save-saas-resource-pack.dto';

describe('SaveSaasResourcePackDto', () => {
  it('rejects blank names and invalid platform resource pack fields', async () => {
    const invalidPack = Object.assign(new SaveSaasResourcePackDto(), {
      code: 'Tokens 1M',
      name: '',
      resource_type: 'unknown',
      quota_amount: 0,
      price_cents: -1,
      status: 2,
      sort: -1,
    });
    const invalidStatus = Object.assign(new UpdateSaasResourcePackStatusDto(), { status: 3 });

    const errors = await validate(invalidPack);
    const properties = errors.map((error) => error.property);

    expect(properties).toEqual(
      expect.arrayContaining(['code', 'name', 'resource_type', 'quota_amount', 'price_cents', 'status', 'sort']),
    );
    await expect(validate(invalidStatus)).resolves.toEqual([expect.objectContaining({ property: 'status' })]);
  });

  it('accepts a valid platform resource pack payload', async () => {
    const dto = Object.assign(new SaveSaasResourcePackDto(), {
      code: 'tokens_1m',
      name: 'Tokens 1M',
      resource_type: 'tokens',
      quota_amount: 1000000,
      price_cents: 19900,
      currency: 'CNY',
      status: 1,
      sort: 20,
      remark: 'Adds 1M tokens',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    await expect(validate(Object.assign(new UpdateSaasResourcePackStatusDto(), { status: 0 }))).resolves.toHaveLength(0);
  });

  it('rejects storage and RAG resource packs until those quotas are enforced', async () => {
    const base = {
      code: 'unenforced_pack',
      name: 'Unenforced Pack',
      quota_amount: 100,
      price_cents: 1000,
    };

    await expect(
      validate(Object.assign(new SaveSaasResourcePackDto(), base, { resource_type: 'storage_mb' })),
    ).resolves.toEqual([expect.objectContaining({ property: 'resource_type' })]);
    await expect(
      validate(Object.assign(new SaveSaasResourcePackDto(), base, { resource_type: 'rag_documents' })),
    ).resolves.toEqual([expect.objectContaining({ property: 'resource_type' })]);
  });
});
