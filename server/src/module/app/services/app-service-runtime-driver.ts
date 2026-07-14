export type AppServiceRuntimeDriverName = 'pm2' | 'podman';

export type AppServiceRuntimeEndpoint =
  | { kind: 'tcp'; port: number }
  | { kind: 'unix'; socketPath: string };

export interface AppServiceRuntimeSpec {
  appCode: string;
  version: string;
  processName: string;
  releaseDir: string;
  entryFile: 'dist/index.js';
  healthPath: string;
  loopbackPort: number;
  memoryMb: number;
}

export interface AppServiceProcessSnapshot {
  processName: string;
  status: 'starting' | 'online' | 'stopped' | 'failed';
  pid: number | null;
  restartCount: number;
  memoryBytes: number;
  cpuPercent: number;
}

export interface AppServiceCommandResult {
  stdout: string;
  stderr: string;
}

export abstract class AppServiceRuntimeDriver {
  abstract readonly name: AppServiceRuntimeDriverName;
  abstract start(spec: AppServiceRuntimeSpec): Promise<AppServiceProcessSnapshot>;
  abstract stop(processName: string): Promise<void>;
  abstract delete(processName: string): Promise<void>;
  abstract describe(processName: string): Promise<AppServiceProcessSnapshot | null>;
  abstract logs(processName: string, lines: number): Promise<AppServiceCommandResult>;
  abstract endpoint(input: {
    processName: string;
    loopbackPort: number;
  }): AppServiceRuntimeEndpoint;
}
