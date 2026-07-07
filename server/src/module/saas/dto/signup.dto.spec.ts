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

  it('rejects weak signup credentials and invalid contact fields', async () => {
    const dto = Object.assign(new SaasSignupDto(), {
      username: 'bad user',
      password: '123456',
      tenant_name: '',
      phone: 'abc',
      email: 'founder@example.com',
    });

    const errors = await validate(dto);
    const properties = errors.map((error) => error.property);

    expect(properties).toEqual(expect.arrayContaining(['username', 'password', 'tenant_name', 'phone']));
  });

  it('accepts strong signup credentials and normalized contact fields', async () => {
    const dto = Object.assign(new SaasSignupDto(), {
      username: 'founder_01',
      password: 'Secret123',
      tenant_name: 'Acme AI',
      phone: '+1 415-555-0100',
      email: 'founder@example.com',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
