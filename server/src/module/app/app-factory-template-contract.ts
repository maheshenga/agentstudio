import { BadRequestException } from '@nestjs/common';

import {
  normalizeRuntimeCapabilities,
  type AppRuntimeCapability,
} from './app-runtime.constants';
import type {
  NormalizedServiceManifest,
  StaticAppManifest,
} from './services/app-manifest.service';

export type AppFactoryRuntimeTarget = 'static' | 'service';

export interface AppFactoryManifestDefaults {
  tenant_scoped?: boolean;
  permissions?: unknown;
  healthPath?: string;
  capabilities?: unknown;
}

export interface BuildFactoryAppManifestInput {
  runtimeTarget: AppFactoryRuntimeTarget;
  code: string;
  name: string;
  version: string;
  category?: string;
  summary?: string;
  description?: string;
  icon?: string;
  defaults?: AppFactoryManifestDefaults | null;
}

export type FactoryAppManifest = StaticAppManifest | NormalizedServiceManifest;

export function buildFactoryAppManifest(
  input: BuildFactoryAppManifestInput,
): FactoryAppManifest {
  const defaults = input.defaults || {};
  if (input.runtimeTarget === 'service') {
    return {
      manifestVersion: 2,
      code: input.code,
      version: input.version,
      runtime: 'service',
      entry: 'dist/index.js',
      healthPath: normalizeHealthPath(defaults.healthPath),
      capabilities: normalizeRuntimeCapabilities('service', defaults.capabilities),
      serviceTargets: [],
      allowedOrigins: [],
      runtimeConfig: {},
    };
  }

  const permissions = normalizeRuntimeCapabilities('static', defaults.permissions);
  if (permissions.includes('service.invoke')) {
    throw new BadRequestException(
      'Factory static manifests cannot request service.invoke without a service target',
    );
  }

  return {
    code: input.code,
    name: input.name,
    version: input.version,
    type: 'static',
    entry: 'dist/index.html',
    category: input.category || '',
    summary: input.summary || '',
    description: input.description || '',
    icon: input.icon || '',
    tenant_scoped: Boolean(defaults.tenant_scoped),
    permissions: permissions as AppRuntimeCapability[],
    serviceTargets: [],
    allowedOrigins: [],
  };
}

function normalizeHealthPath(value?: string) {
  const healthPath = String(value || '/health').trim();
  return healthPath.startsWith('/') ? healthPath : `/${healthPath}`;
}
