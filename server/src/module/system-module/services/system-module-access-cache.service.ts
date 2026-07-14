import { Injectable } from '@nestjs/common';

interface CacheEntry<T> {
  expiresAt: number;
  value: Promise<T>;
}

@Injectable()
export class SystemModuleAccessCacheService {
  private readonly entries = new Map<string, CacheEntry<unknown>>();
  private readonly ttlMs = 10_000;
  private nextSweepAt = 0;

  async getOrLoad<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const now = Date.now();
    if (now >= this.nextSweepAt) {
      this.sweepExpired(now);
      this.nextSweepAt = now + this.ttlMs;
    }
    const existing = this.entries.get(key) as CacheEntry<T> | undefined;
    if (existing && existing.expiresAt > now) return existing.value;

    const value = loader().catch((error) => {
      this.entries.delete(key);
      throw error;
    });
    this.entries.set(key, { expiresAt: now + this.ttlMs, value });
    return value;
  }

  invalidateAll() {
    this.entries.clear();
    this.nextSweepAt = 0;
  }

  private sweepExpired(now: number) {
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
  }
}
