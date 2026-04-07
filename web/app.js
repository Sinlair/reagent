const i18n = window.ReAgentI18n;

const NAV_STORAGE_KEY = "reagent-ui-nav-collapsed";
const UI_AGENT_SENDER_ID = "ui-wechat-user";

const state = {
  activeTab: "landing",
  latestReport: null,
  researchBriefs: [],
  selectedResearchBrief: null,
  selectedResearchBriefId: null,
  selectedDirectionReport: null,
  selectedDirectionReportId: null,
  selectedPresentation: null,
  selectedPresentationId: null,
  selectedModuleAsset: null,
  selectedModuleAssetId: null,
  latestMessages: [],
  transportMessages: [],
  recentReports: [],
  discoveryScheduler: null,
  discoveryRuns: [],
  directionReports: [],
  presentations: [],
  moduleAssets: [],
  feedbackItems: [],
  feedbackSummary: null,
  wechatLifecycleAudit: [],
  researchTasks: [],
  lang: "zh",
  navCollapsed: false,
  navDrawerOpen: false,
  paletteOpen: false,
  paletteQuery: "",
  paletteActiveIndex: 0,
  health: null,
  channels: null,
  agentSession: null,
  agentSessions: [],
  agentsPanel: "overview",
  runtimeMeta: null,
  skillsFilter: "",
  skillsStatusFilter: "all",
  selectedSkillId: null,
  skillMessage: "",
  settingsPanel: "communications",
  memoryStatus: null,
  memoryFiles: [],
  selectedMemoryFilePath: null,
  graphData: null,
  graphDetail: null,
  graphSearch: "",
  graphDateRange: "all",
  graphTypeFilters: [],
  selectedGraphNodeId: null,
  selectedResearchTaskId: null,
  selectedResearchTask: null
};

const els = {
  shell: document.querySelector("#app-shell"),
  sidebar: document.querySelector("#sidebar"),
  content: document.querySelector("#content-root"),
  workspacePulse: document.querySelector(".workspace-pulse"),
  currentTabLabel: document.querySelector("#current-tab-label"),
  pageTitle: document.querySelector("#page-title"),
  pageSubtitle: document.querySelector("#page-subtitle"),
  productAlerts: document.querySelector("#product-alerts"),
  topbarDeliveryPill: document.querySelector("#topbar-delivery-pill"),
  healthChip: document.querySelector("#health-chip"),
  healthDot: document.querySelector("#health-dot"),
  wechatConnection: document.querySelector("#wechat-connection"),
  wechatMode: document.querySelector("#wechat-mode"),
  memoryFileCount: document.querySelector("#memory-file-count"),
  memoryMode: document.querySelector("#memory-mode"),
  researchSessionCount: document.querySelector("#research-session-count"),
  latestReportAge: document.querySelector("#latest-report-age"),
  sidebarStatusText: document.querySelector("#sidebar-status-text"),
  sidebarStatusDot: document.querySelector("#sidebar-status-dot"),
  sidebarNote: document.querySelector("#sidebar-note"),
  workspacePath: document.querySelector("#workspace-path"),
  wechatProviderOverview: document.querySelector("#wechat-provider-overview"),
  memoryModeOverview: document.querySelector("#memory-mode-overview"),
  chatTransportPill: document.querySelector("#chat-transport-pill"),
  chatMemoryPill: document.querySelector("#chat-memory-pill"),
  chatOverviewCards: document.querySelector("#chat-overview-cards"),
  agentSessionSummary: document.querySelector("#agent-session-summary"),
  agentRuntimeNotes: document.querySelector("#agent-runtime-notes"),
  agentRoleSelect: document.querySelector("#agent-role-select"),
  agentModelSelect: document.querySelector("#agent-model-select"),
  agentModelHint: document.querySelector("#agent-model-hint"),
  agentModelReset: document.querySelector("#agent-model-reset"),
  agentFallbacksList: document.querySelector("#agent-fallbacks-list"),
  agentFallbacksSelect: document.querySelector("#agent-fallbacks-select"),
  agentFallbacksAdd: document.querySelector("#agent-fallbacks-add"),
  agentFallbacksClear: document.querySelector("#agent-fallbacks-clear"),
  agentReasoningSelect: document.querySelector("#agent-reasoning-select"),
  agentReasoningHint: document.querySelector("#agent-reasoning-hint"),
  agentSkills: document.querySelector("#agent-skills"),
  skillsCatalog: document.querySelector("#skills-catalog"),
  skillsFilterInput: document.querySelector("#skills-filter-input"),
  skillsStatusFilter: document.querySelector("#skills-status-filter"),
  skillDetail: document.querySelector("#skill-detail"),
  skillDetailModal: document.querySelector("#skill-detail-modal"),
  agentSessionsList: document.querySelector("#agent-sessions-list"),
  settingsOverview: document.querySelector("#settings-overview"),
  chatLatestReport: document.querySelector("#chat-latest-report"),
  chatSessionList: document.querySelector("#chat-session-list"),
  chatResearchTopic: document.querySelector("#chat-research-topic"),
  chatResearchQuestion: document.querySelector("#chat-research-question"),
  chatReportTaskId: document.querySelector("#chat-report-task-id"),
  chatActivity: document.querySelector("#chat-activity"),
  chatNotes: document.querySelector("#chat-notes"),
  workspacePulseKicker: document.querySelector("#workspace-pulse-kicker"),
  workspacePulseHeadline: document.querySelector("#workspace-pulse-headline"),
  workspacePulseSubtitle: document.querySelector("#workspace-pulse-subtitle"),
  workspacePulseMetrics: document.querySelector("#workspace-pulse-metrics"),
  workspacePulseActions: document.querySelector("#workspace-pulse-actions"),
  landingCommandBar: document.querySelector("#landing-command-bar"),
  landingLiveCards: document.querySelector("#landing-live-cards"),
  landingLatestReport: document.querySelector("#landing-latest-report"),
  landingSessionList: document.querySelector("#landing-session-list"),
  launchChecklist: document.querySelector("#launch-checklist"),
  overviewCards: document.querySelector("#overview-cards"),
  overviewActivity: document.querySelector("#overview-activity"),
  overviewLatestReport: document.querySelector("#overview-latest-report"),
  overviewSessionList: document.querySelector("#overview-session-list"),
  overviewNotes: document.querySelector("#overview-notes"),
  wechatStatus: document.querySelector("#wechat-status"),
  pairingCode: document.querySelector("#pairing-code"),
  pairingQr: document.querySelector("#pairing-qr"),
  pairingHint: document.querySelector("#pairing-hint"),
  channelNotes: document.querySelector("#channel-notes"),
  channelLifecycleAudit: document.querySelector("#channel-lifecycle-audit"),
  wechatMessages: document.querySelector("#wechat-messages"),
  wechatChannelMessages: document.querySelector("#wechat-channel-messages"),
  wechatDisplayName: document.querySelector("#wechat-display-name"),
  wechatStart: document.querySelector("#wechat-start"),
  wechatComplete: document.querySelector("#wechat-complete"),
  wechatLogout: document.querySelector("#wechat-logout"),
  wechatMessage: document.querySelector("#wechat-message"),
  researchSessionList: document.querySelector("#research-session-list"),
  discoverySchedulerForm: document.querySelector("#discovery-scheduler-form"),
  discoverySchedulerTime: document.querySelector("#discovery-scheduler-time"),
  discoverySchedulerEnabled: document.querySelector("#discovery-scheduler-enabled"),
  discoverySchedulerSenderId: document.querySelector("#discovery-scheduler-sender-id"),
  discoverySchedulerSenderName: document.querySelector("#discovery-scheduler-sender-name"),
  discoverySchedulerDirectionIds: document.querySelector("#discovery-scheduler-direction-ids"),
  discoverySchedulerTopK: document.querySelector("#discovery-scheduler-topk"),
  discoverySchedulerMaxPapers: document.querySelector("#discovery-scheduler-max-papers"),
  discoverySchedulerRun: document.querySelector("#discovery-scheduler-run"),
  discoverySchedulerStatus: document.querySelector("#discovery-scheduler-status"),
  discoverySchedulerRuns: document.querySelector("#discovery-scheduler-runs"),
  researchTaskList: document.querySelector("#research-task-list"),
  reportTaskId: document.querySelector("#report-task-id"),
  researchTopic: document.querySelector("#research-topic"),
  researchQuestion: document.querySelector("#research-question"),
  researchReport: document.querySelector("#research-report"),
  researchBriefForm: document.querySelector("#research-brief-form"),
  researchBriefId: document.querySelector("#research-brief-id"),
  researchBriefLabel: document.querySelector("#research-brief-label"),
  researchBriefSummary: document.querySelector("#research-brief-summary"),
  researchBriefTlDr: document.querySelector("#research-brief-tldr"),
  researchBriefBackground: document.querySelector("#research-brief-background"),
  researchBriefTargetProblem: document.querySelector("#research-brief-target-problem"),
  researchBriefSuccessCriteria: document.querySelector("#research-brief-success-criteria"),
  researchBriefKnownBaselines: document.querySelector("#research-brief-known-baselines"),
  researchBriefEvaluationPriorities: document.querySelector("#research-brief-evaluation-priorities"),
  researchBriefShortTermValidationTargets: document.querySelector("#research-brief-short-term-validation-targets"),
  researchBriefCurrentGoals: document.querySelector("#research-brief-current-goals"),
  researchBriefOpenQuestions: document.querySelector("#research-brief-open-questions"),
  researchBriefQueryHints: document.querySelector("#research-brief-query-hints"),
  researchBriefBlockedDirections: document.querySelector("#research-brief-blocked-directions"),
  researchBriefPreferredVenues: document.querySelector("#research-brief-preferred-venues"),
  researchBriefPreferredDatasets: document.querySelector("#research-brief-preferred-datasets"),
  researchBriefPreferredBenchmarks: document.querySelector("#research-brief-preferred-benchmarks"),
  researchBriefPreferredPaperStyles: document.querySelector("#research-brief-preferred-paper-styles"),
  researchBriefPriority: document.querySelector("#research-brief-priority"),
  researchBriefEnabled: document.querySelector("#research-brief-enabled"),
  researchBriefMarkdownForm: document.querySelector("#research-brief-markdown-form"),
  researchBriefMarkdown: document.querySelector("#research-brief-markdown"),
  researchBriefList: document.querySelector("#research-brief-list"),
  researchBriefStatus: document.querySelector("#research-brief-status"),
  researchBriefNew: document.querySelector("#research-brief-new"),
  researchBriefExport: document.querySelector("#research-brief-export"),
  researchBriefDelete: document.querySelector("#research-brief-delete"),
  directionReportForm: document.querySelector("#direction-report-form"),
  directionReportTopic: document.querySelector("#direction-report-topic"),
  directionReportId: document.querySelector("#direction-report-id"),
  directionReportDays: document.querySelector("#direction-report-days"),
  directionReportList: document.querySelector("#direction-report-list"),
  presentationList: document.querySelector("#presentation-list"),
  moduleAssetList: document.querySelector("#module-asset-list"),
  feedbackForm: document.querySelector("#research-feedback-form"),
  feedbackSignal: document.querySelector("#feedback-signal"),
  feedbackTopic: document.querySelector("#feedback-topic"),
  feedbackPaperTitle: document.querySelector("#feedback-paper-title"),
  feedbackNotes: document.querySelector("#feedback-notes"),
  feedbackSummary: document.querySelector("#feedback-summary"),
  feedbackList: document.querySelector("#feedback-list"),
  graphSummary: document.querySelector("#graph-summary"),
  graphCanvas: document.querySelector("#graph-canvas"),
  graphEdges: document.querySelector("#graph-edges"),
  graphStats: document.querySelector("#graph-stats"),
  graphDetail: document.querySelector("#graph-detail"),
  graphSearch: document.querySelector("#graph-search"),
  graphDateRange: document.querySelector("#graph-date-range"),
  graphTypeFilters: document.querySelector("#graph-type-filters"),
  graphClearFilters: document.querySelector("#graph-clear-filters"),
  memoryQuery: document.querySelector("#memory-query"),
  memoryResults: document.querySelector("#memory-results"),
  memoryScope: document.querySelector("#memory-scope"),
  memoryTitle: document.querySelector("#memory-title"),
  memoryContent: document.querySelector("#memory-content"),
  memoryFiles: document.querySelector("#memory-files"),
  memoryFileViewer: document.querySelector("#memory-file-viewer"),
  runtimeLogStdoutPath: document.querySelector("#runtime-log-stdout-path"),
  runtimeLogStderrPath: document.querySelector("#runtime-log-stderr-path"),
  runtimeLogOutput: document.querySelector("#runtime-log-output"),
  runtimeLogError: document.querySelector("#runtime-log-error"),
  navBackdrop: document.querySelector("#nav-backdrop"),
  navToggle: document.querySelector("#nav-toggle"),
  navCollapseToggle: document.querySelector("#nav-collapse-toggle"),
  focusChatInput: document.querySelector("#focus-chat-input"),
  paletteOverlay: document.querySelector("#command-palette-overlay"),
  paletteInput: document.querySelector("#command-palette-input"),
  paletteResults: document.querySelector("#command-palette-results"),
  navTabs: [...document.querySelectorAll(".sidebar-nav [data-tab]")],
  panels: [...document.querySelectorAll("[data-panel]")],
  quickCommands: [...document.querySelectorAll("[data-prompt]")]
};

const QUICK_ACTIONS = [
  { id: "cmd-research", label: "/research agentic rag", desc: "actions.insertPrompt", prompt: "/research agentic rag" },
  { id: "cmd-memory", label: "/memory user preference", desc: "actions.insertPrompt", prompt: "/memory user preference" },
  { id: "cmd-remember", label: "/remember user prefers TypeScript", desc: "actions.insertPrompt", prompt: "/remember user prefers TypeScript" }
];

const GRAPH_TYPE_ORDER = [
  "direction",
  "discovery_run",
  "source_item",
  "paper",
  "paper_report",
  "repo",
  "repo_report",
  "module_asset",
  "workflow_report",
  "presentation"
];

const GRAPH_TYPE_LABELS = {
  direction: "Direction",
  discovery_run: "Discovery",
  source_item: "Source",
  paper: "Paper",
  paper_report: "Paper Report",
  repo: "Repo",
  repo_report: "Repo Report",
  module_asset: "Module",
  workflow_report: "Workflow",
  presentation: "Deck"
};

let graphLoadToken = 0;
let graphDetailToken = 0;
let graphSearchTimerId = 0;

function copy() {
  return i18n?.getCopy?.(state) ?? {};
}

function t(path, fallback = "") {
  const value = i18n?.t?.(state, path);
  return typeof value === "string" ? value : fallback;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function nl2br(value) {
  return escapeHtml(value).replaceAll("\n", "<br />");
}

function formatTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString(state.lang === "zh" ? "zh-CN" : "en-US", {
    hour12: false
  });
}

function formatRelativeTime(value) {
  if (!value) return "-";
  const diffMs = new Date(value).getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);
  const rtf = new Intl.RelativeTimeFormat(state.lang === "zh" ? "zh-CN" : "en-US", { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  return rtf.format(diffDays, "day");
}

function trimText(value, max = 180) {
  if (!value) return "";
  return value.length <= max ? value : `${value.slice(0, max).trimEnd()}...`;
}

function clipBlock(value, max = 2400) {
  if (!value) return "";
  return value.length <= max ? value : `${value.slice(0, max).trimEnd()}\n...`;
}

function formatGraphType(type) {
  return GRAPH_TYPE_LABELS[type] || type;
}

function getGraphDateFrom() {
  if (state.graphDateRange === "all") return null;
  const days = Number.parseInt(state.graphDateRange, 10);
  if (!Number.isFinite(days)) return null;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function buildGraphUrl() {
  const params = new URLSearchParams();
  if (state.graphSearch.trim()) {
    params.set("search", state.graphSearch.trim());
  }
  if (state.graphTypeFilters.length > 0) {
    params.set("types", state.graphTypeFilters.join(","));
  }
  const dateFrom = getGraphDateFrom();
  if (dateFrom) {
    params.set("dateFrom", dateFrom);
  }
  const query = params.toString();
  return query ? `/api/research/memory-graph?${query}` : "/api/research/memory-graph";
}

function adjustTextareaHeight() {
  els.wechatMessage.style.height = "auto";
  els.wechatMessage.style.height = `${Math.min(els.wechatMessage.scrollHeight, 180)}px`;
}

function rememberNavCollapsed(value) {
  try {
    window.localStorage.setItem(NAV_STORAGE_KEY, value ? "1" : "0");
  } catch {}
}

function loadRememberedNavCollapsed() {
  try {
    return window.localStorage.getItem(NAV_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

async function requestJson(url, options) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message || `${response.status} ${response.statusText}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function requestText(url, options) {
  const response = await fetch(url, options);

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message || `${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function startResearchTask(topic, question, options = {}) {
  const task = await requestJson("/api/research/tasks", {
    method: "POST",
    body: JSON.stringify({
      topic,
      question: question || undefined,
      maxPapers: 10
    })
  });

  clearResearchSelections();
  state.selectedResearchTaskId = task.taskId;
  state.selectedResearchTask = null;
  if (els.reportTaskId) {
    els.reportTaskId.value = task.taskId;
  }
  if (els.chatReportTaskId) {
    els.chatReportTaskId.value = task.taskId;
  }

  await loadResearchTasks();
  await hydrateResearchTask(task.taskId);

  if (options.openResearch) {
    window.location.hash = "research";
    setActiveTab("research");
  } else {
    await refreshAll();
  }

  return task;
}

async function openResearchTaskOrReport(taskId, options = {}) {
  if (!taskId) {
    throw new Error(state.lang === "zh" ? "\u8bf7\u8f93\u5165\u4efb\u52a1\u7f16\u53f7\u3002" : "Please enter a task number.");
  }

  try {
    await hydrateResearchTask(taskId);
  } catch {
    await hydrateReport(taskId);
  }

  if (options.openResearch) {
    window.location.hash = "research";
    setActiveTab("research");
  } else {
    await refreshAll();
  }
}

function parseListInput(value) {
  if (!value) return [];
  return [
    ...new Set(
      String(value)
        .split(/\n|,/u)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ];
}

function formatListInput(values) {
  return Array.isArray(values) ? values.join("\n") : "";
}

function clearResearchBriefStatus() {
  if (!els.researchBriefStatus) return;
  els.researchBriefStatus.hidden = true;
  els.researchBriefStatus.className = "brief-status";
  els.researchBriefStatus.textContent = "";
}

function setResearchBriefStatus(message, tone = "") {
  if (!els.researchBriefStatus) return;
  els.researchBriefStatus.hidden = false;
  els.researchBriefStatus.className = `brief-status${tone ? ` brief-status--${tone}` : ""}`;
  els.researchBriefStatus.textContent = message;
}

function clearResearchSelections() {
  state.selectedResearchBrief = null;
  state.selectedResearchBriefId = null;
  state.selectedDirectionReport = null;
  state.selectedDirectionReportId = null;
  state.selectedPresentation = null;
  state.selectedPresentationId = null;
  state.selectedModuleAsset = null;
  state.selectedModuleAssetId = null;
  state.selectedResearchTask = null;
  state.selectedResearchTaskId = null;
}

function getLatestSummary() {
  return state.latestReport || state.recentReports[0] || null;
}

function getTransportStatus(status) {
  if (!status) return { value: "-", hint: "-", tone: "" };
  if (status.lifecycleState === "running" || status.connected) {
    return { value: state.lang === "zh" ? "\u5df2\u8fde\u63a5" : "Connected", hint: status.providerMode, tone: "ok" };
  }
  if (status.lifecycleState === "reconnecting") {
    return { value: state.lang === "zh" ? "\u91cd\u8fde\u4e2d" : "Reconnecting", hint: status.lifecycleReason || status.providerMode, tone: "warn" };
  }
  if (status.lifecycleState === "stale-socket") {
    return { value: state.lang === "zh" ? "\u8fde\u63a5\u50f5\u6b7b" : "Stale Socket", hint: status.lifecycleReason || status.providerMode, tone: "warn" };
  }
  if (status.lifecycleState === "stuck") {
    return { value: state.lang === "zh" ? "\u5361\u4f4f" : "Stuck", hint: status.lifecycleReason || status.providerMode, tone: "warn" };
  }
  if (status.lifecycleState === "waiting-human-action") {
    return { value: state.lang === "zh" ? "\u9700\u8981\u5173\u6ce8" : "Attention", hint: status.lifecycleReason || status.providerMode, tone: "warn" };
  }
  if (status.lifecycleState === "failed") {
    return { value: state.lang === "zh" ? "\u5df2\u5931\u8d25" : "Failed", hint: status.lifecycleReason || status.providerMode, tone: "danger" };
  }
  if (status.running) return { value: state.lang === "zh" ? "\u914d\u5bf9\u4e2d" : "Pairing", hint: status.providerMode, tone: "warn" };
  return { value: state.lang === "zh" ? "\u7a7a\u95f2" : "Idle", hint: status.providerMode, tone: "" };
}

function updateShellClasses() {
  els.shell.classList.toggle("shell--nav-collapsed", state.navCollapsed);
  els.shell.classList.toggle("shell--nav-drawer-open", state.navDrawerOpen);
  els.content.classList.toggle("content--chat", state.activeTab === "chat");
}

function setSidebarStatus(online) {
  els.sidebarStatusDot.classList.toggle("sidebar-connection-status--online", Boolean(online));
  els.sidebarStatusDot.classList.toggle("sidebar-connection-status--offline", !online);
}

function renderOverviewCards(target, compact = false) {
  const transport = getTransportStatus(state.channels?.wechat);
  const cards = [
    {
      tab: "overview",
      label: state.lang === "zh" ? "\u7cfb\u7edf\u5065\u5eb7" : "System Health",
      value: state.health?.status?.toUpperCase?.() || "-",
      hint: state.health?.agent || (state.lang === "zh" ? "\u7b49\u5f85\u5065\u5eb7\u68c0\u67e5" : "Waiting for health"),
      tone: state.health?.status === "ok" ? "ok" : ""
    },
    {
      tab: "channels",
      label: state.lang === "zh" ? "\u6e20\u9053\u72b6\u6001" : "Channel Status",
      value: transport.value,
      hint: transport.hint || "-",
      tone: transport.tone
    },
    {
      tab: "agents",
      label: state.lang === "zh" ? "\u7814\u7a76\u6a21\u5f0f" : "Research Mode",
      value: state.agentSession?.roleLabel || state.agentSession?.roleId || "-",
      hint:
        state.agentSession?.skillLabels?.length
          ? `${state.agentSession.skillLabels.length} skills`
          : (state.lang === "zh" ? "\u672a\u52a0\u8f7d" : "Not loaded"),
      tone: ""
    },
    {
      tab: "research",
      label: state.lang === "zh" ? "\u62a5\u544a\u6570\u91cf" : "Reports",
      value: String(state.recentReports.length),
      hint: getLatestSummary()?.generatedAt ? formatRelativeTime(getLatestSummary().generatedAt) : t("empty.report", "No report yet."),
      tone: ""
    }
  ];

  const variantClass = target.dataset.cardVariant ? ` ov-cards--${target.dataset.cardVariant}` : "";
  target.className = `${compact ? "ov-cards ov-cards--compact" : "ov-cards"}${variantClass}`;
  target.innerHTML = cards
    .map(
      (card, index) => `
        <button class="ov-card" type="button" data-open-tab="${escapeHtml(card.tab)}">
          <span class="ov-card__label">${escapeHtml(card.label)}</span>
          <span class="ov-card__value ${escapeHtml(card.tone)}">${escapeHtml(card.value)}</span>
          <span class="ov-card__hint">${escapeHtml(card.hint)}</span>
        </button>
      `
    )
    .join("");

  bindOpenTabButtons(target);
}

function getActiveResearchTask() {
  return (state.researchTasks || []).find((task) => !["completed", "failed"].includes(task.state)) || null;
}

function renderWorkspacePulse() {
  if (!els.workspacePulseMetrics || !els.workspacePulseActions) return;

  const summary = getLatestSummary();
  const activeTask = getActiveResearchTask();
  const transport = getTransportStatus(state.channels?.wechat);
  const healthOk = state.health?.status === "ok";
  const memoryFiles = state.memoryStatus?.files ?? 0;
  const briefsCount = state.researchBriefs.length;
  const reportsCount = state.recentReports.length;

  let headline = state.lang === "zh"
    ? "\u5de5\u4f5c\u533a\u5df2\u5c31\u7eea\uff0c\u53ef\u4ee5\u53d1\u8d77\u7b2c\u4e00\u6761\u7814\u7a76\u6d41\u6c34\u7ebf\u3002"
    : "Workspace is ready to launch the first research run.";
  let subtitle = memoryFiles
    ? (
        state.lang === "zh"
          ? `\u77e5\u8bc6\u5e93\u91cc\u5df2\u6709 ${memoryFiles} \u4e2a memory \u6587\u4ef6\uff0c\u53ef\u4ee5\u5e26\u7740\u4e0a\u4e0b\u6587\u76f4\u63a5\u5f00\u59cb\u3002`
          : `The vault already has ${memoryFiles} memory files, so you can start with context.`
      )
    : (state.lang === "zh"
        ? "\u53ef\u4ee5\u4ece research brief\u3001knowledge vault \u6216\u65b0\u4e3b\u9898\u76f4\u63a5\u8d77\u6b65\u3002"
        : "Start from a research brief, the vault, or a fresh topic.");

  if (!healthOk) {
    headline = state.lang === "zh"
      ? "\u8fd0\u884c\u72b6\u6001\u9700\u8981\u5148\u6062\u590d\uff0c\u518d\u7ee7\u7eed\u4e0b\u4e00\u6b65\u7814\u7a76\u52a8\u4f5c\u3002"
      : "Runtime health needs attention before the next research move.";
    subtitle =
      state.health?.agent ||
      state.health?.status ||
      (state.lang === "zh" ? "\u8bf7\u5148\u68c0\u67e5 runtime \u5065\u5eb7\u72b6\u6001\u3002" : "Inspect runtime health before continuing.");
  } else if (activeTask) {
    headline = state.lang === "zh"
      ? "\u7814\u7a76\u8fd0\u884c\u8fdb\u884c\u4e2d\uff0c\u8bc1\u636e\u8fd8\u5728\u7d2f\u79ef\u3002"
      : "A research run is in flight and evidence is still accumulating.";
    subtitle = `${formatResearchTaskState(activeTask)} · ${trimText(activeTask.topic || activeTask.taskId || "-", 92)}`;
  } else if (summary) {
    headline = state.lang === "zh"
      ? "\u6700\u65b0\u4ea7\u51fa\u5df2\u5c31\u7eea\uff0c\u53ef\u4ee5\u7ee7\u7eed\u5ba1\u9605\u6216\u4ea4\u4ed8\u3002"
      : "The latest output is ready for review or delivery.";
    subtitle = `${trimText(summary.topic || summary.taskId || "-", 92)} · ${formatRelativeTime(summary.generatedAt)}`;
  }

  if (els.workspacePulseKicker) {
    els.workspacePulseKicker.textContent = state.lang === "zh" ? "\u5de5\u4f5c\u533a\u8109\u51b2" : "Workspace Pulse";
  }
  if (els.workspacePulseHeadline) {
    els.workspacePulseHeadline.textContent = headline;
  }
  if (els.workspacePulseSubtitle) {
    els.workspacePulseSubtitle.textContent = subtitle;
  }

  const metrics = [
    {
      label: state.lang === "zh" ? "\u6d3b\u8dc3\u8fd0\u884c" : "Active Run",
      value: activeTask ? formatResearchTaskState(activeTask) : (state.lang === "zh" ? "\u7a7a\u95f2" : "Idle"),
      hint: activeTask
        ? trimText(activeTask.topic || activeTask.taskId || "-", 72)
        : (state.lang === "zh" ? `\u5df2\u8ffd\u8e2a ${reportsCount} \u6761\u4ea7\u51fa` : `${reportsCount} outputs tracked`),
      tone: activeTask ? "warn" : ""
    },
    {
      label: state.lang === "zh" ? "\u6700\u65b0\u4ea7\u51fa" : "Latest Output",
      value: summary?.generatedAt ? formatRelativeTime(summary.generatedAt) : (state.lang === "zh" ? "\u6682\u65e0" : "None yet"),
      hint: summary
        ? trimText(summary.topic || summary.taskId || "-", 72)
        : (state.lang === "zh" ? "\u5148\u542f\u52a8\u4e00\u6761 research run" : "Launch the first research run"),
      tone: summary ? "ok" : ""
    },
    {
      label: state.lang === "zh" ? "Brief \u5e93" : "Brief Library",
      value: String(briefsCount),
      hint: briefsCount
        ? (state.lang === "zh" ? `\u5df2\u4fdd\u5b58 ${briefsCount} \u4e2a structured brief` : `${briefsCount} structured briefs ready`)
        : (state.lang === "zh" ? "\u521b\u5efa\u7b2c\u4e00\u4e2a research brief" : "Create the first research brief"),
      tone: briefsCount ? "ok" : ""
    },
    {
      label: state.lang === "zh" ? "\u77e5\u8bc6\u5e93" : "Knowledge Vault",
      value: String(memoryFiles),
      hint:
        state.memoryStatus?.searchMode ||
        (state.lang === "zh" ? "\u6682\u672a\u52a0\u8f7d search mode" : "Search mode not loaded"),
      tone: memoryFiles ? "ok" : ""
    }
  ];

  els.workspacePulseMetrics.innerHTML = metrics
    .map(
      (metric) => `
        <article class="pulse-metric ${metric.tone ? `pulse-metric--${metric.tone}` : ""}">
          <span>${escapeHtml(metric.label)}</span>
          <strong>${escapeHtml(metric.value)}</strong>
          <small>${escapeHtml(metric.hint)}</small>
        </article>
      `
    )
    .join("");

  const actions = [];
  if (summary?.taskId) {
    actions.push({
      label: state.lang === "zh" ? "\u6253\u5f00\u6700\u65b0\u4ea7\u51fa" : "Open latest output",
      hint: trimText(summary.topic || summary.taskId, 76),
      taskId: summary.taskId,
      tone: "primary"
    });
  } else {
    actions.push({
      label: state.lang === "zh" ? "\u53d1\u8d77\u7814\u7a76" : "Start research",
      hint: state.lang === "zh" ? "\u8fdb\u5165\u8bc1\u636e\u5de5\u4f5c\u53f0\u63d0\u4ea4\u65b0\u4efb\u52a1" : "Open the evidence workspace and queue a new run.",
      tab: "research",
      tone: "primary"
    });
  }

  if (activeTask) {
    actions.push({
      label: state.lang === "zh" ? "\u8ddf\u8fdb\u6d3b\u8dc3\u8fd0\u884c" : "Follow active run",
      hint: `${formatResearchTaskState(activeTask)} · ${trimText(activeTask.topic || activeTask.taskId || "-", 64)}`,
      tab: "research"
    });
  } else if (briefsCount) {
    actions.push({
      label: state.lang === "zh" ? "\u6253\u5f00 Brief \u5e93" : "Open brief library",
      hint: state.lang === "zh" ? `\u5df2\u7ecf\u6709 ${briefsCount} \u4e2a brief \u53ef\u590d\u7528` : `${briefsCount} briefs are ready to reuse`,
      tab: "research"
    });
  } else {
    actions.push({
      label: state.lang === "zh" ? "\u6253\u5f00\u77e5\u8bc6\u5e93" : "Open knowledge vault",
      hint: state.lang === "zh" ? "\u5148\u62ff\u56de\u5de5\u4f5c\u4e0a\u4e0b\u6587" : "Bring working context back into view.",
      tab: "memory"
    });
  }

  actions.push(
    transport.tone === "warn" || transport.tone === "danger"
      ? {
          label: state.lang === "zh" ? "\u67e5\u770b\u4ea4\u4ed8\u72b6\u6001" : "Check delivery status",
          hint: transport.hint || state.channels?.wechat?.providerMode || "-",
          tab: "channels"
        }
      : {
          label: state.lang === "zh" ? "\u6253\u5f00\u6307\u6325\u4e2d\u5fc3" : "Open command center",
          hint: state.lang === "zh" ? "\u7edf\u4e00\u67e5\u770b health\u3001memory \u548c delivery \u4fe1\u53f7" : "Review health, memory, and delivery signals together.",
          tab: "overview"
        }
  );

  els.workspacePulseActions.innerHTML = actions
    .map(
      (action) => `
        <button
          class="pulse-action ${action.tone ? `pulse-action--${action.tone}` : ""}"
          type="button"
          ${action.taskId ? `data-task-id="${escapeHtml(action.taskId)}"` : `data-open-tab="${escapeHtml(action.tab)}"`}
        >
          <strong>${escapeHtml(action.label)}</strong>
          <span>${escapeHtml(action.hint)}</span>
        </button>
      `
    )
    .join("");

  bindOpenTabButtons(els.workspacePulseActions);
  bindReportButtons(els.workspacePulseActions);
}

function renderLandingCommandBar() {
  if (!els.landingCommandBar) return;

  const summary = getLatestSummary();
  const activeTask = getActiveResearchTask();
  const transport = getTransportStatus(state.channels?.wechat);
  const memoryFiles = state.memoryStatus?.files ?? 0;
  const briefsCount = state.researchBriefs.length;
  const deploymentModes = state.runtimeMeta?.deployment?.alwaysOn?.modes || [];
  const deploymentMeta = deploymentModes.map((mode) => mode.label).join(" / ");

  const cards = [
    summary?.taskId
      ? {
          eyebrow: t("landing.commandLatestEyebrow", "Latest Deliverable"),
          title: t("landing.commandLatestTitle", "Review the latest deliverable"),
          meta: `${formatRelativeTime(summary.generatedAt)} · ${trimText(summary.topic || summary.taskId, 52)}`,
          taskId: summary.taskId,
          tone: "accent"
        }
      : activeTask
        ? {
            eyebrow: t("landing.commandActiveEyebrow", "Active Investigation"),
            title: t("landing.commandActiveTitle", "Continue the active investigation"),
            meta: `${formatResearchTaskState(activeTask)} - ${trimText(activeTask.topic || activeTask.taskId || "-", 56)}`,
            tab: "research",
            tone: "accent"
          }
        : {
            eyebrow: t("landing.commandStartEyebrow", "Start Research"),
            title: t("landing.commandStartTitle", "Start the first scoped investigation"),
            meta: t("landing.commandStartMeta", "Open the evidence workspace and queue the first topic."),
            tab: "research",
            tone: "accent"
          },
    {
      eyebrow: t("landing.commandBriefEyebrow", "Research Briefs"),
      title: briefsCount
        ? t("landing.commandBriefReadyTitle", "Maintain the brief library")
        : t("landing.commandBriefEmptyTitle", "Create the first research brief"),
      meta: briefsCount
        ? t("landing.commandBriefReadyMeta", "{count} briefs are ready to reuse").replace("{count}", String(briefsCount))
        : t("landing.commandBriefEmptyMeta", "Lock goals, baselines, and evaluation criteria first."),
      tab: "research"
    },
    {
      eyebrow: t("landing.commandMemoryEyebrow", "Knowledge Vault"),
      title: memoryFiles
        ? t("landing.commandMemoryReadyTitle", "Reuse workspace memory")
        : t("landing.commandMemoryEmptyTitle", "Write the first working memory"),
      meta: state.memoryStatus?.searchMode
        ? `${memoryFiles} files · ${state.memoryStatus.searchMode}`
        : (state.lang === "zh" ? "\u67e5\u770b\u5df2\u4fdd\u5b58\u6587\u4ef6\u5e76\u6253\u5f00\u539f\u59cb\u4e0a\u4e0b\u6587" : "Inspect saved files and reopen raw context."),
      tab: "memory"
    },
    {
      eyebrow: t("landing.commandDeliveryEyebrow", "Delivery"),
      title: t("landing.commandDeliveryStatusTitle", "Delivery status"),
      meta: transport.tone === "warn" || transport.tone === "danger"
        ? `${formatResearchTaskState(activeTask)} · ${transport.value}`
        : `${transport.value} · ${transport.hint || "-"}`,
      tab: "channels",
      tone: transport.tone === "warn" || transport.tone === "danger" ? "warn" : ""
    },
    {
      eyebrow: t("landing.commandOverviewEyebrow", "Command Center"),
      title: t("landing.commandOverviewTitle", "Review workspace status"),
      meta: deploymentMeta || t("landing.commandOverviewMeta", "Health, delivery posture, memory mode, and runtime visibility."),
      tab: "overview"
    }
  ];

  const deliveryCard = cards.find((card) => card.tab === "channels");
  if (deliveryCard) {
    deliveryCard.title = t("landing.commandDeliveryStatusTitle", "Delivery status");
    deliveryCard.meta = `${transport.value} - ${transport.hint || "-"}`;
  }

  els.landingCommandBar.innerHTML = cards
    .map(
      (card) => `
        <button
          class="landing-command-card ${card.tone ? `landing-command-card--${card.tone}` : ""}"
          type="button"
          ${card.taskId ? `data-task-id="${escapeHtml(card.taskId)}"` : `data-open-tab="${escapeHtml(card.tab)}"`}
          ${card.settingsPanel ? `data-open-settings-panel="${escapeHtml(card.settingsPanel)}"` : ""}
        >
          <span class="landing-command-card__eyebrow">${escapeHtml(card.eyebrow)}</span>
          <strong>${escapeHtml(card.title)}</strong>
          <span class="landing-command-card__meta">${escapeHtml(card.meta)}</span>
        </button>
      `
    )
    .join("");

  bindOpenTabButtons(els.landingCommandBar);
  bindReportButtons(els.landingCommandBar);
}

function renderLaunchChecklist() {
  if (!els.launchChecklist) return;

  const summary = getLatestSummary();
  const briefsCount = state.researchBriefs.length;
  const memoryFiles = state.memoryStatus?.files ?? 0;
  const tasksCount = state.researchTasks.length;

  const items = [
    {
      done: briefsCount > 0,
      title: t("landing.checklistBriefTitle", "Define the first research brief"),
      body: briefsCount > 0
        ? t("landing.checklistBriefDone", "{count} briefs are already available for scoped runs.").replace("{count}", String(briefsCount))
        : t("landing.checklistBriefTodo", "Lock scope, baselines, and evaluation criteria first."),
      actionLabel: t("landing.checklistBriefAction", "Open Briefs"),
      tab: "research"
    },
    {
      done: tasksCount > 0,
      title: t("landing.checklistRunTitle", "Launch the first research run"),
      body: tasksCount > 0
        ? t("landing.checklistRunDone", "{count} tasks have already been queued.").replace("{count}", String(tasksCount))
        : t("landing.checklistRunTodo", "Start with a scoped topic and generate the first evidence pipeline."),
      actionLabel: t("landing.checklistRunAction", "Open Research"),
      tab: "research"
    },
    {
      done: Boolean(summary?.taskId),
      title: t("landing.checklistOutputTitle", "Generate the first deliverable"),
      body: summary?.taskId
        ? t("landing.checklistOutputDone", "{topic} is ready for review.").replace("{topic}", trimText(summary.topic || summary.taskId, 54))
        : t("landing.checklistOutputTodo", "The goal is a report or synthesis, not just a chat exchange."),
      actionLabel: summary?.taskId
        ? t("landing.checklistOutputReadyAction", "Open Output")
        : t("landing.checklistOutputTodoAction", "Review Research"),
      ...(summary?.taskId ? { taskId: summary.taskId } : { tab: "research" })
    },
    {
      done: memoryFiles > 0,
      title: t("landing.checklistMemoryTitle", "Capture working memory"),
      body: memoryFiles > 0
        ? t("landing.checklistMemoryDone", "{count} memory files are preserving context across runs.").replace("{count}", String(memoryFiles))
        : t("landing.checklistMemoryTodo", "Keep judgments, notes, and next actions inside the workspace."),
      actionLabel: t("landing.checklistMemoryAction", "Open Memory"),
      tab: "memory"
    }
  ];

  const completedCount = items.filter((item) => item.done).length;

  els.launchChecklist.innerHTML = `
    <div class="launch-checklist__summary">
      <span class="launch-checklist__summary-label">${escapeHtml(t("landing.checklistSummaryLabel", "Launch Path"))}</span>
      <strong>${escapeHtml(t("landing.checklistSummaryValue", "{count}/4 completed").replace("{count}", String(completedCount)))}</strong>
    </div>
    <div class="launch-checklist__items">
      ${items
        .map(
          (item, index) => `
            <article class="launch-checklist__item ${item.done ? "launch-checklist__item--done" : ""}">
              <div class="launch-checklist__index">${String(index + 1).padStart(2, "0")}</div>
              <div class="launch-checklist__copy">
                <strong>${escapeHtml(item.title)}</strong>
                <p>${escapeHtml(item.body)}</p>
              </div>
              <div class="launch-checklist__action">
                <span class="launch-checklist__state">${escapeHtml(item.done ? t("landing.checklistDone", "Done") : t("landing.checklistNext", "Next"))}</span>
                <button
                  class="btn btn--ghost"
                  type="button"
                  ${item.taskId ? `data-task-id="${escapeHtml(item.taskId)}"` : `data-open-tab="${escapeHtml(item.tab)}"`}
                >
                  ${escapeHtml(item.actionLabel)}
                </button>
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;

  bindOpenTabButtons(els.launchChecklist);
  bindReportButtons(els.launchChecklist);
}

function renderLandingSurfaces() {
  renderLandingCommandBar();
  renderLaunchChecklist();
  renderOverviewCards(els.landingLiveCards, false);
  renderLatestReport(els.landingLatestReport, getLatestSummary());
  renderSessionCards(els.landingSessionList, state.recentReports.slice(0, 4), true);
}

function renderWorkspaceNotes(target) {
  if (!target) return;
  const summary = getLatestSummary();
  const notes = [
    [t("chat.workspaceLabel", "Workspace"), state.memoryStatus?.workspaceDir || "-"],
    [state.lang === "zh" ? "\u6e20\u9053\u6a21\u5f0f" : "Channel mode", state.channels?.wechat?.providerMode || "-"],
    [state.lang === "zh" ? "\u5f53\u524d\u6a21\u5f0f" : "Active mode", state.agentSession?.roleLabel || state.agentSession?.roleId || "-"],
    [state.lang === "zh" ? "\u6700\u65b0\u62a5\u544a" : "Latest report", summary ? `${summary.topic} - ${formatRelativeTime(summary.generatedAt)}` : t("empty.report", "No report yet.")]
  ];

  target.innerHTML = notes
    .map(([label, value]) => `<div class="detail-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join("");
}

function renderOverviewNotes() {
  renderWorkspaceNotes(els.overviewNotes);
  renderWorkspaceNotes(els.chatNotes);
}

function renderSettingsTabs() {
  const tabs = [
    ["communications", state.lang === "zh" ? "\u901a\u4fe1\u4e0e\u4ea4\u4ed8" : "Communications"],
    ["infrastructure", state.lang === "zh" ? "\u57fa\u7840\u8bbe\u65bd" : "Infrastructure"],
    ["aiAgents", state.lang === "zh" ? "AI \u4e0e Agent" : "AI & Agents"],
    ["deployment", state.lang === "zh" ? "\u90e8\u7f72\u4e0e\u5e38\u9a7b" : "Deployment"]
  ];

  return `
    <div class="agent-panel-tabs">
      ${tabs
        .map(
          ([id, label]) => `
            <button
              class="agent-panel-tab ${state.settingsPanel === id ? "agent-panel-tab--active" : ""}"
              type="button"
              data-settings-panel="${escapeHtml(id)}"
            >
              ${escapeHtml(label)}
            </button>
          `
        )
        .join("")}
    </div>
  `;
}

function bindSettingsTabs() {
  document.querySelectorAll("[data-settings-panel]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = button.dataset.settingsPanel;
      if (!next) return;
      state.settingsPanel = next;
      renderSettingsOverview();
    });
  });
}

function renderAgentPanelTabs() {
  const tabs = [
    ["overview", t("agents.panelOverview", "Overview")],
    ["skills", t("agents.panelSkills", "Skills")],
    ["tools", t("agents.panelTools", "Tools")],
    ["channels", t("agents.panelChannels", "Channels")],
    ["cron", t("agents.panelCron", "Scheduler")]
  ];

  return `
    <div class="agent-panel-tabs">
      ${tabs
        .map(
          ([id, label]) => `
            <button
              class="agent-panel-tab ${state.agentsPanel === id ? "agent-panel-tab--active" : ""}"
              type="button"
              data-agent-panel="${escapeHtml(id)}"
            >
              ${escapeHtml(label)}
            </button>
          `
        )
        .join("")}
    </div>
  `;
}

function bindAgentPanelTabs() {
  document.querySelectorAll("[data-agent-panel]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = button.dataset.agentPanel;
      if (!next) return;
      state.agentsPanel = next;
      renderAgentSession(state.agentSession);
    });
  });
}

function buildSkillsCatalogMarkup(session) {
  if (!session) {
    return `<div class="empty-state">${escapeHtml(t("empty.notes", "No notes available."))}</div>`;
  }

  const skills = (session.availableSkills || []).filter((skill) => {
    const query = state.skillsFilter.trim().toLowerCase();
    const status = skill.status || (session.skillIds?.includes(skill.id) ? "ready" : "disabled");
    const matchesQuery =
      !query ||
      `${skill.label} ${skill.id} ${skill.instruction} ${skill.source || ""} ${(skill.notes || []).join(" ")}`.toLowerCase().includes(query);
    const matchesStatus = state.skillsStatusFilter === "all" || state.skillsStatusFilter === status;
    return matchesQuery && matchesStatus;
  });

  if (skills.length === 0) {
    return `<div class="empty-state">${escapeHtml(state.lang === "zh" ? "没有符合当前筛选条件的技能。" : "No skills match the current filter.")}</div>`;
  }

  return skills
    .map((skill) => {
      const enabled = session.skillIds?.includes(skill.id);
      const status = skill.status || (enabled ? "ready" : "disabled");
      return `
        <article class="card panel-card ${state.selectedSkillId === skill.id ? "panel-card--selected" : ""}" data-skill-card="${escapeHtml(skill.id)}">
          <div class="card-head">
            <div>
              <div class="card-title">${escapeHtml(skill.label)}</div>
              <div class="card-sub">${escapeHtml(skill.id)}</div>
            </div>
            <span class="pill"><strong>${escapeHtml(status)}</strong></span>
          </div>
          <p class="panel-sub">${escapeHtml(skill.instruction)}</p>
          <label class="agent-skill">
            <input data-agent-skill-toggle type="checkbox" value="${escapeHtml(skill.id)}" ${enabled ? "checked" : ""} />
            <span class="agent-skill__copy">
              <strong>${escapeHtml(skill.label)}</strong>
              <span>${escapeHtml(enabled ? (state.lang === "zh" ? "当前聊天可用" : "Available in this chat") : (state.lang === "zh" ? "当前聊天未启用" : "Not enabled in this chat"))}</span>
            </span>
          </label>
        </article>
      `;
    })
    .join("");
}

function renderSkillsCatalog(session) {
  if (!els.skillsCatalog) return;
  els.skillsCatalog.innerHTML = buildSkillsCatalogMarkup(session);

  bindAgentSkillInputs();
  bindSkillCards();
}

function renderSkillDetail(session) {
  if (!els.skillDetail) return;
  if (!session || !state.selectedSkillId) {
    els.skillDetail.innerHTML = `<div class="empty-state compact-empty">${escapeHtml(state.lang === "zh" ? "选择一个技能后，可在这里查看详情。" : "Select a skill to inspect its details.")}</div>`;
    return;
  }

  const skill = (session.availableSkills || []).find((item) => item.id === state.selectedSkillId);
  if (!skill) {
    els.skillDetail.innerHTML = `<div class="empty-state compact-empty">${escapeHtml(state.lang === "zh" ? "选择一个技能后，可在这里查看详情。" : "Select a skill to inspect its details.")}</div>`;
    return;
  }

  const enabled = session.skillIds?.includes(skill.id);
  const status = skill.status || (enabled ? "ready" : "disabled");
  const relatedTools =
    skill.relatedTools || [];

  els.skillDetail.innerHTML = `
    <article class="card panel-card">
      <div class="card-head">
        <div>
          <div class="card-title">${escapeHtml(skill.label)}</div>
          <div class="card-sub">${escapeHtml(skill.id)}</div>
        </div>
        <span class="pill"><strong>${escapeHtml(status)}</strong></span>
      </div>
      <div class="result-stack">
        <article class="result-item">
          <h3>Status</h3>
          <p>${escapeHtml(status)}</p>
        </article>
        <article class="result-item">
          <h3>Description</h3>
          <p>${escapeHtml(skill.instruction)}</p>
        </article>
        <article class="result-item">
          <h3>Runtime effect</h3>
          <p>${escapeHtml(enabled ? "This skill currently exposes its tool group to the runtime." : "This skill is currently excluded from the runtime tool list.")}</p>
        </article>
        <article class="result-item">
          <h3>Related tools</h3>
          <p>${escapeHtml(relatedTools.join(", ") || "No related tools mapped yet.")}</p>
        </article>
        <article class="result-item">
          <h3>Source</h3>
          <p>${escapeHtml(skill.source || "local-runtime")}</p>
        </article>
        ${
          skill.notes?.length
            ? `<article class="result-item"><h3>Notes</h3><p>${escapeHtml(skill.notes.join(" | "))}</p></article>`
            : ""
        }
        ${
          state.skillMessage
            ? `<article class="result-item"><p>${escapeHtml(state.skillMessage)}</p></article>`
            : ""
        }
      </div>
    </article>
  `;
}

function bindSkillCards() {
  document.querySelectorAll("[data-skill-card]").forEach((card) => {
    card.addEventListener("click", () => {
      const skillId = card.dataset.skillCard;
      if (!skillId) return;
      state.selectedSkillId = skillId;
      renderSkillDetail(state.agentSession);
      if (els.skillDetailModal) {
        els.skillDetailModal.hidden = false;
      }
    });
  });
}

function renderAgentToolsPanel(session) {
  if (!session) {
    return `<div class="empty-state compact-empty">${escapeHtml(t("empty.notes", "No notes available."))}</div>`;
  }

  const entryCard = `
    <article class="result-item">
      <h3>${escapeHtml("Entry")}</h3>
      <p>${escapeHtml(`${session.activeEntryLabel || session.activeEntrySource || "-"} (${session.activeEntrySource || "-"})`)}</p>
      <small>${escapeHtml(`Toolsets: ${(session.enabledToolsets || []).join(", ") || "-"}`)}</small>
    </article>
  `;

  const toolGroups = [
    {
      label: "workspace-control",
      tools: ["agent_describe"]
    },
    {
      label: "memory-ops",
      tools: ["memory_search", "memory_remember"]
    },
    {
      label: "research-ops",
      tools: ["research_run", "research_recent"]
    }
  ];

  return [
    entryCard,
    ...toolGroups
      .filter((group) => session.skillIds.includes(group.label))
      .map(
        (group) => `
        <article class="result-item">
          <h3>${escapeHtml(group.label)}</h3>
          <p>${escapeHtml(group.tools.join(", "))}</p>
          <small>${escapeHtml("Source: session-enabled skill group")}</small>
        </article>
      `
      ),
  ].join("");
}

function renderAgentChannelsPanel() {
  const wechat = state.channels?.wechat;
  return [
    [state.lang === "zh" ? "\u4f20\u8f93" : "Transport", wechat?.providerMode || "-"],
    [state.lang === "zh" ? "\u5df2\u8fde\u63a5" : "Connected", String(Boolean(wechat?.connected))],
    [state.lang === "zh" ? "\u7f51\u5173" : "Gateway", state.runtimeMeta?.openclaw?.gatewayUrl || "-"]
  ]
    .map(([label, value]) => `<div class="detail-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join("");
}

function renderAgentCronPanel() {
  const notes = [
    state.lang === "zh"
      ? "\u5f53\u524d runtime \u8fd8\u6ca1\u6709\u72ec\u7acb cron \u63a7\u5236\u53f0\u3002"
      : "This runtime does not expose a dedicated cron scheduler UI yet.",
    state.lang === "zh"
      ? "\u53ef\u4ee5\u53c2\u8003 OpenClaw \u7684 Agents -> Cron Jobs \u7ed3\u6784\u7ee7\u7eed\u8865\u9f50\u3002"
      : "The next step is to mirror OpenClaw's Agents -> Cron Jobs workflow."
  ];

  return notes.map((note) => `<article class="result-item"><p>${escapeHtml(note)}</p></article>`).join("");
}

function renderAgentSessionsList(sessions) {
  state.agentSessions = Array.isArray(sessions) ? sessions : [];
  if (!els.agentSessionsList) return;

  if (!state.agentSessions.length) {
    els.agentSessionsList.className = "empty-state";
    els.agentSessionsList.textContent = t("empty.sessions", "No sessions yet.");
    return;
  }

  els.agentSessionsList.className = "session-list";
  els.agentSessionsList.innerHTML = state.agentSessions
    .map((session) => {
      const isCurrent = session.senderId === UI_AGENT_SENDER_ID;
      return `
        <article class="session-item ${isCurrent ? "session-item--current" : ""}">
          <div class="message__meta">
            <span class="message__author">${escapeHtml(session.sessionId)}</span>
            <span>${escapeHtml(formatRelativeTime(session.updatedAt))}</span>
          </div>
          <p>${escapeHtml(session.lastUserMessage || session.lastAssistantMessage || "-")}</p>
          <div class="message__meta">
            <span>${escapeHtml(session.roleLabel)} (${escapeHtml(session.roleId)})</span>
            <span>${escapeHtml(session.activeEntrySource || "-")}</span>
            <span>${escapeHtml(state.lang === "zh" ? `${String(session.turnCount)} 轮对话` : `${String(session.turnCount)} turns`)}</span>
            <span>${escapeHtml(`${session.providerLabel || session.providerId}/${session.modelLabel || session.modelId}`)}</span>
            <span>${escapeHtml(session.skillLabels.join(", ") || "-")}</span>
            ${isCurrent ? `<span>${escapeHtml(state.lang === "zh" ? "当前聊天" : "Current chat")}</span>` : ""}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderSettingsOverview() {
  if (!els.settingsOverview) return;

  const meta = state.runtimeMeta;
  const wechat = state.channels?.wechat;
  const agent = state.agentSession;
  const deployment = meta?.deployment;
  const alwaysOnModes = deployment?.alwaysOn?.modes || [];
  const pm2Mode = alwaysOnModes.find((mode) => mode.id === "pm2");
  const windowsServiceMode = alwaysOnModes.find((mode) => mode.id === "windows-service");
  const openclawBridgeMode = alwaysOnModes.find((mode) => mode.id === "openclaw-bridge");

  function formatSettingsValue(value) {
    if (Array.isArray(value)) {
      return value.filter(Boolean).join(" | ") || "-";
    }
    if (value == null || value === "") {
      return "-";
    }
    return String(value);
  }

  const sections = {
    communications: [
      {
        title: state.lang === "zh" ? "\u5fae\u4fe1\u6e20\u9053" : "WeChat Channel",
        rows: [
          [state.lang === "zh" ? "\u63d0\u4f9b\u65b9" : "Provider", wechat?.providerMode || meta?.wechatProvider || "-"],
          [state.lang === "zh" ? "\u8fde\u63a5" : "Connected", String(Boolean(wechat?.connected))],
          [state.lang === "zh" ? "\u6700\u540e\u72b6\u6001" : "Last status", wechat?.lastMessage || wechat?.lastError || "-"]
        ]
      },
      {
        title: state.lang === "zh" ? "\u7814\u7a76\u7b14\u8bb0" : "Research Notes",
        rows: [
          [state.lang === "zh" ? "\u8def\u5f84" : "Path", state.memoryStatus?.workspaceDir || meta?.workspaceDir || "-"],
          [state.lang === "zh" ? "\u6587\u4ef6\u6570" : "Files", String(state.memoryStatus?.files ?? 0)],
          [state.lang === "zh" ? "\u641c\u7d22" : "Search mode", state.memoryStatus?.searchMode || "-"]
        ]
      }
    ],
    infrastructure: [
      {
        title: "MCP",
        rows: [
          ["Status", meta?.mcp?.status || "not-configured"],
          ["Connectors", String(meta?.mcp?.connectors ?? 0)],
          ["Notes", meta?.mcp?.notes?.[0] || "No MCP connectors are registered."]
        ]
      },
      {
        title: "MCP Servers",
        rows: (meta?.mcp?.servers || []).length
          ? meta.mcp.servers.flatMap((server) => [
              [`${server.serverLabel}`, `${server.status}`],
              ["Target", server.serverUrl || server.connectorId || "-"]
            ])
          : [["Registry", "workspace/channels/mcp-servers.json"], ["Configured", "0"]],
      },
      {
        title: state.lang === "zh" ? "\u6865\u63a5" : "Bridge",
        rows: [
          ["Gateway", meta?.openclaw?.gatewayUrl || "-"],
          ["CLI", meta?.openclaw?.cliPath || "-"],
          ["Channel", meta?.openclaw?.channelId || "-"]
        ]
      }
    ],
    aiAgents: [
      {
        title: state.lang === "zh" ? "AI Runtime" : "AI Runtime",
        rows: [
          ["LLM", meta?.llmProvider || "-"],
          ["Model", meta?.llmModel || "-"],
          ["Wire API", meta?.llmWireApi || agent?.wireApi || "-"],
          ["Route", agent ? `${agent.providerLabel || agent.providerId}/${agent.modelLabel || agent.modelId}` : "-"],
          ["Route status", agent ? `${agent.llmStatus || "-"} (${agent.llmSource || "-"})` : "-"],
          ["Role", agent?.roleLabel || agent?.roleId || "-"],
          ["Skills", agent?.skillLabels?.join(", ") || "-"]
        ]
      },
      {
        title: state.lang === "zh" ? "Sessions" : "Sessions",
        rows: [
          ["Tracked", String(state.agentSessions?.length ?? 0)],
          ["Current", UI_AGENT_SENDER_ID],
          ["Providers", String(meta?.llm?.providers?.length ?? 0)],
          ["Node env", meta?.nodeEnv || "-"]
        ]
      }
    ],
    deployment: [
      {
        title: state.lang === "zh" ? "Root Runtime" : "Root Runtime",
        rows: [
          [state.lang === "zh" ? "工作区" : "Workspace", deployment?.workspaceDir || meta?.workspaceDir || "-"],
          [state.lang === "zh" ? "安装" : "Install", deployment?.rootRuntime?.installCommand || "npm install"],
          [state.lang === "zh" ? "启动" : "Start", deployment?.rootRuntime?.startCommand || "npm start"],
          [state.lang === "zh" ? "开发" : "Dev", deployment?.rootRuntime?.devCommand || "npm run dev"],
          [state.lang === "zh" ? "构建" : "Build", deployment?.rootRuntime?.buildCommand || "npm run build"]
        ]
      },
      {
        title: state.lang === "zh" ? "常驻运行" : "Always-On Modes",
        rows: [
          ["PM2", pm2Mode ? [pm2Mode.installCommand, pm2Mode.restartCommand, pm2Mode.stopCommand] : "-"],
          [state.lang === "zh" ? "Windows \u670d\u52a1" : "Windows Service", windowsServiceMode ? [windowsServiceMode.installCommand, windowsServiceMode.startCommand, windowsServiceMode.statusCommand, windowsServiceMode.stopCommand] : "-"],
          ["OpenClaw Bridge", openclawBridgeMode ? [openclawBridgeMode.installCommand, openclawBridgeMode.statusCommand] : "-"],
          [state.lang === "zh" ? "说明" : "Notes", deployment?.alwaysOn?.notes?.[0] || "-"]
        ]
      },
      {
        title: state.lang === "zh" ? "\u5f53\u524d\u8fd0\u884c\u72b6\u6001" : "Current Runtime Status",
        rows: [
          [state.lang === "zh" ? "Provider" : "Provider", wechat?.providerMode || meta?.wechatProvider || "-"],
          [state.lang === "zh" ? "生命周期" : "Lifecycle", wechat?.lifecycleState || "-"],
          [state.lang === "zh" ? "原因" : "Reason", wechat?.lifecycleReason || "-"],
          [state.lang === "zh" ? "运行中" : "Running", String(Boolean(wechat?.running))],
          [state.lang === "zh" ? "已连接" : "Connected", String(Boolean(wechat?.connected))],
          [state.lang === "zh" ? "需人工处理" : "Human action", String(Boolean(wechat?.requiresHumanAction))],
          [state.lang === "zh" ? "最近健康时间" : "Last healthy", wechat?.lastHealthyAt ? formatTime(wechat.lastHealthyAt) : "-"],
          [state.lang === "zh" ? "最近重启时间" : "Last restart", wechat?.lastRestartAt ? formatTime(wechat.lastRestartAt) : "-"]
        ]
      },
      {
        title: state.lang === "zh" ? "OpenClaw \u63d2\u4ef6" : "OpenClaw Plugin",
        rows: [
          [state.lang === "zh" ? "\u5305\u540d" : "Package", deployment?.openclawPlugin?.packageName || "@sinlair/reagent-openclaw"],
          [state.lang === "zh" ? "\u5b89\u88c5\u547d\u4ee4" : "Install", deployment?.openclawPlugin?.installCommand || "openclaw plugins install @sinlair/reagent-openclaw --yes"],
          [state.lang === "zh" ? "\u5f53\u524d\u63d2\u4ef6" : "Plugin state", wechat?.providerMode === "openclaw" ? (wechat?.pluginInstalled ? wechat?.pluginVersion || "installed" : "missing") : (state.lang === "zh" ? "\u672a\u542f\u7528 openclaw provider" : "openclaw provider not active")],
          [state.lang === "zh" ? "\u793a\u4f8b\u547d\u4ee4" : "Sample commands", deployment?.openclawPlugin?.sampleCommands || "-"]
        ]
      }
    ]
  };

  const cards = sections[state.settingsPanel] || sections.communications;

  els.settingsOverview.innerHTML = `${renderSettingsTabs()}<div class="grid grid--2">${cards
    .map(
      (card) => `
        <article class="card panel-card">
          <div class="card-head">
            <div>
              <div class="card-title">${escapeHtml(card.title)}</div>
            </div>
          </div>
          <div class="detail-list">
            ${card.rows
              .map(
                ([label, value]) =>
                  `<div class="detail-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(formatSettingsValue(value))}</strong></div>`,
              )
              .join("")}
          </div>
        </article>
      `
    )
    .join("")}</div>`;
  bindSettingsTabs();
}

function buildAgentModelOptions(session) {
  if (!session) return [];

  const defaultRoute = session.defaultRoute || null;
  const options = [];
  const seen = new Set();

  if (defaultRoute?.providerId && defaultRoute?.modelId) {
    const key = `${defaultRoute.providerId}::${defaultRoute.modelId}`;
    seen.add(key);
    options.push({
      value: "",
      label: `Default: ${defaultRoute.providerLabel || defaultRoute.providerId}/${defaultRoute.modelLabel || defaultRoute.modelId}${defaultRoute.wireApi ? ` via ${defaultRoute.wireApi}` : ""}`
    });
  }

  for (const provider of session.availableLlmProviders || []) {
    for (const model of provider.models || []) {
      const key = `${provider.id}::${model.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      options.push({
        value: key,
        label: `${provider.label || provider.id}/${model.label || model.id}${model.wireApi || provider.wireApi ? ` via ${model.wireApi || provider.wireApi}` : ""}${model.status ? ` [${model.status}]` : ""}`
      });
    }
  }

  return options;
}

function getAgentModelSelectValue(session) {
  if (!session) return "";
  const currentKey = `${session.providerId}::${session.modelId}`;
  const defaultKey =
    session.defaultRoute?.providerId && session.defaultRoute?.modelId
      ? `${session.defaultRoute.providerId}::${session.defaultRoute.modelId}`
      : null;
  return currentKey === defaultKey ? "" : currentKey;
}

function formatRouteLabel(route) {
  if (!route) return "-";
  return `${route.providerLabel || route.providerId}/${route.modelLabel || route.modelId}${route.wireApi ? ` via ${route.wireApi}` : ""}`;
}

function buildFallbackCandidateOptions(session) {
  if (!session) return [];
  const currentKey = `${session.providerId}::${session.modelId}`;
  const activeFallbacks = new Set((session.fallbackRoutes || []).map((route) => `${route.providerId}::${route.modelId}`));
  const options = [];

  for (const provider of session.availableLlmProviders || []) {
    for (const model of provider.models || []) {
      const key = `${provider.id}::${model.id}`;
      if (key === currentKey || activeFallbacks.has(key)) continue;
      options.push({
        value: key,
        label: `${provider.label || provider.id}/${model.label || model.id}${model.wireApi || provider.wireApi ? ` via ${model.wireApi || provider.wireApi}` : ""}${model.status ? ` [${model.status}]` : ""}`
      });
    }
  }

  return options;
}

function renderAgentSession(session) {
  state.agentSession = session;

  if (!session) {
    if (els.agentSessionSummary) {
      els.agentSessionSummary.innerHTML = `<div class="empty-state compact-empty">${escapeHtml(t("empty.notes", "No notes available."))}</div>`;
    }
    if (els.agentRuntimeNotes) {
      els.agentRuntimeNotes.innerHTML = "";
    }
    if (els.agentSessionSummary) {
      els.agentSessionSummary.insertAdjacentHTML?.("afterbegin", renderAgentPanelTabs());
      bindAgentPanelTabs();
    }
    els.agentRoleSelect.innerHTML = `<option value="">-</option>`;
    if (els.agentModelSelect) els.agentModelSelect.innerHTML = `<option value="">-</option>`;
    if (els.agentFallbacksList) els.agentFallbacksList.innerHTML = `<div class="empty-state compact-empty">${escapeHtml(t("empty.notes", "No notes available."))}</div>`;
    if (els.agentFallbacksSelect) els.agentFallbacksSelect.innerHTML = `<option value="">-</option>`;
    if (els.agentReasoningSelect) els.agentReasoningSelect.innerHTML = `<option value="default">default</option>`;
    els.agentSkills.innerHTML = `<div class="empty-state compact-empty">${escapeHtml(t("empty.notes", "No notes available."))}</div>`;
    renderSkillsCatalog(null);
    renderSettingsOverview();
    return;
  }

  if (els.agentSessionSummary) {
    let panelContent = "";
    if (state.agentsPanel === "overview") {
      panelContent = [
        [state.lang === "zh" ? "\u4f1a\u8bdd" : "Session", UI_AGENT_SENDER_ID],
        [state.lang === "zh" ? "\u5165\u53e3" : "Entry", `${session.activeEntryLabel || session.activeEntrySource} (${session.activeEntrySource || "-"})`],
        [state.lang === "zh" ? "\u5de5\u5177\u96c6" : "Toolsets", session.enabledToolsets?.join(", ") || "-"],
        [state.lang === "zh" ? "\u89d2\u8272" : "Role", `${session.roleLabel} (${session.roleId})`],
        [state.lang === "zh" ? "Skills" : "Skills", session.skillLabels.join(", ") || "-"],
        [state.lang === "zh" ? "\u6a21\u578b\u8def\u7531" : "Model route", `${session.providerLabel || session.providerId}/${session.modelLabel || session.modelId}`],
        [state.lang === "zh" ? "\u5907\u9009\u8def\u7531" : "Fallbacks", String(session.fallbackRoutes?.length ?? 0)],
        [state.lang === "zh" ? "\u63a8\u7406" : "Reasoning", session.reasoningEffort || "default"],
        [state.lang === "zh" ? "\u534f\u8bae" : "Wire API", session.wireApi || "-"],
        [state.lang === "zh" ? "\u6765\u6e90" : "Source", `${session.llmStatus || "-"} (${session.llmSource || "-"})`],
        [state.lang === "zh" ? "\u53ef\u7528\u89d2\u8272" : "Available roles", String(session.availableRoles?.length ?? 0)]
      ]
        .map(([label, value]) => `<div class="detail-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
        .join("");
    } else if (state.agentsPanel === "skills") {
      panelContent = `<div class="result-stack">${buildSkillsCatalogMarkup(session)}</div>`;
    } else if (state.agentsPanel === "tools") {
      panelContent = `<div class="result-stack">${renderAgentToolsPanel(session)}</div>`;
    } else if (state.agentsPanel === "channels") {
      panelContent = renderAgentChannelsPanel();
    } else if (state.agentsPanel === "cron") {
      panelContent = `<div class="result-stack">${renderAgentCronPanel()}</div>`;
    }

    els.agentSessionSummary.innerHTML = `${renderAgentPanelTabs()}${panelContent}`;
    bindAgentPanelTabs();
  }

  if (els.agentRuntimeNotes) {
    const notes = [
      state.lang === "zh"
        ? `当前入口：${session.activeEntryLabel || session.activeEntrySource}。`
        : `Current entry: ${session.activeEntryLabel || session.activeEntrySource}.`,
      state.lang === "zh"
        ? `当前入口允许的 toolsets：${(session.enabledToolsets || []).join(", ") || "-" }。`
        : `This entry allows these toolsets: ${(session.enabledToolsets || []).join(", ") || "-"}.`,
      state.lang === "zh"
        ? "\u5f53\u524d\u804a\u5929\u4f1a\u8bdd\u4f1a\u7acb\u5373\u4f7f\u7528\u8fd9\u91cc\u7684 role \u548c skills \u8bbe\u5b9a\u3002"
        : "The current chat session applies these role and skill settings immediately.",
      state.lang === "zh"
        ? "关闭某个 skill 后，runtime 不会再向模型暴露对应工具。"
        : "When a skill is disabled, its tools disappear from the runtime tool list.",
      state.lang === "zh"
        ? "\u4f60\u4ecd\u7136\u53ef\u4ee5\u5728\u804a\u5929\u91cc\u7528 /role\u3001/skills \u548c /model \u547d\u4ee4\u3002"
        : "You can still use /role, /skills, and /model inside chat."
    ];
    els.agentRuntimeNotes.innerHTML = notes
      .map((note) => `<article class="result-item"><p>${escapeHtml(note)}</p></article>`)
      .join("");
  }

  els.agentRoleSelect.innerHTML = (session.availableRoles || [])
    .map(
      (role) =>
        `<option value="${escapeHtml(role.id)}" ${role.id === session.roleId ? "selected" : ""}>${escapeHtml(role.label)} (${escapeHtml(role.id)})</option>`,
    )
    .join("");

  const modelOptions = buildAgentModelOptions(session);
  if (els.agentModelSelect) {
    els.agentModelSelect.innerHTML = modelOptions
      .map(
        (option) =>
          `<option value="${escapeHtml(option.value)}" ${option.value === getAgentModelSelectValue(session) ? "selected" : ""}>${escapeHtml(option.label)}</option>`,
      )
      .join("");
  }
  if (els.agentModelHint) {
    const defaultRoute = session.defaultRoute;
    els.agentModelHint.textContent = defaultRoute
      ? `Default route: ${formatRouteLabel(defaultRoute)}`
      : "Switch the active model route for this chat session, or inherit the registry default.";
  }
  if (els.agentModelReset) {
    els.agentModelReset.disabled = !getAgentModelSelectValue(session);
  }

  if (els.agentFallbacksList) {
    const routes = session.fallbackRoutes || [];
    els.agentFallbacksList.innerHTML = routes.length
      ? routes
          .map(
            (route) => `
              <div class="route-chip">
                <span class="route-chip__copy">
                  <strong>${escapeHtml(formatRouteLabel(route))}</strong>
                  <span>${escapeHtml(`${route.llmStatus} (${route.llmSource})`)}</span>
                </span>
                <button class="route-chip__remove" type="button" data-remove-fallback="${escapeHtml(`${route.providerId}::${route.modelId}`)}">Remove</button>
              </div>
            `
          )
          .join("")
      : `<div class="empty-state compact-empty">${escapeHtml("No fallback routes configured.")}</div>`;
    els.agentFallbacksList.querySelectorAll("[data-remove-fallback]").forEach((button) => {
      button.addEventListener("click", async () => {
        const key = button.dataset.removeFallback;
        if (!key) return;
        const nextRoutes = (session.fallbackRoutes || []).filter(
          (route) => `${route.providerId}::${route.modelId}` !== key
        ).map((route) => ({
          providerId: route.providerId,
          modelId: route.modelId
        }));

        try {
          const nextSession = await requestJson("/api/channels/wechat/agent/fallbacks", {
            method: "POST",
            body: JSON.stringify({
              senderId: UI_AGENT_SENDER_ID,
              routes: nextRoutes
            })
          });
          state.skillMessage = nextRoutes.length
            ? `Fallback routes updated: ${nextRoutes.map((route) => `${route.providerId}/${route.modelId}`).join(", ")}.`
            : "Fallback routes cleared.";
          renderAgentSession(nextSession);
        } catch (error) {
          showError(error);
          await loadAgentSession().catch(() => {});
        }
      });
    });
  }
  const fallbackOptions = buildFallbackCandidateOptions(session);
  if (els.agentFallbacksSelect) {
    els.agentFallbacksSelect.innerHTML = [
      `<option value="">Select a fallback route</option>`,
      ...fallbackOptions.map(
        (option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`
      )
    ].join("");
  }
  if (els.agentFallbacksClear) {
    els.agentFallbacksClear.disabled = !(session.fallbackRoutes || []).length;
  }
  if (els.agentFallbacksAdd) {
    els.agentFallbacksAdd.disabled = !(fallbackOptions.length && els.agentFallbacksSelect?.value !== "");
  }
  if (els.agentReasoningSelect) {
    els.agentReasoningSelect.innerHTML = (session.availableReasoningEfforts || [])
      .map(
        (effort) =>
          `<option value="${escapeHtml(effort)}" ${effort === (session.reasoningEffort || "default") ? "selected" : ""}>${escapeHtml(effort)}</option>`
      )
      .join("");
  }
  if (els.agentReasoningHint) {
    els.agentReasoningHint.textContent = `Current reasoning effort: ${session.reasoningEffort || "default"}`;
  }

  els.agentSkills.innerHTML = (session.availableSkills || [])
    .map((skill) => {
      const checked = session.skillIds?.includes(skill.id);
      return `
        <label class="agent-skill">
          <input data-agent-skill-toggle type="checkbox" value="${escapeHtml(skill.id)}" ${checked ? "checked" : ""} />
          <span class="agent-skill__copy">
            <strong>${escapeHtml(skill.label)}</strong>
            <span>${escapeHtml(skill.id)}</span>
          </span>
        </label>
      `;
    })
    .join("");

  bindAgentSkillInputs();
  if (state.agentsPanel !== "skills") {
    renderSkillsCatalog(session);
  }
  renderSettingsOverview();
}

function renderLatestReport(target, report) {
  if (!target) return;
  if (!report) {
    target.className = "empty-state compact-empty";
    target.textContent = t("empty.report", "No report yet.");
    return;
  }

  const paperCount = report.paperCount ?? report.papers?.length ?? 0;
  const evidenceCount = report.evidenceCount ?? report.evidence?.length ?? 0;
  const verdict = report.critiqueVerdict ?? report.critique?.verdict ?? "-";

  target.className = "result-stack";
  target.innerHTML = `
    <button class="session-item" type="button" data-task-id="${escapeHtml(report.taskId)}">
      <div class="message__meta">
        <span class="message__author">${escapeHtml(report.topic)}</span>
        <span>${escapeHtml(formatRelativeTime(report.generatedAt))}</span>
      </div>
      <p>${escapeHtml(trimText(report.summary, 220))}</p>
      <div class="message__meta">
        <span>${escapeHtml(String(paperCount))} papers</span>
        <span>${escapeHtml(String(evidenceCount))} evidence</span>
        <span>${escapeHtml(verdict)}</span>
      </div>
    </button>
  `;
  bindReportButtons(target);
}

function renderActivityFeed(target, messages) {
  if (!target) return;
  const recent = [...messages].slice(-6).reverse();
  if (!recent.length) {
    target.className = "empty-state";
    target.textContent = t("empty.activity", "No activity yet.");
    return;
  }

  target.className = "result-stack";
  target.innerHTML = recent
    .map(
      (message) => `
        <article class="activity-item">
          <div class="message__meta">
            <span class="message__author">${escapeHtml(message.direction)}</span>
            <span>${escapeHtml(formatTime(message.createdAt))}</span>
          </div>
          <p>${nl2br(message.text)}</p>
        </article>
      `
    )
    .join("");
}

function renderOverviewActivity(messages) {
  renderActivityFeed(els.overviewActivity, messages);
  renderActivityFeed(els.chatActivity, messages);
}

function renderProductAlerts() {
  if (!els.productAlerts) return;

  const alertsAllowedTabs = new Set(["channels"]);
  if (!alertsAllowedTabs.has(state.activeTab)) {
    els.productAlerts.hidden = true;
    els.productAlerts.innerHTML = "";
    return;
  }

  const alerts = [];
  const wechat = state.channels?.wechat;
  const researchRoute = state.runtimeMeta?.llm?.routes?.research;

  if (researchRoute?.providerType === "fallback") {
    alerts.push({
      tone: "danger",
      title: state.lang === "zh" ? "研究结果处于降级模式" : "Research Is In Fallback Mode",
      body:
        state.lang === "zh"
          ? "当前研究工作流正在使用 fallback LLM。输出可用于占位和流程联调，不应视为正式模型分析。"
          : "The research workflow is using the fallback LLM. Outputs are useful for scaffolding, not as final model analysis."
    });
  }

  if (wechat?.providerMode === "openclaw" && wechat?.pluginInstalled === false) {
    alerts.push({
      tone: "warn",
      title: state.lang === "zh" ? "OpenClaw \u63d2\u4ef6\u672a\u5b89\u88c5" : "OpenClaw Plugin Missing",
      body:
        state.lang === "zh"
          ? "\u5f53\u524d bridge \u5904\u4e8e openclaw \u6a21\u5f0f\uff0c\u4f46\u63d2\u4ef6\u672a\u5c31\u7eea\u3002\u5230 Settings > Deployment \u67e5\u770b\u5b89\u88c5\u547d\u4ee4\u3002"
          : "The bridge is in openclaw mode, but the plugin is not ready. Open Settings > Deployment for the install command."
    });
  }

  if (!alerts.length) {
    els.productAlerts.hidden = true;
    els.productAlerts.innerHTML = "";
    return;
  }

  els.productAlerts.hidden = false;
  els.productAlerts.innerHTML = alerts
    .map(
      (alert) => `
        <article class="alert-strip alert-strip--${escapeHtml(alert.tone)}">
          <strong>${escapeHtml(alert.title)}</strong>
          <span>${escapeHtml(alert.body)}</span>
        </article>
      `
    )
    .join("");
}

function renderSessionCards(target, reports, compact = false) {
  if (!target) return;
  if (!reports.length) {
    target.className = compact ? "empty-state compact-empty" : "empty-state";
    target.textContent = t("empty.sessions", "No sessions yet.");
    return;
  }

  target.className = "session-list";
  target.innerHTML = reports
    .map(
      (report) => `
        <button class="session-item ${compact ? "session-item--compact" : ""}" type="button" data-task-id="${escapeHtml(report.taskId)}">
          <div class="message__meta">
            <span class="message__author">${escapeHtml(report.topic)}</span>
            <span>${escapeHtml(report.critiqueVerdict ?? report.critique?.verdict ?? "-")}</span>
          </div>
          <p>${escapeHtml(trimText(report.summary, compact ? 110 : 180))}</p>
          <small>${escapeHtml(formatTime(report.generatedAt))}</small>
        </button>
      `
    )
    .join("");

  bindReportButtons(target);
}

function researchTaskTone(task) {
  if (task.state === "completed") return "ok";
  if (task.state === "failed") return "danger";
  return "warn";
}

function formatResearchTaskStateLegacy(task) {
  const labels = {
    queued: state.lang === "zh" ? "已排队" : "Queued",
    planning: state.lang === "zh" ? "规划中" : "Planning",
    "searching-paper": state.lang === "zh" ? "检索论文" : "Searching Papers",
    "downloading-paper": state.lang === "zh" ? "下载论文" : "Downloading Papers",
    "analyzing-paper": state.lang === "zh" ? "分析证据" : "Analyzing Evidence",
    "generating-summary": state.lang === "zh" ? "生成总结" : "Generating Summary",
    persisting: state.lang === "zh" ? "持久化" : "Persisting",
    completed: state.lang === "zh" ? "已完成" : "Completed",
    failed: state.lang === "zh" ? "失败" : "Failed"
  };
  return labels[task.state] || task.state;
}

function formatResearchTaskState(task) {
  const labels = {
    queued: state.lang === "zh" ? "已排队" : "Queued",
    briefing: "Briefing",
    planning: state.lang === "zh" ? "规划中" : "Planning",
    "idea-generation": "Idea Generation",
    "novelty-check": "Novelty Check",
    "candidate-comparison": "Candidate Comparison",
    decision: "Decision",
    "searching-paper": state.lang === "zh" ? "检索论文" : "Searching Papers",
    "downloading-paper": state.lang === "zh" ? "下载论文" : "Downloading Papers",
    "analyzing-paper": state.lang === "zh" ? "分析证据" : "Analyzing Evidence",
    "checking-repo": "Checking Repo",
    "extracting-module": "Extracting Module",
    "generating-summary": state.lang === "zh" ? "生成总结" : "Generating Summary",
    "generating-ppt": "Generating PPT",
    persisting: state.lang === "zh" ? "持久化" : "Persisting",
    completed: state.lang === "zh" ? "已完成" : "Completed",
    failed: state.lang === "zh" ? "失败" : "Failed"
  };
  return labels[task.state] || task.state;
}

function renderResearchTaskDetail(task) {
  if (!task) {
    return;
  }

  const transitions = (task.transitions || [])
    .slice()
    .reverse()
    .slice(0, 6)
    .map(
      (transition) => `
        <article class="result-item">
          <div class="message__meta">
            <span class="message__author">${escapeHtml(formatResearchTaskState(transition))}</span>
            <span>${escapeHtml(formatTime(transition.at))}</span>
          </div>
          <p>${escapeHtml(transition.message || "-")}</p>
        </article>
      `
    )
    .join("");

  els.researchReport.className = "research-report";
  els.researchReport.innerHTML = `
    <article class="report-hero">
      <div class="report-hero__head">
        <div>
          <div class="section-kicker">${escapeHtml(state.lang === "zh" ? "Research Task" : "Research Task")}</div>
          <h3>${escapeHtml(task.topic)}</h3>
          <p>${escapeHtml(task.message || (state.lang === "zh" ? "任务正在运行。" : "Task is running."))}</p>
        </div>
        <div class="report-chip-list">
          ${renderPill(formatResearchTaskState(task), researchTaskTone(task))}
          ${renderPill(`${task.progress}%`)}
          ${renderPill(formatTime(task.updatedAt))}
        </div>
      </div>
      <div class="research-stat-grid">
        <article class="research-stat">
          <span>${escapeHtml(state.lang === "zh" ? "Task ID" : "Task ID")}</span>
          <strong>${escapeHtml(task.taskId)}</strong>
        </article>
        <article class="research-stat">
          <span>${escapeHtml(state.lang === "zh" ? "阶段" : "State")}</span>
          <strong>${escapeHtml(formatResearchTaskState(task))}</strong>
        </article>
        <article class="research-stat">
          <span>${escapeHtml(state.lang === "zh" ? "进度" : "Progress")}</span>
          <strong>${escapeHtml(`${task.progress}%`)}</strong>
        </article>
        <article class="research-stat">
          <span>${escapeHtml(state.lang === "zh" ? "尝试次数" : "Attempt")}</span>
          <strong>${escapeHtml(String(task.attempt ?? 1))}</strong>
        </article>
      </div>
    </article>

    <article class="report-block">
      <div class="report-item-head">
        <h3>${escapeHtml(state.lang === "zh" ? "Task Timeline" : "Task Timeline")}</h3>
        ${renderPill(String(task.transitions?.length || 0))}
      </div>
      <div class="result-stack">${transitions || `<div class="empty-state compact-empty">${escapeHtml(state.lang === "zh" ? "暂无状态流转。" : "No transitions yet.")}</div>`}</div>
    </article>
  `;
}

function renderResearchTasks(tasks) {
  if (!els.researchTaskList) return;
  if (!tasks.length) {
    els.researchTaskList.className = "empty-state compact-empty";
    els.researchTaskList.textContent = state.lang === "zh" ? "暂无研究任务。" : "No research tasks yet.";
    return;
  }

  els.researchTaskList.className = "session-list";
  els.researchTaskList.innerHTML = tasks
    .map((task) => {
      const completed = task.reportReady && task.state === "completed";
      return `
        <article class="session-item ${state.selectedResearchTaskId === task.taskId ? "session-item--current" : ""}">
          <div class="message__meta">
            <span class="message__author">${escapeHtml(task.topic)}</span>
            <span>${escapeHtml(formatRelativeTime(task.updatedAt))}</span>
          </div>
          <p>${escapeHtml(task.message || formatResearchTaskState(task))}</p>
          <div class="message__meta">
            <span>${renderPill(formatResearchTaskState(task), researchTaskTone(task))}</span>
            <span>${escapeHtml(`${task.progress}%`)}</span>
            <span>${escapeHtml(`attempt ${task.attempt ?? 1}`)}</span>
          </div>
          <div class="button-row">
            <button class="btn btn--ghost" type="button" data-task-open="${escapeHtml(task.taskId)}">
              ${escapeHtml(completed ? t("common.load", "Load") : (state.lang === "zh" ? "查看" : "Inspect"))}
            </button>
            ${task.state === "failed"
              ? `<button class="btn btn--ghost" type="button" data-task-retry="${escapeHtml(task.taskId)}">${escapeHtml(t("common.retry", "Retry"))}</button>`
              : ""}
          </div>
        </article>
      `;
    })
    .join("");

  els.researchTaskList.querySelectorAll("[data-task-open]").forEach((button) => {
    button.addEventListener("click", async () => {
      const taskId = button.dataset.taskOpen;
      if (!taskId) return;
      await hydrateResearchTask(taskId);
    });
  });

  els.researchTaskList.querySelectorAll("[data-task-retry]").forEach((button) => {
    button.addEventListener("click", async () => {
      const taskId = button.dataset.taskRetry;
      if (!taskId) return;
      const nextTask = await requestJson(`/api/research/tasks/${encodeURIComponent(taskId)}/retry`, {
        method: "POST",
        body: JSON.stringify({})
      });
      state.selectedResearchTaskId = nextTask.taskId;
      await loadResearchTasks();
    });
  });
}

function renderStatusRows(status) {
  const rows = [
    [state.lang === "zh" ? "\u5df2\u914d\u7f6e" : "Configured", String(status.configured)],
    [state.lang === "zh" ? "\u5df2\u7ed1\u5b9a" : "Linked", String(status.linked)],
    [state.lang === "zh" ? "\u8fd0\u884c\u4e2d" : "Running", String(status.running)],
    [state.lang === "zh" ? "\u5df2\u8fde\u63a5" : "Connected", String(status.connected)],
    [state.lang === "zh" ? "\u751f\u547d\u5468\u671f" : "Lifecycle", status.lifecycleState || "-"],
    [state.lang === "zh" ? "\u539f\u56e0" : "Reason", status.lifecycleReason || "-"],
    [state.lang === "zh" ? "\u8d26\u53f7" : "Account", status.accountName || status.accountId || "-"],
    [state.lang === "zh" ? "\u66f4\u65b0\u65f6\u95f4" : "Updated", formatTime(status.updatedAt)],
    [state.lang === "zh" ? "\u6700\u540e\u6d88\u606f" : "Last", status.lastMessage || status.lastError || "-"],
    [state.lang === "zh" ? "\u63d0\u4f9b\u65b9" : "Provider", status.providerMode]
  ];

  if (status.providerMode === "openclaw") {
    rows.splice(5, 0, [state.lang === "zh" ? "\u7f51\u5173" : "Gateway", status.gatewayReachable ? (state.lang === "zh" ? "\u53ef\u8fbe" : "Reachable") : (state.lang === "zh" ? "\u79bb\u7ebf" : "Offline")]);
    rows.splice(6, 0, [state.lang === "zh" ? "\u63d2\u4ef6" : "Plugin", status.pluginInstalled ? status.pluginVersion || (state.lang === "zh" ? "\u5df2\u5b89\u88c5" : "Installed") : (state.lang === "zh" ? "\u7f3a\u5931" : "Missing")]);
  }

  els.wechatStatus.innerHTML = rows
    .map(([label, value]) => `<div class="detail-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join("");
}

function renderChannelNotes(status) {
  const notes = [...(status.notes || [])];
  if (status.lifecycleState) {
    notes.unshift(`Lifecycle: ${status.lifecycleState}${status.lifecycleReason ? ` (${status.lifecycleReason})` : ""}`);
  }
  if (status.requiresHumanAction) {
    notes.unshift(state.lang === "zh" ? "需要人工处理当前微信连接状态。" : "Manual action is required for the current WeChat state.");
  }
  if (status.reconnectPausedUntil) {
    notes.unshift(`${state.lang === "zh" ? "\u81ea\u52a8\u6062\u590d\u6682\u505c\u5230" : "Reconnect paused until"}: ${formatTime(status.reconnectPausedUntil)}`);
  }
  if (status.lastError) notes.unshift(status.lastError);
  if (status.gatewayUrl) notes.push(`${state.lang === "zh" ? "\u7f51\u5173" : "Gateway"}: ${status.gatewayUrl}`);
  if (status.lastHealthyAt) notes.push(`${state.lang === "zh" ? "\u4e0a\u6b21\u5065\u5eb7" : "Last healthy"}: ${formatTime(status.lastHealthyAt)}`);
  if (status.lastRestartAt) notes.push(`${state.lang === "zh" ? "\u4e0a\u6b21\u91cd\u542f" : "Last restart"}: ${formatTime(status.lastRestartAt)}`);
  if (status.providerMode !== "mock") {
    notes.push(
      state.lang === "zh"
        ? "\u5982\u9700\u50cf OpenClaw \u4e00\u6837\u5e38\u9a7b\u8fd0\u884c\uff0c\u53ef\u7528 PM2 \u6216 Windows service \u811a\u672c\uff0c\u800c\u4e0d\u662f\u4e00\u76f4\u6302\u7740\u524d\u53f0\u7ec8\u7aef\u3002"
        : "For always-on runtime, use PM2 or the bundled Windows service scripts instead of keeping a foreground terminal open."
    );
  }
  if (status.providerMode === "openclaw") {
    notes.push(
      state.lang === "zh"
        ? "OpenClaw \u63d2\u4ef6\u5b89\u88c5\u547d\u4ee4\uff1aopenclaw plugins install @sinlair/reagent-openclaw --yes"
        : "OpenClaw plugin install: openclaw plugins install @sinlair/reagent-openclaw --yes"
    );
  }

  if (!notes.length) {
    els.channelNotes.className = "empty-state compact-empty";
    els.channelNotes.textContent = t("empty.notes", "No notes available.");
    return;
  }

  els.channelNotes.className = "result-stack";
  els.channelNotes.innerHTML = notes
    .map((note) => `<article class="result-item"><p>${escapeHtml(note)}</p></article>`)
    .join("");
}

function renderPairing(status) {
  const hasQr = Boolean(status.qrDataUrl);
  const isNative = status.providerMode === "native";
  els.pairingCode.hidden = hasQr;
  els.pairingQr.hidden = !hasQr;
  if (hasQr) els.pairingQr.src = status.qrDataUrl;
  else els.pairingQr.removeAttribute("src");

  els.pairingCode.textContent = status.pairingCode || (status.connected ? "CONNECTED" : "-");
  els.wechatStart.textContent = hasQr
    ? t("channels.refreshQr", state.lang === "zh" ? "刷新二维码" : "Refresh QR")
    : t("channels.startPairing", state.lang === "zh" ? "开始配对" : "Start pairing");
  els.wechatComplete.hidden = isNative;

  if (status.connected) {
    els.pairingHint.textContent = state.lang === "zh" ? "\u5fae\u4fe1\u4f20\u8f93\u5df2\u8fde\u63a5\u3002" : "WeChat transport is connected.";
    return;
  }

  if (hasQr) {
    els.pairingHint.textContent = isNative
      ? (state.lang === "zh"
          ? "\u626b\u63cf\u4e8c\u7ef4\u7801\u5373\u53ef\uff0cReAgent \u4f1a\u81ea\u52a8\u68c0\u6d4b\u5e76\u5b8c\u6210\u8fde\u63a5\u3002"
          : "Scan the QR code. ReAgent will detect the confirmation and connect automatically.")
      : (state.lang === "zh"
          ? "\u626b\u63cf\u4e8c\u7ef4\u7801\u540e\u70b9\u51fb\u201c\u7b49\u5f85\u626b\u7801\u201d\u3002"
          : "Scan the QR code, then click 'Wait for scan'.");
    return;
  }

  els.pairingHint.textContent =
    status.lastError ||
    status.notes?.[0] ||
    (state.lang === "zh"
      ? (isNative
          ? "\u540e\u53f0\u901a\u9053 runtime \u4f1a\u81ea\u52a8\u51c6\u5907\u4e8c\u7ef4\u7801\uff0c\u4e5f\u53ef\u4ee5\u624b\u52a8\u5237\u65b0\u3002"
          : "\u5f00\u59cb\u914d\u5bf9\u4ee5\u8bf7\u6c42\u65b0\u7684\u4e8c\u7ef4\u7801\u3002")
      : (isNative
          ? "The background channel runtime will prepare a QR code automatically. You can also refresh it manually."
          : "Start pairing to request a new QR code."));
}

function renderWelcomeState() {
  const welcome = copy().chat || {};
  els.wechatMessages.className = "chat-thread empty-state";
  els.wechatMessages.innerHTML = `
    <div class="agent-chat__welcome">
      <div class="agent-chat__welcome-glow"></div>
      <div class="sidebar-brand__logo agent-chat__welcome-mark"><span class="sidebar-brand__logo-mark">R</span></div>
      <h2>ReAgent</h2>
      <div class="agent-chat__badge">${escapeHtml(welcome.welcomeBadge || "")}</div>
      <p class="agent-chat__welcome-hint">${escapeHtml(welcome.welcomeHint || "")}</p>
      <div class="agent-chat__suggestions">
        ${(welcome.suggestions || [])
          .map(
            (suggestion) => `
              <button class="agent-chat__suggestion" type="button" data-suggestion="${escapeHtml(suggestion)}">
                ${escapeHtml(suggestion)}
              </button>
            `
          )
          .join("")}
      </div>
    </div>
  `;

  els.wechatMessages.querySelectorAll("[data-suggestion]").forEach((button) => {
    button.addEventListener("click", () => {
      els.wechatMessage.value = button.dataset.suggestion || "";
      adjustTextareaHeight();
      els.wechatMessage.focus();
    });
  });
}

function renderMessages(messages) {
  state.latestMessages = Array.isArray(messages) ? messages : [];
  if (!state.latestMessages.length) {
    renderWelcomeState();
    renderOverviewActivity([]);
    return;
  }

  els.wechatMessages.className = "chat-thread";
  els.wechatMessages.innerHTML = state.latestMessages
    .map((message) => {
      const isLocalUser = message.direction === "inbound" && message.senderId === "ui-wechat-user";
      const kind = message.direction === "system" ? "system" : isLocalUser ? "user" : "assistant";
      const author =
        message.direction === "system"
          ? t("chat.system", "System")
          : isLocalUser
            ? message.senderName || t("chat.you", "You")
            : message.direction === "outbound"
              ? t("chat.assistant", "ReAgent")
              : message.senderName || message.senderId || t("chat.assistant", "ReAgent");
      const avatar = message.direction === "system" ? "!" : author.slice(0, 1).toUpperCase();

      return `
        <article class="message message--${kind}">
          <div class="message__avatar">${escapeHtml(avatar)}</div>
          <div class="message__body">
            <div class="message__meta">
              <span class="message__author">${escapeHtml(author)}</span>
              <span>${escapeHtml(formatTime(message.createdAt))}</span>
            </div>
            <div class="bubble"><p>${nl2br(message.text)}</p></div>
          </div>
        </article>
      `;
    })
    .join("");

  els.wechatMessages.scrollTop = els.wechatMessages.scrollHeight;
  renderOverviewActivity(state.latestMessages);
}

function renderTransportMessages(messages) {
  state.transportMessages = Array.isArray(messages) ? messages : [];
  if (!state.transportMessages.length) {
    els.wechatChannelMessages.className = "empty-state compact-empty";
    els.wechatChannelMessages.textContent = t("empty.transport", "No transport messages yet.");
    return;
  }

  els.wechatChannelMessages.className = "result-stack";
  els.wechatChannelMessages.innerHTML = state.transportMessages
    .slice(-8)
    .reverse()
    .map(
      (message) => `
        <article class="activity-item">
          <div class="message__meta">
            <span class="message__author">${escapeHtml(message.direction)}</span>
            <span>${escapeHtml(formatTime(message.createdAt))}</span>
          </div>
          <p>${nl2br(message.text)}</p>
        </article>
      `
    )
    .join("");
}

async function openMemoryFile(path) {
  if (!path) return;
  const payload = await requestJson(`/api/memory/file?path=${encodeURIComponent(path)}`);
  state.selectedMemoryFilePath = path;
  els.memoryFileViewer.textContent = payload.content;
  renderMemoryFiles(state.memoryFiles);
}

function renderMemoryResults(results) {
  if (!results.length) {
    els.memoryResults.className = "empty-state";
    els.memoryResults.textContent = t("empty.memoryResults", "No memory results yet.");
    return;
  }

  els.memoryResults.className = "result-stack";
  els.memoryResults.innerHTML = results
    .map(
      (result) => `
        <button class="result-item result-item--action" type="button" data-memory-open="${escapeHtml(result.path)}">
          <h3>${escapeHtml(result.title)}</h3>
          <p>${escapeHtml(result.snippet)}</p>
          <small>${escapeHtml(result.path)} - ${escapeHtml(String(result.startLine))}-${escapeHtml(String(result.endLine))} - ${escapeHtml(String(result.score))}</small>
        </button>
      `
    )
    .join("");

  els.memoryResults.querySelectorAll("[data-memory-open]").forEach((button) => {
    button.addEventListener("click", async () => {
      const path = button.dataset.memoryOpen;
      if (!path) return;
      await openMemoryFile(path);
    });
  });
}

function bindMemoryFileButtons() {
  els.memoryFiles.querySelectorAll("[data-path]").forEach((button) => {
    button.addEventListener("click", async () => {
      const path = button.dataset.path;
      if (!path) return;
      await openMemoryFile(path);
    });
  });
}

function renderMemoryFiles(files) {
  state.memoryFiles = Array.isArray(files) ? files : [];
  if (!state.memoryFiles.length) {
    els.memoryFiles.className = "empty-state";
    els.memoryFiles.textContent = t("empty.memoryFiles", "No files.");
    return;
  }

  els.memoryFiles.className = "file-list";
  els.memoryFiles.innerHTML = state.memoryFiles
    .map(
      (file) => `
        <button class="file-item ${file.path === state.selectedMemoryFilePath ? "is-active" : ""}" type="button" data-path="${escapeHtml(file.path)}">
          <strong>${escapeHtml(file.path)}</strong>
          <small>${escapeHtml(file.kind)} - ${escapeHtml(formatRelativeTime(file.updatedAt))}</small>
        </button>
      `
    )
    .join("");
  bindMemoryFileButtons();
}

function verdictTone(verdict) {
  if (verdict === "strong") return "ok";
  if (verdict === "moderate") return "warn";
  return "danger";
}

function supportKindLabel(kind) {
  const labels = {
    paper: state.lang === "zh" ? "论文证据" : "Paper",
    code: state.lang === "zh" ? "代码证据" : "Code",
    inference: state.lang === "zh" ? "推断" : "Inference",
    speculation: state.lang === "zh" ? "猜测" : "Speculation"
  };
  return labels[kind] || kind;
}

function conclusionKindLabel(kind) {
  const labels = {
    problem_statement: state.lang === "zh" ? "问题定义" : "Problem",
    core_method: state.lang === "zh" ? "核心方法" : "Method",
    innovation: state.lang === "zh" ? "创新点" : "Innovation",
    strength: state.lang === "zh" ? "优势" : "Strength",
    weakness: state.lang === "zh" ? "风险/弱点" : "Weakness",
    baseline: state.lang === "zh" ? "基线" : "Baseline",
    recommendation: state.lang === "zh" ? "建议" : "Recommendation",
    repo_availability: state.lang === "zh" ? "代码可用性" : "Code Availability"
  };
  return labels[kind] || kind;
}

function confidenceTone(confidence) {
  if (confidence === "high") return "ok";
  if (confidence === "medium") return "warn";
  return "danger";
}

function renderPill(text, tone = "") {
  return `<span class="report-pill ${tone ? `report-pill--${escapeHtml(tone)}` : ""}">${escapeHtml(text)}</span>`;
}

function renderStringList(items, emptyText) {
  return items?.length
    ? items.map((item) => `<article class="result-item"><p>${escapeHtml(item)}</p></article>`).join("")
    : `<div class="empty-state compact-empty">${escapeHtml(emptyText)}</div>`;
}

function clearResearchBriefForm() {
  if (els.researchBriefForm) {
    els.researchBriefForm.reset();
  }
  if (els.researchBriefId) els.researchBriefId.value = "";
  if (els.researchBriefLabel) els.researchBriefLabel.value = "";
  if (els.researchBriefSummary) els.researchBriefSummary.value = "";
  if (els.researchBriefTlDr) els.researchBriefTlDr.value = "";
  if (els.researchBriefBackground) els.researchBriefBackground.value = "";
  if (els.researchBriefTargetProblem) els.researchBriefTargetProblem.value = "";
  if (els.researchBriefSuccessCriteria) els.researchBriefSuccessCriteria.value = "";
  if (els.researchBriefKnownBaselines) els.researchBriefKnownBaselines.value = "";
  if (els.researchBriefEvaluationPriorities) els.researchBriefEvaluationPriorities.value = "";
  if (els.researchBriefShortTermValidationTargets) els.researchBriefShortTermValidationTargets.value = "";
  if (els.researchBriefCurrentGoals) els.researchBriefCurrentGoals.value = "";
  if (els.researchBriefOpenQuestions) els.researchBriefOpenQuestions.value = "";
  if (els.researchBriefQueryHints) els.researchBriefQueryHints.value = "";
  if (els.researchBriefBlockedDirections) els.researchBriefBlockedDirections.value = "";
  if (els.researchBriefPreferredVenues) els.researchBriefPreferredVenues.value = "";
  if (els.researchBriefPreferredDatasets) els.researchBriefPreferredDatasets.value = "";
  if (els.researchBriefPreferredBenchmarks) els.researchBriefPreferredBenchmarks.value = "";
  if (els.researchBriefPreferredPaperStyles) els.researchBriefPreferredPaperStyles.value = "";
  if (els.researchBriefPriority) els.researchBriefPriority.value = "secondary";
  if (els.researchBriefEnabled) els.researchBriefEnabled.checked = true;
}

function populateResearchBriefForm(brief) {
  if (!brief) {
    clearResearchBriefForm();
    return;
  }

  if (els.researchBriefId) els.researchBriefId.value = brief.id || "";
  if (els.researchBriefLabel) els.researchBriefLabel.value = brief.label || "";
  if (els.researchBriefSummary) els.researchBriefSummary.value = brief.summary || "";
  if (els.researchBriefTlDr) els.researchBriefTlDr.value = brief.tlDr || "";
  if (els.researchBriefBackground) els.researchBriefBackground.value = brief.background || "";
  if (els.researchBriefTargetProblem) els.researchBriefTargetProblem.value = brief.targetProblem || "";
  if (els.researchBriefSuccessCriteria) els.researchBriefSuccessCriteria.value = formatListInput(brief.successCriteria);
  if (els.researchBriefKnownBaselines) els.researchBriefKnownBaselines.value = formatListInput(brief.knownBaselines);
  if (els.researchBriefEvaluationPriorities) els.researchBriefEvaluationPriorities.value = formatListInput(brief.evaluationPriorities);
  if (els.researchBriefShortTermValidationTargets) els.researchBriefShortTermValidationTargets.value = formatListInput(brief.shortTermValidationTargets);
  if (els.researchBriefCurrentGoals) els.researchBriefCurrentGoals.value = formatListInput(brief.currentGoals);
  if (els.researchBriefOpenQuestions) els.researchBriefOpenQuestions.value = formatListInput(brief.openQuestions);
  if (els.researchBriefQueryHints) els.researchBriefQueryHints.value = formatListInput(brief.queryHints);
  if (els.researchBriefBlockedDirections) els.researchBriefBlockedDirections.value = formatListInput(brief.blockedDirections);
  if (els.researchBriefPreferredVenues) els.researchBriefPreferredVenues.value = formatListInput(brief.preferredVenues);
  if (els.researchBriefPreferredDatasets) els.researchBriefPreferredDatasets.value = formatListInput(brief.preferredDatasets);
  if (els.researchBriefPreferredBenchmarks) els.researchBriefPreferredBenchmarks.value = formatListInput(brief.preferredBenchmarks);
  if (els.researchBriefPreferredPaperStyles) els.researchBriefPreferredPaperStyles.value = formatListInput(brief.preferredPaperStyles);
  if (els.researchBriefPriority) els.researchBriefPriority.value = brief.priority || "secondary";
  if (els.researchBriefEnabled) els.researchBriefEnabled.checked = brief.enabled !== false;
}

function buildResearchBriefPayload() {
  return {
    id: els.researchBriefId?.value.trim() || undefined,
    label: els.researchBriefLabel?.value.trim() || "",
    summary: els.researchBriefSummary?.value.trim() || undefined,
    tlDr: els.researchBriefTlDr?.value.trim() || undefined,
    background: els.researchBriefBackground?.value.trim() || undefined,
    targetProblem: els.researchBriefTargetProblem?.value.trim() || undefined,
    successCriteria: parseListInput(els.researchBriefSuccessCriteria?.value),
    knownBaselines: parseListInput(els.researchBriefKnownBaselines?.value),
    evaluationPriorities: parseListInput(els.researchBriefEvaluationPriorities?.value),
    shortTermValidationTargets: parseListInput(els.researchBriefShortTermValidationTargets?.value),
    currentGoals: parseListInput(els.researchBriefCurrentGoals?.value),
    openQuestions: parseListInput(els.researchBriefOpenQuestions?.value),
    queryHints: parseListInput(els.researchBriefQueryHints?.value),
    blockedDirections: parseListInput(els.researchBriefBlockedDirections?.value),
    preferredVenues: parseListInput(els.researchBriefPreferredVenues?.value),
    preferredDatasets: parseListInput(els.researchBriefPreferredDatasets?.value),
    preferredBenchmarks: parseListInput(els.researchBriefPreferredBenchmarks?.value),
    preferredPaperStyles: parseListInput(els.researchBriefPreferredPaperStyles?.value).filter((value) =>
      ["theory", "engineering", "reproducibility", "application"].includes(value)
    ),
    priority: els.researchBriefPriority?.value || "secondary",
    enabled: Boolean(els.researchBriefEnabled?.checked)
  };
}

function setSelectedResearchBrief(brief) {
  clearResearchSelections();
  state.selectedResearchBrief = brief || null;
  state.selectedResearchBriefId = brief?.id || null;
  state.selectedResearchTaskId = null;
}

function renderResearchBrief(brief) {
  if (!brief) {
    els.researchReport.className = "empty-state";
    els.researchReport.textContent = t("empty.reportLoaded", "No report loaded.");
    return;
  }

  const sections = [
    [state.lang === "zh" ? "Summary" : "Summary", brief.summary],
    [state.lang === "zh" ? "TL;DR" : "TL;DR", brief.tlDr],
    [state.lang === "zh" ? "Background" : "Background", brief.background],
    [state.lang === "zh" ? "Target Problem" : "Target Problem", brief.targetProblem]
  ].filter(([, value]) => Boolean(value));

  els.researchReport.className = "research-report";
  els.researchReport.innerHTML = `
    <article class="report-hero">
      <div class="report-hero__head">
        <div>
          <div class="section-kicker">${escapeHtml(state.lang === "zh" ? "Research Brief" : "Research Brief")}</div>
          <h3>${escapeHtml(brief.label)}</h3>
          <p>${escapeHtml(brief.summary || brief.tlDr || brief.targetProblem || (state.lang === "zh" ? "暂无摘要。" : "No summary yet."))}</p>
        </div>
        <div class="report-chip-list">
          ${renderPill(brief.priority || "secondary")}
          ${renderPill(brief.enabled === false ? (state.lang === "zh" ? "disabled" : "disabled") : (state.lang === "zh" ? "enabled" : "enabled"), brief.enabled === false ? "warn" : "ok")}
          ${renderPill(formatTime(brief.updatedAt))}
        </div>
      </div>
      <div class="research-stat-grid">
        <article class="research-stat">
          <span>${escapeHtml(state.lang === "zh" ? "Brief ID" : "Brief ID")}</span>
          <strong>${escapeHtml(brief.id)}</strong>
        </article>
        <article class="research-stat">
          <span>${escapeHtml(state.lang === "zh" ? "Goals" : "Goals")}</span>
          <strong>${escapeHtml(String(brief.currentGoals?.length || 0))}</strong>
        </article>
        <article class="research-stat">
          <span>${escapeHtml(state.lang === "zh" ? "Baselines" : "Baselines")}</span>
          <strong>${escapeHtml(String(brief.knownBaselines?.length || 0))}</strong>
        </article>
        <article class="research-stat">
          <span>${escapeHtml(state.lang === "zh" ? "Success Criteria" : "Success Criteria")}</span>
          <strong>${escapeHtml(String(brief.successCriteria?.length || 0))}</strong>
        </article>
      </div>
    </article>

    <div class="research-report-layout">
      <div class="stack research-report-main">
        ${sections.map(([title, value]) => `
          <article class="report-block">
            <div class="report-item-head"><h3>${escapeHtml(title)}</h3></div>
            <p>${escapeHtml(value)}</p>
          </article>
        `).join("")}

        <article class="report-block">
          <div class="report-item-head"><h3>${escapeHtml(state.lang === "zh" ? "Current Goals" : "Current Goals")}</h3>${renderPill(String(brief.currentGoals?.length || 0), "ok")}</div>
          <div class="result-stack">${renderStringList(brief.currentGoals, state.lang === "zh" ? "暂无 current goals。" : "No current goals recorded.")}</div>
        </article>

        <article class="report-block">
          <div class="report-item-head"><h3>${escapeHtml(state.lang === "zh" ? "Open Questions" : "Open Questions")}</h3>${renderPill(String(brief.openQuestions?.length || 0), "warn")}</div>
          <div class="result-stack">${renderStringList(brief.openQuestions, state.lang === "zh" ? "暂无 open questions。" : "No open questions recorded.")}</div>
        </article>

        <article class="report-block">
          <div class="report-item-head"><h3>${escapeHtml(state.lang === "zh" ? "Short-Term Validation Targets" : "Short-Term Validation Targets")}</h3>${renderPill(String(brief.shortTermValidationTargets?.length || 0))}</div>
          <div class="result-stack">${renderStringList(brief.shortTermValidationTargets, state.lang === "zh" ? "暂无 validation targets。" : "No validation targets recorded.")}</div>
        </article>
      </div>

      <aside class="stack research-report-side">
        <article class="report-block">
          <div class="report-item-head"><h3>${escapeHtml(state.lang === "zh" ? "Known Baselines" : "Known Baselines")}</h3>${renderPill(String(brief.knownBaselines?.length || 0))}</div>
          <div class="result-stack">${renderStringList(brief.knownBaselines, state.lang === "zh" ? "暂无 baselines。" : "No baselines recorded.")}</div>
        </article>

        <article class="report-block">
          <div class="report-item-head"><h3>${escapeHtml(state.lang === "zh" ? "Evaluation Priorities" : "Evaluation Priorities")}</h3>${renderPill(String(brief.evaluationPriorities?.length || 0))}</div>
          <div class="result-stack">${renderStringList(brief.evaluationPriorities, state.lang === "zh" ? "暂无 evaluation priorities。" : "No evaluation priorities recorded.")}</div>
        </article>

        <article class="report-block">
          <div class="report-item-head"><h3>${escapeHtml(state.lang === "zh" ? "Success Criteria" : "Success Criteria")}</h3>${renderPill(String(brief.successCriteria?.length || 0), "ok")}</div>
          <div class="result-stack">${renderStringList(brief.successCriteria, state.lang === "zh" ? "暂无 success criteria。" : "No success criteria recorded.")}</div>
        </article>

        <article class="report-block">
          <div class="report-item-head"><h3>${escapeHtml(state.lang === "zh" ? "Blocked Directions" : "Blocked Directions")}</h3>${renderPill(String(brief.blockedDirections?.length || 0), "warn")}</div>
          <div class="result-stack">${renderStringList(brief.blockedDirections, state.lang === "zh" ? "暂无 blocked directions。" : "No blocked directions recorded.")}</div>
        </article>

        <article class="report-block">
          <div class="report-item-head"><h3>${escapeHtml(state.lang === "zh" ? "Query Hints" : "Query Hints")}</h3>${renderPill(String(brief.queryHints?.length || 0))}</div>
          <div class="result-stack">${renderStringList(brief.queryHints, state.lang === "zh" ? "暂无 query hints。" : "No query hints recorded.")}</div>
        </article>

        <article class="report-block">
          <div class="report-item-head"><h3>${escapeHtml(state.lang === "zh" ? "Preferred Signals" : "Preferred Signals")}</h3>${renderPill(String((brief.preferredVenues?.length || 0) + (brief.preferredDatasets?.length || 0) + (brief.preferredBenchmarks?.length || 0)))}</div>
          <div class="report-stack-tight">
            <div>
              <div class="card-sub">${escapeHtml(state.lang === "zh" ? "Venues" : "Venues")}</div>
              <div class="result-stack">${renderStringList(brief.preferredVenues, state.lang === "zh" ? "暂无 venues。" : "No preferred venues recorded.")}</div>
            </div>
            <div>
              <div class="card-sub">${escapeHtml(state.lang === "zh" ? "Datasets" : "Datasets")}</div>
              <div class="result-stack">${renderStringList(brief.preferredDatasets, state.lang === "zh" ? "暂无 datasets。" : "No preferred datasets recorded.")}</div>
            </div>
            <div>
              <div class="card-sub">${escapeHtml(state.lang === "zh" ? "Benchmarks" : "Benchmarks")}</div>
              <div class="result-stack">${renderStringList(brief.preferredBenchmarks, state.lang === "zh" ? "暂无 benchmarks。" : "No preferred benchmarks recorded.")}</div>
            </div>
            <div>
              <div class="card-sub">${escapeHtml(state.lang === "zh" ? "Paper Styles" : "Paper Styles")}</div>
              <div class="result-stack">${renderStringList(brief.preferredPaperStyles, state.lang === "zh" ? "暂无 paper styles。" : "No preferred paper styles recorded.")}</div>
            </div>
          </div>
        </article>
      </aside>
    </div>
  `;
}

function renderResearchReportLegacy(report) {
  if (!report) {
    els.researchReport.className = "empty-state";
    els.researchReport.textContent = t("empty.reportLoaded", "No report loaded.");
    return;
  }

  const findings = report.findings?.length
    ? report.findings
        .map((finding) => `<article class="result-item"><p>${escapeHtml(finding)}</p></article>`)
        .join("")
    : `<div class="empty-state compact-empty">${escapeHtml(t("empty.findings", "No findings."))}</div>`;

  const nextActions = report.nextActions?.length
    ? report.nextActions
        .map((action) => `<article class="result-item"><p>${escapeHtml(action)}</p></article>`)
        .join("")
    : `<div class="empty-state compact-empty">${escapeHtml(state.lang === "zh" ? "暂无下一步建议。" : "No next actions yet.")}</div>`;

  const evidence = report.evidence?.length
    ? report.evidence
        .map(
          (item) => `
            <article class="report-block report-block--dense">
              <div class="report-item-head">
                <h3>${escapeHtml(item.claim)}</h3>
                ${renderPill(item.confidence || item.sourceType, item.confidence === "high" ? "ok" : item.confidence === "medium" ? "warn" : "")}
              </div>
              <p>${escapeHtml(item.quote || item.support)}</p>
              <div class="report-chip-list">
                ${renderPill(item.sourceType)}
                ${renderPill(item.paperId)}
                ${renderPill(item.chunkId || "-")}
                ${item.pageNumber ? renderPill(`${state.lang === "zh" ? "第" : "p."}${item.pageNumber}${state.lang === "zh" ? "页" : ""}`) : ""}
              </div>
            </article>
          `
        )
        .join("")
    : `<div class="empty-state compact-empty">${escapeHtml(t("empty.evidence", "No evidence."))}</div>`;

  const queries = report.plan?.searchQueries?.length
    ? report.plan.searchQueries.map((query) => renderPill(query)).join("")
    : `<span class="card-sub">${escapeHtml(state.lang === "zh" ? "无查询记录" : "No search queries recorded")}</span>`;

  const subquestions = report.plan?.subquestions?.length
    ? report.plan.subquestions.map((question) => `<article class="result-item"><p>${escapeHtml(question)}</p></article>`).join("")
    : `<div class="empty-state compact-empty">${escapeHtml(state.lang === "zh" ? "无拆分问题。" : "No subquestions.")}</div>`;

  const warnings = report.warnings?.length
    ? `
      <article class="report-block">
        <div class="report-item-head">
          <h3>${escapeHtml(state.lang === "zh" ? "Warnings" : "Warnings")}</h3>
          ${renderPill(String(report.warnings.length), "warn")}
        </div>
        <div class="result-stack">
          ${report.warnings.map((warning) => `<article class="result-item"><p>${escapeHtml(warning)}</p></article>`).join("")}
        </div>
      </article>
    `
    : "";

  els.researchReport.className = "research-report";
  els.researchReport.innerHTML = `
    <article class="report-hero">
      <div class="report-hero__head">
        <div>
          <div class="section-kicker">${escapeHtml(state.lang === "zh" ? "Workflow Report" : "Workflow Report")}</div>
          <h3>${escapeHtml(report.topic)}</h3>
          <p>${escapeHtml(report.summary)}</p>
        </div>
        <div class="report-chip-list">
          ${renderPill(formatTime(report.generatedAt))}
          ${renderPill(report.critique.verdict, verdictTone(report.critique.verdict))}
          ${renderPill(`${report.papers.length} ${state.lang === "zh" ? "papers" : "papers"}`)}
          ${renderPill(`${report.evidence.length} ${state.lang === "zh" ? "evidence" : "evidence"}`)}
        </div>
      </div>
      <div class="research-stat-grid">
        <article class="research-stat">
          <span>${escapeHtml(state.lang === "zh" ? "Task ID" : "Task ID")}</span>
          <strong>${escapeHtml(report.taskId)}</strong>
        </article>
        <article class="research-stat">
          <span>${escapeHtml(state.lang === "zh" ? "Objective" : "Objective")}</span>
          <strong>${escapeHtml(report.plan?.objective || report.topic)}</strong>
        </article>
        <article class="research-stat">
          <span>${escapeHtml(state.lang === "zh" ? "Supported Evidence" : "Supported Evidence")}</span>
          <strong>${escapeHtml(String(report.critique.supportedEvidenceCount ?? 0))}</strong>
        </article>
        <article class="research-stat">
          <span>${escapeHtml(state.lang === "zh" ? "Coverage" : "Coverage")}</span>
          <strong>${escapeHtml(String(report.critique.citationCoverage ?? 0))}</strong>
        </article>
      </div>
    </article>

    <div class="research-report-grid">
      <article class="report-block">
        <div class="report-item-head">
          <h3>${escapeHtml(state.lang === "zh" ? "Research Plan" : "Research Plan")}</h3>
          ${renderPill(String(report.plan?.searchQueries?.length || 0))}
        </div>
        <div class="report-stack-tight">
          <div>
            <div class="card-sub">${escapeHtml(state.lang === "zh" ? "Search queries" : "Search queries")}</div>
            <div class="report-chip-list">${queries}</div>
          </div>
          <div>
            <div class="card-sub">${escapeHtml(state.lang === "zh" ? "Subquestions" : "Subquestions")}</div>
            <div class="result-stack">${subquestions}</div>
          </div>
        </div>
      </article>

      <article class="report-block">
        <div class="report-item-head">
          <h3>${escapeHtml(state.lang === "zh" ? "Critique" : "Critique")}</h3>
          ${renderPill(report.critique.verdict, verdictTone(report.critique.verdict))}
        </div>
        <p>${escapeHtml(report.critique.summary)}</p>
        <div class="research-stat-grid research-stat-grid--compact">
          <article class="research-stat">
            <span>${escapeHtml(state.lang === "zh" ? "Supported" : "Supported")}</span>
            <strong>${escapeHtml(String(report.critique.supportedEvidenceCount ?? 0))}</strong>
          </article>
          <article class="research-stat">
            <span>${escapeHtml(state.lang === "zh" ? "Unsupported" : "Unsupported")}</span>
            <strong>${escapeHtml(String(report.critique.unsupportedEvidenceCount ?? 0))}</strong>
          </article>
          <article class="research-stat">
            <span>${escapeHtml(state.lang === "zh" ? "Coverage" : "Coverage")}</span>
            <strong>${escapeHtml(String(report.critique.citationCoverage ?? 0))}</strong>
          </article>
          <article class="research-stat">
            <span>${escapeHtml(state.lang === "zh" ? "Diversity" : "Diversity")}</span>
            <strong>${escapeHtml(String(report.critique.citationDiversity ?? 0))}</strong>
          </article>
        </div>
      </article>
    </div>

    <article class="report-block">
      <div class="report-item-head">
        <h3>${escapeHtml(state.lang === "zh" ? "Findings" : "Findings")}</h3>
        ${renderPill(String(report.findings?.length || 0))}
      </div>
      <div class="result-stack">${findings}</div>
    </article>

    <article class="report-block">
      <div class="report-item-head">
        <h3>${escapeHtml(state.lang === "zh" ? "Next Actions" : "Next Actions")}</h3>
        ${renderPill(String(report.nextActions?.length || 0), "ok")}
      </div>
      <div class="result-stack">${nextActions}</div>
    </article>

    <article class="report-block">
      <div class="report-item-head">
        <h3>${escapeHtml(state.lang === "zh" ? "Evidence" : "Evidence")}</h3>
        ${renderPill(String(report.evidence?.length || 0))}
      </div>
      <div class="result-stack">${evidence}</div>
    </article>
    ${warnings}
  `;
}

function renderResearchReport(report) {
  if (!report) {
    els.researchReport.className = "empty-state";
    els.researchReport.textContent = t("empty.reportLoaded", "No report loaded.");
    return;
  }

  const papers = Array.isArray(report.papers) ? report.papers : [];
  const critique = report.critique || {
    verdict: "-",
    summary: "",
    issues: [],
    recommendations: [],
    supportedEvidenceCount: 0,
    unsupportedEvidenceCount: 0,
    coveredFindingsCount: 0,
    citationDiversity: 0,
    citationCoverage: 0
  };

  const findings = report.findings?.length
    ? report.findings.map((finding) => `<article class="result-item"><p>${escapeHtml(finding)}</p></article>`).join("")
    : `<div class="empty-state compact-empty">${escapeHtml(t("empty.findings", "No findings."))}</div>`;

  const nextActions = report.nextActions?.length
    ? report.nextActions.map((action) => `<article class="result-item"><p>${escapeHtml(action)}</p></article>`).join("")
    : `<div class="empty-state compact-empty">${escapeHtml(state.lang === "zh" ? "暂无下一步建议。" : "No next actions yet.")}</div>`;

  const gaps = report.gaps?.length
    ? report.gaps.map((gap) => `<article class="result-item"><p>${escapeHtml(gap)}</p></article>`).join("")
    : `<div class="empty-state compact-empty">${escapeHtml(state.lang === "zh" ? "暂无缺口记录。" : "No gaps recorded.")}</div>`;

  const critiqueIssues = critique.issues?.length
    ? critique.issues.map((issue) => `<article class="result-item"><p>${escapeHtml(issue)}</p></article>`).join("")
    : `<div class="empty-state compact-empty">${escapeHtml(state.lang === "zh" ? "暂无风险项。" : "No critique issues.")}</div>`;

  const critiqueRecommendations = critique.recommendations?.length
    ? critique.recommendations.map((item) => `<article class="result-item"><p>${escapeHtml(item)}</p></article>`).join("")
    : `<div class="empty-state compact-empty">${escapeHtml(state.lang === "zh" ? "暂无建议。" : "No recommendations yet.")}</div>`;

  const evidence = report.evidence?.length
    ? report.evidence
        .map(
          (item) => `
            <article class="report-block report-block--dense report-evidence-card">
              <div class="report-item-head">
                <h3>${escapeHtml(item.claim)}</h3>
                ${renderPill(item.confidence || item.sourceType, item.confidence === "high" ? "ok" : item.confidence === "medium" ? "warn" : "")}
              </div>
              <p>${escapeHtml(item.quote || item.support)}</p>
              ${item.quote && item.support && item.quote !== item.support ? `<small>${escapeHtml(item.support)}</small>` : ""}
              <div class="report-chip-list">
                ${renderPill(item.sourceType)}
                ${renderPill(item.paperId)}
                ${renderPill(item.chunkId || "-")}
                ${item.pageNumber ? renderPill(`${state.lang === "zh" ? "第" : "p."}${item.pageNumber}${state.lang === "zh" ? "页" : ""}`) : ""}
              </div>
            </article>
          `
        )
        .join("")
    : `<div class="empty-state compact-empty">${escapeHtml(t("empty.evidence", "No evidence."))}</div>`;

  const queries = report.plan?.searchQueries?.length
    ? report.plan.searchQueries.map((query) => renderPill(query)).join("")
    : `<span class="card-sub">${escapeHtml(state.lang === "zh" ? "无查询记录" : "No search queries recorded")}</span>`;

  const subquestions = report.plan?.subquestions?.length
    ? report.plan.subquestions.map((question) => `<article class="result-item"><p>${escapeHtml(question)}</p></article>`).join("")
    : `<div class="empty-state compact-empty">${escapeHtml(state.lang === "zh" ? "无拆分问题。" : "No subquestions.")}</div>`;

  const paperLibrary = papers.length
    ? papers
        .slice(0, 8)
        .map(
          (paper) => `
            <article class="result-item research-paper-card">
              <div class="report-item-head">
                <h3>${escapeHtml(paper.title)}</h3>
                <div class="report-chip-list">
                  ${paper.year ? renderPill(String(paper.year)) : ""}
                  ${paper.venue ? renderPill(paper.venue) : ""}
                  ${renderPill(paper.source || "paper")}
                </div>
              </div>
              <p>${escapeHtml(trimText(paper.relevanceReason || paper.abstract || "", 260) || (state.lang === "zh" ? "暂无摘要。" : "No abstract available."))}</p>
              <small>${escapeHtml(trimText((paper.authors || []).join(", "), 120) || (state.lang === "zh" ? "作者未知" : "Unknown authors"))}</small>
              <div class="report-chip-list">
                ${paper.doi ? renderPill(paper.doi) : ""}
                ${paper.url ? `<a class="graph-inline-link research-paper-card__link" href="${escapeHtml(paper.url)}" target="_blank" rel="noopener">${escapeHtml(state.lang === "zh" ? "打开来源" : "Open source")}</a>` : ""}
              </div>
            </article>
          `
        )
        .join("")
    : `<div class="empty-state compact-empty">${escapeHtml(state.lang === "zh" ? "暂无候选论文。" : "No papers retrieved.")}</div>`;

  const warnings = report.warnings?.length
    ? `
      <article class="report-block">
        <div class="report-item-head">
          <h3>${escapeHtml(state.lang === "zh" ? "Warnings" : "Warnings")}</h3>
          ${renderPill(String(report.warnings.length), "warn")}
        </div>
        <div class="result-stack">
          ${report.warnings.map((warning) => `<article class="result-item"><p>${escapeHtml(warning)}</p></article>`).join("")}
        </div>
      </article>
    `
    : "";

  els.researchReport.className = "research-report";
  els.researchReport.innerHTML = `
    <article class="report-hero">
      <div class="report-hero__head">
        <div>
          <div class="section-kicker">${escapeHtml(state.lang === "zh" ? "Evidence Report" : "Evidence Report")}</div>
          <h3>${escapeHtml(report.topic)}</h3>
          <p>${escapeHtml(report.summary)}</p>
        </div>
        <div class="report-chip-list">
          ${renderPill(formatTime(report.generatedAt))}
          ${renderPill(critique.verdict, verdictTone(critique.verdict))}
          ${renderPill(`${papers.length} ${state.lang === "zh" ? "papers" : "papers"}`)}
          ${renderPill(`${report.evidence.length} ${state.lang === "zh" ? "evidence" : "evidence"}`)}
        </div>
      </div>
      <div class="research-stat-grid">
        <article class="research-stat">
          <span>${escapeHtml(state.lang === "zh" ? "Task ID" : "Task ID")}</span>
          <strong>${escapeHtml(report.taskId)}</strong>
        </article>
        <article class="research-stat">
          <span>${escapeHtml(state.lang === "zh" ? "Objective" : "Objective")}</span>
          <strong>${escapeHtml(report.plan?.objective || report.topic)}</strong>
        </article>
        <article class="research-stat">
          <span>${escapeHtml(state.lang === "zh" ? "Supported Evidence" : "Supported Evidence")}</span>
          <strong>${escapeHtml(String(critique.supportedEvidenceCount ?? 0))}</strong>
        </article>
        <article class="research-stat">
          <span>${escapeHtml(state.lang === "zh" ? "Coverage" : "Coverage")}</span>
          <strong>${escapeHtml(String(critique.citationCoverage ?? 0))}</strong>
        </article>
      </div>
    </article>

    <div class="research-report-layout">
      <div class="stack research-report-main">
        <article class="report-block report-block--feature">
          <div class="report-item-head">
            <h3>${escapeHtml(state.lang === "zh" ? "Executive Findings" : "Executive Findings")}</h3>
            ${renderPill(String(report.findings?.length || 0))}
          </div>
          <div class="result-stack">${findings}</div>
        </article>

        <article class="report-block report-block--feature">
          <div class="report-item-head">
            <h3>${escapeHtml(state.lang === "zh" ? "Evidence Ledger" : "Evidence Ledger")}</h3>
            ${renderPill(String(report.evidence?.length || 0))}
          </div>
          <div class="result-stack research-evidence-list">${evidence}</div>
        </article>

        <article class="report-block">
          <div class="report-item-head">
            <h3>${escapeHtml(state.lang === "zh" ? "Source Library" : "Source Library")}</h3>
            ${renderPill(String(papers.length))}
          </div>
          <div class="result-stack research-paper-grid">${paperLibrary}</div>
        </article>
      </div>

      <aside class="stack research-report-side">
        <article class="report-block">
          <div class="report-item-head">
            <h3>${escapeHtml(state.lang === "zh" ? "Research Plan" : "Research Plan")}</h3>
            ${renderPill(String(report.plan?.searchQueries?.length || 0))}
          </div>
          <div class="report-stack-tight">
            <div>
              <div class="card-sub">${escapeHtml(state.lang === "zh" ? "Search queries" : "Search queries")}</div>
              <div class="report-chip-list">${queries}</div>
            </div>
            <div>
              <div class="card-sub">${escapeHtml(state.lang === "zh" ? "Subquestions" : "Subquestions")}</div>
              <div class="result-stack">${subquestions}</div>
            </div>
          </div>
        </article>

        <article class="report-block">
          <div class="report-item-head">
            <h3>${escapeHtml(state.lang === "zh" ? "Critique" : "Critique")}</h3>
            ${renderPill(critique.verdict, verdictTone(critique.verdict))}
          </div>
          <p>${escapeHtml(critique.summary)}</p>
          <div class="research-stat-grid research-stat-grid--compact">
            <article class="research-stat">
              <span>${escapeHtml(state.lang === "zh" ? "Supported" : "Supported")}</span>
              <strong>${escapeHtml(String(critique.supportedEvidenceCount ?? 0))}</strong>
            </article>
            <article class="research-stat">
              <span>${escapeHtml(state.lang === "zh" ? "Unsupported" : "Unsupported")}</span>
              <strong>${escapeHtml(String(critique.unsupportedEvidenceCount ?? 0))}</strong>
            </article>
            <article class="research-stat">
              <span>${escapeHtml(state.lang === "zh" ? "Coverage" : "Coverage")}</span>
              <strong>${escapeHtml(String(critique.citationCoverage ?? 0))}</strong>
            </article>
            <article class="research-stat">
              <span>${escapeHtml(state.lang === "zh" ? "Diversity" : "Diversity")}</span>
              <strong>${escapeHtml(String(critique.citationDiversity ?? 0))}</strong>
            </article>
          </div>
          <div class="report-stack-tight">
            <div>
              <div class="card-sub">${escapeHtml(state.lang === "zh" ? "Issues" : "Issues")}</div>
              <div class="result-stack">${critiqueIssues}</div>
            </div>
            <div>
              <div class="card-sub">${escapeHtml(state.lang === "zh" ? "Recommendations" : "Recommendations")}</div>
              <div class="result-stack">${critiqueRecommendations}</div>
            </div>
          </div>
        </article>

        <article class="report-block">
          <div class="report-item-head">
            <h3>${escapeHtml(state.lang === "zh" ? "Next Actions" : "Next Actions")}</h3>
            ${renderPill(String(report.nextActions?.length || 0), "ok")}
          </div>
          <div class="result-stack">${nextActions}</div>
        </article>

        <article class="report-block">
          <div class="report-item-head">
            <h3>${escapeHtml(state.lang === "zh" ? "Evidence Gaps" : "Evidence Gaps")}</h3>
            ${renderPill(String(report.gaps?.length || 0), "warn")}
          </div>
          <div class="result-stack">${gaps}</div>
        </article>
        ${warnings}
      </aside>
    </div>
  `;
}

function renderDirectionReport(report) {
  if (!report) {
    els.researchReport.className = "empty-state";
    els.researchReport.textContent = t("empty.reportLoaded", "No report loaded.");
    return;
  }

  const representativePapers = report.representativePapers?.length
    ? report.representativePapers
        .map(
          (paper) => `
            <article class="result-item research-paper-card">
              <div class="report-item-head">
                <h3>${escapeHtml(paper.title)}</h3>
                <div class="report-chip-list">
                  ${paper.sourceUrl ? `<a class="graph-inline-link research-paper-card__link" href="${escapeHtml(paper.sourceUrl)}" target="_blank" rel="noopener">${escapeHtml(state.lang === "zh" ? "打开来源" : "Open source")}</a>` : ""}
                </div>
              </div>
              <p>${escapeHtml(paper.reason)}</p>
            </article>
          `
        )
        .join("")
    : `<div class="empty-state compact-empty">${escapeHtml(state.lang === "zh" ? "暂无代表论文。" : "No representative papers.")}</div>`;

  const renderStringList = (items, emptyText) =>
    items?.length
      ? items.map((item) => `<article class="result-item"><p>${escapeHtml(item)}</p></article>`).join("")
      : `<div class="empty-state compact-empty">${escapeHtml(emptyText)}</div>`;

  els.researchReport.className = "research-report";
  els.researchReport.innerHTML = `
    <article class="report-hero">
      <div class="report-hero__head">
        <div>
          <div class="section-kicker">${escapeHtml(state.lang === "zh" ? "Direction Report" : "Direction Report")}</div>
          <h3>${escapeHtml(report.topic)}</h3>
          <p>${escapeHtml(report.overview)}</p>
        </div>
        <div class="report-chip-list">
          ${report.directionId ? renderPill(report.directionId) : ""}
          ${renderPill(formatTime(report.updatedAt))}
          ${renderPill(String(report.representativePapers?.length || 0))}
        </div>
      </div>
      <div class="research-stat-grid">
        <article class="research-stat">
          <span>${escapeHtml(state.lang === "zh" ? "Report ID" : "Report ID")}</span>
          <strong>${escapeHtml(report.id)}</strong>
        </article>
        <article class="research-stat">
          <span>${escapeHtml(state.lang === "zh" ? "Direction" : "Direction")}</span>
          <strong>${escapeHtml(report.directionId || report.topic)}</strong>
        </article>
        <article class="research-stat">
          <span>${escapeHtml(state.lang === "zh" ? "代表论文" : "Representative papers")}</span>
          <strong>${escapeHtml(String(report.representativePapers?.length || 0))}</strong>
        </article>
        <article class="research-stat">
          <span>${escapeHtml(state.lang === "zh" ? "建议路线" : "Suggested routes")}</span>
          <strong>${escapeHtml(String(report.suggestedRoutes?.length || 0))}</strong>
        </article>
      </div>
    </article>

    <div class="research-report-layout">
      <div class="stack research-report-main">
        <article class="report-block report-block--feature">
          <div class="report-item-head">
            <h3>${escapeHtml(state.lang === "zh" ? "Representative Papers" : "Representative Papers")}</h3>
            ${renderPill(String(report.representativePapers?.length || 0))}
          </div>
          <div class="result-stack research-paper-grid">${representativePapers}</div>
        </article>

        <article class="report-block">
          <div class="report-item-head">
            <h3>${escapeHtml(state.lang === "zh" ? "Suggested Routes" : "Suggested Routes")}</h3>
            ${renderPill(String(report.suggestedRoutes?.length || 0), "ok")}
          </div>
          <div class="result-stack">${renderStringList(report.suggestedRoutes, state.lang === "zh" ? "暂无建议路线。" : "No suggested routes.")}</div>
        </article>

        <article class="report-block">
          <div class="report-item-head">
            <h3>${escapeHtml(state.lang === "zh" ? "Supporting Signals" : "Supporting Signals")}</h3>
            ${renderPill(String(report.supportingSignals?.length || 0))}
          </div>
          <div class="result-stack">${renderStringList(report.supportingSignals, state.lang === "zh" ? "暂无 supporting signals。" : "No supporting signals.")}</div>
        </article>
      </div>

      <aside class="stack research-report-side">
        <article class="report-block">
          <div class="report-item-head">
            <h3>${escapeHtml(state.lang === "zh" ? "Common Baselines" : "Common Baselines")}</h3>
            ${renderPill(String(report.commonBaselines?.length || 0))}
          </div>
          <div class="result-stack">${renderStringList(report.commonBaselines, state.lang === "zh" ? "暂无 baseline。" : "No baselines recorded.")}</div>
        </article>

        <article class="report-block">
          <div class="report-item-head">
            <h3>${escapeHtml(state.lang === "zh" ? "Common Modules" : "Common Modules")}</h3>
            ${renderPill(String(report.commonModules?.length || 0))}
          </div>
          <div class="result-stack">${renderStringList(report.commonModules, state.lang === "zh" ? "暂无模块。" : "No common modules recorded.")}</div>
        </article>

        <article class="report-block">
          <div class="report-item-head">
            <h3>${escapeHtml(state.lang === "zh" ? "Open Problems" : "Open Problems")}</h3>
            ${renderPill(String(report.openProblems?.length || 0), "warn")}
          </div>
          <div class="result-stack">${renderStringList(report.openProblems, state.lang === "zh" ? "暂无开放问题。" : "No open problems recorded.")}</div>
        </article>
      </aside>
    </div>
  `;
}

function renderPresentationArtifact(presentation) {
  if (!presentation) {
    els.researchReport.className = "empty-state";
    els.researchReport.textContent = t("empty.reportLoaded", "No report loaded.");
    return;
  }

  const markdownHref = `/api/research/artifact?path=${encodeURIComponent(presentation.filePath)}`;
  const pptxHref = presentation.pptxPath ? `/api/research/artifact?path=${encodeURIComponent(presentation.pptxPath)}` : "";

  els.researchReport.className = "research-report";
  els.researchReport.innerHTML = `
    <article class="report-hero">
      <div class="report-hero__head">
        <div>
          <div class="section-kicker">${escapeHtml(state.lang === "zh" ? "Presentation Artifact" : "Presentation Artifact")}</div>
          <h3>${escapeHtml(presentation.title)}</h3>
          <p>${escapeHtml(state.lang === "zh" ? "已生成的会议材料和导出文件。" : "Generated meeting material and export files.")}</p>
        </div>
        <div class="report-chip-list">
          ${renderPill(formatTime(presentation.generatedAt))}
          ${renderPill(String(presentation.sourceReportTaskIds?.length || 0))}
          ${renderPill(String(presentation.imagePaths?.length || 0))}
        </div>
      </div>
    </article>
    <div class="research-report-layout">
      <div class="stack research-report-main">
        <article class="report-block report-block--feature">
          <div class="report-item-head">
            <h3>${escapeHtml(state.lang === "zh" ? "Slide Markdown" : "Slide Markdown")}</h3>
            ${renderPill(String((presentation.slideMarkdown || "").split("\n").length))}
          </div>
          <pre class="code-panel">${escapeHtml(clipBlock(presentation.slideMarkdown || "", 6000))}</pre>
        </article>
      </div>
      <aside class="stack research-report-side">
        <article class="report-block">
          <div class="report-item-head">
            <h3>${escapeHtml(state.lang === "zh" ? "Artifacts" : "Artifacts")}</h3>
          </div>
          <div class="result-stack">
            <article class="result-item">
              <h3>${escapeHtml("Markdown")}</h3>
              <p>${escapeHtml(presentation.filePath)}</p>
              <small><a class="graph-inline-link" href="${escapeHtml(markdownHref)}" target="_blank" rel="noopener">${escapeHtml(state.lang === "zh" ? "打开文件" : "Open file")}</a></small>
            </article>
            ${presentation.pptxPath ? `
              <article class="result-item">
                <h3>${escapeHtml("PPTX")}</h3>
                <p>${escapeHtml(presentation.pptxPath)}</p>
                <small><a class="graph-inline-link" href="${escapeHtml(pptxHref)}" target="_blank" rel="noopener">${escapeHtml(state.lang === "zh" ? "打开文件" : "Open file")}</a></small>
              </article>
            ` : ""}
          </div>
        </article>
        <article class="report-block">
          <div class="report-item-head">
            <h3>${escapeHtml(state.lang === "zh" ? "Source Reports" : "Source Reports")}</h3>
            ${renderPill(String(presentation.sourceReportTaskIds?.length || 0))}
          </div>
          <div class="result-stack">${renderStringList(presentation.sourceReportTaskIds, state.lang === "zh" ? "暂无 source reports。" : "No source reports recorded.")}</div>
        </article>
        <article class="report-block">
          <div class="report-item-head">
            <h3>${escapeHtml(state.lang === "zh" ? "Image Assets" : "Image Assets")}</h3>
            ${renderPill(String(presentation.imagePaths?.length || 0))}
          </div>
          <div class="result-stack">
            ${(presentation.imagePaths || []).length
              ? presentation.imagePaths.map((filePath) => `
                  <article class="result-item">
                    <p>${escapeHtml(filePath)}</p>
                    <small><a class="graph-inline-link" href="/api/research/artifact?path=${encodeURIComponent(filePath)}" target="_blank" rel="noopener">${escapeHtml(state.lang === "zh" ? "打开文件" : "Open file")}</a></small>
                  </article>
                `).join("")
              : `<div class="empty-state compact-empty">${escapeHtml(state.lang === "zh" ? "暂无 image assets。" : "No image assets recorded.")}</div>`}
          </div>
        </article>
      </aside>
    </div>
  `;
}

function renderModuleAsset(asset) {
  if (!asset) {
    els.researchReport.className = "empty-state";
    els.researchReport.textContent = t("empty.reportLoaded", "No report loaded.");
    return;
  }

  const archiveHref = asset.archivePath ? `/api/research/artifact?path=${encodeURIComponent(asset.archivePath)}` : "";

  els.researchReport.className = "research-report";
  els.researchReport.innerHTML = `
    <article class="report-hero">
      <div class="report-hero__head">
        <div>
          <div class="section-kicker">${escapeHtml(state.lang === "zh" ? "Module Asset" : "Module Asset")}</div>
          <h3>${escapeHtml(`${asset.owner}/${asset.repo}`)}</h3>
          <p>${escapeHtml(state.lang === "zh" ? "这里展示已归档的可复用模块和仓库快照。" : "Archived reusable modules and repository snapshots.")}</p>
        </div>
        <div class="report-chip-list">
          ${renderPill(asset.id)}
          ${asset.defaultBranch ? renderPill(asset.defaultBranch) : ""}
          ${renderPill(formatTime(asset.updatedAt))}
        </div>
      </div>
    </article>
    <div class="research-report-layout">
      <div class="stack research-report-main">
        <article class="report-block report-block--feature">
          <div class="report-item-head">
            <h3>${escapeHtml(state.lang === "zh" ? "Selected Paths" : "Selected Paths")}</h3>
            ${renderPill(String(asset.selectedPaths?.length || 0))}
          </div>
          <div class="result-stack">${renderStringList(asset.selectedPaths, state.lang === "zh" ? "还没有已选路径。" : "No selected paths recorded.")}</div>
        </article>
        <article class="report-block">
          <div class="report-item-head">
            <h3>${escapeHtml(state.lang === "zh" ? "Notes" : "Notes")}</h3>
            ${renderPill(String(asset.notes?.length || 0))}
          </div>
          <div class="result-stack">${renderStringList(asset.notes, state.lang === "zh" ? "还没有备注。" : "No notes recorded.")}</div>
        </article>
      </div>
      <aside class="stack research-report-side">
        <article class="report-block">
          <div class="report-item-head">
            <h3>${escapeHtml(state.lang === "zh" ? "Archive" : "Archive")}</h3>
          </div>
          <div class="result-stack">
            <article class="result-item">
              <h3>${escapeHtml(state.lang === "zh" ? "Repository URL" : "Repository URL")}</h3>
              <p>${escapeHtml(asset.repoUrl)}</p>
              <small><a class="graph-inline-link" href="${escapeHtml(asset.repoUrl)}" target="_blank" rel="noopener">${escapeHtml(state.lang === "zh" ? "打开仓库" : "Open repo")}</a></small>
            </article>
            ${asset.archivePath ? `
              <article class="result-item">
                <h3>${escapeHtml(state.lang === "zh" ? "Archive Path" : "Archive Path")}</h3>
                <p>${escapeHtml(asset.archivePath)}</p>
                <small><a class="graph-inline-link" href="${escapeHtml(archiveHref)}" target="_blank" rel="noopener">${escapeHtml(state.lang === "zh" ? "打开归档" : "Open archive")}</a></small>
              </article>
            ` : ""}
          </div>
        </article>
      </aside>
    </div>
  `;
}

function renderDirectionReportList(reports) {
  if (!els.directionReportList) return;
  if (!reports.length) {
    els.directionReportList.className = "empty-state compact-empty";
    els.directionReportList.textContent = state.lang === "zh" ? "还没有主题报告。" : "No topic reports yet.";
    return;
  }

  els.directionReportList.className = "session-list";
  els.directionReportList.innerHTML = reports
    .map(
      (report) => `
        <button class="session-item ${state.selectedDirectionReportId === report.id ? "session-item--current" : ""}" type="button" data-direction-report-id="${escapeHtml(report.id)}">
          <div class="message__meta">
            <span class="message__author">${escapeHtml(report.topic)}</span>
            <span>${escapeHtml(formatRelativeTime(report.updatedAt))}</span>
          </div>
          <p>${escapeHtml(trimText(report.overview, 140))}</p>
          <small>${escapeHtml(report.directionId || "-")}</small>
        </button>
      `
    )
    .join("");

  els.directionReportList.querySelectorAll("[data-direction-report-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const reportId = button.dataset.directionReportId;
      if (!reportId) return;
      await hydrateDirectionReport(reportId);
    });
  });
}

function renderResearchBriefList(briefs) {
  if (!els.researchBriefList) return;
  if (!briefs.length) {
    els.researchBriefList.className = "empty-state compact-empty";
    els.researchBriefList.textContent = state.lang === "zh" ? "还没有研究模板。" : "No research templates yet.";
    return;
  }

  els.researchBriefList.className = "session-list";
  els.researchBriefList.innerHTML = briefs
    .map(
      (brief) => `
        <button class="session-item ${state.selectedResearchBriefId === brief.id ? "session-item--current" : ""}" type="button" data-brief-id="${escapeHtml(brief.id)}">
          <div class="message__meta">
            <span class="message__author">${escapeHtml(brief.label)}</span>
            <span>${escapeHtml(formatRelativeTime(brief.updatedAt))}</span>
          </div>
          <p>${escapeHtml(trimText(brief.summary || brief.tlDr || brief.targetProblem || "", 140) || (state.lang === "zh" ? "暂无 brief summary。" : "No brief summary yet."))}</p>
          <small>${escapeHtml(`${brief.priority || "secondary"}${brief.enabled === false ? " · disabled" : ""}`)}</small>
        </button>
      `
    )
    .join("");

  els.researchBriefList.querySelectorAll("[data-brief-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const briefId = button.dataset.briefId;
      if (!briefId) return;
      await hydrateResearchBrief(briefId);
    });
  });
}

async function hydrateResearchBrief(briefId) {
  const brief = await requestJson(`/api/research/directions/${encodeURIComponent(briefId)}`);
  setSelectedResearchBrief(brief);
  populateResearchBriefForm(brief);
  renderResearchBrief(brief);
  renderResearchBriefList(state.researchBriefs);
  return brief;
}

async function loadResearchBriefs() {
  const payload = await requestJson("/api/research/directions");
  state.researchBriefs = payload.profiles || [];
  if (state.selectedResearchBriefId) {
    state.selectedResearchBrief =
      state.researchBriefs.find((brief) => brief.id === state.selectedResearchBriefId) || null;
    if (state.selectedResearchBrief) {
      populateResearchBriefForm(state.selectedResearchBrief);
      renderResearchBrief(state.selectedResearchBrief);
    } else {
      state.selectedResearchBriefId = null;
      clearResearchBriefForm();
    }
  }
  renderResearchBriefList(state.researchBriefs);
  renderDiscoveryScheduler(state.discoveryScheduler);
  renderLandingSurfaces();
}

function isSchedulerFormActive() {
  return Boolean(els.discoverySchedulerForm && document.activeElement && els.discoverySchedulerForm.contains(document.activeElement));
}

function renderDiscoveryScheduler(status) {
  state.discoveryScheduler = status || null;
  if (!els.discoverySchedulerStatus) return;

  const scheduler = status || {
    running: false,
    enabled: false,
    dailyTimeLocal: "09:00",
    directionIds: [],
    topK: 5,
    maxPapersPerQuery: 4,
    lastRunDateByDirection: {},
  };

  if (!isSchedulerFormActive()) {
    if (els.discoverySchedulerTime) els.discoverySchedulerTime.value = scheduler.dailyTimeLocal || "09:00";
    if (els.discoverySchedulerEnabled) els.discoverySchedulerEnabled.checked = Boolean(scheduler.enabled);
    if (els.discoverySchedulerSenderId) els.discoverySchedulerSenderId.value = scheduler.senderId || "";
    if (els.discoverySchedulerSenderName) els.discoverySchedulerSenderName.value = scheduler.senderName || "";
    if (els.discoverySchedulerDirectionIds) els.discoverySchedulerDirectionIds.value = formatListInput(scheduler.directionIds || []);
    if (els.discoverySchedulerTopK) els.discoverySchedulerTopK.value = String(scheduler.topK || 5);
    if (els.discoverySchedulerMaxPapers) els.discoverySchedulerMaxPapers.value = String(scheduler.maxPapersPerQuery || 4);
  }

  const directionMap = new Map((state.researchBriefs || []).map((brief) => [brief.id, brief.label]));
  const selectedDirections = (scheduler.directionIds || []).length
    ? scheduler.directionIds.map((directionId) => directionMap.get(directionId) ? `${directionMap.get(directionId)} (${directionId})` : directionId)
    : [state.lang === "zh" ? "所有已启用的模板" : "All enabled templates"];
  const lastRuns = Object.entries(scheduler.lastRunDateByDirection || {});

  els.discoverySchedulerStatus.innerHTML = [
    [state.lang === "zh" ? "后台计划任务" : "Background schedule", scheduler.running ? (state.lang === "zh" ? "运行中" : "Running") : (state.lang === "zh" ? "未启动" : "Not running")],
    [state.lang === "zh" ? "是否启用" : "Enabled", String(Boolean(scheduler.enabled))],
    [state.lang === "zh" ? "每日时间" : "Daily time", scheduler.dailyTimeLocal || "09:00"],
    [state.lang === "zh" ? "推送目标" : "Push target", scheduler.senderId || "-"],
    [state.lang === "zh" ? "覆盖主题" : "Topics", selectedDirections.join(" | ")],
    ["Top K", String(scheduler.topK || 5)],
    [state.lang === "zh" ? "每次检索论文数" : "Papers / search", String(scheduler.maxPapersPerQuery || 4)],
    [state.lang === "zh" ? "最近更新" : "Updated", scheduler.updatedAt ? formatTime(scheduler.updatedAt) : "-"],
    [state.lang === "zh" ? "最近执行" : "Recent runs", lastRuns.length ? lastRuns.map(([directionId, value]) => `${directionMap.get(directionId) || directionId}: ${value}`).join(" | ") : (state.lang === "zh" ? "暂无" : "None yet")],
  ]
    .map(([label, value]) => `<div class="detail-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join("");
}

async function loadDiscoveryScheduler() {
  const status = await requestJson("/api/research/discovery/scheduler");
  renderDiscoveryScheduler(status);
}

function renderDiscoveryRuns() {
  if (!els.discoverySchedulerRuns) return;

  const runs = (state.discoveryRuns || []).slice(0, 6);
  if (!runs.length) {
    els.discoverySchedulerRuns.className = "empty-state compact-empty";
    els.discoverySchedulerRuns.textContent = state.lang === "zh" ? "还没有定时运行记录。" : "No scheduled runs yet.";
    return;
  }

  els.discoverySchedulerRuns.className = "result-stack";
  els.discoverySchedulerRuns.innerHTML = runs
    .map(
      (run) => `
        <article class="result-item">
          <div class="message__meta">
            <span class="message__author">${escapeHtml((run.directionLabels || []).join(", ") || "-")}</span>
            <span>${escapeHtml(formatRelativeTime(run.generatedAt))}</span>
          </div>
          <p>${escapeHtml(run.topTitle || (state.lang === "zh" ? "还没有代表论文。" : "No top paper recorded."))}</p>
          <small>${escapeHtml(`${run.itemCount || 0} items · ${run.pushed ? "pushed" : "local"}`)}</small>
        </article>
      `
    )
    .join("");
}

async function loadDiscoveryRuns() {
  const payload = await requestJson("/api/research/discovery/recent?limit=8");
  state.discoveryRuns = payload.runs || [];
  renderDiscoveryRuns();
}

function renderLifecycleAudit(items) {
  state.wechatLifecycleAudit = Array.isArray(items) ? items : [];
  if (!els.channelLifecycleAudit) return;

  if (!state.wechatLifecycleAudit.length) {
    els.channelLifecycleAudit.className = "empty-state compact-empty";
    els.channelLifecycleAudit.textContent = state.lang === "zh" ? "还没有状态变化记录。" : "No recent status changes yet.";
    return;
  }

  els.channelLifecycleAudit.className = "result-stack";
  els.channelLifecycleAudit.innerHTML = state.wechatLifecycleAudit
    .map((entry) => {
      const details = entry.details && typeof entry.details === "object"
        ? Object.entries(entry.details).map(([key, value]) => `${key}=${value}`).join(" · ")
        : "";
      return `
        <article class="result-item">
          <div class="message__meta">
            <span class="message__author">${escapeHtml(entry.event || "-")}</span>
            <span>${escapeHtml(entry.ts ? formatTime(entry.ts) : "-")}</span>
          </div>
          <p>${escapeHtml([entry.state, entry.reason].filter(Boolean).join(" · ") || (state.lang === "zh" ? "没有更多状态信息。" : "No additional state."))}</p>
          <small>${escapeHtml(details || entry.providerMode || "-")}</small>
        </article>
      `;
    })
    .join("");
}

async function loadLifecycleAudit() {
  const payload = await requestJson("/api/channels/wechat/lifecycle-audit?limit=12");
  renderLifecycleAudit(payload.items || []);
}

function renderFeedbackSummary(summary) {
  if (!els.feedbackSummary) return;
  if (!summary?.total) {
    els.feedbackSummary.innerHTML = "";
    return;
  }

  const positive = (summary.counts?.useful || 0) + (summary.counts?.["more-like-this"] || 0) + (summary.counts?.["worth-following"] || 0);
  const negative = (summary.counts?.["not-useful"] || 0) + (summary.counts?.["less-like-this"] || 0) + (summary.counts?.["too-theoretical"] || 0) + (summary.counts?.["too-engineering-heavy"] || 0) + (summary.counts?.["not-worth-following"] || 0);

  els.feedbackSummary.innerHTML = `
    <div class="detail-row"><span>${escapeHtml(state.lang === "zh" ? "总数" : "Total")}</span><strong>${escapeHtml(String(summary.total))}</strong></div>
    <div class="detail-row"><span>${escapeHtml(state.lang === "zh" ? "正向反馈" : "Positive feedback")}</span><strong>${escapeHtml(String(positive))}</strong></div>
    <div class="detail-row"><span>${escapeHtml(state.lang === "zh" ? "负向反馈" : "Negative feedback")}</span><strong>${escapeHtml(String(negative))}</strong></div>
    <div class="detail-row"><span>${escapeHtml(state.lang === "zh" ? "最近更新" : "Updated")}</span><strong>${escapeHtml(formatTime(summary.updatedAt))}</strong></div>
  `;
}

function renderFeedbackList(items) {
  if (!els.feedbackList) return;
  if (!items.length) {
    els.feedbackList.className = "empty-state compact-empty";
    els.feedbackList.textContent = state.lang === "zh" ? "还没有反馈记录。" : "No feedback yet.";
    return;
  }

  els.feedbackList.className = "result-stack";
  els.feedbackList.innerHTML = items
    .map(
      (item) => `
        <article class="result-item">
          <div class="message__meta">
            <span class="message__author">${escapeHtml(item.feedback)}</span>
            <span>${escapeHtml(formatRelativeTime(item.updatedAt || item.createdAt))}</span>
          </div>
          <p>${escapeHtml(trimText(item.notes || item.paperTitle || item.topic || "-", 140))}</p>
          <small>${escapeHtml(item.topic || item.paperTitle || item.directionId || "-")}</small>
        </article>
      `
    )
    .join("");
}

async function hydrateDirectionReport(reportId) {
  const report = await requestJson(`/api/research/direction-reports/${encodeURIComponent(reportId)}`);
  clearResearchSelections();
  state.selectedDirectionReport = report;
  state.selectedDirectionReportId = report.id;
  renderDirectionReport(report);
  renderDirectionReportList(state.directionReports);
  return report;
}

async function loadDirectionReports() {
  const payload = await requestJson("/api/research/direction-reports/recent?limit=12");
  state.directionReports = payload.reports || [];
  renderDirectionReportList(state.directionReports);
}

function renderPresentationList(presentations) {
  if (!els.presentationList) return;
  if (!presentations.length) {
    els.presentationList.className = "empty-state compact-empty";
    els.presentationList.textContent = state.lang === "zh" ? "暂无 presentations。" : "No presentations yet.";
    return;
  }

  els.presentationList.className = "session-list";
  els.presentationList.innerHTML = presentations
    .map(
      (presentation) => `
        <button class="session-item ${state.selectedPresentationId === presentation.id ? "session-item--current" : ""}" type="button" data-presentation-id="${escapeHtml(presentation.id)}">
          <div class="message__meta">
            <span class="message__author">${escapeHtml(presentation.title)}</span>
            <span>${escapeHtml(formatRelativeTime(presentation.generatedAt))}</span>
          </div>
          <p>${escapeHtml(trimText(presentation.filePath || presentation.id, 140))}</p>
          <small>${escapeHtml(`${presentation.sourceReportTaskIds?.length || 0} reports${presentation.pptxPath ? " · pptx" : ""}`)}</small>
        </button>
      `
    )
    .join("");

  els.presentationList.querySelectorAll("[data-presentation-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const presentationId = button.dataset.presentationId;
      if (!presentationId) return;
      await hydratePresentation(presentationId);
    });
  });
}

async function hydratePresentation(presentationId) {
  const presentation = await requestJson(`/api/research/presentations/${encodeURIComponent(presentationId)}`);
  clearResearchSelections();
  state.selectedPresentation = presentation;
  state.selectedPresentationId = presentation.id;
  renderPresentationArtifact(presentation);
  renderPresentationList(state.presentations);
  return presentation;
}

async function loadPresentations() {
  const payload = await requestJson("/api/research/presentations/recent?limit=12");
  state.presentations = payload.presentations || [];
  if (state.selectedPresentationId) {
    state.selectedPresentation =
      state.presentations.find((item) => item.id === state.selectedPresentationId) || state.selectedPresentation;
    if (state.selectedPresentation) {
      renderPresentationArtifact(state.selectedPresentation);
    } else {
      state.selectedPresentationId = null;
    }
  }
  renderPresentationList(state.presentations);
}

function renderModuleAssetList(assets) {
  if (!els.moduleAssetList) return;
  if (!assets.length) {
    els.moduleAssetList.className = "empty-state compact-empty";
    els.moduleAssetList.textContent = state.lang === "zh" ? "暂无 module assets。" : "No module assets yet.";
    return;
  }

  els.moduleAssetList.className = "session-list";
  els.moduleAssetList.innerHTML = assets
    .map(
      (asset) => `
        <button class="session-item ${state.selectedModuleAssetId === asset.id ? "session-item--current" : ""}" type="button" data-module-asset-id="${escapeHtml(asset.id)}">
          <div class="message__meta">
            <span class="message__author">${escapeHtml(`${asset.owner}/${asset.repo}`)}</span>
            <span>${escapeHtml(formatRelativeTime(asset.updatedAt))}</span>
          </div>
          <p>${escapeHtml(trimText(asset.selectedPaths?.join(", ") || asset.archivePath || asset.id, 140))}</p>
          <small>${escapeHtml(`${asset.selectedPaths?.length || 0} paths${asset.defaultBranch ? ` · ${asset.defaultBranch}` : ""}`)}</small>
        </button>
      `
    )
    .join("");

  els.moduleAssetList.querySelectorAll("[data-module-asset-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const assetId = button.dataset.moduleAssetId;
      if (!assetId) return;
      await hydrateModuleAsset(assetId);
    });
  });
}

async function hydrateModuleAsset(assetId) {
  const asset = await requestJson(`/api/research/module-assets/${encodeURIComponent(assetId)}`);
  clearResearchSelections();
  state.selectedModuleAsset = asset;
  state.selectedModuleAssetId = asset.id;
  renderModuleAsset(asset);
  renderModuleAssetList(state.moduleAssets);
  return asset;
}

async function loadModuleAssets() {
  const payload = await requestJson("/api/research/module-assets/recent?limit=12");
  state.moduleAssets = payload.assets || [];
  if (state.selectedModuleAssetId) {
    state.selectedModuleAsset =
      state.moduleAssets.find((item) => item.id === state.selectedModuleAssetId) || state.selectedModuleAsset;
    if (state.selectedModuleAsset) {
      renderModuleAsset(state.selectedModuleAsset);
    } else {
      state.selectedModuleAssetId = null;
    }
  }
  renderModuleAssetList(state.moduleAssets);
}

async function loadFeedback() {
  const payload = await requestJson("/api/research/feedback?limit=12");
  state.feedbackSummary = payload.summary || null;
  state.feedbackItems = payload.items || [];
  renderFeedbackSummary(state.feedbackSummary);
  renderFeedbackList(state.feedbackItems);
}

function renderRuntimeLogs(payload) {
  els.runtimeLogStdoutPath.textContent = payload.stdout.path || t("logs.waitingStdout", "Waiting for stdout log...");
  els.runtimeLogStderrPath.textContent = payload.stderr.path || t("logs.waitingStderr", "Waiting for stderr log...");
  els.runtimeLogOutput.textContent = payload.stdout.content || t("empty.stdout", "No stdout logs yet.");
  els.runtimeLogError.textContent = payload.stderr.content || t("empty.stderr", "No stderr logs yet.");
}

async function hydrateResearchTask(taskId) {
  const task = await requestJson(`/api/research/tasks/${encodeURIComponent(taskId)}`);
  clearResearchSelections();
  state.selectedResearchTaskId = task.taskId;
  state.selectedResearchTask = task;
  els.reportTaskId.value = task.taskId;
  if (els.chatReportTaskId) {
    els.chatReportTaskId.value = task.taskId;
  }

  if (task.reportReady && task.state === "completed") {
    return hydrateReport(task.taskId);
  }

  state.latestReport = state.latestReport?.taskId === task.taskId ? null : state.latestReport;
  renderResearchTaskDetail(task);
  renderOverviewCards(els.chatOverviewCards, true);
  renderOverviewCards(els.overviewCards, false);
  updateGlobalSummary();
  return task;
}

async function hydrateReport(taskId) {
  const report = await requestJson(`/api/research/${encodeURIComponent(taskId)}`);
  state.latestReport = report;
  clearResearchSelections();
  state.selectedResearchTaskId = report.taskId;
  els.reportTaskId.value = report.taskId;
  if (els.chatReportTaskId) {
    els.chatReportTaskId.value = report.taskId;
  }
  renderResearchReport(report);
  renderLatestReport(els.chatLatestReport, report);
  renderLatestReport(els.overviewLatestReport, report);
  renderOverviewCards(els.chatOverviewCards, true);
  renderOverviewCards(els.overviewCards, false);
  updateGlobalSummary();
  return report;
}

async function loadResearchTasks() {
  const payload = await requestJson("/api/research/tasks?limit=12");
  state.researchTasks = payload.tasks || [];
  renderResearchTasks(state.researchTasks);
  renderLandingSurfaces();

  const selectedTaskId = state.selectedResearchTaskId;
  if (!selectedTaskId) {
    return;
  }

  const selectedTask = state.researchTasks.find((task) => task.taskId === selectedTaskId);
  if (!selectedTask) {
    return;
  }

  if (selectedTask.reportReady && selectedTask.state === "completed") {
    if (state.latestReport?.taskId !== selectedTask.taskId) {
      await hydrateReport(selectedTask.taskId).catch(() => {});
    }
    return;
  }

  if (!state.selectedResearchTask || state.selectedResearchTask.taskId !== selectedTask.taskId || state.selectedResearchTask.state !== selectedTask.state || state.selectedResearchTask.message !== selectedTask.message) {
    await hydrateResearchTask(selectedTask.taskId).catch(() => {});
  }
}

async function loadHealth() {
  state.health = await requestJson("/health");
  updateGlobalSummary();
}

async function loadRuntimeMeta() {
  state.runtimeMeta = await requestJson("/api/runtime/meta");
  renderSettingsOverview();
  renderProductAlerts();
}

function renderGraphSummary(graph) {
  if (!els.graphSummary) return;
  if (!graph) {
    els.graphSummary.className = "empty-state compact-empty";
    els.graphSummary.textContent = "No graph data yet.";
    return;
  }

  const filters = [
    state.graphSearch.trim() ? `Search: ${state.graphSearch.trim()}` : "",
    state.graphTypeFilters.length ? `Types: ${state.graphTypeFilters.map((type) => formatGraphType(type)).join(", ")}` : "",
    state.graphDateRange !== "all" ? `Window: last ${state.graphDateRange.replace("d", "")} days` : "",
  ].filter(Boolean);

  const byType = GRAPH_TYPE_ORDER
    .map((type) => [type, graph.stats?.byType?.[type] ?? 0])
    .filter(([, count]) => count > 0);
  els.graphSummary.className = "detail-list";
  els.graphSummary.innerHTML = [
    `<div class="detail-row"><span>Generated</span><strong>${escapeHtml(formatTime(graph.generatedAt))}</strong></div>`,
    `<div class="detail-row"><span>Nodes</span><strong>${escapeHtml(String(graph.stats?.nodes ?? 0))}</strong></div>`,
    `<div class="detail-row"><span>Edges</span><strong>${escapeHtml(String(graph.stats?.edges ?? 0))}</strong></div>`,
    `<div class="detail-row"><span>Active filters</span><strong>${escapeHtml(filters.join(" | ") || "None")}</strong></div>`,
    ...byType.map(([type, count]) => `<div class="detail-row"><span>${escapeHtml(formatGraphType(type))}</span><strong>${escapeHtml(String(count))}</strong></div>`)
  ].join("");
}

function renderGraphTypeFilters(graph) {
  if (!els.graphTypeFilters) return;

  const counts = graph?.stats?.byType || {};
  els.graphTypeFilters.innerHTML = GRAPH_TYPE_ORDER
    .map((type) => `
      <button
        class="agent-panel-tab ${state.graphTypeFilters.includes(type) ? "agent-panel-tab--active" : ""}"
        type="button"
        data-graph-type="${escapeHtml(type)}"
      >
        ${escapeHtml(formatGraphType(type))} <span class="graph-filter-count">${escapeHtml(String(counts[type] ?? 0))}</span>
      </button>
    `)
    .join("");

  els.graphTypeFilters.querySelectorAll("[data-graph-type]").forEach((button) => {
    button.addEventListener("click", async () => {
      const type = button.dataset.graphType;
      if (!type) return;
      state.graphTypeFilters = state.graphTypeFilters.includes(type)
        ? state.graphTypeFilters.filter((item) => item !== type)
        : [...state.graphTypeFilters, type];
      await loadGraph().catch(showError);
    });
  });
}

function renderGraphStats(graph) {
  if (!els.graphStats) return;
  if (!graph) {
    els.graphStats.className = "graph-stats";
    els.graphStats.innerHTML = "";
    return;
  }

  const activeTypeCount = Object.values(graph.stats?.byType || {}).filter((count) => count > 0).length;
  const cards = [
    ["Visible Nodes", String(graph.stats?.nodes ?? 0), "Current filtered node count"],
    ["Visible Edges", String(graph.stats?.edges ?? 0), "Relationships inside the current filter"],
    ["Active Types", String(activeTypeCount), "Node categories visible in this view"],
    ["Selected Node", state.graphDetail?.node?.label || "-", state.graphDetail?.node ? formatGraphType(state.graphDetail.node.type) : "Pick a node from the graph"],
  ];

  els.graphStats.className = "graph-stats";
  els.graphStats.innerHTML = cards
    .map(
      ([label, value, hint]) => `
        <article class="card panel-card graph-stat-card">
          <div class="graph-stat-card__label">${escapeHtml(label)}</div>
          <div class="graph-stat-card__value">${escapeHtml(value)}</div>
          <div class="graph-stat-card__hint">${escapeHtml(hint)}</div>
        </article>
      `
    )
    .join("");
}

function bindGraphNodeButtons() {
  els.graphCanvas?.querySelectorAll("[data-graph-node]").forEach((node) => {
    node.addEventListener("click", () => {
      const nodeId = node.dataset.graphNode;
      if (!nodeId) return;
      selectGraphNode(nodeId).catch(showError);
    });
  });
}

function renderGraphCanvas(graph) {
  if (!els.graphCanvas) return;
  if (!graph || !Array.isArray(graph.nodes) || graph.nodes.length === 0) {
    els.graphCanvas.className = "graph-canvas empty-state compact-empty";
    els.graphCanvas.textContent = "No graph data yet.";
    return;
  }

  const grouped = GRAPH_TYPE_ORDER.map((type) => ({
    type,
    nodes: graph.nodes.filter((node) => node.type === type).slice(0, 10)
  })).filter((group) => group.nodes.length > 0);

  const laneWidth = 180;
  const width = Math.max(1020, grouped.length * laneWidth + 140);
  const laneGap = grouped.length > 0 ? (width - 140) / Math.max(grouped.length, 1) : laneWidth;
  const maxNodesPerLane = grouped.reduce((max, group) => Math.max(max, group.nodes.length), 1);
  const height = Math.max(420, maxNodesPerLane * 96 + 140);
  const positions = new Map();
  const degreeByNodeId = new Map();

  (graph.edges || []).forEach((edge) => {
    degreeByNodeId.set(edge.source, (degreeByNodeId.get(edge.source) || 0) + 1);
    degreeByNodeId.set(edge.target, (degreeByNodeId.get(edge.target) || 0) + 1);
  });

  grouped.forEach((group, columnIndex) => {
    const x = 90 + columnIndex * laneGap;
    const laneInnerHeight = Math.max(height - 150, 120);
    const step = group.nodes.length > 1 ? laneInnerHeight / (group.nodes.length - 1) : 0;
    group.nodes.forEach((node, rowIndex) => {
      const y = group.nodes.length === 1 ? height / 2 : 96 + rowIndex * step;
      positions.set(node.id, { x, y });
    });
  });

  const laneMarkup = grouped
    .map((group, columnIndex) => {
      const x = 90 + columnIndex * laneGap - 54;
      return `
        <g class="graph-lane">
          <rect x="${x}" y="42" width="108" height="${height - 74}" rx="28" class="graph-lane__rail"></rect>
          <text x="${x + 54}" y="28" text-anchor="middle" class="graph-column-label">${escapeHtml(formatGraphType(group.type))} (${group.nodes.length})</text>
        </g>
      `;
    })
    .join("");

  const edgeMarkup = (graph.edges || [])
    .filter((edge) => positions.has(edge.source) && positions.has(edge.target))
    .slice(0, 80)
    .map((edge) => {
      const source = positions.get(edge.source);
      const target = positions.get(edge.target);
      const delta = Math.abs(target.x - source.x) / 2;
      const active = state.selectedGraphNodeId && (edge.source === state.selectedGraphNodeId || edge.target === state.selectedGraphNodeId);
      return `<path d="M ${source.x} ${source.y} C ${source.x + delta} ${source.y}, ${target.x - delta} ${target.y}, ${target.x} ${target.y}" class="graph-link ${active ? "graph-link--active" : ""}" />`;
    })
    .join("");

  const nodeMarkup = grouped
    .flatMap((group) => group.nodes)
    .map((node) => {
      const pos = positions.get(node.id);
      const degree = degreeByNodeId.get(node.id) || 0;
      const radius = 18 + Math.min(10, degree * 1.5);
      const active = state.selectedGraphNodeId === node.id;
      return `
        <g class="graph-node-group ${active ? "graph-node-group--active" : ""}" data-graph-node="${escapeHtml(node.id)}" role="button" tabindex="0">
          <circle cx="${pos.x}" cy="${pos.y}" r="${radius}" class="graph-node graph-node--${escapeHtml(node.type)}"></circle>
          <text x="${pos.x}" y="${pos.y + radius + 18}" text-anchor="middle" class="graph-node-label">${escapeHtml(trimText(node.label, 18))}</text>
        </g>
      `;
    })
    .join("");

  els.graphCanvas.className = "graph-canvas";
  els.graphCanvas.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="graph-svg" role="img" aria-label="Research memory graph">
      ${laneMarkup}
      ${edgeMarkup}
      ${nodeMarkup}
    </svg>
  `;
  bindGraphNodeButtons();
}

function bindGraphEdgeButtons() {
  els.graphEdges?.querySelectorAll("[data-graph-open-node]").forEach((button) => {
    button.addEventListener("click", () => {
      const nodeId = button.dataset.graphOpenNode;
      if (!nodeId) return;
      selectGraphNode(nodeId).catch(showError);
    });
  });
}

function bindGraphDetailButtons() {
  els.graphDetail?.querySelectorAll("[data-graph-open-node]").forEach((button) => {
    button.addEventListener("click", () => {
      const nodeId = button.dataset.graphOpenNode;
      if (!nodeId) return;
      selectGraphNode(nodeId).catch(showError);
    });
  });

  els.graphDetail?.querySelectorAll("[data-graph-href]").forEach((button) => {
    button.addEventListener("click", () => {
      const href = button.dataset.graphHref;
      if (!href) return;
      window.open(href, href.startsWith("http") ? "_blank" : "_blank", "noopener");
    });
  });
}

function renderGraphEdges(graph) {
  if (!els.graphEdges) return;
  if (!graph || !Array.isArray(graph.edges) || graph.edges.length === 0) {
    els.graphEdges.className = "result-stack empty-state compact-empty";
    els.graphEdges.textContent = "No graph edges yet.";
    return;
  }

  const nodeById = new Map((graph.nodes || []).map((node) => [node.id, node]));
  const activeEdges = state.selectedGraphNodeId
    ? graph.edges.filter((edge) => edge.source === state.selectedGraphNodeId || edge.target === state.selectedGraphNodeId)
    : graph.edges;

  if (!activeEdges.length) {
    els.graphEdges.className = "result-stack empty-state compact-empty";
    els.graphEdges.textContent = "No visible relationships match the current selection.";
    return;
  }

  els.graphEdges.className = "result-stack";
  els.graphEdges.innerHTML = activeEdges.slice(0, 24).map((edge) => {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    return `
      <article class="result-item graph-edge-item">
        <div class="message__meta">
          <span class="message__author">${escapeHtml(edge.label)}</span>
          <span>${escapeHtml(formatGraphType(source?.type || "source_item"))} -> ${escapeHtml(formatGraphType(target?.type || "source_item"))}</span>
        </div>
        <div class="graph-edge-item__nodes">
          <button class="graph-inline-link" type="button" data-graph-open-node="${escapeHtml(source?.id || edge.source)}">${escapeHtml(source?.label || edge.source)}</button>
          <span class="graph-edge-arrow">&rarr;</span>
          <button class="graph-inline-link" type="button" data-graph-open-node="${escapeHtml(target?.id || edge.target)}">${escapeHtml(target?.label || edge.target)}</button>
        </div>
      </article>
    `;
  }).join("");
  bindGraphEdgeButtons();
}

function renderGraphDetailStats(items) {
  if (!items.length) {
    return "";
  }

  return `
    <div class="graph-detail__stats">
      ${items
        .map(
          ([label, value, tone = ""]) => `
            <article class="graph-detail-stat ${tone ? `graph-detail-stat--${escapeHtml(tone)}` : ""}">
              <span>${escapeHtml(label)}</span>
              <strong>${escapeHtml(String(value))}</strong>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderGraphConclusionCards(conclusions) {
  if (!Array.isArray(conclusions) || conclusions.length === 0) {
    return "";
  }

  return `
    <div class="graph-detail__section">
      <div class="card-sub">${escapeHtml(state.lang === "zh" ? "Structured conclusions" : "Structured conclusions")}</div>
      <div class="graph-conclusion-list">
        ${conclusions
          .slice(0, 12)
          .map(
            (conclusion) => `
              <article class="graph-conclusion">
                <div class="report-item-head">
                  <strong>${escapeHtml(conclusionKindLabel(conclusion.kind))}</strong>
                  <div class="report-chip-list">
                    ${renderPill(supportKindLabel(conclusion.supportKind), conclusion.supportKind === "paper" ? "info" : conclusion.supportKind === "code" ? "ok" : conclusion.supportKind === "inference" ? "warn" : "danger")}
                    ${renderPill(conclusion.confidence || "-", confidenceTone(conclusion.confidence))}
                  </div>
                </div>
                <p>${escapeHtml(conclusion.statement)}</p>
                ${
                  conclusion.evidenceRefs?.length
                    ? `<div class="report-chip-list">${conclusion.evidenceRefs
                        .slice(0, 3)
                        .map((ref) =>
                          renderPill(
                            [ref.sourceType, ref.pageNumber ? `${state.lang === "zh" ? "p" : "p"}${ref.pageNumber}` : "", trimText(ref.note || ref.text || "", 42)]
                              .filter(Boolean)
                              .join(" · ")
                          )
                        )
                        .join("")}</div>`
                    : ""
                }
                ${
                  conclusion.missingEvidence
                    ? `<small>${escapeHtml(conclusion.missingEvidence)}</small>`
                    : ""
                }
              </article>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderGraphDetailHighlights(detail) {
  const raw = detail?.raw;
  if (!raw || typeof raw !== "object") {
    return "";
  }

  if (raw.kind === "canonical_paper") {
    return `
      ${renderGraphDetailStats([
        [state.lang === "zh" ? "Linked reports" : "Linked reports", detail.node.meta.paperReports ?? 0],
        [state.lang === "zh" ? "Discovery runs" : "Discovery runs", detail.node.meta.discoveryRuns ?? 0],
        [state.lang === "zh" ? "Source items" : "Source items", detail.node.meta.sourceItems ?? 0],
        [state.lang === "zh" ? "Linked repos" : "Linked repos", detail.node.meta.linkedRepos ?? 0],
      ])}
      <div class="graph-detail__section">
        <div class="card-sub">${escapeHtml(state.lang === "zh" ? "Provenance summary" : "Provenance summary")}</div>
        <div class="graph-related-list">
          ${Object.entries(raw.relatedByType || {})
            .map(([type, entries]) => `
              <div class="graph-summary-chip">
                <strong>${escapeHtml(formatGraphType(type))}</strong>
                <span>${escapeHtml(String(entries.length))}</span>
              </div>
            `)
            .join("")}
        </div>
      </div>
    `;
  }

  if (raw.kind === "canonical_repo") {
    return `
      ${renderGraphDetailStats([
        [state.lang === "zh" ? "Repo reports" : "Repo reports", detail.node.meta.repoReports ?? 0],
        [state.lang === "zh" ? "Paper links" : "Paper links", detail.node.meta.linkedPapers ?? 0],
        [state.lang === "zh" ? "Module assets" : "Module assets", detail.node.meta.moduleAssets ?? 0],
        [state.lang === "zh" ? "Source items" : "Source items", detail.node.meta.sourceItems ?? 0],
      ], "ok")}
      <div class="graph-detail__section">
        <div class="card-sub">${escapeHtml(state.lang === "zh" ? "Provenance summary" : "Provenance summary")}</div>
        <div class="graph-related-list">
          ${Object.entries(raw.relatedByType || {})
            .map(([type, entries]) => `
              <div class="graph-summary-chip">
                <strong>${escapeHtml(formatGraphType(type))}</strong>
                <span>${escapeHtml(String(entries.length))}</span>
              </div>
            `)
            .join("")}
        </div>
      </div>
    `;
  }

  if (detail.node.type === "paper_report") {
    return `
      ${renderGraphDetailStats([
        [state.lang === "zh" ? "Paper-supported" : "Paper-supported", raw.evidenceProfile?.paperSupportedCount ?? 0, "info"],
        [state.lang === "zh" ? "Code-supported" : "Code-supported", raw.evidenceProfile?.codeSupportedCount ?? 0, "ok"],
        [state.lang === "zh" ? "Inference" : "Inference", raw.evidenceProfile?.inferenceCount ?? 0, "warn"],
        [state.lang === "zh" ? "Missing evidence" : "Missing evidence", raw.evidenceProfile?.missingEvidenceCount ?? 0, "danger"],
      ])}
      ${renderGraphConclusionCards(raw.conclusions)}
    `;
  }

  if (detail.node.type === "repo_report") {
    return renderGraphDetailStats([
      [state.lang === "zh" ? "Stars" : "Stars", raw.stars ?? 0, "ok"],
      [state.lang === "zh" ? "Official guess" : "Official guess", raw.likelyOfficial ? "yes" : "no", raw.likelyOfficial ? "ok" : "warn"],
      [state.lang === "zh" ? "Key paths" : "Key paths", raw.keyPaths?.length ?? 0],
      [state.lang === "zh" ? "Branch" : "Branch", raw.defaultBranch || "-"],
    ]);
  }

  if (detail.node.type === "module_asset") {
    return `
      ${renderGraphDetailStats([
        [state.lang === "zh" ? "Selected paths" : "Selected paths", raw.selectedPaths?.length ?? 0, "ok"],
        [state.lang === "zh" ? "Archive" : "Archive", raw.archivePath ? "ready" : "-", raw.archivePath ? "ok" : ""],
      ])}
      <div class="graph-detail__section">
        <div class="card-sub">${escapeHtml(state.lang === "zh" ? "Selected module paths" : "Selected module paths")}</div>
        <div class="report-chip-list">${(raw.selectedPaths || []).map((item) => renderPill(item)).join("")}</div>
      </div>
    `;
  }

  if (detail.node.type === "presentation") {
    return `
      ${renderGraphDetailStats([
        [state.lang === "zh" ? "Source reports" : "Source reports", raw.sourceReportTaskIds?.length ?? 0],
        [state.lang === "zh" ? "Images" : "Images", raw.imagePaths?.length ?? 0, "ok"],
      ])}
    `;
  }

  return "";
}

function renderGraphDetail(detail) {
  if (!els.graphDetail) return;
  if (!detail) {
    els.graphDetail.className = "empty-state compact-empty";
    els.graphDetail.textContent = state.selectedGraphNodeId ? "Loading node detail..." : "Select a node to inspect it.";
    return;
  }

  const metaRows = Object.entries(detail.node?.meta || {})
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => `<div class="detail-row"><span>${escapeHtml(key)}</span><strong>${escapeHtml(String(value))}</strong></div>`)
    .join("");

  const relatedNodes = detail.relatedNodes?.length
    ? detail.relatedNodes
        .map(
          (node) => `
            <button class="graph-related-chip" type="button" data-graph-open-node="${escapeHtml(node.id)}">
              ${escapeHtml(node.label)}
              <span>${escapeHtml(formatGraphType(node.type))}</span>
            </button>
          `
        )
        .join("")
    : `<div class="empty-state compact-empty">No directly connected nodes.</div>`;

  const links = detail.links?.length
    ? detail.links
        .map(
          (link) => `
            <button class="route-chip" type="button" data-graph-href="${escapeHtml(link.href)}">
              <span class="route-chip__copy">
                <strong>${escapeHtml(link.label)}</strong>
                <span>${escapeHtml(link.kind)}</span>
              </span>
            </button>
          `
        )
        .join("")
    : `<div class="empty-state compact-empty">No raw artifact or source link is available for this node.</div>`;

  const rawPayload = detail.raw ? clipBlock(JSON.stringify(detail.raw, null, 2)) : "No raw payload available.";
  const highlightMarkup = renderGraphDetailHighlights(detail);

  els.graphDetail.className = "graph-detail";
  els.graphDetail.innerHTML = `
    <div class="graph-detail__header">
      <div>
        <div class="graph-detail__eyebrow">${escapeHtml(formatGraphType(detail.node.type))}</div>
        <h3>${escapeHtml(detail.node.label)}</h3>
        <p>${escapeHtml(detail.node.subtitle || "No subtitle available.")}</p>
      </div>
      <span class="pill"><strong>${escapeHtml(detail.relatedEdges?.length ? `${detail.relatedEdges.length} edges` : "0 edges")}</strong></span>
    </div>
    <div class="detail-list">
      <div class="detail-row"><span>Node ID</span><strong>${escapeHtml(detail.node.id)}</strong></div>
      ${detail.node.occurredAt ? `<div class="detail-row"><span>Occurred</span><strong>${escapeHtml(formatTime(detail.node.occurredAt))}</strong></div>` : ""}
      ${metaRows}
    </div>
    ${highlightMarkup}
    <div class="graph-detail__section">
      <div class="card-sub">Related nodes</div>
      <div class="graph-related-list">${relatedNodes}</div>
    </div>
    <div class="graph-detail__section">
      <div class="card-sub">Artifacts and sources</div>
      <div class="fallback-route-list">${links}</div>
    </div>
    <details class="graph-detail__toggle">
      <summary>${escapeHtml(state.lang === "zh" ? "Raw payload" : "Raw payload")}</summary>
      <pre class="graph-detail__raw">${escapeHtml(rawPayload)}</pre>
    </details>
  `;
  bindGraphDetailButtons();
}

async function selectGraphNode(nodeId) {
  if (!nodeId) return;
  state.selectedGraphNodeId = nodeId;
  state.graphDetail = null;
  renderGraphCanvas(state.graphData);
  renderGraphEdges(state.graphData);
  renderGraphStats(state.graphData);
  renderGraphDetail(null);

  const token = ++graphDetailToken;
  const detail = await requestJson(`/api/research/memory-graph/${encodeURIComponent(nodeId)}`);
  if (token !== graphDetailToken || state.selectedGraphNodeId !== nodeId) {
    return;
  }

  state.graphDetail = detail;
  renderGraphStats(state.graphData);
  renderGraphDetail(detail);
}

async function renderGraph(graph) {
  state.graphData = graph;
  renderGraphTypeFilters(graph);
  renderGraphStats(graph);
  renderGraphSummary(graph);
  renderGraphCanvas(graph);
  renderGraphEdges(graph);
  if (!graph?.nodes?.length) {
    state.selectedGraphNodeId = null;
    state.graphDetail = null;
    renderGraphDetail(null);
    return;
  }

  const selectionStillVisible = state.selectedGraphNodeId && graph.nodes.some((node) => node.id === state.selectedGraphNodeId);
  if (!selectionStillVisible) {
    state.selectedGraphNodeId = graph.nodes[0].id;
    state.graphDetail = null;
  }

  renderGraphDetail(
    state.graphDetail && state.graphDetail.node?.id === state.selectedGraphNodeId
      ? state.graphDetail
      : null
  );

  if (!state.graphDetail || state.graphDetail.node?.id !== state.selectedGraphNodeId) {
    await selectGraphNode(state.selectedGraphNodeId);
  }
}

async function loadGraph() {
  const token = ++graphLoadToken;
  const graph = await requestJson(buildGraphUrl());
  if (token !== graphLoadToken) {
    return;
  }
  await renderGraph(graph);
}
async function loadAgentSession() {
  const session = await requestJson(`/api/channels/wechat/agent?senderId=${encodeURIComponent(UI_AGENT_SENDER_ID)}`);
  renderAgentSession(session);
}

async function loadAgentSessions() {
  const payload = await requestJson("/api/channels/wechat/agent/sessions");
  renderAgentSessionsList(payload.sessions || []);
}

async function loadChannels() {
  const snapshot = await requestJson("/api/channels/status");
  state.channels = snapshot.channels;
  const status = state.channels.wechat;
  renderStatusRows(status);
  renderPairing(status);
  renderChannelNotes(status);
  renderProductAlerts();
  updateGlobalSummary();
}

async function loadMessages() {
  const [chatPayload, transportPayload] = await Promise.all([
    requestJson("/api/channels/wechat/chat/messages"),
    requestJson("/api/channels/wechat/messages")
  ]);
  renderMessages(chatPayload.messages || []);
  renderTransportMessages(transportPayload.messages || []);
}

async function loadMemoryStatus() {
  state.memoryStatus = await requestJson("/api/memory/status");
  updateGlobalSummary();
}

async function loadMemoryFiles() {
  const payload = await requestJson("/api/memory/files");
  renderMemoryFiles(payload.files || []);
}

async function loadRecentResearch(options = {}) {
  const payload = await requestJson("/api/research/recent?limit=20");
  state.recentReports = payload.reports || [];
  renderLandingSurfaces();
  renderSessionCards(els.chatSessionList, state.recentReports.slice(0, 4), true);
  renderSessionCards(els.overviewSessionList, state.recentReports.slice(0, 5), true);
  renderSessionCards(els.researchSessionList, state.recentReports.slice(0, 5), true);
  renderLatestReport(els.chatLatestReport, getLatestSummary());
  renderLatestReport(els.overviewLatestReport, getLatestSummary());
  renderOverviewCards(els.chatOverviewCards, true);
  renderOverviewCards(els.overviewCards, false);
  renderOverviewNotes();
  updateGlobalSummary();

  if (options.hydrateLatest && !state.latestReport && state.recentReports[0]?.taskId) {
    await hydrateReport(state.recentReports[0].taskId).catch(() => {});
  }
}

async function loadRuntimeLogs() {
  const payload = await requestJson("/api/ui/runtime-log?lines=140");
  renderRuntimeLogs(payload);
}

function updateGlobalSummary() {
  const healthOk = state.health?.status === "ok";
  const wechat = state.channels?.wechat;
  const summary = getLatestSummary();
  const transport = getTransportStatus(wechat);
  const shouldShowTopbarDelivery = false;

  els.healthChip.textContent = state.health?.status?.toUpperCase?.() || "ERROR";
  els.healthDot.className = `statusDot ${healthOk ? "ok" : ""}`.trim();
  if (els.topbarDeliveryPill) {
    els.topbarDeliveryPill.hidden = !shouldShowTopbarDelivery;
  }
  if (els.wechatConnection) {
    els.wechatConnection.textContent = transport.value;
  }
  if (els.wechatMode) {
    els.wechatMode.textContent = wechat?.providerMode || "-";
  }
  els.memoryFileCount.textContent = String(state.memoryStatus?.files ?? 0);
  els.memoryMode.textContent = state.memoryStatus?.searchMode || "-";
  els.researchSessionCount.textContent = String(state.recentReports.length);
  els.latestReportAge.textContent = summary?.generatedAt ? formatRelativeTime(summary.generatedAt) : "-";
  els.workspacePath.textContent = state.memoryStatus?.workspaceDir || "-";
  els.wechatProviderOverview.textContent = wechat?.providerMode || "-";
  els.memoryModeOverview.textContent = state.memoryStatus?.searchMode || "-";
  els.chatTransportPill.textContent = transport.value;
  els.chatMemoryPill.textContent = state.memoryStatus?.searchMode || "-";
  els.sidebarStatusText.textContent = healthOk ? (state.lang === "zh" ? "\u6b63\u5e38" : "Healthy") : "Error";
  setSidebarStatus(Boolean(healthOk));
  els.sidebarNote.textContent = t("shell.sidebarNote", "");
  renderLandingSurfaces();
  renderOverviewCards(els.chatOverviewCards, true);
  renderOverviewCards(els.overviewCards, false);
  renderOverviewNotes();
  renderSettingsOverview();
}

function openSettingsPanel(panelId) {
  state.settingsPanel = panelId || "communications";
  window.location.hash = "settings";
  setActiveTab("settings");
  renderSettingsOverview();
}

function bindOpenTabButtons(root = document) {
  root.querySelectorAll("[data-open-tab], [data-open-settings-panel]").forEach((button) => {
    button.addEventListener("click", () => {
      const settingsPanel = button.dataset.openSettingsPanel;
      if (settingsPanel) {
        openSettingsPanel(settingsPanel);
        return;
      }

      const tab = button.dataset.openTab;
      if (!tab) return;
      window.location.hash = tab;
      setActiveTab(tab);
    });
  });
}

function bindReportButtons(root) {
  root.querySelectorAll("[data-task-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const taskId = button.dataset.taskId;
      if (!taskId) return;
      await hydrateReport(taskId);
      window.location.hash = "research";
      setActiveTab("research");
    });
  });
}

function setActiveTab(tab) {
  const meta = i18n?.getTabMeta?.(state, tab) || i18n?.getTabMeta?.(state, "landing");
  const next = meta ? tab : "landing";
  state.activeTab = next;
  els.navTabs.forEach((item) => item.classList.toggle("nav-item--active", item.dataset.tab === next));
  els.panels.forEach((panel) => panel.classList.toggle("workspace-panel--active", panel.dataset.panel === next));
  if (els.workspacePulse) {
    els.workspacePulse.hidden = next !== "landing";
  }
  els.currentTabLabel.textContent = i18n?.getTabMeta?.(state, next)?.label || next;
  els.pageTitle.textContent = i18n?.getTabMeta?.(state, next)?.title || next;
  els.pageSubtitle.textContent = i18n?.getTabMeta?.(state, next)?.subtitle || "";
  state.navDrawerOpen = false;
  updateShellClasses();

  if (next === "logs") loadRuntimeLogs().catch(showError);
  if (next === "graph") loadGraph().catch(showError);
  if (next === "sessions") loadAgentSessions().catch(showError);
  if (next === "settings") loadRuntimeMeta().catch(showError);
}

function syncTabFromHash() {
  const tab = window.location.hash.replace(/^#/, "").trim() || "landing";
  setActiveTab(tab);
}

function getPaletteItems() {
  const tabItems = Object.keys(copy().tabs || {}).map((tab) => ({
    id: `tab-${tab}`,
    group: "tabs",
    label: i18n.getTabMeta(state, tab).label,
    desc: `${t("actions.openTab", "Go to")} ${i18n.getTabMeta(state, tab).title}`,
    action: () => {
      window.location.hash = tab;
      setActiveTab(tab);
      closePalette();
    }
  }));

  const actionItems = QUICK_ACTIONS.map((item) => ({
    id: item.id,
    group: "actions",
    label: item.label,
    desc: t("actions.insertPrompt", "Insert"),
    action: () => {
      els.wechatMessage.value = item.prompt;
      adjustTextareaHeight();
      els.wechatMessage.focus();
      closePalette();
    }
  }));

  return [...tabItems, ...actionItems];
}

function renderPalette() {
  const query = state.paletteQuery.trim().toLowerCase();
  const items = getPaletteItems().filter((item) => !query || `${item.label} ${item.desc}`.toLowerCase().includes(query));
  if (!items.length) {
    els.paletteResults.innerHTML = `<div class="cmd-palette__empty">${escapeHtml(t("common.commandPaletteEmpty", "No results."))}</div>`;
    return [];
  }

  const groups = [
    ["tabs", t("common.commandGroupTabs", "Tabs")],
    ["actions", t("common.commandGroupActions", "Actions")]
  ];

  let index = -1;
  els.paletteResults.innerHTML = groups
    .map(([groupId, label]) => {
      const groupItems = items.filter((item) => item.group === groupId);
      if (!groupItems.length) return "";
      return `
        <div class="cmd-palette__group-label">${escapeHtml(label)}</div>
        ${groupItems
          .map((item) => {
            index += 1;
            return `
              <button class="cmd-palette__item ${index === state.paletteActiveIndex ? "is-active" : ""}" type="button" data-item-index="${index}">
                <span class="nav-item__icon">${groupId === "tabs" ? ">" : "/"}</span>
                <span class="cmd-palette__item-copy">
                  <strong>${escapeHtml(item.label)}</strong>
                </span>
                <span class="cmd-palette__item-desc">${escapeHtml(item.desc)}</span>
              </button>
            `;
          })
          .join("")}
      `;
    })
    .join("");

  els.paletteResults.querySelectorAll("[data-item-index]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = items[Number(button.dataset.itemIndex)];
      item?.action();
    });
  });

  return items;
}

function openPalette() {
  state.paletteOpen = true;
  state.paletteQuery = "";
  state.paletteActiveIndex = 0;
  els.paletteOverlay.hidden = false;
  renderPalette();
  els.paletteInput.value = "";
  els.paletteInput.focus();
}

function closePalette() {
  state.paletteOpen = false;
  state.paletteQuery = "";
  els.paletteOverlay.hidden = true;
}

async function refreshAll(options = {}) {
  await Promise.all([
    loadHealth(),
    loadChannels(),
    loadRuntimeMeta(),
    loadAgentSession(),
    loadAgentSessions(),
    loadMessages(),
    loadLifecycleAudit(),
    loadMemoryStatus(),
    loadMemoryFiles(),
    loadRecentResearch(options),
    loadResearchBriefs(),
    loadDiscoveryScheduler(),
    loadDiscoveryRuns(),
    loadResearchTasks(),
    loadDirectionReports(),
    loadPresentations(),
    loadModuleAssets(),
    loadFeedback()
  ]);
  if (state.activeTab === "logs") await loadRuntimeLogs();
  if (state.activeTab === "graph") await loadGraph();
}

function showError(error) {
  const message = error instanceof Error ? error.message : String(error);
  els.healthChip.textContent = "ERROR";
  els.healthDot.className = "statusDot";
  els.pageSubtitle.textContent = message;
  els.sidebarNote.textContent = message;
}

function bindAgentSkillInputs() {
  document.querySelectorAll('[data-agent-skill-toggle]').forEach((input) => {
    input.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    input.addEventListener("change", async () => {
      const selected = [
        ...new Set(
          [...document.querySelectorAll('[data-agent-skill-toggle]:checked')].map((item) => item.value)
        )
      ];
      if (selected.length === 0) {
        input.checked = true;
        return;
      }

      try {
        const session = await requestJson("/api/channels/wechat/agent/skills", {
          method: "POST",
          body: JSON.stringify({
            senderId: UI_AGENT_SENDER_ID,
            skillIds: selected
          })
        });
        state.skillMessage = `Updated enabled skills: ${session.skillLabels.join(", ")}`;
        renderAgentSession(session);
      } catch (error) {
        showError(error);
        await loadAgentSession().catch(() => {});
      }
    });
  });
}

document.querySelector("#refresh-overview").addEventListener("click", () => refreshAll().catch(showError));
document.querySelector("#refresh-wechat").addEventListener("click", () => refreshAll().catch(showError));
document.querySelector("#refresh-sessions").addEventListener("click", () => loadAgentSessions().catch(showError));
document.querySelector("#refresh-logs").addEventListener("click", () => loadRuntimeLogs().catch(showError));
document.querySelector("#refresh-graph")?.addEventListener("click", () => loadGraph().catch(showError));

els.graphSearch?.addEventListener("input", () => {
  state.graphSearch = els.graphSearch.value;
  window.clearTimeout(graphSearchTimerId);
  graphSearchTimerId = window.setTimeout(() => {
    loadGraph().catch(showError);
  }, 180);
});

els.graphDateRange?.addEventListener("change", () => {
  state.graphDateRange = els.graphDateRange.value || "all";
  loadGraph().catch(showError);
});

els.graphClearFilters?.addEventListener("click", () => {
  state.graphSearch = "";
  state.graphDateRange = "all";
  state.graphTypeFilters = [];
  if (els.graphSearch) {
    els.graphSearch.value = "";
  }
  if (els.graphDateRange) {
    els.graphDateRange.value = "all";
  }
  loadGraph().catch(showError);
});

document.querySelector("#wechat-start").addEventListener("click", async () => {
  const currentWechatStatus = state.channels?.channels?.wechat;
  await requestJson("/api/channels/wechat/login/start", {
    method: "POST",
    body: JSON.stringify({
      force: Boolean(currentWechatStatus?.qrDataUrl || currentWechatStatus?.pairingCode),
      displayName: els.wechatDisplayName.value.trim() || undefined
    })
  });
  await refreshAll();
});

document.querySelector("#wechat-complete").addEventListener("click", async () => {
  await requestJson("/api/channels/wechat/login/complete", {
    method: "POST",
    body: JSON.stringify({ displayName: els.wechatDisplayName.value.trim() || undefined })
  });
  await refreshAll();
});

document.querySelector("#wechat-logout").addEventListener("click", async () => {
  await requestJson("/api/channels/wechat/logout", { method: "POST", body: JSON.stringify({}) });
  await refreshAll();
});

document.querySelector("#wechat-message-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = els.wechatMessage.value.trim();
  if (!text) return;

  const payload = await requestJson("/api/channels/wechat/chat", {
    method: "POST",
    body: JSON.stringify({
      senderId: UI_AGENT_SENDER_ID,
      text
    })
  });

  if (payload.researchTaskId) {
    await hydrateReport(payload.researchTaskId);
    await loadRecentResearch();
  }

  els.wechatMessage.value = "";
  adjustTextareaHeight();
  await refreshAll();
});

document.querySelector("#chat-research-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const topic = els.chatResearchTopic?.value.trim() || "";
  const question = els.chatResearchQuestion?.value.trim() || "";
  if (!topic) return;

  await startResearchTask(topic, question, { openResearch: false });

  if (els.chatResearchTopic) els.chatResearchTopic.value = "";
  if (els.chatResearchQuestion) els.chatResearchQuestion.value = "";
});

document.querySelector("#chat-load-report")?.addEventListener("click", async () => {
  await openResearchTaskOrReport(els.chatReportTaskId?.value.trim() || "", { openResearch: false });
});

document.querySelector("#memory-search-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = els.memoryQuery.value.trim();
  if (!query) return renderMemoryResults([]);
  const payload = await requestJson(`/api/memory/search?q=${encodeURIComponent(query)}`);
  renderMemoryResults(payload.results || []);
});

document.querySelector("#memory-remember-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  await requestJson("/api/memory/remember", {
    method: "POST",
    body: JSON.stringify({
      scope: els.memoryScope.value,
      title: els.memoryTitle.value.trim() || undefined,
      content: els.memoryContent.value.trim(),
      source: "ui"
    })
  });
  els.memoryContent.value = "";
  els.memoryTitle.value = "";
  await Promise.all([loadMemoryStatus(), loadMemoryFiles()]);
});

document.querySelector("#research-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  await startResearchTask(els.researchTopic.value.trim(), els.researchQuestion.value.trim(), {
    openResearch: true
  });
});

els.discoverySchedulerForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const senderId = els.discoverySchedulerSenderId?.value.trim() || "";
  const enabled = Boolean(els.discoverySchedulerEnabled?.checked);
  if (enabled && !senderId) {
    throw new Error(state.lang === "zh" ? "启用 scheduler 前需要填写 WeChat sender id。" : "A WeChat sender id is required before enabling the scheduler.");
  }

  await requestJson("/api/research/discovery/scheduler", {
    method: "POST",
    body: JSON.stringify({
      enabled,
      dailyTimeLocal: els.discoverySchedulerTime?.value || "09:00",
      ...(senderId ? { senderId } : {}),
      ...(els.discoverySchedulerSenderName?.value.trim() ? { senderName: els.discoverySchedulerSenderName.value.trim() } : {}),
      directionIds: parseListInput(els.discoverySchedulerDirectionIds?.value || ""),
      topK: Number.parseInt(els.discoverySchedulerTopK?.value || "5", 10) || 5,
      maxPapersPerQuery: Number.parseInt(els.discoverySchedulerMaxPapers?.value || "4", 10) || 4
    })
  });

  await loadDiscoveryScheduler();
});

els.discoverySchedulerRun?.addEventListener("click", async () => {
  const payload = await requestJson("/api/research/discovery/scheduler/tick", {
    method: "POST",
    body: JSON.stringify({})
  });
  renderDiscoveryScheduler(payload.status || null);
  await Promise.all([
    loadDiscoveryRuns().catch(() => {}),
    loadResearchTasks().catch(() => {}),
    loadDirectionReports().catch(() => {}),
    loadRecentResearch().catch(() => {}),
  ]);
});

document.querySelector("#load-report").addEventListener("click", async () => {
  await openResearchTaskOrReport(els.reportTaskId.value.trim(), { openResearch: true });
});

els.directionReportForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    topic: els.directionReportTopic?.value.trim() || undefined,
    directionId: els.directionReportId?.value.trim() || undefined,
    days: Number.parseInt(els.directionReportDays?.value || "14", 10) || 14
  };

  const report = await requestJson("/api/research/direction-reports/generate", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  clearResearchSelections();
  state.selectedDirectionReport = report;
  state.selectedDirectionReportId = report.id;
  state.selectedResearchTaskId = null;
  renderDirectionReport(report);
  await loadDirectionReports();
  window.location.hash = "research";
  setActiveTab("research");
});

els.researchBriefForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearResearchBriefStatus();

  const payload = buildResearchBriefPayload();
  if (!payload.label) {
    setResearchBriefStatus(state.lang === "zh" ? "Brief label 不能为空。" : "Brief label is required.", "danger");
    return;
  }

  const brief = await requestJson("/api/research/directions", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  setSelectedResearchBrief(brief);
  populateResearchBriefForm(brief);
  renderResearchBrief(brief);
  await loadResearchBriefs();
  setResearchBriefStatus(state.lang === "zh" ? "Research brief 已保存。" : "Research brief saved.", "ok");
  window.location.hash = "research";
  setActiveTab("research");
});

els.researchBriefMarkdownForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearResearchBriefStatus();

  const markdown = els.researchBriefMarkdown?.value.trim() || "";
  if (!markdown) {
    setResearchBriefStatus(state.lang === "zh" ? "请先粘贴 brief markdown。" : "Paste research brief markdown first.", "danger");
    return;
  }

  const brief = await requestJson("/api/research/directions/import-markdown", {
    method: "POST",
    body: JSON.stringify({
      markdown,
      id: els.researchBriefId?.value.trim() || undefined
    })
  });

  setSelectedResearchBrief(brief);
  populateResearchBriefForm(brief);
  renderResearchBrief(brief);
  await loadResearchBriefs();
  setResearchBriefStatus(state.lang === "zh" ? "Brief markdown 已导入。" : "Research brief markdown imported.", "ok");
  window.location.hash = "research";
  setActiveTab("research");
});

els.researchBriefNew?.addEventListener("click", () => {
  clearResearchSelections();
  clearResearchBriefForm();
  clearResearchBriefStatus();
  if (els.researchBriefMarkdown) els.researchBriefMarkdown.value = "";
  renderResearchReport(state.latestReport);
  renderResearchBriefList(state.researchBriefs);
});

els.researchBriefExport?.addEventListener("click", async () => {
  clearResearchBriefStatus();
  const briefId = state.selectedResearchBriefId || els.researchBriefId?.value.trim();
  if (!briefId) {
    setResearchBriefStatus(state.lang === "zh" ? "请先选择一个 brief 再导出。" : "Select a brief before exporting.", "danger");
    return;
  }

  const markdown = await requestText(`/api/research/directions/${encodeURIComponent(briefId)}/brief-markdown`);
  if (els.researchBriefMarkdown) els.researchBriefMarkdown.value = markdown;
  setResearchBriefStatus(state.lang === "zh" ? "已将 markdown 导出到编辑框。" : "Markdown exported into the editor.", "ok");
});

els.researchBriefDelete?.addEventListener("click", async () => {
  clearResearchBriefStatus();
  const briefId = state.selectedResearchBriefId || els.researchBriefId?.value.trim();
  if (!briefId) {
    setResearchBriefStatus(state.lang === "zh" ? "请先选择一个 brief 再删除。" : "Select a brief before deleting.", "danger");
    return;
  }

  await requestJson(`/api/research/directions/${encodeURIComponent(briefId)}`, {
    method: "DELETE",
    body: JSON.stringify({})
  }).catch(async (error) => {
    throw error;
  });

  clearResearchSelections();
  clearResearchBriefForm();
  if (els.researchBriefMarkdown) els.researchBriefMarkdown.value = "";
  await loadResearchBriefs();
  renderResearchReport(state.latestReport);
  setResearchBriefStatus(state.lang === "zh" ? "Research brief 已删除。" : "Research brief deleted.", "ok");
});

els.feedbackForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  await requestJson("/api/research/feedback", {
    method: "POST",
    body: JSON.stringify({
      feedback: els.feedbackSignal?.value,
      topic: els.feedbackTopic?.value.trim() || undefined,
      paperTitle: els.feedbackPaperTitle?.value.trim() || undefined,
      notes: els.feedbackNotes?.value.trim() || undefined
    })
  });

  if (els.feedbackTopic) els.feedbackTopic.value = "";
  if (els.feedbackPaperTitle) els.feedbackPaperTitle.value = "";
  if (els.feedbackNotes) els.feedbackNotes.value = "";
  await loadFeedback();
});

els.agentRoleSelect?.addEventListener("change", async () => {
  const roleId = els.agentRoleSelect.value.trim();
  if (!roleId) return;

  try {
    const session = await requestJson("/api/channels/wechat/agent/role", {
      method: "POST",
      body: JSON.stringify({
        senderId: UI_AGENT_SENDER_ID,
        roleId
      })
    });
    state.skillMessage = `Active role set to ${session.roleLabel} (${session.roleId}).`;
    renderAgentSession(session);
  } catch (error) {
    showError(error);
    await loadAgentSession().catch(() => {});
  }
});

els.agentModelSelect?.addEventListener("change", async () => {
  const value = els.agentModelSelect.value.trim();

  try {
    const session = !value
      ? await requestJson("/api/channels/wechat/agent/model", {
          method: "POST",
          body: JSON.stringify({
            senderId: UI_AGENT_SENDER_ID
          })
        })
      : await requestJson("/api/channels/wechat/agent/model", {
          method: "POST",
          body: JSON.stringify({
            senderId: UI_AGENT_SENDER_ID,
            providerId: value.split("::")[0],
            modelId: value.split("::")[1]
          })
        });
    state.skillMessage = `Active model route: ${session.providerLabel || session.providerId}/${session.modelLabel || session.modelId}${session.wireApi ? ` via ${session.wireApi}` : ""}.`;
    renderAgentSession(session);
  } catch (error) {
    showError(error);
    await loadAgentSession().catch(() => {});
  }
});

els.agentModelReset?.addEventListener("click", async () => {
  try {
    const session = await requestJson("/api/channels/wechat/agent/model", {
      method: "POST",
      body: JSON.stringify({
        senderId: UI_AGENT_SENDER_ID
      })
    });
    state.skillMessage = `Model route reset to default: ${session.providerLabel || session.providerId}/${session.modelLabel || session.modelId}${session.wireApi ? ` via ${session.wireApi}` : ""}.`;
    renderAgentSession(session);
  } catch (error) {
    showError(error);
    await loadAgentSession().catch(() => {});
  }
});

els.agentFallbacksSelect?.addEventListener("change", () => {
  if (els.agentFallbacksAdd) {
    els.agentFallbacksAdd.disabled = !(els.agentFallbacksSelect?.value || "").trim();
  }
});

els.agentFallbacksAdd?.addEventListener("click", async () => {
  try {
    const selected = (els.agentFallbacksSelect?.value || "").trim();
    if (!selected) return;
    const [providerId, modelId] = selected.split("::");
    if (!providerId || !modelId) return;
    const currentRoutes = (state.agentSession?.fallbackRoutes || []).map((route) => ({
      providerId: route.providerId,
      modelId: route.modelId
    }));
    const routes = [
      ...new Map(
        [...currentRoutes, { providerId, modelId }].map((route) => [`${route.providerId}::${route.modelId}`, route])
      ).values()
    ];
    const session = await requestJson("/api/channels/wechat/agent/fallbacks", {
      method: "POST",
      body: JSON.stringify({
        senderId: UI_AGENT_SENDER_ID,
        routes
      })
    });
    state.skillMessage = routes.length
      ? `Fallback routes updated: ${routes.map((route) => `${route.providerId}/${route.modelId}`).join(", ")}.`
      : "Fallback routes cleared.";
    renderAgentSession(session);
  } catch (error) {
    showError(error);
    await loadAgentSession().catch(() => {});
  }
});

els.agentFallbacksClear?.addEventListener("click", async () => {
  try {
    const session = await requestJson("/api/channels/wechat/agent/fallbacks", {
      method: "POST",
      body: JSON.stringify({
        senderId: UI_AGENT_SENDER_ID,
        routes: []
      })
    });
    state.skillMessage = "Fallback routes cleared.";
    renderAgentSession(session);
  } catch (error) {
    showError(error);
    await loadAgentSession().catch(() => {});
  }
});

els.agentReasoningSelect?.addEventListener("change", async () => {
  try {
    const session = await requestJson("/api/channels/wechat/agent/reasoning", {
      method: "POST",
      body: JSON.stringify({
        senderId: UI_AGENT_SENDER_ID,
        reasoningEffort: els.agentReasoningSelect.value || "default"
      })
    });
    state.skillMessage = `Reasoning effort set to ${session.reasoningEffort || "default"}.`;
    renderAgentSession(session);
  } catch (error) {
    showError(error);
    await loadAgentSession().catch(() => {});
  }
});

els.skillsFilterInput?.addEventListener("input", () => {
  state.skillsFilter = els.skillsFilterInput.value;
  renderSkillsCatalog(state.agentSession);
});

els.skillsStatusFilter?.addEventListener("change", () => {
  state.skillsStatusFilter = els.skillsStatusFilter.value;
  renderSkillsCatalog(state.agentSession);
});

els.skillDetailModal?.addEventListener("click", (event) => {
  if (event.target === els.skillDetailModal) {
    els.skillDetailModal.hidden = true;
  }
});

i18n?.init(state);
state.navCollapsed = loadRememberedNavCollapsed();
i18n?.apply(state);
updateShellClasses();
bindOpenTabButtons();
els.navCollapseToggle.title = state.navCollapsed ? t("common.expandNav", "Expand navigation") : t("common.collapseNav", "Collapse navigation");

els.navTabs.forEach((item) => {
  item.addEventListener("click", () => {
    if (!item.dataset.tab) return;
    window.location.hash = item.dataset.tab;
    setActiveTab(item.dataset.tab);
  });
});

els.quickCommands.forEach((button) => {
  button.addEventListener("click", () => {
    els.wechatMessage.value = button.dataset.prompt || "";
    adjustTextareaHeight();
    els.wechatMessage.focus();
  });
});

els.navToggle.addEventListener("click", () => {
  state.navDrawerOpen = !state.navDrawerOpen;
  updateShellClasses();
});

els.navCollapseToggle.addEventListener("click", () => {
  state.navCollapsed = !state.navCollapsed;
  rememberNavCollapsed(state.navCollapsed);
  els.navCollapseToggle.title = state.navCollapsed ? t("common.expandNav", "Expand navigation") : t("common.collapseNav", "Collapse navigation");
  updateShellClasses();
});

els.navBackdrop.addEventListener("click", () => {
  state.navDrawerOpen = false;
  updateShellClasses();
});

els.focusChatInput.addEventListener("click", openPalette);
els.paletteOverlay.addEventListener("click", (event) => {
  if (event.target === els.paletteOverlay) closePalette();
});

els.paletteInput.addEventListener("input", () => {
  state.paletteQuery = els.paletteInput.value;
  state.paletteActiveIndex = 0;
  renderPalette();
});

window.addEventListener("hashchange", syncTabFromHash);
window.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    if (state.paletteOpen) closePalette();
    else openPalette();
    return;
  }

  if (event.key === "/" && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
    event.preventDefault();
    els.wechatMessage.focus();
    return;
  }

  if (!state.paletteOpen) return;

  const items = renderPalette();
  if (event.key === "Escape") {
    closePalette();
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    state.paletteActiveIndex = Math.min(state.paletteActiveIndex + 1, Math.max(items.length - 1, 0));
    renderPalette();
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    state.paletteActiveIndex = Math.max(state.paletteActiveIndex - 1, 0);
    renderPalette();
  } else if (event.key === "Enter") {
    event.preventDefault();
    items[state.paletteActiveIndex]?.action();
  }
});

els.wechatMessage.addEventListener("input", adjustTextareaHeight);

window.addEventListener("reagent-language-change", () => {
  i18n?.apply(state);
  setActiveTab(state.activeTab);
  els.navCollapseToggle.title = state.navCollapsed ? t("common.expandNav", "Expand navigation") : t("common.collapseNav", "Collapse navigation");
  renderMessages(state.latestMessages);
  renderTransportMessages(state.transportMessages);
  renderLifecycleAudit(state.wechatLifecycleAudit);
  renderLatestReport(els.chatLatestReport, getLatestSummary());
  renderLatestReport(els.overviewLatestReport, getLatestSummary());
  renderAgentSession(state.agentSession);
  renderAgentSessionsList(state.agentSessions);
  if (els.skillsFilterInput) {
    els.skillsFilterInput.value = state.skillsFilter;
  }
  if (els.skillsStatusFilter) {
    els.skillsStatusFilter.value = state.skillsStatusFilter;
  }
  if (els.graphSearch) {
    els.graphSearch.value = state.graphSearch;
  }
  if (els.graphDateRange) {
    els.graphDateRange.value = state.graphDateRange;
  }
  renderLandingSurfaces();
  renderSessionCards(els.chatSessionList, state.recentReports.slice(0, 4), true);
  renderSessionCards(els.overviewSessionList, state.recentReports.slice(0, 5), true);
  renderSessionCards(els.researchSessionList, state.recentReports.slice(0, 5), true);
  renderOverviewCards(els.chatOverviewCards, true);
  renderOverviewCards(els.overviewCards, false);
  renderOverviewNotes();
  if (state.selectedResearchBrief) renderResearchBrief(state.selectedResearchBrief);
  else if (state.selectedDirectionReport) renderDirectionReport(state.selectedDirectionReport);
  else if (state.selectedPresentation) renderPresentationArtifact(state.selectedPresentation);
  else if (state.selectedModuleAsset) renderModuleAsset(state.selectedModuleAsset);
  else if (state.selectedResearchTask) renderResearchTaskDetail(state.selectedResearchTask);
  else renderResearchReport(state.latestReport);
  renderResearchBriefList(state.researchBriefs);
  renderDiscoveryScheduler(state.discoveryScheduler);
  renderDiscoveryRuns();
  renderDirectionReportList(state.directionReports);
  renderPresentationList(state.presentations);
  renderModuleAssetList(state.moduleAssets);
  renderFeedbackSummary(state.feedbackSummary);
  renderFeedbackList(state.feedbackItems);
  renderSettingsOverview();
  updateGlobalSummary();
  renderGraphTypeFilters(state.graphData);
  renderGraphStats(state.graphData);
  renderGraphSummary(state.graphData);
  renderGraphCanvas(state.graphData);
  renderGraphEdges(state.graphData);
  renderGraphDetail(state.graphDetail);
  renderPalette();
});

if (els.graphSearch) {
  els.graphSearch.value = state.graphSearch;
}
if (els.graphDateRange) {
  els.graphDateRange.value = state.graphDateRange;
}
adjustTextareaHeight();
closePalette();
syncTabFromHash();
refreshAll({ hydrateLatest: true }).catch(showError);
setInterval(() => refreshAll().catch(showError), 10000);
