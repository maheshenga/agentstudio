import { BadRequestException } from '@nestjs/common';

export const APP_RUNTIME_CAPABILITIES = [
  'context.read',
  'kv.read',
  'kv.write',
  'kv.delete',
  'files.read',
  'files.write',
  'http.request',
  'webhook.emit',
  'service.invoke',
] as const;
export type AppRuntimeCapability = (typeof APP_RUNTIME_CAPABILITIES)[number];
export type AppCapabilityRuntimeType = 'static' | 'iframe' | 'service' | 'native';

const APP_IFRAME_RUNTIME_CAPABILITIES = [
  'context.read',
  'kv.read',
  'kv.write',
  'kv.delete',
  'files.read',
  'files.write',
  'http.request',
  'webhook.emit',
] as const;

export const APP_RUNTIME_CAPABILITY_MATRIX = {
  static: APP_RUNTIME_CAPABILITIES,
  iframe: APP_IFRAME_RUNTIME_CAPABILITIES,
  service: ['context.read'],
  native: [],
} as const satisfies Record<AppCapabilityRuntimeType, readonly AppRuntimeCapability[]>;

export const LEGACY_APP_RUNTIME_CAPABILITY_ALIASES = {
  'runtime:context:read': 'context.read',
} as const satisfies Record<string, AppRuntimeCapability>;

const supported = new Set<string>(APP_RUNTIME_CAPABILITIES);

function normalizeCapability(value: unknown): AppRuntimeCapability {
  const capability = String(value || '').trim();
  if (!supported.has(capability)) {
    throw new BadRequestException(`Unsupported app capability: ${capability || 'empty'}`);
  }
  return capability as AppRuntimeCapability;
}

export function normalizeApprovedCapabilities(values: unknown): AppRuntimeCapability[] {
  if (values === undefined || values === null) return [];
  if (!Array.isArray(values)) {
    throw new BadRequestException('App capabilities must be an array');
  }
  return [...new Set(values.map(normalizeCapability))].sort();
}

export function normalizeRuntimeCapabilities(
  runtimeType: AppCapabilityRuntimeType,
  values: unknown,
): AppRuntimeCapability[] {
  const capabilities = normalizeApprovedCapabilities(values);
  const available = new Set<string>(APP_RUNTIME_CAPABILITY_MATRIX[runtimeType]);
  const unsupported = capabilities.find((capability) => !available.has(capability));
  if (unsupported) {
    throw new BadRequestException(
      `Capability ${unsupported} is not available for ${runtimeType} apps`,
    );
  }
  return capabilities;
}

export function normalizeAppCapabilities(
  manifest?: Record<string, unknown> | null,
): AppRuntimeCapability[] {
  if (!manifest) return [];

  const normalized = new Set<AppRuntimeCapability>();
  if (manifest.capabilities !== undefined) {
    for (const capability of normalizeApprovedCapabilities(manifest.capabilities)) {
      normalized.add(capability);
    }
  }

  if (Array.isArray(manifest.permissions)) {
    for (const permission of manifest.permissions) {
      const value = String(permission || '').trim();
      const mapped =
        LEGACY_APP_RUNTIME_CAPABILITY_ALIASES[
          value as keyof typeof LEGACY_APP_RUNTIME_CAPABILITY_ALIASES
        ];
      if (mapped) normalized.add(mapped);
      if (supported.has(value)) normalized.add(value as AppRuntimeCapability);
    }
  }

  return [...normalized].sort();
}
