import { Transform } from 'class-transformer';
import { IsIn } from 'class-validator';

export const APP_ANALYTICS_WINDOWS = [7, 30, 90] as const;
export type AppAnalyticsWindow = (typeof APP_ANALYTICS_WINDOWS)[number];

export class AppAnalyticsQueryDto {
  @Transform(({ value }) => (value == null || value === '' ? 30 : Number(value)))
  @IsIn(APP_ANALYTICS_WINDOWS)
  days: AppAnalyticsWindow = 30;
}
