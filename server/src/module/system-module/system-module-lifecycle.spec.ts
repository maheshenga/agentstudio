import {
  assertSystemModuleTransition,
  systemModuleStatusEventType,
} from './system-module-lifecycle';

describe('system module lifecycle', () => {
  it.each([
    ['draft', 'installed'],
    ['installed', 'enabled'],
    ['enabled', 'disabled'],
    ['enabled', 'upgrading'],
    ['enabled', 'failed'],
    ['disabled', 'enabled'],
    ['disabled', 'uninstalled'],
    ['upgrading', 'enabled'],
    ['upgrading', 'failed'],
    ['failed', 'upgrading'],
    ['uninstalled', 'installed'],
  ] as const)('allows %s -> %s', (current, next) => {
    expect(() => assertSystemModuleTransition(current, next)).not.toThrow();
  });

  it.each([
    ['draft', 'enabled'],
    ['installed', 'failed'],
    ['enabled', 'uninstalled'],
    ['disabled', 'draft'],
    ['upgrading', 'uninstalled'],
    ['uninstalled', 'enabled'],
  ] as const)('rejects %s -> %s', (current, next) => {
    expect(() => assertSystemModuleTransition(current, next)).toThrow(
      `Invalid system module status transition: ${current} -> ${next}`,
    );
  });

  it.each([
    ['draft', 'install'],
    ['installed', 'install'],
    ['enabled', 'enable'],
    ['disabled', 'disable'],
    ['upgrading', 'upgrade'],
    ['failed', 'upgrade'],
    ['uninstalled', 'uninstall'],
  ] as const)('maps %s to the %s event', (status, eventType) => {
    expect(systemModuleStatusEventType(status)).toBe(eventType);
  });
});
