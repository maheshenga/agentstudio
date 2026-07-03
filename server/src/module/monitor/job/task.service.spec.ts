import { TaskRegistry } from '../../../common/decorators/task.decorator';
import { TaskService } from './task.service';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'task-service-test-uuid'),
}));

class ExternalTaskProvider {
  async run() {
    return true;
  }
}

describe('TaskService', () => {
  const registry = TaskRegistry.getInstance() as any;
  let originalTasks: Map<string, any>;

  beforeEach(() => {
    originalTasks = registry.tasks;
    registry.tasks = new Map([
      [
        'external.task',
        {
          classOrigin: ExternalTaskProvider,
          methodName: 'run',
          metadata: { name: 'external.task' },
        },
      ],
    ]);
  });

  afterEach(() => {
    registry.tasks = originalTasks;
    jest.clearAllMocks();
  });

  it('resolves task providers outside the current module context', async () => {
    const provider = new ExternalTaskProvider();
    const moduleRef = {
      get: jest.fn((token, options?: { strict?: boolean }) => {
        if (token === ExternalTaskProvider && options?.strict === false) return provider;
        throw new Error('strict lookup failed');
      }),
    };
    const service = new TaskService(moduleRef as any, { addJobLog: jest.fn() } as any, { getMemoryInfo: jest.fn(), getMemoryReport: jest.fn(), checkMemory: jest.fn() } as any);

    await (service as any).initializeTasks();

    expect(moduleRef.get).toHaveBeenCalledWith(ExternalTaskProvider, { strict: false });
    expect(service.getTasks()).toContain('external.task');
  });
});
