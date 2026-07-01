import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SAAS_PLAN_FREE } from '../constants';
import { SaasPlanEntity } from '../entities/saas-plan.entity';

@Injectable()
export class SaasPlanService {
  constructor(
    @InjectRepository(SaasPlanEntity)
    private readonly saasPlanRepo: Repository<SaasPlanEntity>,
  ) {}

  async getFreePlan(): Promise<SaasPlanEntity> {
    const plan = await this.saasPlanRepo.findOne({
      where: {
        code: SAAS_PLAN_FREE,
        status: 1,
      },
    });

    if (!plan) {
      throw new Error('Free plan is not configured');
    }

    return plan;
  }
}
