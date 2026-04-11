import type { JobRuntimeRunAuditEntry, JobRuntimeSnapshot } from "./jobRuntimeObservabilityService.js";
import type { MemoryCompactionSchedulerService } from "./memoryCompactionSchedulerService.js";
import type { ResearchDiscoverySchedulerService } from "./researchDiscoverySchedulerService.js";

export interface RuntimeJobEntry {
  id: string;
  label: string;
  snapshot: JobRuntimeSnapshot;
  recentRuns: JobRuntimeRunAuditEntry[];
}

export class RuntimeJobsService {
  constructor(
    private readonly deps: {
      researchDiscoverySchedulerService: ResearchDiscoverySchedulerService;
      memoryCompactionSchedulerService: MemoryCompactionSchedulerService;
    },
  ) {}

  async listJobs(limit = 5): Promise<RuntimeJobEntry[]> {
    const normalizedLimit = Math.max(1, Math.min(limit, 50));
    const [discoverySnapshot, discoveryRuns, memorySnapshot, memoryRuns] = await Promise.all([
      this.deps.researchDiscoverySchedulerService.getRuntimeSnapshot(),
      this.deps.researchDiscoverySchedulerService.listRecentRuns(normalizedLimit),
      this.deps.memoryCompactionSchedulerService.getRuntimeSnapshot(),
      this.deps.memoryCompactionSchedulerService.listRecentRuns(normalizedLimit),
    ]);

    return [
      {
        id: "research-discovery-scheduler",
        label: "Research Discovery Scheduler",
        snapshot: discoverySnapshot,
        recentRuns: discoveryRuns,
      },
      {
        id: "memory-auto-compaction",
        label: "Memory Auto-Compaction",
        snapshot: memorySnapshot,
        recentRuns: memoryRuns,
      },
    ];
  }
}
