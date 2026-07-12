import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { DeveloperCertificationListDto } from './app-developer-certification.dto';

describe('Developer certification DTOs', () => {
  it('converts disabled query strings to booleans', async () => {
    const disabled = plainToInstance(DeveloperCertificationListDto, { disabled: 'false' });

    await expect(validate(disabled)).resolves.toHaveLength(0);
    expect(disabled.disabled).toBe(false);
  });
});
