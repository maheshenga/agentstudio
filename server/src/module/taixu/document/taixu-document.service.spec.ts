import { BadRequestException } from '@nestjs/common';
import axios from 'axios';

import * as tenantUtils from '../../../common/utils/tenant.util';
import { TaixuDocumentService } from './taixu-document.service';

jest.mock('axios');
jest.mock('../../../common/utils', () => ({
  generateUUID: jest.fn(() => 'doc-id'),
}));

describe('TaixuDocumentService', () => {
  const configService = {
    get: jest.fn(),
  };
  const vectorService = {};
  const graphService = {};
  const indexTracker = {};
  const indexQueue = {
    enqueue: jest.fn(),
  };
  const documentRepo = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
  };

  let service: TaixuDocumentService;
  const mockedAxios = axios as jest.Mocked<typeof axios>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(tenantUtils, 'getTenantId').mockReturnValue(42);
    service = new TaixuDocumentService(
      configService as any,
      vectorService as any,
      graphService as any,
      indexTracker as any,
      indexQueue as any,
      documentRepo as any,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects private website URLs before fetching', async () => {
    await expect(service.uploadWebsite('http://127.0.0.1/admin')).rejects.toBeInstanceOf(BadRequestException);

    expect(mockedAxios.get).not.toHaveBeenCalled();
    expect(documentRepo.save).not.toHaveBeenCalled();
    expect(indexQueue.enqueue).not.toHaveBeenCalled();
  });

  it('fetches public website URLs with redirects disabled', async () => {
    mockedAxios.get.mockResolvedValue({ data: Buffer.from('<html><body>ok</body></html>') });

    const result = await service.uploadWebsite('https://93.184.216.34/docs');

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://93.184.216.34/docs',
      expect.objectContaining({ timeout: 15000, responseType: 'arraybuffer', maxRedirects: 0 }),
    );
    expect(documentRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 42,
        documentName: 'https://93.184.216.34/docs',
        documentType: 'html',
        status: 0,
      }),
    );
    expect(indexQueue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 42,
        ext: 'html',
        documentName: 'https://93.184.216.34/docs',
      }),
    );
    expect(result).toMatchObject({ index_status: 'queued' });
  });
});
