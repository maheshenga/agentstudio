import { completeOpenAiChatCompletions } from './openai-stream.util';

describe('openai-stream util', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'ok' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
    } as any);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('does not duplicate chat/completions when a full endpoint is provided as baseUrl', async () => {
    await completeOpenAiChatCompletions({
      baseUrl: 'https://api.example.test/v1/chat/completions/',
      apiKey: 'secret',
      model: 'gpt-test',
      messages: [{ role: 'user', content: 'ping' }],
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.test/v1/chat/completions',
      expect.any(Object),
    );
  });
});
