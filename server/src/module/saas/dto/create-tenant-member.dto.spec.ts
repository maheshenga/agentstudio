import { validate } from 'class-validator';

import {
  ChangeTenantMemberRoleDto,
  CreateTenantMemberDto,
  ResetTenantMemberPasswordDto,
  UpdateTenantMemberStatusDto,
} from './create-tenant-member.dto';

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

  it('validates tenant member mutation payloads', async () => {
    const invalidRole = Object.assign(new ChangeTenantMemberRoleDto(), { role: 'owner' });
    const invalidStatus = Object.assign(new UpdateTenantMemberStatusDto(), { status: 2 });
    const weakPassword = Object.assign(new ResetTenantMemberPasswordDto(), { password: '123456' });

    await expect(validate(invalidRole)).resolves.toEqual([
      expect.objectContaining({ property: 'role' }),
    ]);
    await expect(validate(invalidStatus)).resolves.toEqual([
      expect.objectContaining({ property: 'status' }),
    ]);
    await expect(validate(weakPassword)).resolves.toEqual([
      expect.objectContaining({ property: 'password' }),
    ]);
  });

  it('accepts valid tenant member mutation payloads', async () => {
    await expect(validate(Object.assign(new ChangeTenantMemberRoleDto(), { role: 'admin' }))).resolves.toHaveLength(0);
    await expect(validate(Object.assign(new UpdateTenantMemberStatusDto(), { status: 0 }))).resolves.toHaveLength(0);
    await expect(
      validate(Object.assign(new ResetTenantMemberPasswordDto(), { password: 'Secret123' })),
    ).resolves.toHaveLength(0);
  });
});
