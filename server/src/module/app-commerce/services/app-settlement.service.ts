import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import {
  And,
  DataSource,
  FindOptionsWhere,
  In,
  IsNull,
  LessThan,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';

import type { AppSettlementListQueryDto } from '../dto/app-settlement.dto';
import { AppRevenueLedgerEntity } from '../entities/app-revenue-ledger.entity';
import {
  AppSettlementBatchEntity,
  type AppSettlementStatus,
} from '../entities/app-settlement-batch.entity';

@Injectable()
export class AppSettlementService {
  constructor(
    @InjectRepository(AppSettlementBatchEntity)
    private readonly batchRepo: Repository<AppSettlementBatchEntity>,
    @InjectRepository(AppRevenueLedgerEntity)
    private readonly ledgerRepo: Repository<AppRevenueLedgerEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async createBatch(developerId: number, period: string, operatorId: number) {
    this.requirePositiveId(developerId, 'Developer');
    this.requirePositiveId(operatorId, 'Operator');
    const range = this.closedPeriod(period);
    return this.dataSource.transaction(async (manager) => {
      const batchRepo = manager.getRepository(AppSettlementBatchEntity);
      const ledgerRepo = manager.getRepository(AppRevenueLedgerEntity);
      const existing = await batchRepo.findOne({
        where: {
          developerId: Number(developerId),
          periodStart: range.periodStart,
          periodEnd: range.periodEnd,
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (existing && existing.status !== 'cancelled') return this.toResponse(existing, 0, true);

      const rows = await ledgerRepo.find({
        where: {
          developerId: Number(developerId),
          settlementBatchId: IsNull(),
          createTime: And(MoreThanOrEqual(range.start), LessThan(range.endExclusive)),
        },
        order: { id: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (!rows.length) throw new BadRequestException('No unsettled application revenue for period');

      const amounts = this.sumRows(rows);
      const batch = existing ||
        batchRepo.create({
          batchNo: this.generateBatchNo(period),
          developerId: Number(developerId),
          periodStart: range.periodStart,
          periodEnd: range.periodEnd,
        });
      Object.assign(batch, {
        grossAmountCents: amounts.grossAmountCents,
        refundAmountCents: amounts.refundAmountCents,
        developerAmountCents: amounts.developerAmountCents,
        ledgerCount: rows.length,
        status: 'draft' as const,
        reviewedBy: null,
        reviewedAt: null,
        paidBy: null,
        paidAt: null,
        paymentReference: '',
        note: '',
      } satisfies Partial<AppSettlementBatchEntity>);
      const saved = await batchRepo.save(batch);
      const claimed = await ledgerRepo.update(
        { id: In(rows.map((row) => Number(row.id))), settlementBatchId: IsNull() },
        { settlementBatchId: Number(saved.id) },
      );
      if (Number(claimed.affected || 0) !== rows.length) {
        throw new BadRequestException('Application revenue settlement claim changed concurrently');
      }
      return this.toResponse(saved, this.orderCount(rows), true);
    });
  }

  async approveBatch(id: number, operatorId: number, note: string) {
    this.requirePositiveId(operatorId, 'Operator');
    const normalizedNote = this.normalizeRequiredText(note, 255, 'Settlement review note');
    return this.transition(id, 'draft', (batch) => {
      batch.status = 'approved';
      batch.reviewedBy = Number(operatorId);
      batch.reviewedAt = new Date();
      batch.note = normalizedNote;
    });
  }

  async markPaid(id: number, operatorId: number, paymentReference: string) {
    this.requirePositiveId(operatorId, 'Operator');
    const normalizedReference = this.normalizeRequiredText(
      paymentReference,
      100,
      'Settlement payment reference',
    );
    return this.transition(id, 'approved', (batch) => {
      if (Number(batch.developerAmountCents) <= 0) {
        throw new BadRequestException('Application settlement payable amount must be positive');
      }
      batch.status = 'paid';
      batch.paidBy = Number(operatorId);
      batch.paidAt = new Date();
      batch.paymentReference = normalizedReference;
    });
  }

  async cancelBatch(id: number, operatorId: number, note: string) {
    this.requirePositiveId(id, 'Settlement');
    this.requirePositiveId(operatorId, 'Operator');
    const normalizedNote = this.normalizeRequiredText(note, 255, 'Settlement cancel note');
    return this.dataSource.transaction(async (manager) => {
      const batchRepo = manager.getRepository(AppSettlementBatchEntity);
      const ledgerRepo = manager.getRepository(AppRevenueLedgerEntity);
      const batch = await batchRepo.findOne({
        where: { id: Number(id) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!batch) throw new NotFoundException('Application settlement not found');
      if (batch.status === 'cancelled') return this.toResponse(batch, 0, true);
      if (batch.status !== 'draft') {
        throw new BadRequestException('Only draft application settlements can be cancelled');
      }
      const released = await ledgerRepo.update(
        { settlementBatchId: Number(batch.id) },
        { settlementBatchId: null },
      );
      if (Number(released.affected || 0) !== Number(batch.ledgerCount || 0)) {
        throw new BadRequestException('Application settlement ledger release changed concurrently');
      }
      batch.status = 'cancelled';
      batch.reviewedBy = Number(operatorId);
      batch.reviewedAt = new Date();
      batch.note = normalizedNote;
      return this.toResponse(await batchRepo.save(batch), 0, true);
    });
  }

  listPlatformSettlements(query: AppSettlementListQueryDto = {}) {
    return this.list(query, null, true);
  }

  listDeveloperSettlements(developerId: number, query: AppSettlementListQueryDto = {}) {
    this.requirePositiveId(developerId, 'Developer');
    return this.list(query, Number(developerId), false);
  }

  private async list(
    query: AppSettlementListQueryDto,
    ownedDeveloperId: number | null,
    includeOperations: boolean,
  ) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const where: FindOptionsWhere<AppSettlementBatchEntity> = {};
    const developerId = ownedDeveloperId ?? query.developer_id;
    if (developerId) where.developerId = Number(developerId);
    if (query.status) where.status = query.status;
    if (query.period) where.periodStart = `${query.period}-01`;
    const [batches, total] = await this.batchRepo.findAndCount({
      where,
      order: { periodStart: 'DESC', id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    const batchIds = batches.map((batch) => Number(batch.id));
    const rows = batchIds.length
      ? await this.ledgerRepo.find({
          where: { settlementBatchId: In(batchIds) },
          order: { id: 'ASC' },
        })
      : [];
    const rowsByBatch = new Map<number, AppRevenueLedgerEntity[]>();
    for (const row of rows) {
      const list = rowsByBatch.get(Number(row.settlementBatchId)) || [];
      list.push(row);
      rowsByBatch.set(Number(row.settlementBatchId), list);
    }
    return {
      list: batches.map((batch) =>
        this.toResponse(
          batch,
          this.orderCount(rowsByBatch.get(Number(batch.id)) || []),
          includeOperations,
        ),
      ),
      total,
      page,
      limit,
    };
  }

  private transition(
    id: number,
    expected: AppSettlementStatus,
    apply: (batch: AppSettlementBatchEntity) => void,
  ) {
    this.requirePositiveId(id, 'Settlement');
    return this.dataSource.transaction(async (manager) => {
      const batchRepo = manager.getRepository(AppSettlementBatchEntity);
      const batch = await batchRepo.findOne({
        where: { id: Number(id) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!batch) throw new NotFoundException('Application settlement not found');
      if (batch.status !== expected) {
        throw new BadRequestException(`Only ${expected} application settlements can transition`);
      }
      apply(batch);
      return this.toResponse(await batchRepo.save(batch), 0, true);
    });
  }

  private closedPeriod(period: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(period || ''))) {
      throw new BadRequestException('Settlement period must use YYYY-MM');
    }
    const [year, month] = period.split('-').map(Number);
    const start = new Date(Date.UTC(year, month - 1, 1));
    const endExclusive = new Date(Date.UTC(year, month, 1));
    const currentMonth = new Date();
    const currentStart = new Date(
      Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth(), 1),
    );
    if (endExclusive.getTime() > currentStart.getTime()) {
      throw new BadRequestException('Settlement period must be closed');
    }
    return {
      start,
      endExclusive,
      periodStart: start.toISOString().slice(0, 10),
      periodEnd: new Date(endExclusive.getTime() - 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10),
    };
  }

  private sumRows(rows: AppRevenueLedgerEntity[]) {
    return rows.reduce(
      (total, row) => ({
        grossAmountCents:
          total.grossAmountCents + (row.eventType === 'charge' ? Number(row.grossAmountCents) : 0),
        refundAmountCents:
          total.refundAmountCents +
          (row.eventType === 'refund' ? Math.abs(Number(row.grossAmountCents)) : 0),
        developerAmountCents: total.developerAmountCents + Number(row.developerAmountCents),
      }),
      { grossAmountCents: 0, refundAmountCents: 0, developerAmountCents: 0 },
    );
  }

  private orderCount(rows: AppRevenueLedgerEntity[]) {
    return new Set(rows.map((row) => Number(row.orderId || 0)).filter((id) => id > 0)).size;
  }

  private toResponse(batch: AppSettlementBatchEntity, orderCount: number, includeOperations: boolean) {
    const result = {
      id: batch.id,
      batch_no: batch.batchNo,
      period_start: batch.periodStart,
      period_end: batch.periodEnd,
      gross_amount_cents: Number(batch.grossAmountCents) || 0,
      refund_amount_cents: Number(batch.refundAmountCents) || 0,
      developer_amount_cents: Number(batch.developerAmountCents) || 0,
      order_count: orderCount,
      currency: 'CNY' as const,
      status: batch.status,
    };
    return includeOperations
      ? {
          ...result,
          developer_id: batch.developerId,
          ledger_count: Number(batch.ledgerCount) || 0,
          reviewed_by: batch.reviewedBy ?? null,
          reviewed_at: batch.reviewedAt ?? null,
          paid_by: batch.paidBy ?? null,
          paid_at: batch.paidAt ?? null,
          payment_reference: batch.paymentReference || '',
          note: batch.note || '',
          create_time: batch.createTime ?? null,
          update_time: batch.updateTime ?? null,
        }
      : result;
  }

  private normalizeRequiredText(value: string, maxLength: number, label: string) {
    const normalized = String(value || '').trim();
    if (!normalized || normalized.length > maxLength) {
      throw new BadRequestException(`${label} is invalid`);
    }
    return normalized;
  }

  private requirePositiveId(value: number, label: string) {
    if (!Number.isInteger(Number(value)) || Number(value) <= 0) {
      throw new BadRequestException(`${label} id is required`);
    }
  }

  private generateBatchNo(period: string) {
    return `AS${period.replace('-', '')}${Date.now().toString(36).toUpperCase()}${randomBytes(3)
      .toString('hex')
      .toUpperCase()}`;
  }
}
