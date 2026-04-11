import {
  getBooleanFlag,
  getIntegerFlag,
  getStringFlag,
  type ParsedOptions,
} from "./args.js";
import {
  dispatchResearchFeedbackCommand as runResearchFeedbackCommandDispatch,
  dispatchResearchGraphCommand as runResearchGraphCommandDispatch,
} from "./dispatch.js";
import type { ResearchFeedbackRecord, ResearchFeedbackSummary } from "../types/researchFeedback.js";
import type {
  ResearchMemoryGraph,
  ResearchMemoryGraphQuery,
  ResearchMemoryNode,
  ResearchMemoryNodeDetail,
} from "../types/researchMemoryGraph.js";

type GatewayContextLike = {
  baseUrl: string;
  timeoutMs: number;
};

type GatewayRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  timeoutMs?: number;
  accept?: string;
};

type ResearchFeedbackPayload = {
  summary: ResearchFeedbackSummary;
  items: ResearchFeedbackRecord[];
};

export type ResearchGraphReportPayload = {
  generatedAt: string;
  view: "asset" | "paper";
  filters: ResearchMemoryGraphQuery;
  stats: ResearchMemoryGraph["stats"];
  isolatedNodeCount?: number | undefined;
  hubs?: Array<{ node: ResearchMemoryNode; degree: number }> | undefined;
  topNodes?: Array<{ node: ResearchMemoryNode; degree: number }> | undefined;
  strongestEdges: Array<{
    id: string;
    source: string;
    target: string;
    label: string;
    kind?: string | undefined;
    weight?: number | undefined;
    sourceLabel: string;
    targetLabel: string;
  }>;
  components?: Array<{
    id: string;
    size: number;
    edgeCount: number;
    nodeTypes: Record<string, number>;
    leadNodes: Array<{
      id: string;
      label: string;
      type: string;
      degree: number;
    }>;
    supportingLabels: string[];
  }> | undefined;
  isolatedNodes?: ResearchMemoryNode[] | undefined;
  summary?: string[] | undefined;
};

export type ResearchGraphPathPayload = {
  generatedAt: string;
  view: "asset" | "paper";
  connected: boolean;
  fromNode: ResearchMemoryNode | null;
  toNode: ResearchMemoryNode | null;
  hops: number;
  pathNodeIds: string[];
  pathNodes: ResearchMemoryNode[];
  pathEdges: Array<{
    id: string;
    source: string;
    target: string;
    label: string;
    kind?: string | undefined;
    weight?: number | undefined;
    sourceLabel: string;
    targetLabel: string;
  }>;
  summary: string;
};

export type ResearchGraphExplainPayload = {
  generatedAt: string;
  view: "asset" | "paper";
  connected: boolean;
  relationType: "missing" | "direct" | "indirect" | "disconnected";
  fromNode: ResearchMemoryNode | null;
  toNode: ResearchMemoryNode | null;
  directEdges: ResearchGraphPathPayload["pathEdges"];
  sharedNeighbors: ResearchMemoryNode[];
  supportingLabels: string[];
  path: {
    hops: number;
    pathNodeIds: string[];
    pathNodes: ResearchMemoryNode[];
    pathEdges: ResearchGraphPathPayload["pathEdges"];
  } | null;
  summary: string;
};

export interface ResearchGraphFeedbackCliDeps {
  resolveGatewayContext(options: ParsedOptions): Promise<GatewayContextLike>;
  requestGatewayJson<T>(baseUrl: string, targetPath: string, options?: GatewayRequestOptions): Promise<T>;
  buildQueryString(values: Record<string, string | number | boolean | undefined>): string;
  printJson(value: unknown): void;
  printResearchFeedback(summary: ResearchFeedbackSummary, items: ResearchFeedbackRecord[]): void;
  resolveResearchGraphQuery(options: ParsedOptions): ResearchMemoryGraphQuery;
  printResearchGraph(graph: ResearchMemoryGraph): void;
  printResearchGraphReport(report: ResearchGraphReportPayload): void;
  printResearchGraphPath(payload: ResearchGraphPathPayload | ResearchGraphExplainPayload): void;
  resolveRequiredEntityId(options: ParsedOptions, label: string): string;
  renderResearchHelp(): void;
}

export function createResearchGraphFeedbackCli(deps: ResearchGraphFeedbackCliDeps) {
  function buildResearchGraphQueryString(
    options: ParsedOptions,
    extra: Record<string, string | number | boolean | undefined> = {},
  ): string {
    const query = deps.resolveResearchGraphQuery(options);
    return deps.buildQueryString({
      ...(query.view ? { view: query.view } : {}),
      ...(query.types ? { types: query.types.join(",") } : {}),
      ...(query.search ? { search: query.search } : {}),
      ...(query.topic ? { topic: query.topic } : {}),
      ...(query.dateFrom ? { dateFrom: query.dateFrom } : {}),
      ...(query.dateTo ? { dateTo: query.dateTo } : {}),
      ...extra,
    });
  }

  async function researchFeedbackListCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const limit = getIntegerFlag(options, "limit") ?? 20;
    const payload = await deps.requestGatewayJson<ResearchFeedbackPayload>(
      context.baseUrl,
      `/api/research/feedback?${deps.buildQueryString({ limit })}`,
      { timeoutMs: context.timeoutMs },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }
    deps.printResearchFeedback(payload.summary, payload.items);
  }

  async function researchFeedbackRecordCommand(options: ParsedOptions): Promise<void> {
    const feedback = getStringFlag(options, "kind") ?? options.positionals[0];
    if (!feedback?.trim()) {
      throw new Error("research feedback record requires a feedback kind.");
    }

    const senderId = getStringFlag(options, "sender");
    const senderName = getStringFlag(options, "name", "sender-name");
    const directionId = getStringFlag(options, "direction");
    const topic = getStringFlag(options, "topic");
    const paperTitle = getStringFlag(options, "paper-title", "paper");
    const venue = getStringFlag(options, "venue");
    const sourceUrl = getStringFlag(options, "source-url", "url");
    const notes = getStringFlag(options, "notes");

    const context = await deps.resolveGatewayContext(options);
    const payload = await deps.requestGatewayJson<ResearchFeedbackRecord>(
      context.baseUrl,
      "/api/research/feedback",
      {
        method: "POST",
        body: {
          feedback: feedback.trim(),
          ...(senderId ? { senderId } : {}),
          ...(senderName ? { senderName } : {}),
          ...(directionId ? { directionId } : {}),
          ...(topic ? { topic } : {}),
          ...(paperTitle ? { paperTitle } : {}),
          ...(venue ? { venue } : {}),
          ...(sourceUrl ? { sourceUrl } : {}),
          ...(notes ? { notes } : {}),
        },
        timeoutMs: context.timeoutMs,
      },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }
    console.log(`Recorded feedback ${payload.feedback} at ${payload.createdAt}`);
  }

  async function researchFeedbackCommand(options: ParsedOptions): Promise<void> {
    await runResearchFeedbackCommandDispatch(options, {
      renderResearchHelp: deps.renderResearchHelp,
      researchFeedbackListCommand,
      researchFeedbackRecordCommand,
    });
  }

  async function researchGraphShowCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const payload = await deps.requestGatewayJson<ResearchMemoryGraph>(
      context.baseUrl,
      `/api/research/memory-graph?${buildResearchGraphQueryString(options)}`,
      { timeoutMs: context.timeoutMs },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }
    deps.printResearchGraph(payload);
  }

  async function researchGraphNodeCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const nodeId = deps.resolveRequiredEntityId(options, "graph node");
    const payload = await deps.requestGatewayJson<ResearchMemoryNodeDetail>(
      context.baseUrl,
      `/api/research/memory-graph/${encodeURIComponent(nodeId)}?${buildResearchGraphQueryString(options)}`,
      { timeoutMs: context.timeoutMs },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }
    console.log(`${payload.node.type}:${payload.node.label}`);
    console.log(`Links: ${payload.links.length}`);
    console.log(`Related nodes: ${payload.relatedNodes.length}`);
  }

  async function researchGraphPathCommand(options: ParsedOptions): Promise<void> {
    const from = getStringFlag(options, "from") ?? options.positionals[0];
    const to = getStringFlag(options, "to") ?? options.positionals[1];
    if (!from?.trim() || !to?.trim()) {
      throw new Error("research graph path requires both from and to node ids.");
    }

    const context = await deps.resolveGatewayContext(options);
    const view = getStringFlag(options, "view");
    const payload = await deps.requestGatewayJson<ResearchGraphPathPayload>(
      context.baseUrl,
      `/api/research/memory-graph/path?${deps.buildQueryString({
        from: from.trim(),
        to: to.trim(),
        ...((view === "asset" || view === "paper") ? { view } : {}),
      })}`,
      { timeoutMs: context.timeoutMs },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }
    deps.printResearchGraphPath(payload);
  }

  async function researchGraphExplainCommand(options: ParsedOptions): Promise<void> {
    const from = getStringFlag(options, "from") ?? options.positionals[0];
    const to = getStringFlag(options, "to") ?? options.positionals[1];
    if (!from?.trim() || !to?.trim()) {
      throw new Error("research graph explain requires both from and to node ids.");
    }

    const context = await deps.resolveGatewayContext(options);
    const view = getStringFlag(options, "view");
    const payload = await deps.requestGatewayJson<ResearchGraphExplainPayload>(
      context.baseUrl,
      `/api/research/memory-graph/explain?${deps.buildQueryString({
        from: from.trim(),
        to: to.trim(),
        ...((view === "asset" || view === "paper") ? { view } : {}),
      })}`,
      { timeoutMs: context.timeoutMs },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }
    deps.printResearchGraphPath(payload);
  }

  async function researchGraphReportCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const limit = getIntegerFlag(options, "limit") ?? 6;
    const payload = await deps.requestGatewayJson<ResearchGraphReportPayload>(
      context.baseUrl,
      `/api/research/memory-graph/report?${buildResearchGraphQueryString(options, { limit })}`,
      { timeoutMs: context.timeoutMs },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }
    deps.printResearchGraphReport(payload);
  }

  async function researchGraphCommand(options: ParsedOptions): Promise<void> {
    await runResearchGraphCommandDispatch(options, {
      renderResearchHelp: deps.renderResearchHelp,
      researchGraphShowCommand,
      researchGraphNodeCommand,
      researchGraphPathCommand,
      researchGraphExplainCommand,
      researchGraphReportCommand,
    });
  }

  return {
    researchFeedbackListCommand,
    researchFeedbackRecordCommand,
    researchFeedbackCommand,
    researchGraphShowCommand,
    researchGraphNodeCommand,
    researchGraphPathCommand,
    researchGraphExplainCommand,
    researchGraphReportCommand,
    researchGraphCommand,
  };
}
