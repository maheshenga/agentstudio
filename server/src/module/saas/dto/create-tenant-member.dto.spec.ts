import { validate } from 'class-validator';

import { CreateTenantMemberDto } from './create-tenant-member.dto';

describe('CreateTenantMemberDto', () => {
  it('rejects weak member credentials and invalid optional contact fields', async () => {
    const dto = Object.assign(new CreateTenantMemberDto(), {
      username: 'bad user',
      password: '123456',
      phone: 'abc',
      email: 'bad-email',
      role: 'admin',
    });

    const errors = await validate(dto);
    const properties = errors.map((error) => error.property);

    expect(properties).toEqual(expect.arrayContaining(['username', 'password', 'phone', 'email']));
  });

  it('accepts strong member credentials with blank optional email', async () => {
    const dto = Object.assign(new CreateTenantMemberDto(), {
      username: 'member_01',
      password: 'Secret123',
      phone: '+1 415-555-0101',
      email: '',
      role: 'member',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
