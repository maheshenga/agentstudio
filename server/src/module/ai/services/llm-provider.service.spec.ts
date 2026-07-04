import { BadRequestException } from '@nestjs/common';

import { AiProviderEntity } from '../entities/ai-provider.entity';
import {
  completeOpenAiChatCompletions,
  streamOpenAiChatCompletions,
} from '../providers/openai-stream.util';
import { LlmProviderService } from './llm-provider.service';

jest.mock('../providers/openai-stream.util', () => ({
  completeOpenAiChatCompletions: jest.fn(),
  streamOpenAiChatCompletions: jest.fn(),
}));

describe('LlmProviderService', () => {
  const service = new LlmProviderService();

  const provider = {
    id: '1',
    adapterType: 'openai_compatible',
    baseUrl: 'https://api.example.test/v1',
    extraHeaders: { 'X-Test': '1' },
  } as unknown as AiProviderEntity;

  it('delegates non-streaming calls to the OpenAI-compatible util', async () => {
    (completeOpenAiChatCompletions as jest.Mock).mockResolvedValue({
      content: 'ok',
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    });

    const result = await service.completeChat(provider, 'secret', {
      model: 'gpt-test',
      messages: [{ role: 'user', content: 'ping' }],
      maxTokens: 8,
    });

    expect(result.content).toBe('ok');
    expect(completeOpenAiChatCompletions).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: provider.baseUrl,
        apiKey: 'secret',
        model: 'gpt-test',
        extraHeaders: provider.extraHeaders,
      }),
    );
  });

  it('delegates streaming calls to the OpenAI-compatible util', () => {
    const stream = (async function* () {
      yield { delta: 'hi' };
      return { promptTokens: 1, completionTokens: 1, totalTokens: 2 };
    })();
    (streamOpenAiChatCompletions as jest.Mock).mockReturnValue(stream);

    const result = service.streamChat(provider, 'secret', {
      model: 'gpt-test',
      messages: [{ role: 'user', content: 'ping' }],
    });

    expect(result).toBe(stream);
  });

  it('rejects unsupported adapter types', () => {
    expect(() =>
      service.completeChat({ ...provider, adapterType: 'anthropic' } as AiProviderEntity, 'secret', {
        model: 'claude',
        messages: [{ role: 'user', content: 'ping' }],
      }),
    ).toThrow(BadRequestException);
  });
});
