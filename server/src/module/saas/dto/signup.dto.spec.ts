import { validate } from 'class-validator';

import { SaasSignupDto } from './signup.dto';

describe('SaasSignupDto', () => {
  it('requires phone and email for public SaaS signup', async () => {
    const dto = Object.assign(new SaasSignupDto(), {
      username: 'founder',
      password: 'Secret123!',
      tenant_name: 'Acme AI',
    });

    const errors = await validate(dto);
    const properties = errors.map((error) => error.property);

    expect(properties).toEqual(expect.arrayContaining(['phone', 'email']));
  });
});
