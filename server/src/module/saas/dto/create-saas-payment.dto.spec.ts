import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

describe('CreateSaasPaymentDto', () => {
  it('declares runtime validation for order number and order type', () => {
    const dtoPath = join(__dirname, 'create-saas-payment.dto.ts');

    expect(existsSync(dtoPath)).toBe(true);
    const source = readFileSync(dtoPath, 'utf8');
    expect(source).toContain('export class CreateSaasPaymentDto');
    expect(source).toContain('@IsNotEmpty()');
    expect(source).toContain("@IsIn(['plan', 'resource_pack', 'app'])");
  });
});
