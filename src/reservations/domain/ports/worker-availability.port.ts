export interface WorkerAvailabilityPort {
  countParallelStylists(): Promise<number>;
  getDefaultWorkerId(): Promise<string>;
}
