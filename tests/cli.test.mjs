import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

async function withTempDir(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "reagent-cli-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      resolve(raw);
    });
    req.on("error", reject);
  });
}

async function createFixtureServer() {
  let runtimeLogCallCount = 0;
  const agentSession = {
    roleId: "operator",
    roleLabel: "Operator",
    skillIds: ["workspace-control", "memory-ops"],
    skillLabels: ["Workspace Control", "Memory Ops"],
    providerId: "fallback",
    providerLabel: "Fallback",
    modelId: "gpt-4.1-mini",
    modelLabel: "gpt-4.1-mini",
    llmStatus: "ready",
    llmSource: "env",
    wireApi: null,
    fallbackRoutes: [],
    reasoningEffort: "default",
    defaultRoute: {
      providerId: "fallback",
      providerLabel: "Fallback",
      modelId: "gpt-4.1-mini",
      modelLabel: "gpt-4.1-mini",
      llmStatus: "ready",
      llmSource: "env",
      wireApi: null,
    },
    availableRoles: [
      { id: "operator", label: "Operator" },
      { id: "researcher", label: "Researcher" },
    ],
    availableSkills: [
      { id: "workspace-control", label: "Workspace Control" },
      { id: "memory-ops", label: "Memory Ops" },
      { id: "research-ops", label: "Research Ops" },
    ],
    availableLlmProviders: [
      {
        id: "fallback",
        label: "Fallback",
        models: [{ id: "gpt-4.1-mini", label: "gpt-4.1-mini" }],
      },
      {
        id: "proxy-a",
        label: "Proxy A",
        models: [{ id: "gpt-4o", label: "gpt-4o" }],
      },
    ],
    availableReasoningEfforts: ["default", "low", "medium", "high"],
  };

  const researchTaskId = "11111111-1111-1111-1111-111111111111";
  let schedulerStatus = {
    running: true,
    enabled: false,
    dailyTimeLocal: "08:30",
    senderId: "wx-user-1",
    senderName: "Alice",
    directionIds: ["dir-web-agents"],
    topK: 3,
    maxPapersPerQuery: 4,
    lastRunDateByDirection: {},
    updatedAt: "2026-04-08T08:35:00.000Z",
  };
  const researchDirection = {
    id: "dir-web-agents",
    label: "Web Agents",
    summary: "Track browser automation and tool-using web agents.",
    tlDr: "Focus on strong engineering baselines and browser control.",
    abstract: "",
    background: "The workspace tracks agentic browser stacks.",
    targetProblem: "Reliable browser task execution",
    subDirections: ["browser control", "tool planning"],
    excludedTopics: ["pure RL"],
    preferredVenues: ["ICLR"],
    preferredDatasets: ["WebArena"],
    preferredBenchmarks: ["MiniWoB++"],
    preferredPaperStyles: ["engineering"],
    openQuestions: ["How should evaluation handle flaky websites?"],
    currentGoals: ["Compare open-source baselines"],
    queryHints: ["browser agent", "tool-using web agent"],
    successCriteria: ["Strong reproducibility"],
    blockedDirections: [],
    knownBaselines: ["BrowserGym baseline"],
    evaluationPriorities: ["task success rate"],
    shortTermValidationTargets: ["navigation robustness"],
    priority: "primary",
    enabled: true,
    createdAt: "2026-04-07T08:00:00.000Z",
    updatedAt: "2026-04-08T08:00:00.000Z",
  };
  const researchReport = {
    taskId: researchTaskId,
    topic: "web agents",
    question: "Which open-source baselines are strongest?",
    generatedAt: "2026-04-08T08:40:00.000Z",
    summary: "BrowserGym-style baselines remain the most reusable open-source starting point.",
    findings: ["Open-source baselines are strongest when tightly coupled to evaluation suites."],
    gaps: ["Long-horizon reliability remains weak."],
    nextActions: ["Run a focused BrowserGym baseline comparison."],
    evidence: [
      {
        claim: "BrowserGym is a common baseline.",
        paperId: "paper-1",
        chunkId: "chunk-1",
        support: "The paper compares against BrowserGym.",
        quote: "We compare with BrowserGym.",
        sourceType: "abstract",
        confidence: "medium",
      },
    ],
    warnings: [],
    plan: {
      objective: "Review web-agent baselines",
      subquestions: ["Which baselines are open source?"],
      searchQueries: ["web agent benchmark open source baseline"],
    },
    papers: [
      {
        id: "paper-1",
        title: "Web Agents in the Wild",
        authors: ["A. Researcher"],
        url: "https://example.com/paper-1",
        pdfUrl: "https://example.com/paper-1.pdf",
        year: 2026,
        venue: "ICLR",
        doi: "10.1000/example",
        source: "crossref",
        relevanceReason: "Mentions BrowserGym baselines.",
      },
    ],
    chunks: [
      {
        id: "chunk-1",
        paperId: "paper-1",
        ordinal: 1,
        sourceType: "abstract",
        text: "We compare with BrowserGym and related baselines.",
      },
    ],
    critique: {
      verdict: "moderate",
      summary: "Evidence is usable but still sparse.",
      issues: [],
      recommendations: ["Read the PDF for stronger evidence."],
      supportedEvidenceCount: 1,
      unsupportedEvidenceCount: 0,
      coveredFindingsCount: 1,
      citationDiversity: 1,
      citationCoverage: 1,
    },
  };
  const researchTask = {
    taskId: researchTaskId,
    topic: researchReport.topic,
    question: researchReport.question,
    state: "completed",
    createdAt: "2026-04-08T08:36:00.000Z",
    updatedAt: "2026-04-08T08:40:00.000Z",
    message: "Research report generated.",
    progress: 100,
    attempt: 1,
    sourceTaskId: undefined,
    reportReady: true,
    generatedAt: researchReport.generatedAt,
    roundPath: "research/rounds/11111111-1111-1111-1111-111111111111",
    handoffPath: "research/rounds/11111111-1111-1111-1111-111111111111/handoff.json",
    reviewStatus: "passed",
    transitions: [
      { state: "queued", at: "2026-04-08T08:36:00.000Z", message: "Task queued." },
      { state: "completed", at: "2026-04-08T08:40:00.000Z", message: "Research report generated." },
    ],
    request: {
      topic: researchReport.topic,
      question: researchReport.question,
      maxPapers: 6,
    },
  };
  const handoff = {
    taskId: researchTaskId,
    topic: researchTask.topic,
    question: researchTask.question,
    updatedAt: "2026-04-08T08:40:30.000Z",
    state: researchTask.state,
    progress: researchTask.progress,
    currentMessage: "Research report generated.",
    reviewStatus: researchTask.reviewStatus,
    nextRecommendedAction: "Continue with BrowserGym-focused validation.",
    blockers: [],
    artifacts: [
      {
        kind: "report",
        id: researchTaskId,
        title: "Research report",
        path: `research/rounds/${researchTaskId}/report.json`,
        createdAt: researchReport.generatedAt,
        notes: ["Summary: BrowserGym-focused validation report."],
      },
      {
        kind: "review",
        id: researchTaskId,
        title: "Research review",
        path: `research/rounds/${researchTaskId}/review.md`,
        createdAt: researchReport.generatedAt,
        notes: ["No critique issues were recorded."],
      },
    ],
    roundPath: researchTask.roundPath,
    briefPath: `research/rounds/${researchTaskId}/brief.md`,
    progressLogPath: `research/rounds/${researchTaskId}/progress-log.md`,
    handoffPath: researchTask.handoffPath,
    artifactsPath: `research/rounds/${researchTaskId}/artifacts.json`,
    reportPath: `research/rounds/${researchTaskId}/report.json`,
    reviewPath: `research/rounds/${researchTaskId}/review.md`,
  };
  const discoveryRun = {
    runId: "discovery-run-1",
    generatedAt: "2026-04-08T08:50:00.000Z",
    directionIds: [researchDirection.id],
    directionLabels: [researchDirection.label],
    request: {
      directionId: researchDirection.id,
      maxPapersPerQuery: 4,
      topK: 3,
      pushToWechat: false,
      senderId: "wx-user-1",
    },
    items: [
      {
        id: "paper-1",
        title: "Web Agents in the Wild",
        authors: ["A. Researcher"],
        url: "https://example.com/paper-1",
        pdfUrl: "https://example.com/paper-1.pdf",
        year: 2026,
        venue: "ICLR",
        doi: "10.1000/example",
        source: "crossref",
        directionId: researchDirection.id,
        directionLabel: researchDirection.label,
        query: "web agent benchmark open source baseline",
        queryReason: "Directly matches the direction.",
        venuePreferenceMatched: true,
        datasetOrBenchmarkMatched: true,
        targetProblemMatched: true,
        baselineOrEvaluationMatched: true,
        blockedTopicMatched: false,
      },
    ],
    digest: "One strong paper matched the current research direction.",
    pushed: false,
    warnings: [],
  };
  let feedbackItems = [
    {
      id: "feedback-1",
      feedback: "useful",
      senderId: "wx-user-1",
      senderName: "Alice",
      directionId: researchDirection.id,
      topic: researchReport.topic,
      notes: "Prefer engineering-heavy baselines.",
      createdAt: "2026-04-08T08:55:00.000Z",
      updatedAt: "2026-04-08T08:55:00.000Z",
    },
  ];
  const sourceItem = {
    id: "source-1",
    sourceType: "url",
    url: "https://example.com/blog",
    title: "A blog about web agents",
    author: "Alice",
    publishedAt: "2026-04-01",
    content: "Long source content.",
    excerpt: "A short source excerpt.",
    outboundLinks: ["https://example.com/paper-1"],
    imageUrls: [],
    paperCandidates: [
      {
        title: "Web Agents in the Wild",
        url: "https://example.com/paper-1",
        pdfUrl: "https://example.com/paper-1.pdf",
        reason: "Referenced directly",
        confidence: "high",
      },
    ],
    repoCandidates: [
      {
        url: "https://github.com/example/web-agents",
        owner: "example",
        repo: "web-agents",
        reason: "Repository linked in the article",
        confidence: "medium",
      },
    ],
    createdAt: "2026-04-08T08:48:00.000Z",
    updatedAt: "2026-04-08T08:48:00.000Z",
  };
  const paperReport = {
    id: "paper-report-1",
    sourceItemId: sourceItem.id,
    sourceUrl: sourceItem.url,
    paper: researchReport.papers[0],
    repoCandidates: sourceItem.repoCandidates,
    problemStatement: "Open-source browser agents remain brittle.",
    coreMethod: "Benchmark and compare browser-control baselines.",
    innovationPoints: ["Stronger benchmark coupling"],
    strengths: ["PDF is available for deeper review."],
    weaknesses: ["Only one benchmark is covered."],
    likelyBaselines: ["BrowserGym baseline"],
    recommendation: "Worth reading now.",
    evidenceSnippets: [
      {
        sourceType: "abstract",
        text: "We compare with BrowserGym and related baselines.",
      },
    ],
    conclusions: [],
    evidenceProfile: {
      paperSupportedCount: 1,
      codeSupportedCount: 0,
      inferenceCount: 0,
      speculationCount: 0,
      missingEvidenceCount: 0,
    },
    createdAt: "2026-04-08T08:58:00.000Z",
    updatedAt: "2026-04-08T08:58:00.000Z",
  };
  const repoReport = {
    id: "repo-report-1",
    url: "https://github.com/example/web-agents",
    owner: "example",
    repo: "web-agents",
    defaultBranch: "main",
    title: "web-agents",
    description: "Fixture repository report",
    stars: 42,
    likelyOfficial: true,
    keyPaths: ["src/agent.ts", "configs/eval.yaml"],
    notes: ["Matches the current benchmark focus."],
    createdAt: "2026-04-08T08:59:00.000Z",
    updatedAt: "2026-04-08T08:59:00.000Z",
  };
  const moduleAsset = {
    id: "module-asset-1",
    repoUrl: repoReport.url,
    owner: repoReport.owner,
    repo: repoReport.repo,
    defaultBranch: "main",
    archivePath: "research/repo-archives/web-agents.zip",
    selectedPaths: ["src/agent.ts", "configs/eval.yaml"],
    notes: ["Good starting point for baseline extraction."],
    createdAt: "2026-04-08T09:00:00.000Z",
    updatedAt: "2026-04-08T09:00:00.000Z",
  };
  const presentation = {
    id: "presentation-1",
    title: "Weekly Web Agent Briefing",
    generatedAt: "2026-04-08T09:05:00.000Z",
    sourceReportTaskIds: [researchTaskId],
    slideMarkdown: "# Slide 1",
    filePath: "research/presentations/presentation-1.md",
    pptxPath: "research/presentations/presentation-1.pptx",
    imagePaths: [],
  };
  const directionReport = {
    id: "direction-report-1",
    directionId: researchDirection.id,
    topic: researchDirection.label,
    overview: "Browser agents need stronger engineering baselines and reproducible evaluation.",
    representativePapers: [
      {
        title: researchReport.papers[0].title,
        reason: "Covers open-source baselines",
        sourceUrl: researchReport.papers[0].url,
      },
    ],
    commonBaselines: ["BrowserGym baseline"],
    commonModules: ["Browser controller"],
    openProblems: ["Flaky environment handling"],
    suggestedRoutes: ["Compare BrowserGym with lightweight open-source alternatives"],
    supportingSignals: ["Recent ICLR paper coverage"],
    createdAt: "2026-04-08T09:10:00.000Z",
    updatedAt: "2026-04-08T09:10:00.000Z",
  };
  const graph = {
    generatedAt: "2026-04-08T09:15:00.000Z",
    stats: {
      nodes: 3,
      edges: 2,
      byType: {
        direction: 1,
        workflow_report: 1,
        paper_report: 1,
      },
    },
    nodes: [
      {
        id: researchDirection.id,
        type: "direction",
        label: researchDirection.label,
        tags: ["primary"],
        meta: { enabled: true },
        occurredAt: researchDirection.updatedAt,
      },
      {
        id: researchTaskId,
        type: "workflow_report",
        label: researchReport.topic,
        tags: ["report"],
        meta: { verdict: researchReport.critique.verdict },
        occurredAt: researchReport.generatedAt,
      },
      {
        id: paperReport.id,
        type: "paper_report",
        label: researchReport.papers[0].title,
        tags: ["paper"],
        meta: { venue: "ICLR" },
        occurredAt: paperReport.updatedAt,
      },
    ],
    edges: [
      {
        id: "edge-1",
        source: researchDirection.id,
        target: researchTaskId,
        label: "informs",
        kind: "direction-to-report",
        weight: 3,
        supportingNodeIds: [paperReport.id],
        supportingLabels: [researchReport.papers[0].title],
      },
      {
        id: "edge-2",
        source: researchTaskId,
        target: paperReport.id,
        label: "analyzes",
        kind: "report-to-paper",
        weight: 2,
      },
    ],
  };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const sendJson = (statusCode, body) => {
      res.statusCode = statusCode;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(body));
    };

    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(200, {
        status: "ok",
        agent: "ReAgent",
        time: "2026-04-08T08:30:00.000Z",
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/runtime/meta") {
      sendJson(200, {
        agent: "ReAgent",
        llmProvider: "fallback",
        llmWireApi: null,
        llmModel: "gpt-4.1-mini",
        wechatProvider: "mock",
        workspaceDir: "E:/fixture/workspace",
        openclaw: {
          gatewayUrl: "ws://127.0.0.1:18789",
          cliPath: "openclaw",
          channelId: "openclaw-weixin",
        },
        mcp: {
          supported: false,
          connectors: 0,
          status: "not-configured",
          notes: [],
        },
        deployment: {
          gateway: {
            defaultPort: 18789,
            runtimePort: 18789,
            serviceManager: "startup",
            commands: {
              install: "reagent service install --port 18789",
              start: "reagent service start",
              restart: "reagent service restart",
              status: "reagent service status",
              deepStatus: "reagent service status --deep",
              stop: "reagent service stop",
              uninstall: "reagent service uninstall",
              logs: "reagent service logs",
              doctor: "reagent runtime doctor",
              deepDoctor: "reagent runtime doctor --deep",
            },
            runtime: {
              currentProcessPid: 4321,
              currentProcessOwnsPort: true,
              healthUrl: "http://127.0.0.1:18789/health",
            },
            supervisor: {
              platform: "win32",
              serviceManager: "startup",
              serviceSupported: true,
              serviceAvailable: true,
              availabilityDetail: null,
              taskName: "ReAgent Gateway",
              serviceLabel: "ReAgent Gateway",
              serviceConfigPath: "C:/Users/test/AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Startup/ReAgent Gateway.cmd",
              installed: true,
              installKind: "startup-entry",
              scheduledTaskRegistered: false,
              startupEntryInstalled: true,
              loaded: true,
              loadedText: "startup entry",
              port: 18789,
              workingDirectory: "E:/fixture",
              taskScriptPath: "C:/Users/test/.reagent/daemon/gateway.cmd",
              startupEntryPath: "C:/Users/test/AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Startup/ReAgent Gateway.cmd",
              stdoutLogPath: "C:/Users/test/.reagent/daemon/gateway.out.log",
              stderrLogPath: "C:/Users/test/.reagent/daemon/gateway.err.log",
              healthUrl: "http://127.0.0.1:18789/health",
              healthReachable: true,
              healthStatus: "ok",
              runtimeWorkspaceDir: "E:/fixture/workspace",
              runtimeAgent: "ReAgent",
              runtimeLlmProvider: "fallback",
              runtimeWechatProvider: "mock",
              runtimeOpenClawCli: "openclaw",
              serviceState: "Ready",
              taskState: "Ready",
              lastRunTime: null,
              lastRunResult: null,
              serviceRuntimePid: 4321,
              listenerPid: 4321,
              installCommand: "reagent service install --port 18789",
              startCommand: "reagent service start",
              restartCommand: "reagent service restart",
              statusCommand: "reagent service status",
              deepStatusCommand: "reagent service status --deep",
              stopCommand: "reagent service stop",
              uninstallCommand: "reagent service uninstall",
              logsCommand: "reagent service logs",
              doctorCommand: "reagent runtime doctor",
              deepDoctorCommand: "reagent runtime doctor --deep",
              extraInstallations: [],
              issues: [],
              hints: [],
            },
          },
        },
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/channels/status") {
      sendJson(200, {
        ts: 1775608200000,
        channelOrder: ["wechat"],
        channelLabels: {
          wechat: "WeChat",
        },
        channels: {
          wechat: {
            providerMode: "mock",
            configured: true,
            linked: true,
            running: true,
            connected: true,
            accountId: "wx-test-1",
            accountName: "Fixture User",
            updatedAt: "2026-04-08T08:30:00.000Z",
            notes: ["Mock transport is ready."],
          },
        },
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/channels/wechat/lifecycle-audit") {
      sendJson(200, {
        items: [
          {
            ts: "2026-04-08T08:25:00.000Z",
            providerMode: "mock",
            event: "service-started",
            state: "running",
          },
        ],
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/channels/wechat/messages") {
      sendJson(200, {
        messages: [
          {
            id: "msg-1",
            direction: "inbound",
            text: "hello",
            senderId: "wx-user-1",
            senderName: "Alice",
            createdAt: "2026-04-08T08:20:00.000Z",
          },
          {
            id: "msg-2",
            direction: "outbound",
            text: "hi",
            senderId: "wx-user-1",
            senderName: "Alice",
            createdAt: "2026-04-08T08:21:00.000Z",
          },
        ],
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/channels/wechat/agent/sessions") {
      sendJson(200, {
        sessions: [
          {
            sessionId: "wechat:wx-user-1",
            channel: "wechat",
            senderId: "wx-user-1",
            roleId: "operator",
            roleLabel: "Operator",
            skillIds: ["workspace-control", "memory-ops"],
            skillLabels: ["Workspace Control", "Memory Ops"],
            providerId: "fallback",
            providerLabel: "Fallback",
            modelId: "gpt-4.1-mini",
            modelLabel: "gpt-4.1-mini",
            llmStatus: "ready",
            llmSource: "env",
            fallbackRoutes: agentSession.fallbackRoutes,
            reasoningEffort: agentSession.reasoningEffort,
            turnCount: 4,
            updatedAt: "2026-04-08T08:21:00.000Z",
          },
        ],
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/channels/wechat/agent") {
      sendJson(200, {
        ...agentSession,
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/channels/wechat/agent/role") {
      const raw = await readRequestBody(req);
      const body = raw ? JSON.parse(raw) : {};
      agentSession.roleId = body.roleId;
      agentSession.roleLabel =
        agentSession.availableRoles.find((role) => role.id === body.roleId)?.label ?? body.roleId;
      sendJson(200, { ...agentSession });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/channels/wechat/agent/skills") {
      const raw = await readRequestBody(req);
      const body = raw ? JSON.parse(raw) : {};
      agentSession.skillIds = body.skillIds ?? [];
      agentSession.skillLabels = agentSession.skillIds.map(
        (id) => agentSession.availableSkills.find((skill) => skill.id === id)?.label ?? id,
      );
      sendJson(200, { ...agentSession });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/channels/wechat/agent/model") {
      const raw = await readRequestBody(req);
      const body = raw ? JSON.parse(raw) : {};
      if (body.providerId && body.modelId) {
        agentSession.providerId = body.providerId;
        agentSession.providerLabel =
          agentSession.availableLlmProviders.find((provider) => provider.id === body.providerId)?.label ?? body.providerId;
        agentSession.modelId = body.modelId;
        agentSession.modelLabel =
          agentSession.availableLlmProviders
            .flatMap((provider) => provider.models ?? [])
            .find((model) => model.id === body.modelId)?.label ?? body.modelId;
      } else {
        agentSession.providerId = agentSession.defaultRoute.providerId;
        agentSession.providerLabel = agentSession.defaultRoute.providerLabel;
        agentSession.modelId = agentSession.defaultRoute.modelId;
        agentSession.modelLabel = agentSession.defaultRoute.modelLabel;
      }
      sendJson(200, { ...agentSession });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/channels/wechat/agent/fallbacks") {
      const raw = await readRequestBody(req);
      const body = raw ? JSON.parse(raw) : {};
      agentSession.fallbackRoutes = (body.routes ?? []).map((route) => ({
        providerId: route.providerId,
        providerLabel:
          agentSession.availableLlmProviders.find((provider) => provider.id === route.providerId)?.label ?? route.providerId,
        modelId: route.modelId,
        modelLabel:
          agentSession.availableLlmProviders
            .flatMap((provider) => provider.models ?? [])
            .find((model) => model.id === route.modelId)?.label ?? route.modelId,
        llmStatus: "ready",
        llmSource: "env",
        wireApi: null,
      }));
      sendJson(200, { ...agentSession });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/channels/wechat/agent/reasoning") {
      const raw = await readRequestBody(req);
      const body = raw ? JSON.parse(raw) : {};
      agentSession.reasoningEffort = body.reasoningEffort ?? agentSession.reasoningEffort;
      sendJson(200, { ...agentSession });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/channels/wechat/login/start") {
      await readRequestBody(req);
      sendJson(200, {
        message: "Fixture QR ready",
        pairingCode: "fixture-qr-payload",
        connected: false,
        providerMode: "mock",
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/channels/wechat/login/complete") {
      await readRequestBody(req);
      sendJson(200, {
        providerMode: "mock",
        configured: true,
        linked: true,
        running: true,
        connected: true,
        accountId: "wx-test-1",
        accountName: "Fixture User",
        updatedAt: "2026-04-08T08:31:00.000Z",
        notes: [],
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/channels/wechat/logout") {
      sendJson(200, {
        providerMode: "mock",
        configured: false,
        linked: false,
        running: false,
        connected: false,
        updatedAt: "2026-04-08T08:31:30.000Z",
        notes: [],
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/channels/wechat/chat") {
      const raw = await readRequestBody(req);
      const body = raw ? JSON.parse(raw) : {};
      sendJson(200, {
        accepted: true,
        reply: `chat:${body.senderId}:${body.text}`,
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/channels/wechat/inbound") {
      const raw = await readRequestBody(req);
      const body = raw ? JSON.parse(raw) : {};
      sendJson(200, {
        accepted: true,
        reply: `inbound:${body.senderId}:${body.text}`,
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/channels/wechat/push") {
      const raw = await readRequestBody(req);
      const body = raw ? JSON.parse(raw) : {};
      sendJson(200, {
        accepted: true,
        reply: `push:${body.senderId}:${body.text}`,
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/memory/status") {
      sendJson(200, {
        workspaceDir: "E:/fixture/workspace",
        files: 2,
        searchMode: "hybrid",
        lastUpdatedAt: "2026-04-08T08:10:00.000Z",
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/memory/files") {
      sendJson(200, {
        files: [
          {
            path: "MEMORY.md",
            kind: "long-term",
            size: 128,
            updatedAt: "2026-04-08T08:10:00.000Z",
          },
          {
            path: "memory/2026-04-08.md",
            kind: "daily",
            size: 96,
            updatedAt: "2026-04-08T08:11:00.000Z",
          },
        ],
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/memory/file") {
      sendJson(200, {
        path: url.searchParams.get("path") ?? "MEMORY.md",
        kind: "long-term",
        updatedAt: "2026-04-08T08:10:00.000Z",
        content: "# Memory\n\nFixture content.\n",
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/memory/search") {
      sendJson(200, {
        query: url.searchParams.get("q") ?? "",
        results: [
          {
            path: "MEMORY.md",
            kind: "long-term",
            title: "User Preference",
            snippet: "The user prefers evidence-led writeups.",
            score: 12.4,
            startLine: 3,
            endLine: 8,
          },
        ],
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/memory/recall") {
      sendJson(200, {
        query: url.searchParams.get("q") ?? "",
        generatedAt: "2026-04-08T08:32:00.000Z",
        hits: [
          {
            id: "hit-1",
            layer: "workspace",
            title: "User Preference",
            snippet: "Evidence-led writeups are preferred.",
            score: 9.4,
            confidence: "high",
            sourceType: "user-stated",
            provenance: "memory-index",
            tags: [],
            entityIds: [],
            path: "MEMORY.md",
            kind: "long-term",
          },
        ],
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/memory/remember") {
      const raw = await readRequestBody(req);
      const body = raw ? JSON.parse(raw) : {};
      sendJson(200, {
        path: body.scope === "long-term" ? "MEMORY.md" : "memory/2026-04-08.md",
        kind: body.scope ?? "daily",
        updatedAt: "2026-04-08T08:33:00.000Z",
        content: `# Fixture\n\n${body.content ?? ""}\n`,
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/memory/policy") {
      sendJson(200, {
        updatedAt: "2026-04-08T08:00:00.000Z",
        autoCompactionEnabled: true,
        autoCompactionIntervalMinutes: 30,
        autoCompactionOlderThanDays: 14,
        autoCompactionMinEntries: 6,
        autoCompactionMaxEntries: 12,
        maxDailyEntriesBeforeAutoCompact: 20,
        neverCompactTags: ["pinned"],
        highConfidenceLongTermOnly: false,
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/memory/compact") {
      sendJson(200, {
        generatedAt: "2026-04-08T08:34:00.000Z",
        candidateCount: 6,
        compactedEntryCount: 6,
        sourceEntryIds: ["a", "b", "c"],
        summaryTitle: "Memory Summary 2026-04-01 to 2026-04-07",
        summaryPath: "MEMORY.md",
        summaryEntryId: "summary-1",
        mode: "manual",
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/memory/compactions") {
      sendJson(200, {
        items: [
          {
            id: "compact-1",
            generatedAt: "2026-04-08T08:34:00.000Z",
            candidateCount: 6,
            compactedEntryCount: 6,
            sourceEntryIds: ["a", "b", "c"],
            summaryTitle: "Memory Summary 2026-04-01 to 2026-04-07",
            summaryPath: "MEMORY.md",
            summaryEntryId: "summary-1",
            mode: "manual",
            status: "compacted",
          },
        ],
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/research/recent") {
      sendJson(200, {
        reports: [
          {
            taskId: researchReport.taskId,
            topic: researchReport.topic,
            question: researchReport.question,
            generatedAt: researchReport.generatedAt,
            summary: researchReport.summary,
            critiqueVerdict: researchReport.critique.verdict,
            paperCount: researchReport.papers.length,
            evidenceCount: researchReport.evidence.length,
          },
        ],
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/research/tasks") {
      sendJson(200, {
        tasks: [
          {
            taskId: researchTask.taskId,
            topic: researchTask.topic,
            question: researchTask.question,
            state: researchTask.state,
            createdAt: researchTask.createdAt,
            updatedAt: researchTask.updatedAt,
            message: researchTask.message,
            progress: researchTask.progress,
            attempt: researchTask.attempt,
            sourceTaskId: researchTask.sourceTaskId,
            reportReady: researchTask.reportReady,
            generatedAt: researchTask.generatedAt,
            roundPath: researchTask.roundPath,
            handoffPath: researchTask.handoffPath,
            reviewStatus: researchTask.reviewStatus,
          },
        ],
      });
      return;
    }

    if (req.method === "GET" && url.pathname === `/api/research/tasks/${researchTaskId}`) {
      sendJson(200, {
        ...researchTask,
        handoff,
      });
      return;
    }

    if (req.method === "GET" && url.pathname === `/api/research/tasks/${researchTaskId}/handoff`) {
      sendJson(200, handoff);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/research/tasks") {
      const raw = await readRequestBody(req);
      const body = raw ? JSON.parse(raw) : {};
      sendJson(202, {
        taskId: "22222222-2222-2222-2222-222222222222",
        topic: body.topic,
        question: body.question,
        state: "queued",
        createdAt: "2026-04-08T09:20:00.000Z",
        updatedAt: "2026-04-08T09:20:00.000Z",
        message: "Task queued.",
        progress: 5,
        attempt: 1,
        sourceTaskId: undefined,
        reportReady: false,
        reviewStatus: "pending",
      });
      return;
    }

    if (req.method === "POST" && url.pathname === `/api/research/tasks/${researchTaskId}/retry`) {
      sendJson(202, {
        taskId: "33333333-3333-3333-3333-333333333333",
        topic: researchTask.topic,
        question: researchTask.question,
        state: "queued",
        createdAt: "2026-04-08T09:21:00.000Z",
        updatedAt: "2026-04-08T09:21:00.000Z",
        message: "Task queued.",
        progress: 5,
        attempt: 2,
        sourceTaskId: researchTaskId,
        reportReady: false,
        reviewStatus: "pending",
      });
      return;
    }

    if (req.method === "GET" && url.pathname === `/api/research/${researchTaskId}`) {
      sendJson(200, {
        ...researchReport,
        taskMeta: {
          ...researchTask,
          handoff,
        },
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/research") {
      const raw = await readRequestBody(req);
      const body = raw ? JSON.parse(raw) : {};
      sendJson(201, {
        ...researchReport,
        topic: body.topic ?? researchReport.topic,
        question: body.question ?? researchReport.question,
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/research/directions") {
      sendJson(200, {
        profiles: [researchDirection],
      });
      return;
    }

    if (req.method === "GET" && url.pathname === `/api/research/directions/${researchDirection.id}`) {
      sendJson(200, researchDirection);
      return;
    }

    if (req.method === "GET" && url.pathname === `/api/research/directions/${researchDirection.id}/brief-markdown`) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.end(`# ${researchDirection.label}\n\n${researchDirection.summary}\n`);
      return;
    }

    if (req.method === "GET" && url.pathname === `/api/research/directions/${researchDirection.id}/plan`) {
      sendJson(200, {
        profile: researchDirection,
        candidates: [
          {
            directionId: researchDirection.id,
            directionLabel: researchDirection.label,
            query: "web agent benchmark open source baseline",
            reason: "Matches the current focus and benchmark preferences.",
          },
        ],
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/research/directions") {
      const raw = await readRequestBody(req);
      const body = raw ? JSON.parse(raw) : {};
      Object.assign(researchDirection, body, {
        id: body.id ?? researchDirection.id,
        label: body.label ?? researchDirection.label,
        updatedAt: "2026-04-08T09:22:00.000Z",
      });
      sendJson(201, researchDirection);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/research/directions/import-markdown") {
      const raw = await readRequestBody(req);
      const body = raw ? JSON.parse(raw) : {};
      sendJson(201, {
        ...researchDirection,
        id: body.id ?? researchDirection.id,
        label: "Imported Brief",
        summary: body.markdown.split("\n").find(Boolean)?.replace(/^#\s*/u, "") ?? "Imported Brief",
        updatedAt: "2026-04-08T09:23:00.000Z",
      });
      return;
    }

    if (req.method === "DELETE" && url.pathname === `/api/research/directions/${researchDirection.id}`) {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/research/discovery-plan") {
      sendJson(200, {
        candidates: [
          {
            directionId: researchDirection.id,
            directionLabel: researchDirection.label,
            query: "web agent benchmark open source baseline",
            reason: "Matches direction filters.",
          },
        ],
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/research/discovery/recent") {
      sendJson(200, {
        runs: [
          {
            runId: discoveryRun.runId,
            generatedAt: discoveryRun.generatedAt,
            directionIds: discoveryRun.directionIds,
            directionLabels: discoveryRun.directionLabels,
            topTitle: discoveryRun.items[0].title,
            itemCount: discoveryRun.items.length,
            pushed: discoveryRun.pushed,
          },
        ],
      });
      return;
    }

    if (req.method === "GET" && url.pathname === `/api/research/discovery/runs/${discoveryRun.runId}`) {
      sendJson(200, discoveryRun);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/research/discovery/scheduler") {
      sendJson(200, schedulerStatus);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/research/discovery/scheduler") {
      const raw = await readRequestBody(req);
      const body = raw ? JSON.parse(raw) : {};
      schedulerStatus = {
        ...schedulerStatus,
        ...body,
        updatedAt: "2026-04-08T09:24:00.000Z",
      };
      sendJson(200, schedulerStatus);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/research/discovery/scheduler/tick") {
      sendJson(200, {
        results: [discoveryRun],
        status: schedulerStatus,
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/research/discovery/run") {
      const raw = await readRequestBody(req);
      const body = raw ? JSON.parse(raw) : {};
      sendJson(201, {
        ...discoveryRun,
        request: {
          ...discoveryRun.request,
          ...(body.directionId ? { directionId: body.directionId } : {}),
          ...(body.maxPapersPerQuery ? { maxPapersPerQuery: body.maxPapersPerQuery } : {}),
          ...(body.topK ? { topK: body.topK } : {}),
          ...(body.pushToWechat !== undefined ? { pushToWechat: body.pushToWechat } : {}),
          ...(body.senderId ? { senderId: body.senderId } : {}),
        },
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/research/feedback") {
      sendJson(200, {
        summary: {
          total: feedbackItems.length,
          updatedAt: feedbackItems[feedbackItems.length - 1]?.updatedAt ?? "2026-04-08T08:55:00.000Z",
          counts: {
            useful: feedbackItems.filter((item) => item.feedback === "useful").length,
            "not-useful": 0,
            "more-like-this": 0,
            "less-like-this": 0,
            "too-theoretical": 0,
            "too-engineering-heavy": 0,
            "worth-following": 0,
            "not-worth-following": 0,
          },
          recent: feedbackItems.slice(-3),
        },
        items: feedbackItems,
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/research/feedback") {
      const raw = await readRequestBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const created = {
        id: `feedback-${feedbackItems.length + 1}`,
        feedback: body.feedback,
        senderId: body.senderId,
        senderName: body.senderName,
        directionId: body.directionId,
        topic: body.topic,
        paperTitle: body.paperTitle,
        venue: body.venue,
        sourceUrl: body.sourceUrl,
        notes: body.notes,
        createdAt: "2026-04-08T09:25:00.000Z",
        updatedAt: "2026-04-08T09:25:00.000Z",
      };
      feedbackItems = [...feedbackItems, created];
      sendJson(201, created);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/research/memory-graph") {
      sendJson(200, graph);
      return;
    }

    if (req.method === "GET" && url.pathname === `/api/research/memory-graph/${researchDirection.id}`) {
      sendJson(200, {
        generatedAt: graph.generatedAt,
        node: graph.nodes[0],
        relatedEdges: graph.edges.filter((edge) => edge.source === researchDirection.id || edge.target === researchDirection.id),
        relatedNodes: graph.nodes.filter((node) => node.id !== researchDirection.id),
        raw: researchDirection,
        links: [
          {
            label: "Direction JSON",
            href: `/api/research/directions/${researchDirection.id}`,
            kind: "api",
          },
        ],
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/research/memory-graph/path") {
      sendJson(200, {
        generatedAt: graph.generatedAt,
        view: url.searchParams.get("view") ?? "asset",
        connected: true,
        fromNode: graph.nodes[0],
        toNode: graph.nodes[2],
        hops: 2,
        pathNodeIds: [graph.nodes[0].id, graph.nodes[1].id, graph.nodes[2].id],
        pathNodes: graph.nodes,
        pathEdges: graph.edges.map((edge) => ({
          ...edge,
          sourceLabel: graph.nodes.find((node) => node.id === edge.source)?.label ?? edge.source,
          targetLabel: graph.nodes.find((node) => node.id === edge.target)?.label ?? edge.target,
        })),
        summary: "Web Agents reaches Web Agents in the Wild in 2 hops.",
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/research/memory-graph/explain") {
      sendJson(200, {
        generatedAt: graph.generatedAt,
        view: url.searchParams.get("view") ?? "asset",
        connected: true,
        relationType: "indirect",
        fromNode: graph.nodes[0],
        toNode: graph.nodes[2],
        directEdges: [],
        sharedNeighbors: [graph.nodes[1]],
        supportingLabels: [],
        path: {
          hops: 2,
          pathNodeIds: [graph.nodes[0].id, graph.nodes[1].id, graph.nodes[2].id],
          pathNodes: graph.nodes,
          pathEdges: graph.edges.map((edge) => ({
            ...edge,
            sourceLabel: graph.nodes.find((node) => node.id === edge.source)?.label ?? edge.source,
            targetLabel: graph.nodes.find((node) => node.id === edge.target)?.label ?? edge.target,
          })),
        },
        summary: "Web Agents and Web Agents in the Wild are indirectly connected through the workflow report.",
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/research/memory-graph/report") {
      sendJson(200, {
        generatedAt: graph.generatedAt,
        view: url.searchParams.get("view") ?? "asset",
        filters: {},
        stats: graph.stats,
        isolatedNodeCount: 0,
        hubs: graph.nodes.map((node, index) => ({ node, degree: index === 1 ? 2 : 1 })),
        strongestEdges: graph.edges.map((edge) => ({
          ...edge,
          sourceLabel: graph.nodes.find((node) => node.id === edge.source)?.label ?? edge.source,
          targetLabel: graph.nodes.find((node) => node.id === edge.target)?.label ?? edge.target,
        })),
        components: [
          {
            id: "component-1",
            size: graph.nodes.length,
            edgeCount: graph.edges.length,
            nodeTypes: graph.stats.byType,
            leadNodes: graph.nodes.map((node, index) => ({
              id: node.id,
              label: node.label,
              type: node.type,
              degree: index === 1 ? 2 : 1,
            })),
            supportingLabels: [],
          },
        ],
        summary: ["Fixture graph summary."],
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/research/artifact") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.end("# Fixture Artifact\n\nartifact-body\n");
      return;
    }

    if (req.method === "GET" && url.pathname === `/api/research/source-items/${sourceItem.id}`) {
      sendJson(200, sourceItem);
      return;
    }

    if (req.method === "GET" && url.pathname === `/api/research/paper-reports/${paperReport.id}`) {
      sendJson(200, paperReport);
      return;
    }

    if (req.method === "GET" && url.pathname === `/api/research/repo-reports/${repoReport.id}`) {
      sendJson(200, repoReport);
      return;
    }

    if (req.method === "GET" && url.pathname === `/api/research/module-assets/${moduleAsset.id}`) {
      sendJson(200, moduleAsset);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/research/module-assets/recent") {
      sendJson(200, {
        assets: [moduleAsset],
      });
      return;
    }

    if (req.method === "GET" && url.pathname === `/api/research/presentations/${presentation.id}`) {
      sendJson(200, presentation);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/research/presentations/recent") {
      sendJson(200, {
        presentations: [presentation],
      });
      return;
    }

    if (req.method === "GET" && url.pathname === `/api/research/direction-reports/${directionReport.id}`) {
      sendJson(200, directionReport);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/research/direction-reports/recent") {
      sendJson(200, {
        reports: [directionReport],
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/research/direction-reports/generate") {
      const raw = await readRequestBody(req);
      const body = raw ? JSON.parse(raw) : {};
      sendJson(201, {
        ...directionReport,
        topic: body.topic ?? directionReport.topic,
        directionId: body.directionId ?? directionReport.directionId,
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/ui/runtime-log") {
      runtimeLogCallCount += 1;
      const stdoutLines = ["line-one", "line-two"];
      if (runtimeLogCallCount >= 2) {
        stdoutLines.push("line-three");
      }
      if (runtimeLogCallCount >= 3) {
        stdoutLines.push("line-four");
      }
      sendJson(200, {
        lines: 40,
        source: "gateway-daemon",
        stdout: {
          path: "C:/Users/test/.reagent/daemon/gateway.out.log",
          content: stdoutLines.join("\n"),
        },
        stderr: {
          path: "C:/Users/test/.reagent/daemon/gateway.err.log",
          content: "",
        },
        ts: 1775608440000,
      });
      return;
    }

    sendJson(404, { message: "not found", path: url.pathname });
  });

  await new Promise((resolve) => server.listen(0, "0.0.0.0", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start CLI fixture server.");
  }

  return {
    server,
    baseUrl: `http://127.0.0.2:${address.port}`,
  };
}

async function createFakeOpenClaw(tempDir) {
  const scriptPath = path.join(tempDir, "fake-openclaw.js");
  const commandPath = path.join(tempDir, "fake-openclaw.cmd");
  const logPath = path.join(tempDir, "fake-openclaw.log");

  await writeFile(
    scriptPath,
    `import { appendFile } from "node:fs/promises";
import process from "node:process";

const args = process.argv.slice(2);
const logPath = process.env.OPENCLAW_FAKE_LOG;

async function writeLog() {
  if (!logPath) return;
  await appendFile(logPath, JSON.stringify({ args }) + "\\n", "utf8");
}

await writeLog();

if (args[0] === "plugins" && args[1] === "list" && args.includes("--json")) {
  process.stdout.write(JSON.stringify({
    plugins: [
      { id: "reagent-openclaw", name: "@sinlair/reagent-openclaw", version: "0.1.0", enabled: true, status: "loaded", channelIds: [] }
    ]
  }));
  process.exit(0);
}

if (args[0] === "plugins" && args[1] === "install") {
  process.stdout.write(JSON.stringify({ ok: true, action: "install", args }));
  process.exit(0);
}

if (args[0] === "plugins" && args[1] === "doctor") {
  process.stdout.write(JSON.stringify({ ok: true, action: "doctor", args }));
  process.exit(0);
}

if (args[0] === "plugins" && args[1] === "update") {
  process.stdout.write(JSON.stringify({ ok: true, action: "update", args }));
  process.exit(0);
}

process.stdout.write(JSON.stringify({ ok: true, args }));
`,
    "utf8",
  );

  await writeFile(
    commandPath,
    `@echo off\r\nnode "%~dp0fake-openclaw.js" %*\r\n`,
    "utf8",
  );

  return {
    commandPath,
    logPath,
  };
}

async function createFakeEditor(tempDir) {
  const scriptPath = path.join(tempDir, "fake-editor.js");
  const commandPath = path.join(tempDir, "fake-editor.cmd");

  await writeFile(
    scriptPath,
    `import { writeFile } from "node:fs/promises";
const target = process.argv[2];
await writeFile(target, JSON.stringify({ entries: { "workspace:research-brief": { enabled: false } } }, null, 2) + "\\n", "utf8");
`,
    "utf8",
  );

  await writeFile(commandPath, `@echo off\r\nnode "%~dp0fake-editor.js" %1\r\n`, "utf8");
  return { commandPath };
}

async function runCli(args, cwd, envOverrides = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx/esm", path.join(cwd, "src", "cli.ts"), ...args],
      {
        cwd,
        env: {
          ...process.env,
          NODE_ENV: "test",
          ...envOverrides,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        code: code ?? -1,
        stdout,
        stderr,
      });
    });
  });
}

async function runBuiltCli(args, cwd, envOverrides = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [path.join(cwd, "dist", "cli.js"), ...args],
      {
        cwd,
        env: {
          ...process.env,
          NODE_ENV: "test",
          ...envOverrides,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        code: code ?? -1,
        stdout,
        stderr,
      });
    });
  });
}

async function runLocalPackageBin(args, cwd, envOverrides = {}) {
  return new Promise((resolve, reject) => {
    const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
    const child = spawn(
      npmCommand,
      ["exec", "--", "reagent", ...args],
      {
        cwd,
        env: {
          ...process.env,
          NODE_ENV: "test",
          ...envOverrides,
        },
        shell: process.platform === "win32",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        code: code ?? -1,
        stdout,
        stderr,
      });
    });
  });
}

async function runCliWithAbort(args, cwd, abortAfterMs, envOverrides = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx/esm", path.join(cwd, "src", "cli.ts"), ...args],
      {
        cwd,
        env: {
          ...process.env,
          NODE_ENV: "test",
          ...envOverrides,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (payload) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(payload);
    };

    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {}
    }, abortAfterMs);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      finish({
        code: code ?? -1,
        signal: signal ?? null,
        stdout,
        stderr,
      });
    });
  });
}

async function main() {
  const cwd = process.cwd();
  const packageManifest = JSON.parse(await readFile(path.join(cwd, "package.json"), "utf8"));

  await runTest("Built CLI help prints usage from dist artifact", async () => {
    const result = await runBuiltCli(["--help"], cwd);
    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.stdout.includes("ReAgent CLI"), true);
    assert.equal(result.stdout.includes("reagent runtime"), true);
    assert.equal(result.stdout.includes("reagent daemon"), true);
  });

  await runTest("Built CLI gateway help exposes OpenClaw-style compatibility commands", async () => {
    const result = await runBuiltCli(["gateway", "--help"], cwd);
    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.stdout.includes("reagent gateway probe"), true);
    assert.equal(result.stdout.includes("reagent daemon"), true);
  });

  await runTest("Built CLI version matches package manifest", async () => {
    const result = await runBuiltCli(["version"], cwd);
    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.stdout.trim(), packageManifest.version);
  });

  await runTest("Local package bin resolves through npm exec", async () => {
    const result = await runLocalPackageBin(["version"], cwd, {
      NO_UPDATE_NOTIFIER: "1",
      npm_config_loglevel: "error",
    });
    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.stdout.trim(), packageManifest.version);
  });

  await withTempDir(async () => {
    const fixture = await createFixtureServer();
    try {
      await runTest("CLI health returns JSON payload", async () => {
        const result = await runCli(["health", "--url", fixture.baseUrl, "--json"], cwd);
        assert.equal(result.code, 0, result.stderr);
        const payload = JSON.parse(result.stdout);
        assert.equal(payload.health.status, "ok");
        assert.equal(payload.health.agent, "ReAgent");
      });

      await runTest("CLI gateway health and probe aliases match OpenClaw-style entrypoints", async () => {
        let result = await runCli(["gateway", "health", "--url", fixture.baseUrl, "--json"], cwd);
        assert.equal(result.code, 0, result.stderr);
        let payload = JSON.parse(result.stdout);
        assert.equal(payload.health.status, "ok");

        result = await runCli(["gateway", "probe", "--url", fixture.baseUrl, "--json"], cwd);
        assert.equal(result.code, 0, result.stderr);
        payload = JSON.parse(result.stdout);
        assert.equal(payload.healthReachable, true);
        assert.equal(payload.rpcReachable, true);
        assert.equal(payload.agent, "ReAgent");
      });

      await runTest("CLI status aggregates runtime, channels, and memory", async () => {
        const result = await runCli(["status", "--url", fixture.baseUrl, "--json"], cwd);
        assert.equal(result.code, 0, result.stderr);
        const payload = JSON.parse(result.stdout);
        assert.equal(payload.runtime.agent, "ReAgent");
        assert.equal(payload.channels.channels.wechat.connected, true);
        assert.equal(payload.memory.files, 2);
        assert.equal(payload.gateway.healthReachable, true);
      });

      await runTest("CLI status --all prints detailed status sections", async () => {
        const result = await runCli(["status", "--all", "--url", fixture.baseUrl], cwd);
        assert.equal(result.code, 0, result.stderr);
        assert.equal(result.stdout.includes("WeChat:"), true);
        assert.equal(result.stdout.includes("Account ID:"), true);
        assert.equal(result.stdout.includes("Memory:"), true);
        assert.equal(result.stdout.includes("Search mode:"), true);
      });

      await runTest("CLI status falls back to local diagnostics when the gateway is unreachable", async () => {
        const result = await runCli(["status", "--url", "http://127.0.0.1:1", "--json"], cwd);
        assert.equal(result.code, 0, result.stderr);
        const payload = JSON.parse(result.stdout);
        assert.equal(payload.degraded, true);
        assert.equal(payload.runtime.source, "local-fallback");
        assert.equal(payload.channels.source, "local-fallback");
        assert.equal(payload.memory.source, "local-fallback");
        assert.equal(payload.gateway.healthReachable, false);
      });

      await runTest("CLI runtime status alias aggregates runtime, channels, and memory", async () => {
        const result = await runCli(["runtime", "status", "--url", fixture.baseUrl, "--json"], cwd);
        assert.equal(result.code, 0, result.stderr);
        const payload = JSON.parse(result.stdout);
        assert.equal(payload.runtime.agent, "ReAgent");
        assert.equal(payload.channels.channels.wechat.connected, true);
        assert.equal(payload.memory.files, 2);
      });

      await runTest("CLI channels status prints WeChat provider details", async () => {
        const result = await runCli(["channels", "status", "--url", fixture.baseUrl], cwd);
        assert.equal(result.code, 0, result.stderr);
        assert.ok(result.stdout.includes("Provider: mock"));
        assert.ok(result.stdout.includes("Connected: yes"));
      });

      await runTest("CLI channels status falls back to local summary when the gateway is unreachable", async () => {
        const result = await runCli(["channels", "status", "--probe", "--url", "http://127.0.0.1:1", "--json"], cwd);
        assert.equal(result.code, 0, result.stderr);
        const payload = JSON.parse(result.stdout);
        assert.equal(payload.degraded, true);
        assert.equal(payload.source, "local-fallback");
        assert.equal(payload.channels.wechat.connected, false);
        assert.equal(Array.isArray(payload.warnings), true);
      });

      await runTest("CLI channels agent session exposes current runtime settings", async () => {
        const result = await runCli(
          ["channels", "agent", "session", "wx-user-1", "--url", fixture.baseUrl, "--json"],
          cwd,
        );
        assert.equal(result.code, 0, result.stderr);
        const payload = JSON.parse(result.stdout);
        assert.equal(payload.senderId, "wx-user-1");
        assert.equal(payload.roleId, "operator");
        assert.equal(payload.skillIds.includes("memory-ops"), true);
      });

      await runTest("CLI channels agent mutations update role, skills, model, fallbacks, and reasoning", async () => {
        let result = await runCli(
          ["channels", "agent", "role", "wx-user-1", "researcher", "--url", fixture.baseUrl, "--json"],
          cwd,
        );
        assert.equal(result.code, 0, result.stderr);
        let payload = JSON.parse(result.stdout);
        assert.equal(payload.roleId, "researcher");

        result = await runCli(
          ["channels", "agent", "skills", "wx-user-1", "workspace-control,research-ops", "--url", fixture.baseUrl, "--json"],
          cwd,
        );
        assert.equal(result.code, 0, result.stderr);
        payload = JSON.parse(result.stdout);
        assert.deepEqual(payload.skillIds, ["workspace-control", "research-ops"]);

        result = await runCli(
          ["channels", "agent", "model", "wx-user-1", "proxy-a", "gpt-4o", "--url", fixture.baseUrl, "--json"],
          cwd,
        );
        assert.equal(result.code, 0, result.stderr);
        payload = JSON.parse(result.stdout);
        assert.equal(payload.providerId, "proxy-a");
        assert.equal(payload.modelId, "gpt-4o");

        result = await runCli(
          ["channels", "agent", "fallbacks", "wx-user-1", "proxy-a/gpt-4o,fallback/gpt-4.1-mini", "--url", fixture.baseUrl, "--json"],
          cwd,
        );
        assert.equal(result.code, 0, result.stderr);
        payload = JSON.parse(result.stdout);
        assert.equal(payload.fallbackRoutes.length, 2);

        result = await runCli(
          ["channels", "agent", "reasoning", "wx-user-1", "high", "--url", fixture.baseUrl, "--json"],
          cwd,
        );
        assert.equal(result.code, 0, result.stderr);
        payload = JSON.parse(result.stdout);
        assert.equal(payload.reasoningEffort, "high");

        result = await runCli(
          ["channels", "agent", "model", "wx-user-1", "clear", "--url", fixture.baseUrl, "--json"],
          cwd,
        );
        assert.equal(result.code, 0, result.stderr);
        payload = JSON.parse(result.stdout);
        assert.equal(payload.providerId, "fallback");

        result = await runCli(
          ["channels", "agent", "fallbacks", "wx-user-1", "clear", "--url", fixture.baseUrl, "--json"],
          cwd,
        );
        assert.equal(result.code, 0, result.stderr);
        payload = JSON.parse(result.stdout);
        assert.equal(payload.fallbackRoutes.length, 0);
      });

      await runTest("CLI channels chat, inbound, and push commands send message payloads", async () => {
        let result = await runCli(
          ["channels", "chat", "wx-user-1", "hello-ui", "--url", fixture.baseUrl, "--json"],
          cwd,
        );
        assert.equal(result.code, 0, result.stderr);
        let payload = JSON.parse(result.stdout);
        assert.equal(payload.reply, "chat:wx-user-1:hello-ui");

        result = await runCli(
          ["channels", "inbound", "wx-user-1", "hello-wechat", "--url", fixture.baseUrl, "--json"],
          cwd,
        );
        assert.equal(result.code, 0, result.stderr);
        payload = JSON.parse(result.stdout);
        assert.equal(payload.reply, "inbound:wx-user-1:hello-wechat");

        result = await runCli(
          ["channels", "push", "wx-user-1", "hello-push", "--url", fixture.baseUrl, "--json"],
          cwd,
        );
        assert.equal(result.code, 0, result.stderr);
        payload = JSON.parse(result.stdout);
        assert.equal(payload.reply, "push:wx-user-1:hello-push");

        result = await runCli(
          ["channels", "send", "wx-user-1", "--text", "hello-send", "--url", fixture.baseUrl, "--json"],
          cwd,
        );
        assert.equal(result.code, 0, result.stderr);
        payload = JSON.parse(result.stdout);
        assert.equal(payload.reply, "push:wx-user-1:hello-send");
      });

      await runTest("CLI memory search returns JSON hits", async () => {
        const result = await runCli(
          ["memory", "search", "evidence-led", "--url", fixture.baseUrl, "--json"],
          cwd,
        );
        assert.equal(result.code, 0, result.stderr);
        const payload = JSON.parse(result.stdout);
        assert.equal(payload.results.length, 1);
        assert.equal(payload.results[0].path, "MEMORY.md");
      });

      await runTest("CLI memory remember posts content and returns file payload", async () => {
        const result = await runCli(
          ["memory", "remember", "Capture this note", "--url", fixture.baseUrl, "--json"],
          cwd,
        );
        assert.equal(result.code, 0, result.stderr);
        const payload = JSON.parse(result.stdout);
        assert.ok(payload.content.includes("Capture this note"));
      });

      await runTest("CLI logs reads runtime log snapshot", async () => {
        const result = await runCli(["logs", "--url", fixture.baseUrl, "--json"], cwd);
        assert.equal(result.code, 0, result.stderr);
        const payload = JSON.parse(result.stdout);
        assert.equal(payload.source, "gateway-daemon");
        assert.ok(payload.stdout.content.includes("line-two"));
      });

      await runTest("CLI logs --follow prints appended runtime log lines", async () => {
        const result = await runCliWithAbort(
          ["runtime", "logs", "--url", fixture.baseUrl, "--follow", "--poll", "250"],
          cwd,
          900,
        );
        assert.equal(result.stderr.trim(), "");
        assert.equal(result.stdout.includes("line-one"), true);
        assert.equal(result.stdout.includes("line-three"), true);
      });

      await runTest("CLI dashboard no-open reports URL without launching a browser", async () => {
        const result = await runCli(["dashboard", "--url", fixture.baseUrl, "--no-open", "--json"], cwd);
        assert.equal(result.code, 0, result.stderr);
        const payload = JSON.parse(result.stdout);
        assert.equal(payload.url, `${fixture.baseUrl}/`);
        assert.equal(payload.opened, false);
      });

      await runTest("CLI service help exposes the supervised runtime entrypoint", async () => {
        const result = await runCli(["service", "help"], cwd);
        assert.equal(result.code, 0, result.stderr);
        assert.equal(result.stdout.includes("reagent service status"), true);
        assert.equal(result.stdout.includes("reagent service run"), true);
      });

      await runTest("CLI research task and report commands expose synchronous and queued flows", async () => {
        const taskId = "11111111-1111-1111-1111-111111111111";

        let result = await runCli(
          ["research", "run", "web agents", "--question", "Which baselines are strongest?", "--url", fixture.baseUrl, "--json"],
          cwd,
        );
        assert.equal(result.code, 0, result.stderr);
        let payload = JSON.parse(result.stdout);
        assert.equal(payload.topic, "web agents");
        assert.equal(payload.question, "Which baselines are strongest?");

        result = await runCli(
          ["research", "enqueue", "tool-using web agents", "--max-papers", "5", "--url", fixture.baseUrl, "--json"],
          cwd,
        );
        assert.equal(result.code, 0, result.stderr);
        payload = JSON.parse(result.stdout);
        assert.equal(payload.state, "queued");
        assert.equal(payload.topic, "tool-using web agents");

        result = await runCli(["research", "tasks", "--url", fixture.baseUrl, "--json"], cwd);
        assert.equal(result.code, 0, result.stderr);
        payload = JSON.parse(result.stdout);
        assert.equal(payload.tasks[0].taskId, taskId);

        result = await runCli(["research", "task", taskId, "--url", fixture.baseUrl, "--json"], cwd);
        assert.equal(result.code, 0, result.stderr);
        payload = JSON.parse(result.stdout);
        assert.equal(payload.taskId, taskId);
        assert.equal(payload.handoff.taskId, taskId);

        result = await runCli(["research", "report", taskId, "--url", fixture.baseUrl, "--json"], cwd);
        assert.equal(result.code, 0, result.stderr);
        payload = JSON.parse(result.stdout);
        assert.equal(payload.taskId, taskId);

        result = await runCli(["research", "retry", taskId, "--url", fixture.baseUrl, "--json"], cwd);
        assert.equal(result.code, 0, result.stderr);
        payload = JSON.parse(result.stdout);
        assert.equal(payload.sourceTaskId, taskId);

        result = await runCli(["research", "handoff", taskId, "--url", fixture.baseUrl, "--json"], cwd);
        assert.equal(result.code, 0, result.stderr);
        payload = JSON.parse(result.stdout);
        assert.equal(payload.nextRecommendedAction.includes("BrowserGym"), true);
        assert.equal(payload.reportPath.endsWith("/report.json"), true);
      });

      await runTest("CLI research direction and discovery commands manage profiles and scheduler", async () => {
        await withTempDir(async (tempDir) => {
          const directionId = "dir-web-agents";
          const directionSummary = "Track browser automation and tool-using web agents.";
          const directionJsonPath = path.join(tempDir, "direction.json");
          const briefPath = path.join(tempDir, "brief.md");
          const briefOutPath = path.join(tempDir, "brief-export.md");

          await writeFile(
            directionJsonPath,
            `${JSON.stringify(
              {
                id: directionId,
                label: "Updated Web Agents",
                summary: directionSummary,
                priority: "primary",
                enabled: true,
                currentGoals: ["Compare open-source baselines"],
                queryHints: ["browser agent"],
              },
              null,
              2,
            )}\n`,
            "utf8",
          );
          await writeFile(briefPath, "# Imported Brief\n\nTrack browser agents.\n", "utf8");

          let result = await runCli(
            ["research", "direction", "upsert", directionJsonPath, "--url", fixture.baseUrl, "--json"],
            cwd,
          );
          assert.equal(result.code, 0, result.stderr);
          let payload = JSON.parse(result.stdout);
          assert.equal(payload.profile.label, "Updated Web Agents");

          result = await runCli(
            ["research", "direction", directionId, "--url", fixture.baseUrl, "--json"],
            cwd,
          );
          assert.equal(result.code, 0, result.stderr);
          payload = JSON.parse(result.stdout);
          assert.equal(payload.id, directionId);

          result = await runCli(
            ["research", "direction", "plan", directionId, "--url", fixture.baseUrl, "--json"],
            cwd,
          );
          assert.equal(result.code, 0, result.stderr);
          payload = JSON.parse(result.stdout);
          assert.equal(payload.candidates[0].directionId, directionId);

          result = await runCli(
            ["research", "direction", "brief", directionId, "--url", fixture.baseUrl, "--out", briefOutPath],
            cwd,
          );
          assert.equal(result.code, 0, result.stderr);
          const exportedBrief = await readFile(briefOutPath, "utf8");
          assert.equal(exportedBrief.includes(directionSummary), true);

          result = await runCli(
            ["research", "direction", "import-brief", briefPath, "--id", "dir-imported", "--url", fixture.baseUrl, "--json"],
            cwd,
          );
          assert.equal(result.code, 0, result.stderr);
          payload = JSON.parse(result.stdout);
          assert.equal(payload.profile.id, "dir-imported");

          result = await runCli(
            ["research", "discovery", "run", "--direction", directionId, "--top-k", "4", "--max-papers", "6", "--url", fixture.baseUrl, "--json"],
            cwd,
          );
          assert.equal(result.code, 0, result.stderr);
          payload = JSON.parse(result.stdout);
          assert.equal(payload.request.topK, 4);
          assert.equal(payload.request.maxPapersPerQuery, 6);

          result = await runCli(
            ["research", "discovery", "scheduler", "set", "--enable", "--time", "09:30", "--direction-ids", "dir-web-agents,dir-extra", "--url", fixture.baseUrl, "--json"],
            cwd,
          );
          assert.equal(result.code, 0, result.stderr);
          payload = JSON.parse(result.stdout);
          assert.equal(payload.enabled, true);
          assert.deepEqual(payload.directionIds, ["dir-web-agents", "dir-extra"]);

          result = await runCli(
            ["research", "discovery", "scheduler", "tick", "--url", fixture.baseUrl, "--json"],
            cwd,
          );
          assert.equal(result.code, 0, result.stderr);
          payload = JSON.parse(result.stdout);
          assert.equal(payload.results[0].runId, "discovery-run-1");

          result = await runCli(
            ["research", "direction", "delete", directionId, "--url", fixture.baseUrl, "--json"],
            cwd,
          );
          assert.equal(result.code, 0, result.stderr);
          payload = JSON.parse(result.stdout);
          assert.equal(payload.deleted, true);
        });
      });

      await runTest("CLI research feedback, graph, and artifact detail commands surface stored artifacts", async () => {
        await withTempDir(async (tempDir) => {
          const directionId = "dir-web-agents";
          const artifactOutPath = path.join(tempDir, "artifact.md");

          let result = await runCli(["research", "feedback", "--url", fixture.baseUrl, "--json"], cwd);
          assert.equal(result.code, 0, result.stderr);
          let payload = JSON.parse(result.stdout);
          assert.equal(payload.summary.total >= 1, true);

          result = await runCli(
            ["research", "feedback", "record", "useful", "--topic", "browser agents", "--notes", "keep engineering-heavy results", "--url", fixture.baseUrl, "--json"],
            cwd,
          );
          assert.equal(result.code, 0, result.stderr);
          payload = JSON.parse(result.stdout);
          assert.equal(payload.feedback, "useful");

          result = await runCli(
            ["research", "graph", "report", "--view", "asset", "--types", "direction,workflow_report", "--url", fixture.baseUrl, "--json"],
            cwd,
          );
          assert.equal(result.code, 0, result.stderr);
          payload = JSON.parse(result.stdout);
          assert.equal(payload.stats.nodes, 3);

          result = await runCli(
            ["research", "graph", "node", directionId, "--url", fixture.baseUrl, "--json"],
            cwd,
          );
          assert.equal(result.code, 0, result.stderr);
          payload = JSON.parse(result.stdout);
          assert.equal(payload.node.id, directionId);

          result = await runCli(
            ["research", "graph", "path", directionId, "paper-report-1", "--url", fixture.baseUrl, "--json"],
            cwd,
          );
          assert.equal(result.code, 0, result.stderr);
          payload = JSON.parse(result.stdout);
          assert.equal(payload.connected, true);

          result = await runCli(
            ["research", "artifact", "research/notes/demo.md", "--url", fixture.baseUrl, "--out", artifactOutPath],
            cwd,
          );
          assert.equal(result.code, 0, result.stderr);
          const artifactContent = await readFile(artifactOutPath, "utf8");
          assert.equal(artifactContent.includes("artifact-body"), true);

          result = await runCli(["research", "source", "source-1", "--url", fixture.baseUrl, "--json"], cwd);
          assert.equal(result.code, 0, result.stderr);
          payload = JSON.parse(result.stdout);
          assert.equal(payload.id, "source-1");

          result = await runCli(["research", "paper-report", "paper-report-1", "--url", fixture.baseUrl, "--json"], cwd);
          assert.equal(result.code, 0, result.stderr);
          payload = JSON.parse(result.stdout);
          assert.equal(payload.id, "paper-report-1");

          result = await runCli(["research", "repo-report", "repo-report-1", "--url", fixture.baseUrl, "--json"], cwd);
          assert.equal(result.code, 0, result.stderr);
          payload = JSON.parse(result.stdout);
          assert.equal(payload.id, "repo-report-1");

          result = await runCli(["research", "module-assets", "--url", fixture.baseUrl, "--json"], cwd);
          assert.equal(result.code, 0, result.stderr);
          payload = JSON.parse(result.stdout);
          assert.equal(payload.assets[0].id, "module-asset-1");

          result = await runCli(["research", "module-asset", "module-asset-1", "--url", fixture.baseUrl, "--json"], cwd);
          assert.equal(result.code, 0, result.stderr);
          payload = JSON.parse(result.stdout);
          assert.equal(payload.id, "module-asset-1");

          result = await runCli(["research", "presentations", "--url", fixture.baseUrl, "--json"], cwd);
          assert.equal(result.code, 0, result.stderr);
          payload = JSON.parse(result.stdout);
          assert.equal(payload.presentations[0].id, "presentation-1");

          result = await runCli(["research", "presentation", "presentation-1", "--url", fixture.baseUrl, "--json"], cwd);
          assert.equal(result.code, 0, result.stderr);
          payload = JSON.parse(result.stdout);
          assert.equal(payload.id, "presentation-1");

          result = await runCli(["research", "direction-reports", "--url", fixture.baseUrl, "--json"], cwd);
          assert.equal(result.code, 0, result.stderr);
          payload = JSON.parse(result.stdout);
          assert.equal(payload.reports[0].id, "direction-report-1");

          result = await runCli(["research", "direction-report", "direction-report-1", "--url", fixture.baseUrl, "--json"], cwd);
          assert.equal(result.code, 0, result.stderr);
          payload = JSON.parse(result.stdout);
          assert.equal(payload.id, "direction-report-1");

          result = await runCli(
            ["research", "direction-report", "generate", "--topic", "browser agents", "--days", "5", "--url", fixture.baseUrl, "--json"],
            cwd,
          );
          assert.equal(result.code, 0, result.stderr);
          payload = JSON.parse(result.stdout);
          assert.equal(payload.topic, "browser agents");
        });
      });
    } finally {
      await new Promise((resolve, reject) => {
        fixture.server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  });

  await withTempDir(async (tempDir) => {
    const workspaceDir = path.join(tempDir, "workspace");
    await mkdir(workspaceDir, { recursive: true });

    await runTest("CLI config set/get/unset manages workspace config files", async () => {
      let result = await runCli(
        ["config", "set", "llm.defaults.agent.providerId", "proxy-a", "--workspace", workspaceDir, "--json"],
        cwd,
      );
      assert.equal(result.code, 0, result.stderr);
      let payload = JSON.parse(result.stdout);
      assert.equal(payload.keyPath, "llm.defaults.agent.providerId");
      assert.equal(payload.nextValue, "proxy-a");

      result = await runCli(
        ["config", "get", "llm.defaults.agent.providerId", "--workspace", workspaceDir, "--json"],
        cwd,
      );
      assert.equal(result.code, 0, result.stderr);
      payload = JSON.parse(result.stdout);
      assert.equal(payload.value, "proxy-a");

      result = await runCli(
        ["config", "unset", "llm.defaults.agent.providerId", "--workspace", workspaceDir, "--json"],
        cwd,
      );
      assert.equal(result.code, 0, result.stderr);
      payload = JSON.parse(result.stdout);
      assert.equal(payload.previousValue, "proxy-a");

      result = await runCli(
        ["config", "get", "llm.defaults.agent.providerId", "--workspace", workspaceDir, "--json"],
        cwd,
      );
      assert.equal(result.code, 0, result.stderr);
      payload = JSON.parse(result.stdout);
      assert.equal(payload.found, false);
      assert.equal(payload.value, null);
    });

    await runTest("CLI config validate and schema expose managed config surface", async () => {
      let result = await runCli(["config", "validate", "--workspace", workspaceDir, "--json"], cwd);
      assert.equal(result.code, 0, result.stderr);
      let payload = JSON.parse(result.stdout);
      assert.equal(payload.workspaceDir.endsWith("workspace"), true);
      assert.equal(Array.isArray(payload.files), true);

      result = await runCli(["config", "schema", "--workspace", workspaceDir, "--json"], cwd);
      assert.equal(result.code, 0, result.stderr);
      payload = JSON.parse(result.stdout);
      assert.equal(payload.properties.llm.description.includes("llm-providers.json"), true);
      assert.equal(payload.properties.mcp.description.includes("mcp-servers.json"), true);
    });

    await runTest("CLI config set can persist structured JSON values", async () => {
      const result = await runCli(
        [
          "config",
          "set",
          "mcp.servers",
          "[{\"serverLabel\":\"maps\",\"serverUrl\":\"https://example.com/sse\",\"enabled\":true}]",
          "--workspace",
          workspaceDir,
          "--strict-json",
          "--json",
        ],
        cwd,
      );
      assert.equal(result.code, 0, result.stderr);

      const fileRaw = await readFile(path.join(workspaceDir, "channels", "mcp-servers.json"), "utf8");
      const filePayload = JSON.parse(fileRaw);
      assert.equal(filePayload.servers[0].serverLabel, "maps");
      assert.equal(filePayload.servers[0].enabled, true);
    });

    await runTest("CLI config export, import, and edit operate on managed config files", async () => {
      const exportPath = path.join(tempDir, "llm-export.json");
      let result = await runCli(
        ["config", "export", "llm", "--workspace", workspaceDir, "--out", exportPath],
        cwd,
      );
      assert.equal(result.code, 0, result.stderr);
      let exported = JSON.parse(await readFile(exportPath, "utf8"));
      assert.equal("providers" in exported, true);

      const importPath = path.join(tempDir, "skills-import.json");
      await writeFile(
        importPath,
        `${JSON.stringify({ entries: { "workspace:travel-concierge": { enabled: true } } }, null, 2)}\n`,
        "utf8",
      );
      result = await runCli(
        ["config", "import", "skills", importPath, "--workspace", workspaceDir, "--json"],
        cwd,
      );
      assert.equal(result.code, 0, result.stderr);
      let payload = JSON.parse(result.stdout);
      assert.equal(payload.alias, "skills");
      let imported = JSON.parse(await readFile(path.join(workspaceDir, "channels", "skills-config.json"), "utf8"));
      assert.equal(imported.entries["workspace:travel-concierge"].enabled, true);

      const fakeEditor = await createFakeEditor(tempDir);
      result = await runCli(
        ["config", "edit", "skills", "--workspace", workspaceDir, "--editor", fakeEditor.commandPath, "--json"],
        cwd,
      );
      assert.equal(result.code, 0, result.stderr);
      payload = JSON.parse(result.stdout);
      assert.equal(payload.alias, "skills");
      assert.equal(payload.changed, true);
      imported = JSON.parse(await readFile(path.join(workspaceDir, "channels", "skills-config.json"), "utf8"));
      assert.equal(imported.entries["workspace:research-brief"].enabled, false);
    });
  });

  await withTempDir(async (tempDir) => {
    const fakeOpenClaw = await createFakeOpenClaw(tempDir);

    await runTest("CLI plugins list merges bundled metadata with OpenClaw host state", async () => {
      const result = await runCli(
        ["plugins", "list", "--openclaw-cli", fakeOpenClaw.commandPath, "--json"],
        cwd,
        { OPENCLAW_FAKE_LOG: fakeOpenClaw.logPath },
      );
      assert.equal(result.code, 0, result.stderr);
      const payload = JSON.parse(result.stdout);
      assert.equal(payload.host.available, true);
      assert.equal(payload.host.plugins.length >= 1, true);
      assert.equal(payload.bundled.some((entry) => entry.plugin.id === "reagent-openclaw"), true);
    });

    await runTest("CLI plugins marketplace list surfaces bundled repo plugins", async () => {
      const result = await runCli(["plugins", "marketplace", "list", "reagent", "--json"], cwd);
      assert.equal(result.code, 0, result.stderr);
      const payload = JSON.parse(result.stdout);
      assert.equal(payload.marketplace.resolvedSource, "reagent");
      assert.equal(Array.isArray(payload.plugins), true);
      assert.equal(payload.plugins.some((entry) => entry.id === "reagent-openclaw"), true);
    });

    await runTest("CLI plugins inspect --all aliases to the bundled plugin list", async () => {
      const result = await runCli(
        ["plugins", "inspect", "--all", "--openclaw-cli", fakeOpenClaw.commandPath, "--json"],
        cwd,
        { OPENCLAW_FAKE_LOG: fakeOpenClaw.logPath },
      );
      assert.equal(result.code, 0, result.stderr);
      const payload = JSON.parse(result.stdout);
      assert.equal(Array.isArray(payload.bundled), true);
      assert.equal(payload.bundled.some((entry) => entry.plugin.id === "reagent-openclaw"), true);
    });

    await runTest("CLI plugins install delegates to OpenClaw CLI with bundled install spec", async () => {
      const result = await runCli(
        ["plugins", "install", "reagent-openclaw", "--openclaw-cli", fakeOpenClaw.commandPath, "--yes", "--json"],
        cwd,
        { OPENCLAW_FAKE_LOG: fakeOpenClaw.logPath },
      );
      assert.equal(result.code, 0, result.stderr);
      const payload = JSON.parse(result.stdout);
      assert.equal(payload.ok, true);
      assert.equal(payload.action, "install");
      assert.equal(payload.args.includes("@sinlair/reagent-openclaw"), true);
      assert.equal(payload.args.includes("--yes"), true);

      const logRaw = await readFile(fakeOpenClaw.logPath, "utf8");
      assert.equal(logRaw.includes("@sinlair/reagent-openclaw"), true);
    });

    await runTest("CLI plugins update delegates to OpenClaw CLI", async () => {
      const result = await runCli(
        ["plugins", "update", "reagent-openclaw", "--openclaw-cli", fakeOpenClaw.commandPath, "--json"],
        cwd,
        { OPENCLAW_FAKE_LOG: fakeOpenClaw.logPath },
      );
      assert.equal(result.code, 0, result.stderr);
      const payload = JSON.parse(result.stdout);
      assert.equal(payload.ok, true);
      assert.equal(payload.action, "update");
      assert.equal(payload.args.includes("reagent-openclaw"), true);
    });
  });

  await runTest("CLI daemon alias forwards to the service surface", async () => {
    const result = await runCli(["daemon", "status", "--json"], cwd);
    assert.equal(result.code, 0, result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.equal(typeof payload.statusCommand, "string");
    assert.equal(payload.statusCommand, "reagent service status");
  });
}

await main();
