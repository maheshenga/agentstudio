import { BadRequestException, Injectable } from '@nestjs/common';

import { AiProviderEntity } from '../entities/ai-provider.entity';
import { buildProviderExtraBody } from '../providers/llm-provider.util';
import {
  completeOpenAiChatCompletions,
  LlmRequestOptions,
  LlmStreamOptions,
  streamOpenAiChatCompletions,
} from '../providers/openai-stream.util';

type RunnerOptions<T> = Omit<T, 'baseUrl' | 'apiKey' | 'extraHeaders' | 'extraBody'>;

@Injectable()
export class LlmProviderService {
  streamChat(
    provider: AiProviderEntity,
    apiKey: string,
    options: RunnerOptions<LlmStreamOptions>,
  ) {
    this.assertSupported(provider);
    return streamOpenAiChatCompletions({
      ...options,
      baseUrl: provider.baseUrl,
      apiKey,
      extraHeaders: provider.extraHeaders ?? undefined,
      extraBody: buildProviderExtraBody(provider),
    });
  }

  completeChat(
    provider: AiProviderEntity,
    apiKey: string,
    options: RunnerOptions<LlmRequestOptions>,
  ) {
    this.assertSupported(provider);
    return completeOpenAiChatCompletions({
      ...options,
      baseUrl: provider.baseUrl,
      apiKey,
      extraHeaders: provider.extraHeaders ?? undefined,
      extraBody: buildProviderExtraBody(provider),
    });
  }

  private assertSupported(provider: AiProviderEntity) {
    if ((provider.adapterType || 'openai_compatible') !== 'openai_compatible') {
      throw new BadRequestException(`Unsupported AI adapter ${provider.adapterType}`);
    }
  }
}
