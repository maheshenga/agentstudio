jest.mock('uuid', () => ({
  v4: jest.fn(() => 'upload-service-test-uuid'),
}));

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { UploadService } from './upload.service';

describe('UploadService security', () => {
  let tempRoot: string;
  let uploadDir: string;
  let uploadRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
    softDelete: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let categoryRepo: Record<string, jest.Mock>;
  let service: UploadService;

  const file = (content: string): Express.Multer.File =>
    ({
      buffer: Buffer.from(content),
      originalname: 'demo.txt',
      mimetype: 'text/plain',
      size: Buffer.byteLength(content),
    }) as Express.Multer.File;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-service-'));
    uploadDir = path.join(tempRoot, 'upload');
    fs.mkdirSync(uploadDir, { recursive: true });

    uploadRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      softDelete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    categoryRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };
    const config = {
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'file.uploadDir') return uploadDir;
        if (key === 'file.serveRoot') return '/profile';
        return fallback;
      }),
    } as unknown as ConfigService;

    service = new UploadService(uploadRepo as any, categoryRepo as any, config);
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('rejects unsafe chunk upload ids before writing files', async () => {
    await expect(
      service.chunkFileUpload(file('a'), {
        uploadId: '../escape',
        fileName: 'demo.txt',
        index: 0,
        totalChunks: 1,
      }),
    ).rejects.toThrow('Invalid upload id');

    expect(fs.existsSync(path.join(uploadDir, 'thunk'))).toBe(false);
  });

  it('stores chunk files under upload thunk directory without raw filenames in path', async () => {
    await service.chunkFileUpload(file('a'), {
      uploadId: 'upload_123',
      fileName: '../demo.txt',
      index: 0,
      totalChunks: 1,
    });

    const chunkDir = path.join(uploadDir, 'thunk', 'upload_123');
    expect(fs.readdirSync(chunkDir)).toEqual(['chunk-0.part']);
    expect(fs.existsSync(path.join(uploadDir, 'thunk', 'demo.txt@0'))).toBe(false);
  });

  it('rejects unsafe chunk merge ids before reading files', async () => {
    const result = await service.chunkMergeFile({
      uploadId: '../escape',
      fileName: 'demo.txt',
    });

    expect(result.code).toBe(400);
    expect(result.msg).toBe('Invalid upload id');
  });

  it('merges new chunk filenames by numeric chunk index', async () => {
    const chunkDir = path.join(uploadDir, 'thunk', 'upload_123');
    fs.mkdirSync(chunkDir, { recursive: true });
    fs.writeFileSync(path.join(chunkDir, 'chunk-10.part'), 'c');
    fs.writeFileSync(path.join(chunkDir, 'chunk-2.part'), 'b');
    fs.writeFileSync(path.join(chunkDir, 'chunk-0.part'), 'a');
    uploadRepo.save.mockResolvedValue({});

    const result = await service.chunkMergeFile({
      uploadId: 'upload_123',
      fileName: 'demo.txt',
    });

    expect(result.code).toBe(200);
    expect(fs.readFileSync(path.join(uploadDir, result.data.newFileName), 'utf8')).toBe('abc');
  });

  it('returns a failed result for missing downloads', async () => {
    uploadRepo.findOne.mockResolvedValue(null);

    const result = await service.download(404);

    expect(result.code).toBe(404);
    expect(result.msg).toBe('Attachment not found');
  });

  it('returns safe local download metadata for existing attachments', async () => {
    const filePath = path.join(uploadDir, 'demo.txt');
    fs.writeFileSync(filePath, 'hello');
    uploadRepo.findOne.mockResolvedValue({
      id: 1,
      originName: 'demo.txt',
      storagePath: 'demo.txt',
      mimeType: 'text/plain',
      deleteTime: null,
    });

    const result = await service.download(1);

    expect(result.code).toBe(200);
    expect(result.data).toEqual({
      filePath,
      fileName: 'demo.txt',
      mimeType: 'text/plain',
    });
  });

  it('rejects download records that resolve outside the upload directory', async () => {
    uploadRepo.findOne.mockResolvedValue({
      id: 2,
      originName: 'secret.txt',
      storagePath: '../secret.txt',
      mimeType: 'text/plain',
      deleteTime: null,
    });

    const result = await service.download(2);

    expect(result.code).toBe(404);
    expect(result.msg).toBe('Attachment not found');
  });
});
