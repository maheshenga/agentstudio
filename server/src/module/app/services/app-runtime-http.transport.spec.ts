import { Agent, request as undiciRequest } from 'undici';

import { UndiciAppRuntimeHttpTransport } from './app-runtime-http.service';

jest.mock('undici', () => ({
  Agent: jest.fn(),
  request: jest.fn(),
}));

describe('UndiciAppRuntimeHttpTransport', () => {
  const close = jest.fn();
  const destroy = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (Agent as unknown as jest.Mock).mockImplementation(() => ({ close }));
  });

  it('uses only pinned addresses, ignores ambient proxy settings, and bounds response bytes', async () => {
    const body = {
      async *[Symbol.asyncIterator]() {
        yield Buffer.from('123456789');
      },
      destroy,
    };
    (undiciRequest as unknown as jest.Mock).mockResolvedValue({
      statusCode: 200,
      headers: { 'content-type': 'text/plain' },
      body,
    });

    const result = await new UndiciAppRuntimeHttpTransport().execute({
      url: 'https://api.example.com/data',
      hostname: 'api.example.com',
      addresses: [{ address: '93.184.216.34', family: 4 }],
      method: 'GET',
      headers: {},
      timeoutMs: 15_000,
      maxResponseBytes: 5,
    });

    expect(result).toMatchObject({ body: Buffer.from('12345'), truncated: true });
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect(Agent).toHaveBeenCalledWith({
      connect: { lookup: expect.any(Function) },
    });
    expect(undiciRequest).toHaveBeenCalledWith(
      'https://api.example.com/data',
      expect.objectContaining({
        dispatcher: expect.any(Object),
        headersTimeout: 15_000,
        bodyTimeout: 15_000,
      }),
    );

    const lookup = (Agent as unknown as jest.Mock).mock.calls[0][0].connect.lookup;
    const callback = jest.fn();
    lookup('api.example.com', { family: 4 }, callback);
    expect(callback).toHaveBeenCalledWith(null, '93.184.216.34', 4);

    const mismatchCallback = jest.fn();
    lookup('rebound.example.com', { family: 4 }, mismatchCallback);
    expect(mismatchCallback.mock.calls[0][0]).toBeInstanceOf(Error);
  });
});
