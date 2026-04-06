import type { ResearchRequest, ResearchReport, ResearchReportSummary } from "../types/research.js";
import { env } from "../config/env.js";
import type { LlmClient, ResearchRepository } from "../domain/ports.js";
import { prisma } from "../lib/prisma.js";
import { OpenAiLlmClient } from "../providers/llm/openaiLlmClient.js";
import { FallbackLlmClient } from "../providers/llm/fallbackLlmClient.js";
import { PdfjsPaperContentProvider } from "../providers/content/pdfjsPaperContentProvider.js";
import { ArxivPaperSearchProvider } from "../providers/search/arxivPaperSearchProvider.js";
import { CompositePaperSearchProvider } from "../providers/search/compositePaperSearchProvider.js";
import { CrossrefPaperSearchProvider } from "../providers/search/crossrefPaperSearchProvider.js";
import { PrismaResearchRepository } from "../repositories/prismaResearchRepository.js";
import { ResearchWorkflow } from "../workflows/researchWorkflow.js";
import { LlmRegistryService } from "./llmRegistryService.js";
import type { ResearchTaskProgressUpdate } from "../types/researchTask.js";

export class ResearchService {
  private readonly llmRegistry: LlmRegistryService;
  private readonly searchProvider: CompositePaperSearchProvider;
  private readonly contentProvider: PdfjsPaperContentProvider;

  constructor(
    private readonly researchRepository: ResearchRepository,
    workspaceDir: string,
  ) {
    this.llmRegistry = new LlmRegistryService(workspaceDir);
    this.searchProvider = new CompositePaperSearchProvider([
      new CrossrefPaperSearchProvider(env.CROSSREF_MAILTO),
      new ArxivPaperSearchProvider()
    ]);
    this.contentProvider = new PdfjsPaperContentProvider();
  }

  async runResearch(
    request: ResearchRequest,
    options: {
      taskId?: string | undefined;
      onProgress?: ((update: ResearchTaskProgressUpdate) => void | Promise<void>) | undefined;
    } = {}
  ): Promise<ResearchReport> {
    const route = await this.llmRegistry.resolvePurpose("research");
    const llmClient: LlmClient =
      route.providerType === "openai" && route.status === "ready" && route.apiKey && route.wireApi
        ? new OpenAiLlmClient(route.apiKey, route.modelId, route.baseUrl, undefined, route.wireApi)
        : new FallbackLlmClient();

    const workflow = new ResearchWorkflow(
      llmClient,
      this.searchProvider,
      this.contentProvider,
      this.researchRepository,
    );

    return workflow.run(request, options);
  }

  async getReport(taskId: string): Promise<ResearchReport | null> {
    return this.researchRepository.findByTaskId(taskId);
  }

  async listRecentReports(limit: number): Promise<ResearchReportSummary[]> {
    return this.researchRepository.listRecent(limit);
  }
}

export function buildResearchService(workspaceDir: string): ResearchService {
  return new ResearchService(new PrismaResearchRepository(prisma), workspaceDir);
}
