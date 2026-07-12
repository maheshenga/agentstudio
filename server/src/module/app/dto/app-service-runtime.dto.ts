import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

import type {
  AppServiceHealthStatus,
  AppServiceInstanceRole,
  AppServiceProcessStatus,
} from '../entities/app-service-instance.entity';

const APP_SERVICE_INSTANCE_ROLES: AppServiceInstanceRole[] = [
  'candidate',
  'active',
  'standby',
  'retired',
];
const APP_SERVICE_PROCESS_STATUSES: AppServiceProcessStatus[] = [
  'starting',
  'online',
  'stopped',
  'failed',
];
const APP_SERVICE_HEALTH_STATUSES: AppServiceHealthStatus[] = [
  'unknown',
  'checking',
  'healthy',
  'unhealthy',
];

function MaxJsonBytes(maxBytes: number, options?: ValidationOptions) {
  return (target: object, propertyName: string) => {
    registerDecorator({
      name: 'maxJsonBytes',
      target: target.constructor,
      propertyName,
      constraints: [maxBytes],
      options,
      validator: {
        validate(value: unknown) {
          try {
            const serialized = JSON.stringify(value);
            return serialized !== undefined && Buffer.byteLength(serialized, 'utf8') <= maxBytes;
          } catch {
            return false;
          }
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} exceeds the JSON size limit`;
        },
      },
    });
  };
}

export class AppServiceRuntimeListQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{2,79}$/)
  app_code?: string;

  @ApiProperty({ required: false, enum: APP_SERVICE_INSTANCE_ROLES })
  @IsOptional()
  @IsIn(APP_SERVICE_INSTANCE_ROLES)
  role?: AppServiceInstanceRole;

  @ApiProperty({ required: false, enum: APP_SERVICE_PROCESS_STATUSES })
  @IsOptional()
  @IsIn(APP_SERVICE_PROCESS_STATUSES)
  process_status?: AppServiceProcessStatus;

  @ApiProperty({ required: false, enum: APP_SERVICE_HEALTH_STATUSES })
  @IsOptional()
  @IsIn(APP_SERVICE_HEALTH_STATUSES)
  health_status?: AppServiceHealthStatus;
}

export class AppServiceReasonDto {
  @ApiProperty({ minLength: 3, maxLength: 500 })
  @IsString()
  @Length(3, 500)
  reason: string;
}

export class AppServiceProbeDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  @MaxJsonBytes(64 * 1024)
  payload: Record<string, unknown>;
}

export class AppServiceLogQueryDto {
  @ApiProperty({ required: false, minimum: 1, maximum: 200, default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  lines = 100;
}
