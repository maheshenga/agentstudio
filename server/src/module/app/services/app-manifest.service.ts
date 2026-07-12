import { BadRequestException, Injectable } from '@nestjs/common';
import * as path from 'path';

import {
  normalizeApprovedCapabilities,
  type AppRuntimeCapability,
} from '../app-runtime.constants';

export interface StaticAppManifest {
  code: string;
  name: string;
  version: string;
  type: 'static';
  entry: string;
  category: string;
  summary: string;
  description: string;
  icon: string;
  tenant_scoped: boolean;
  permissions: string[];
  serviceTargets: string[];
}

export interface ValidateStaticManifestInput {
  manifest: unknown;
  entries: string[];
}

export interface NormalizedServiceManifest {
  manifestVersion: 2;
  code: string;
  version: string;
  runtime: 'service';
  entry: 'dist/index.js';
  healthPath: string;
  capabilities: AppRuntimeCapability[];
  serviceTargets: string[];
  allowedOrigins: [];
  runtimeConfig: Record<string, never>;
}

const APP_CODE_PATTERN = /^[a-z][a-z0-9_]{2,79}$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
const EXECUTABLE_EXTENSIONS = new Set([
  '.bat',
  '.cmd',
  '.com',
  '.dll',
  '.exe',
  '.jar',
  '.msi',
  '.php',
  '.ps1',
  '.py',
  '.rb',
  '.sh',
]);

@Injectable()
export class AppManifestService {
  validateStaticManifest(input: ValidateStaticManifestInput): StaticAppManifest {
    const manifest = this.asRecord(input.manifest);
    const code = this.requiredString(manifest.code, 'App code is required');
    if (!APP_CODE_PATTERN.test(code)) {
      throw new BadRequestException('Invalid app code');
    }

    const name = this.requiredString(manifest.name, 'App name is required');
    const version = this.requiredString(manifest.version, 'App version is required');
    if (!SEMVER_PATTERN.test(version)) {
      throw new BadRequestException('Invalid app version');
    }

    const type = this.requiredString(manifest.type, 'App type is required');
    if (type !== 'static') {
      throw new BadRequestException('Static app packages must use type static');
    }

    const entry = this.normalizePackagePath(this.requiredString(manifest.entry, 'App entry is required'));
    if (!entry.endsWith('.html')) {
      throw new BadRequestException('Static app entry must be an html file');
    }

    const normalizedEntries = input.entries.map((item) => this.normalizePackagePath(item));
    if (!normalizedEntries.includes(entry)) {
      throw new BadRequestException('App entry file not found');
    }

    for (const item of normalizedEntries) {
      const ext = path.posix.extname(item).toLowerCase();
      if (EXECUTABLE_EXTENSIONS.has(ext)) {
        throw new BadRequestException('Executable files are not allowed');
      }
    }

    const permissions = Array.isArray(manifest.permissions)
      ? manifest.permissions.filter((item): item is string => typeof item === 'string')
      : [];
    const serviceTargets = this.normalizeServiceTargets(manifest.serviceTargets, code);
    if (serviceTargets.length > 0 && !permissions.includes('service.invoke')) {
      throw new BadRequestException('Service targets require service.invoke');
    }
    if (permissions.includes('service.invoke') && serviceTargets.length === 0) {
      throw new BadRequestException('service.invoke requires a service target');
    }

    return {
      code,
      name,
      version,
      type: 'static',
      entry,
      category: this.optionalString(manifest.category),
      summary: this.optionalString(manifest.summary),
      description: this.optionalString(manifest.description),
      icon: this.optionalString(manifest.icon),
      tenant_scoped: Boolean(manifest.tenant_scoped),
      permissions,
      serviceTargets,
    };
  }

  validateServiceManifest(input: unknown): NormalizedServiceManifest {
    const manifest = this.asRecord(input);
    if (manifest.manifestVersion !== 2) {
      throw new BadRequestException('Service manifestVersion must be 2');
    }

    const code = this.requiredString(manifest.code, 'App code is required');
    if (!APP_CODE_PATTERN.test(code)) {
      throw new BadRequestException('Invalid app code');
    }

    const version = this.requiredString(manifest.version, 'App version is required');
    if (!SEMVER_PATTERN.test(version)) {
      throw new BadRequestException('Invalid app version');
    }

    if (this.requiredString(manifest.runtime, 'Service manifest runtime is required') !== 'service') {
      throw new BadRequestException('Service manifest runtime must be service');
    }

    const entry = this.normalizeServiceEntry(
      this.requiredString(manifest.entry, 'Service entry is required'),
    );
    if (entry !== 'dist/index.js') {
      throw new BadRequestException('Service entry must be dist/index.js');
    }

    const healthPath = this.normalizeHealthPath(manifest.healthPath);
    const capabilities = normalizeApprovedCapabilities(manifest.capabilities);
    const serviceTargets = this.normalizeServiceTargets(manifest.serviceTargets, code);
    if (serviceTargets.length > 0 && !capabilities.includes('service.invoke')) {
      throw new BadRequestException('Service targets require service.invoke');
    }
    if (capabilities.includes('service.invoke') && serviceTargets.length === 0) {
      throw new BadRequestException('service.invoke requires a service target');
    }
    if (!Array.isArray(manifest.allowedOrigins)) {
      throw new BadRequestException('Service allowedOrigins must be an array');
    }
    if (manifest.allowedOrigins.length > 0) {
      throw new BadRequestException('Direct service origins are not available in P10');
    }

    if (
      manifest.runtimeConfig !== undefined &&
      manifest.runtimeConfig !== null &&
      (!this.isRecord(manifest.runtimeConfig) || Object.keys(manifest.runtimeConfig).length > 0)
    ) {
      throw new BadRequestException('Invalid runtime config');
    }

    return {
      manifestVersion: 2,
      code,
      version,
      runtime: 'service',
      entry: 'dist/index.js',
      healthPath,
      capabilities,
      serviceTargets,
      allowedOrigins: [],
      runtimeConfig: {},
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (!this.isRecord(value)) {
      throw new BadRequestException('Invalid app manifest');
    }
    return value;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  private requiredString(value: unknown, message: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(message);
    }
    return value.trim();
  }

  private optionalString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private normalizePackagePath(value: string): string {
    const normalized = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '');
    const resolved = path.posix.normalize(normalized);
    if (!resolved || resolved === '.' || resolved.startsWith('../') || resolved.includes('/../') || path.posix.isAbsolute(resolved)) {
      throw new BadRequestException('Invalid app entry');
    }
    return resolved;
  }

  private normalizeServiceEntry(value: string) {
    const normalized = value.replace(/\\/g, '/');
    if (normalized.startsWith('/') || normalized.includes('..')) {
      throw new BadRequestException('Invalid service entry');
    }
    const resolved = path.posix.normalize(normalized);
    if (!resolved || resolved === '.' || resolved.startsWith('../') || path.posix.isAbsolute(resolved)) {
      throw new BadRequestException('Invalid service entry');
    }
    return resolved;
  }

  private normalizeHealthPath(value: unknown) {
    const healthPath = this.requiredString(value, 'Service health path is required');
    if (
      !healthPath.startsWith('/') ||
      healthPath.startsWith('//') ||
      healthPath.includes('?') ||
      healthPath.includes('#') ||
      healthPath.includes('\\') ||
      /[\s@]/.test(healthPath) ||
      !/^\/[A-Za-z0-9/_-]*$/.test(healthPath)
    ) {
      throw new BadRequestException('Invalid service health path');
    }
    return healthPath;
  }

  private normalizeServiceTargets(value: unknown, appCode: string) {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) {
      throw new BadRequestException('Service targets must be an array');
    }
    if (value.length > 20) {
      throw new BadRequestException('Service targets exceed the limit');
    }
    const seen = new Set<string>();
    return value.map((item) => {
      const target = typeof item === 'string' ? item.trim() : '';
      if (!APP_CODE_PATTERN.test(target)) {
        throw new BadRequestException('Invalid service target code');
      }
      if (seen.has(target)) {
        throw new BadRequestException('Duplicate service target code');
      }
      if (target === appCode) {
        throw new BadRequestException('App cannot target itself as a service');
      }
      seen.add(target);
      return target;
    });
  }
}
