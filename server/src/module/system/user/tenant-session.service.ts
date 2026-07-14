import { Injectable } from '@nestjs/common';

import { REFRESH_TOKEN_KEY } from '../../../common/constant';
import { CacheEnum } from '../../../common/enum';
import { RedisService } from '../../../redis/redis.service';

@Injectable()
export class TenantSessionService {
  constructor(private readonly redisService: RedisService) {}

  async revokeTenantSessions(userId: number, tenantId: number): Promise<void> {
    const targetUserId = Number(userId);
    const targetTenantId = Number(tenantId);
    const keysToDelete: string[] = [];

    for (const pattern of [`${CacheEnum.LOGIN_TOKEN_KEY}*`, `${REFRESH_TOKEN_KEY}*`]) {
      const keys = await this.redisService.scanKeys(pattern);
      if (!keys.length) continue;
      const sessions = await this.redisService.mget(keys);
      sessions.forEach((session, index) => {
        const sessionUserId = Number(session?.userId ?? session?.user?.id);
        const sessionTenantId = Number(session?.tenantId ?? session?.tenant_id);
        if (sessionUserId === targetUserId && sessionTenantId === targetTenantId) {
          keysToDelete.push(keys[index]);
        }
      });
    }

    if (keysToDelete.length) {
      await this.redisService.del(keysToDelete);
    }
    await this.clearUserRuntimeCache(targetUserId);
  }

  private async clearUserRuntimeCache(userId: number): Promise<void> {
    await this.redisService.del(`user:permissions:${userId}`);
    const menuKeys = await this.redisService.keys(`${CacheEnum.SYS_MENU_KEY}*:${userId}`);
    if (menuKeys.length) await this.redisService.del(menuKeys);
    await this.redisService.del(`user:roles:${userId}`);
    const profileKeys = await this.redisService.keys(`${CacheEnum.SYS_USER_KEY}profile:${userId}:*`);
    if (profileKeys.length) await this.redisService.del(profileKeys);
  }
}
