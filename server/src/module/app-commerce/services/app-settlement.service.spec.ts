import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { AppRevenueLedgerEntity } from '../entities/app-revenue-ledger.entity';
import { AppSettlementBatchEntity } from '../entities/app-settlement-batch.entity';
import { AppSettlementService } from './app-settlement.service';

describe('AppSettlementService', () => {
  const batchRepo = { findAndCount: jest.fn() };
  const ledgerRepo = { find: jest.fn() };
  const txBatchRepo = { create: jest.fn(), findOne: jest.fn(), save: jest.fn() };
  const txLedgerRepo = { find: jest.fn(), update: jest.fn() };
  const manager = { getRepository: jest.fn() };
  const dataSource = { transaction: jest.fn() };
  let service: AppSettlementService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-07-13T08:00:00.000Z'));
    txBatchRepo.create.mockImplementation((value) => value);
    txBatchRepo.save.mockImplementation(async (value) => ({ id: value.id || 51, ...value }));
    txBatchRepo.findOne.mockResolvedValue(null);
    txLedgerRepo.find.mockResolvedValue([
      createLedger({ id: 91, eventType: 'charge', grossAmountCents: 9900, developerAmountCents: 6930 }),
      createLedger({
        id: 92,
        eventKey: 'refund:AO20260601000000001000001',
        eventType: 'refund',
        grossAmountCents: -9900,
        platformAmountCents: -2970,
        developerAmountCents: -6930,
      }),
    ]);
    txLedgerRepo.update.mockResolvedValue({ affected: 2 });
    manager.getRepository.mockImplementation((entity) => {
      if (entity === AppSettlementBatchEntity) return txBatchRepo;
      if (entity === AppRevenueLedgerEntity) return txLedgerRepo;
      throw new Error(`Unexpected repository ${entity?.name}`);
    });
    dataSource.transaction.mockImplementation(async (callback) => callback(manager));
    service = new AppSettlementService(
      batchRepo as any,
      ledgerRepo as any,
      dataSource as unknown as DataSource,
    );
  });

  afterEach(() => jest.useRealTimers());

  it('claims only unsettled rows inside one closed period for one developer', async () => {
    const result = await service.createBatch(17, '2026-06', 9);

    expect(txLedgerRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          developerId: 17,
          settlementBatchId: expect.any(Object),
          createTime: expect.any(Object),
        }),
        lock: { mode: 'pessimistic_write' },
        order: { id: 'ASC' },
      }),
    );
    expect(txBatchRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        developerId: 17,
        periodStart: '2026-06-01',
        periodEnd: '2026-06-30',
        grossAmountCents: 9900,
        refundAmountCents: 9900,
        developerAmountCents: 0,
        ledgerCount: 2,
        status: 'draft',
      }),
    );
    expect(txLedgerRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.any(Object), settlementBatchId: expect.any(Object) }),
      { settlementBatchId: 51 },
    );
    expect(result).toMatchObject({ id: 51, status: 'draft' });
  });

  it('rejects current or future settlement periods', async () => {
    await expect(service.createBatch(17, '2026-07', 9)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.createBatch(17, '2026-08', 9)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('allows draft to approved to paid and rejects backward transitions', async () => {
    const draft = createBatch({ status: 'draft' });
    txBatchRepo.findOne.mockResolvedValueOnce(draft);
    await expect(service.approveBatch(51, 9, 'Reviewed')).resolves.toMatchObject({
      status: 'approved',
      reviewed_by: 9,
    });

    const approved = createBatch({ status: 'approved' });
    txBatchRepo.findOne.mockResolvedValueOnce(approved);
    await expect(service.markPaid(51, 10, 'BANK-20260713-1')).resolves.toMatchObject({
      status: 'paid',
      paid_by: 10,
      payment_reference: 'BANK-20260713-1',
    });

    txBatchRepo.findOne.mockResolvedValueOnce(createBatch({ status: 'paid' }));
    await expect(service.approveBatch(51, 9, 'Backward')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    txBatchRepo.findOne.mockResolvedValueOnce(createBatch({ status: 'draft' }));
    await expect(service.markPaid(51, 9, 'BANK-2')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires a bounded payment reference and performs no automated payout', async () => {
    await expect(service.markPaid(51, 9, '')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.markPaid(51, 9, 'X'.repeat(101))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects marking a non-positive developer settlement as paid', async () => {
    txBatchRepo.findOne.mockResolvedValue(
      createBatch({ status: 'approved', developerAmountCents: -6930 }),
    );

    await expect(service.markPaid(51, 9, 'BANK-NEGATIVE')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(txBatchRepo.save).not.toHaveBeenCalled();
  });

  it('scopes developer settlement history and returns only developer-safe fields', async () => {
    batchRepo.findAndCount.mockResolvedValue([[createBatch({ status: 'paid' })], 1]);
    ledgerRepo.find.mockResolvedValue([createLedger({ settlementBatchId: 51 })]);

    const result = await service.listDeveloperSettlements(17, {});

    expect(batchRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ developerId: 17 }) }),
    );
    expect(result.list).toEqual([
      expect.objectContaining({
        period_start: '2026-06-01',
        period_end: '2026-06-30',
        gross_amount_cents: 9900,
        developer_amount_cents: 6930,
        order_count: 1,
        status: 'paid',
      }),
    ]);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('developer_id');
    expect(serialized).not.toContain('payment_reference');
    expect(serialized).not.toContain('reviewed_by');
    expect(serialized).not.toContain('ledger_count');
    expect(serialized).not.toContain('update_time');
  });

  it('cancels a draft only after every claimed ledger row is released', async () => {
    txBatchRepo.findOne.mockResolvedValue(createBatch({ status: 'draft', ledgerCount: 2 }));
    txLedgerRepo.update.mockResolvedValueOnce({ affected: 2 });

    await expect(service.cancelBatch(51, 9, 'Rebuild settlement')).resolves.toMatchObject({
      status: 'cancelled',
      note: 'Rebuild settlement',
    });
    expect(txLedgerRepo.update).toHaveBeenCalledWith(
      { settlementBatchId: 51 },
      { settlementBatchId: null },
    );

    txBatchRepo.findOne.mockResolvedValue(createBatch({ status: 'draft', ledgerCount: 2 }));
    txLedgerRepo.update.mockResolvedValueOnce({ affected: 1 });
    await expect(service.cancelBatch(51, 9, 'Incomplete release')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

function createLedger(overrides: Partial<AppRevenueLedgerEntity> = {}): AppRevenueLedgerEntity {
  return {
    id: 91,
    eventKey: 'charge:AO20260601000000001000001',
    eventType: 'charge',
    orderId: 31,
    licenseId: 41,
    tenantId: 23,
    appId: 7,
    developerId: 17,
    grossAmountCents: 9900,
    platformAmountCents: 2970,
    developerAmountCents: 6930,
    currency: 'CNY',
    settlementBatchId: null,
    createdBy: 9,
    note: '',
    createTime: new Date('2026-06-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createBatch(overrides: Partial<AppSettlementBatchEntity> = {}): AppSettlementBatchEntity {
  return {
    id: 51,
    batchNo: 'AS20260617000001',
    developerId: 17,
    periodStart: '2026-06-01',
    periodEnd: '2026-06-30',
    grossAmountCents: 9900,
    refundAmountCents: 0,
    developerAmountCents: 6930,
    ledgerCount: 1,
    status: 'draft',
    paymentReference: '',
    note: '',
    ...overrides,
  };
}
