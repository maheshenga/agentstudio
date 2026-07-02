import { getMetadataArgsStorage } from 'typeorm';

import { LoginLogEntity } from './loginlog/entities/loginlog.entity';
import { OperLogEntity } from './operlog/entities/operlog.entity';

describe('monitor log username columns', () => {
  it('match the system user username length', () => {
    const storage = getMetadataArgsStorage();

    const operUsername = storage.columns.find((column) => column.target === OperLogEntity && column.propertyName === 'username');
    const loginUsername = storage.columns.find((column) => column.target === LoginLogEntity && column.propertyName === 'username');

    expect(operUsername?.options.length).toBe(64);
    expect(loginUsername?.options.length).toBe(64);
  });
});
