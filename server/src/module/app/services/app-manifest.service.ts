import { BadRequestException, Injectable } from '@nestjs/common';
import * as path from 'path';

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
}

export interface ValidateStaticManifestInput {
  manifest: unknown;
  entries: string[];
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
      permissions: Array.isArray(manifest.permissions)
        ? manifest.permissions.filter((item): item is string => typeof item === 'string')
        : [],
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('Invalid app manifest');
    }
    return value as Record<string, unknown>;
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
}
