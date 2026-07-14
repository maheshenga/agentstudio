import { BadRequestException } from '@nestjs/common';

import type { SystemModuleEventType, SystemModuleStatus } from './constants';

const ALLOWED_TRANSITIONS: Record<SystemModuleStatus, ReadonlySet<SystemModuleStatus>> = {
  draft: new Set(['installed']),
  installed: new Set(['enabled', 'uninstalled']),
  enabled: new Set(['disabled', 'upgrading', 'failed']),
  disabled: new Set(['enabled', 'upgrading', 'uninstalled']),
  upgrading: new Set(['enabled', 'failed']),
  failed: new Set(['installed', 'disabled', 'upgrading', 'uninstalled']),
  uninstalled: new Set(['installed']),
};

export function assertSystemModuleTransition(
  current: SystemModuleStatus,
  next: SystemModuleStatus,
) {
  if (current === next) return;
  if (!ALLOWED_TRANSITIONS[current]?.has(next)) {
    throw new BadRequestException(`Invalid system module status transition: ${current} -> ${next}`);
  }
}

export function systemModuleStatusEventType(
  status: SystemModuleStatus,
): SystemModuleEventType {
  if (status === 'enabled') return 'enable';
  if (status === 'disabled') return 'disable';
  if (status === 'uninstalled') return 'uninstall';
  if (status === 'draft' || status === 'installed') return 'install';
  return 'upgrade';
}

export function requiresDisabledDependencyProtection(status: SystemModuleStatus) {
  return !['enabled', 'failed'].includes(status);
}
