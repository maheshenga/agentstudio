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
    return this.getPlanByCode(SAAS_PLAN_FREE);
  }

  async getPlanByCode(planCode: string): Promise<SaasPlanEntity> {
    const plan = await this.saasPlanRepo.findOne({
      where: {
        code: planCode,
        status: 1,
      },
    });

    if (!plan) {
      if (planCode === SAAS_PLAN_FREE) {
        throw new Error('Free plan is not configured');
      }

      throw new Error(`Plan ${planCode} is not configured`);
    }

    return plan;
  }
}
