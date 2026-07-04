export const AI_CHAT_STOP_CHANNEL = 'ai:chat:stop';

/** 与 sa_system_dict data_status 一致：1=正常/可用，0=停用 */
export const AI_STATUS_ENABLED = '1';
export const AI_STATUS_DISABLED = '0';

export const AI_ADAPTER_OPENAI_COMPATIBLE = 'openai_compatible';
export const AI_ADAPTER_TYPES = [AI_ADAPTER_OPENAI_COMPATIBLE] as const;
export type AiAdapterType = (typeof AI_ADAPTER_TYPES)[number];

export function isSupportedAiAdapter(value?: string | null): value is AiAdapterType {
  return (AI_ADAPTER_TYPES as readonly string[]).includes(String(value || ''));
}
