import { BadRequestException } from '@nestjs/common';

const MAX_CONFIG_BYTES = 64 * 1024;
const MAX_CONFIG_DEPTH = 8;
const MAX_CONFIG_NODES = 500;

export function validateSystemModuleConfig(
  config: Record<string, unknown>,
  schemaValue?: Record<string, unknown> | null,
) {
  if (!isPlainObject(config)) throw new BadRequestException('Module config must be an object');
  const serialized = JSON.stringify(config);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_CONFIG_BYTES) {
    throw new BadRequestException('Module config exceeds the size limit');
  }

  const structuralError = inspectConfigStructure(config, '$', 0, { nodes: 0 });
  if (structuralError) {
    throw new BadRequestException(`Module config validation failed: ${structuralError}`);
  }

  const state = { nodes: 0 };
  const schema = normalizeRootSchema(schemaValue || {});
  const error = validateValue(config, schema, '$', 0, state);
  if (error) throw new BadRequestException(`Module config validation failed: ${error}`);
}

export function mergeSystemModuleConfig(
  platformConfig: Record<string, unknown>,
  tenantConfig: Record<string, unknown>,
) {
  return deepMerge(platformConfig, tenantConfig);
}

function normalizeRootSchema(schema: Record<string, unknown>) {
  if (!Object.keys(schema).length || schema.type || schema.properties) return schema;
  return { type: 'object', properties: schema };
}

function validateValue(
  value: unknown,
  schema: Record<string, any>,
  path: string,
  depth: number,
  state: { nodes: number },
): string | null {
  state.nodes += 1;
  if (state.nodes > MAX_CONFIG_NODES) return 'configuration is too complex';
  if (depth > MAX_CONFIG_DEPTH) return 'configuration nesting is too deep';
  if (!schema || !Object.keys(schema).length) return null;
  if (Array.isArray(schema.enum) && !schema.enum.some((item: unknown) => Object.is(item, value))) {
    return `${path} is not an allowed value`;
  }

  if (schema.type === 'object' || schema.properties) {
    if (!isPlainObject(value)) return `${path} must be an object`;
    const properties = isPlainObject(schema.properties) ? schema.properties : {};
    for (const requiredKey of Array.isArray(schema.required) ? schema.required : []) {
      if (!Object.prototype.hasOwnProperty.call(value, requiredKey)) {
        return `${path}.${requiredKey} is required`;
      }
    }
    for (const [key, childValue] of Object.entries(value)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        return `${path}.${key} is not allowed`;
      }
      const childSchema = properties[key];
      if (!childSchema) {
        if (schema.additionalProperties === false) return `${path}.${key} is not allowed`;
        continue;
      }
      const error = validateValue(childValue, childSchema, `${path}.${key}`, depth + 1, state);
      if (error) return error;
    }
    return null;
  }

  if (schema.type === 'array') {
    if (!Array.isArray(value)) return `${path} must be an array`;
    if (Number.isFinite(schema.maxItems) && value.length > Number(schema.maxItems)) {
      return `${path} contains too many items`;
    }
    for (let index = 0; index < value.length; index += 1) {
      const error = validateValue(value[index], schema.items || {}, `${path}[${index}]`, depth + 1, state);
      if (error) return error;
    }
    return null;
  }

  if (schema.type === 'string') {
    if (typeof value !== 'string') return `${path} must be a string`;
    if (Number.isFinite(schema.minLength) && value.length < Number(schema.minLength)) return `${path} is too short`;
    if (Number.isFinite(schema.maxLength) && value.length > Number(schema.maxLength)) return `${path} is too long`;
    return null;
  }
  if (schema.type === 'boolean' && typeof value !== 'boolean') return `${path} must be a boolean`;
  if (schema.type === 'number' || schema.type === 'integer') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return `${path} must be a number`;
    if (schema.type === 'integer' && !Number.isInteger(value)) return `${path} must be an integer`;
    if (Number.isFinite(schema.minimum) && value < Number(schema.minimum)) return `${path} is below the minimum`;
    if (Number.isFinite(schema.maximum) && value > Number(schema.maximum)) return `${path} exceeds the maximum`;
  }
  return null;
}

function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    result[key] = isPlainObject(value) && isPlainObject(result[key])
      ? deepMerge(result[key] as Record<string, unknown>, value)
      : value;
  }
  return result;
}

function inspectConfigStructure(
  value: unknown,
  path: string,
  depth: number,
  state: { nodes: number },
): string | null {
  state.nodes += 1;
  if (state.nodes > MAX_CONFIG_NODES) return 'configuration is too complex';
  if (depth > MAX_CONFIG_DEPTH) return 'configuration nesting is too deep';
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const error = inspectConfigStructure(value[index], `${path}[${index}]`, depth + 1, state);
      if (error) return error;
    }
    return null;
  }
  if (!isPlainObject(value)) return null;
  for (const [key, childValue] of Object.entries(value)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return `${path}.${key} is not allowed`;
    }
    const error = inspectConfigStructure(childValue, `${path}.${key}`, depth + 1, state);
    if (error) return error;
  }
  return null;
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
