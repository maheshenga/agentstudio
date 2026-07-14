import { validate } from 'class-validator';

import { SaasPlanQuotaDto } from './update-saas-plan-quotas.dto';

describe('SaasPlanQuotaDto', () => {
  it.each(['storage_mb', 'rag_documents'])('rejects unenforced %s quotas', async (quotaType) => {
    const dto = Object.assign(new SaasPlanQuotaDto(), { quota_type: quotaType, total_quota: 100 });

    await expect(validate(dto)).resolves.toEqual([expect.objectContaining({ property: 'quota_type' })]);
  });
});
