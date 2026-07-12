import { BadRequestException } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import {
  Validate,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

export type AppRuntimeJsonValue =
  | null
  | boolean
  | number
  | string
  | AppRuntimeJsonValue[]
  | { [key: string]: AppRuntimeJsonValue };

const MAX_RUNTIME_JSON_BYTES = 2 * 1024 * 1024;
const MAX_RUNTIME_JSON_DEPTH = 20;

@ValidatorConstraint({ name: 'boundedRuntimeJson', async: false })
export class BoundedRuntimeJsonConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    try {
      assertBoundedAppRuntimeJson(value);
      return true;
    } catch {
      return false;
    }
  }

  defaultMessage() {
    return 'Service input must be bounded JSON';
  }
}

export class AppServiceInvokeDto {
  @ApiProperty({ required: true })
  @Validate(BoundedRuntimeJsonConstraint)
  input: AppRuntimeJsonValue;
}

export function assertBoundedAppRuntimeJson(value: unknown): asserts value is AppRuntimeJsonValue {
  if (!isRuntimeJsonValue(value, 0)) {
    throw new BadRequestException('Service input must be bounded JSON');
  }
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new BadRequestException('Service input must be bounded JSON');
  }
  if (Buffer.byteLength(serialized, 'utf8') > MAX_RUNTIME_JSON_BYTES) {
    throw new BadRequestException('Service input is too large');
  }
}

function isRuntimeJsonValue(value: unknown, depth: number): value is AppRuntimeJsonValue {
  if (depth > MAX_RUNTIME_JSON_DEPTH) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every((item) => isRuntimeJsonValue(item, depth + 1));
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  const prototype = Object.getPrototypeOf(record) as unknown;
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Object.values(record).every((item) =>
    isRuntimeJsonValue(item, depth + 1),
  );
}
