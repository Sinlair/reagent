const i18n = window.ReAgentI18n;

const NAV_STORAGE_KEY = "reagent-ui-nav-collapsed";
const UI_AGENT_SENDER_ID = "ui-wechat-user";

const state = {
  activeTab: "chat",
  latestReport: null,
  selectedDirectionReport: null,
  selectedDirectionReportId: null,
  latestMessages: [],
  transportMessages: [],
  recentReports: [],
  directionReports: [],
  feedbackItems: [],
  feedbackSummary: null,
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
  currentTabLabel: document.querySelector("#current-tab-label"),
  pageTitle: document.querySelector("#page-title"),
  pageSubtitle: document.querySelector("#page-subtitle"),
  productAlerts: document.querySelector("#product-alerts"),
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
  wechatMessages: document.querySelector("#wechat-messages"),
  wechatChannelMessages: document.querySelector("#wechat-channel-messages"),
  wechatDisplayName: document.querySelector("#wechat-display-name"),
  wechatStart: document.querySelector("#wechat-start"),
  wechatComplete: document.querySelector("#wechat-complete"),
  wechatLogout: document.querySelector("#wechat-logout"),
  wechatMessage: document.querySelector("#wechat-message"),
  researchSessionList: document.querySelector("#research-session-list"),
  researchTaskList: document.querySelector("#research-task-list"),
  reportTaskId: document.querySelector("#report-task-id"),
  researchTopic: document.querySelector("#research-topic"),
  researchQuestion: document.querySelector("#research-question"),
  researchReport: document.querySelector("#research-report"),
  directionReportForm: document.querySelector("#direction-report-form"),
  directionReportTopic: document.querySelector("#direction-report-topic"),
  directionReportId: document.querySelector("#direction-report-id"),
  directionReportDays: document.querySelector("#direction-report-days"),
  directionReportList: document.querySelector("#direction-report-list"),
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

  return response.json();
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
    return { value: state.lang === "zh" ? "\u7b49\u5f85\u5904\u7406" : "Waiting", hint: status.lifecycleReason || status.providerMode, tone: "warn" };
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
      label: state.lang === "zh" ? "\u8fd0\u884c\u5065\u5eb7" : "Runtime Health",
      value: state.health?.status?.toUpperCase?.() || "-",
      hint: state.health?.agent || (state.lang === "zh" ? "\u7b49\u5f85\u5065\u5eb7\u68c0\u67e5" : "Waiting for health"),
      tone: state.health?.status === "ok" ? "ok" : ""
    },
    {
      tab: "channels",
      label: state.lang === "zh" ? "\u5fae\u4fe1\u4f20\u8f93" : "WeChat Transport",
      value: transport.value,
      hint: transport.hint || "-",
      tone: transport.tone
    },
    {
      tab: "agents",
      label: state.lang === "zh" ? "Agent Runtime" : "Agent Runtime",
      value: state.agentSession?.roleLabel || state.agentSession?.roleId || "-",
      hint:
        state.agentSession?.skillLabels?.length
          ? `${state.agentSession.skillLabels.length} skills`
          : (state.lang === "zh" ? "\u672a\u52a0\u8f7d" : "Not loaded"),
      tone: ""
    },
    {
      tab: "research",
      label: state.lang === "zh" ? "\u7814\u7a76\u4efb\u52a1" : "Research Runs",
      value: String(state.recentReports.length),
      hint: getLatestSummary()?.generatedAt ? formatRelativeTime(getLatestSummary().generatedAt) : t("empty.report", "No report yet."),
      tone: ""
    }
  ];

  target.className = compact ? "ov-cards ov-cards--compact" : "ov-cards";
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

function renderOverviewNotes() {
  const summary = getLatestSummary();
  const notes = [
    [t("chat.workspaceLabel", "Workspace"), state.memoryStatus?.workspaceDir || "-"],
    [t("chat.wechatProviderLabel", "WeChat provider"), state.channels?.wechat?.providerMode || "-"],
    [state.lang === "zh" ? "Agent role" : "Agent role", state.agentSession?.roleLabel || state.agentSession?.roleId || "-"],
    [state.lang === "zh" ? "\u6700\u65b0\u7814\u7a76" : "Latest research", summary ? `${summary.topic} - ${formatRelativeTime(summary.generatedAt)}` : t("empty.report", "No report yet.")]
  ];

  els.overviewNotes.innerHTML = notes
    .map(([label, value]) => `<div class="detail-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join("");
}

function renderSettingsTabs() {
  const tabs = [
    ["communications", "Communications"],
    ["infrastructure", "Infrastructure"],
    ["aiAgents", "AI & Agents"]
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
    ["overview", "Overview"],
    ["skills", "Skills"],
    ["tools", "Tools"],
    ["channels", "Channels"],
    ["cron", "Cron"]
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
    return `<div class="empty-state">${escapeHtml("No skills match the current filter.")}</div>`;
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
              <span>${escapeHtml(enabled ? "Available to the runtime" : "Excluded from tool access")}</span>
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
    els.skillDetail.innerHTML = `<div class="empty-state compact-empty">${escapeHtml("Select a skill to inspect its details.")}</div>`;
    return;
  }

  const skill = (session.availableSkills || []).find((item) => item.id === state.selectedSkillId);
  if (!skill) {
    els.skillDetail.innerHTML = `<div class="empty-state compact-empty">${escapeHtml("Select a skill to inspect its details.")}</div>`;
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

  return toolGroups
    .filter((group) => session.skillIds.includes(group.label))
    .map(
      (group) => `
        <article class="result-item">
          <h3>${escapeHtml(group.label)}</h3>
          <p>${escapeHtml(group.tools.join(", "))}</p>
          <small>${escapeHtml("Source: session-enabled skill group")}</small>
        </article>
      `
    )
    .join("");
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
            <span>${escapeHtml(String(session.turnCount))} turns</span>
            <span>${escapeHtml(`${session.providerLabel || session.providerId}/${session.modelLabel || session.modelId}`)}</span>
            <span>${escapeHtml(session.skillLabels.join(", ") || "-")}</span>
            ${isCurrent ? `<span>Current chat</span>` : ""}
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

  const sections = {
    communications: [
      {
        title: state.lang === "zh" ? "\u5fae\u4fe1\u4f20\u8f93" : "WeChat Transport",
        rows: [
          [state.lang === "zh" ? "\u63d0\u4f9b\u65b9" : "Provider", wechat?.providerMode || meta?.wechatProvider || "-"],
          [state.lang === "zh" ? "\u8fde\u63a5" : "Connected", String(Boolean(wechat?.connected))],
          [state.lang === "zh" ? "\u6700\u540e\u72b6\u6001" : "Last status", wechat?.lastMessage || wechat?.lastError || "-"]
        ]
      },
      {
        title: state.lang === "zh" ? "\u5de5\u4f5c\u533a\u8bb0\u5fc6" : "Workspace Memory",
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
                  `<div class="detail-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`,
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
        ? "\u5f53\u524d\u804a\u5929\u4f1a\u8bdd\u4f1a\u7acb\u5373\u4f7f\u7528\u8fd9\u91cc\u7684 role \u548c skills \u8bbe\u5b9a\u3002"
        : "The current chat session applies these role and skill settings immediately.",
      state.lang === "zh"
        ? "\u5173\u95ed閺屾劒閲?skill \u540e\uff0cruntime \u4e0d\u4f1a\u518d\u5411\u6a21\u578b\u66b4\u9732\u5bf9\u5e94\u5de5\u5177\u3002"
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

function renderOverviewActivity(messages) {
  if (!els.overviewActivity) return;
  const recent = [...messages].slice(-6).reverse();
  if (!recent.length) {
    els.overviewActivity.className = "empty-state";
    els.overviewActivity.textContent = t("empty.activity", "No activity yet.");
    return;
  }

  els.overviewActivity.className = "result-stack";
  els.overviewActivity.innerHTML = recent
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

function renderProductAlerts() {
  if (!els.productAlerts) return;

  const alerts = [];
  const wechat = state.channels?.wechat;
  const researchRoute = state.runtimeMeta?.llm?.routes?.research;

  if (wechat?.requiresHumanAction) {
    alerts.push({
      tone: "warn",
      title: state.lang === "zh" ? "微信需要人工处理" : "WeChat Needs Attention",
      body:
        wechat.lastError ||
        wechat.lastMessage ||
        (state.lang === "zh"
          ? "当前微信通道需要人工确认，例如扫码或重新认证。"
          : "The current WeChat channel needs manual confirmation, such as QR scan or re-auth.")
    });
  }

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

function formatResearchTaskState(task) {
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
        <article class="result-item">
          <h3>${escapeHtml(result.title)}</h3>
          <p>${escapeHtml(result.snippet)}</p>
          <small>${escapeHtml(result.path)} - ${escapeHtml(String(result.startLine))}-${escapeHtml(String(result.endLine))} - ${escapeHtml(String(result.score))}</small>
        </article>
      `
    )
    .join("");
}

function bindMemoryFileButtons() {
  els.memoryFiles.querySelectorAll("[data-path]").forEach((button) => {
    button.addEventListener("click", async () => {
      const path = button.dataset.path;
      if (!path) return;
      const payload = await requestJson(`/api/memory/file?path=${encodeURIComponent(path)}`);
      state.selectedMemoryFilePath = path;
      els.memoryFileViewer.textContent = payload.content;
      renderMemoryFiles(state.memoryFiles);
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

function renderResearchReport(report) {
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

function renderRuntimeLogs(payload) {
  els.runtimeLogStdoutPath.textContent = payload.stdout.path || t("logs.waitingStdout", "Waiting for stdout log...");
  els.runtimeLogStderrPath.textContent = payload.stderr.path || t("logs.waitingStderr", "Waiting for stderr log...");
  els.runtimeLogOutput.textContent = payload.stdout.content || t("empty.stdout", "No stdout logs yet.");
  els.runtimeLogError.textContent = payload.stderr.content || t("empty.stderr", "No stderr logs yet.");
}

async function hydrateResearchTask(taskId) {
  const task = await requestJson(`/api/research/tasks/${encodeURIComponent(taskId)}`);
  state.selectedResearchTaskId = task.taskId;
  state.selectedResearchTask = task;
  els.reportTaskId.value = task.taskId;

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
  state.selectedResearchTask = null;
  state.selectedResearchTaskId = report.taskId;
  els.reportTaskId.value = report.taskId;
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

  els.healthChip.textContent = state.health?.status?.toUpperCase?.() || "ERROR";
  els.healthDot.className = `statusDot ${healthOk ? "ok" : ""}`.trim();
  els.wechatConnection.textContent = transport.value;
  els.wechatMode.textContent = wechat?.providerMode || "-";
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
  els.sidebarNote.textContent = wechat?.lastError || t("shell.sidebarNote", "");
  renderOverviewNotes();
  renderSettingsOverview();
}

function bindOpenTabButtons(root = document) {
  root.querySelectorAll("[data-open-tab]").forEach((button) => {
    button.addEventListener("click", () => {
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
  const meta = i18n?.getTabMeta?.(state, tab) || i18n?.getTabMeta?.(state, "chat");
  const next = meta ? tab : "chat";
  state.activeTab = next;
  els.navTabs.forEach((item) => item.classList.toggle("nav-item--active", item.dataset.tab === next));
  els.panels.forEach((panel) => panel.classList.toggle("workspace-panel--active", panel.dataset.panel === next));
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
  const tab = window.location.hash.replace(/^#/, "").trim() || "chat";
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
    loadMemoryStatus(),
    loadMemoryFiles(),
    loadRecentResearch(options),
    loadResearchTasks()
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
  const task = await requestJson("/api/research/tasks", {
    method: "POST",
    body: JSON.stringify({
      topic: els.researchTopic.value.trim(),
      question: els.researchQuestion.value.trim() || undefined,
      maxPapers: 10
    })
  });
  state.selectedResearchTaskId = task.taskId;
  state.selectedResearchTask = null;
  els.reportTaskId.value = task.taskId;
  await loadResearchTasks();
  await hydrateResearchTask(task.taskId);
  window.location.hash = "research";
  setActiveTab("research");
});

document.querySelector("#load-report").addEventListener("click", async () => {
  const taskId = els.reportTaskId.value.trim();
  if (!taskId) throw new Error(state.lang === "zh" ? "\u8bf7\u8f93\u5165 taskId\u3002" : "Please enter a taskId.");
  try {
    await hydrateResearchTask(taskId);
  } catch {
    await hydrateReport(taskId);
  }
  window.location.hash = "research";
  setActiveTab("research");
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
  renderSessionCards(els.chatSessionList, state.recentReports.slice(0, 4), true);
  renderSessionCards(els.overviewSessionList, state.recentReports.slice(0, 5), true);
  renderSessionCards(els.researchSessionList, state.recentReports.slice(0, 5), true);
  renderOverviewCards(els.chatOverviewCards, true);
  renderOverviewCards(els.overviewCards, false);
  renderOverviewNotes();
  renderResearchReport(state.latestReport);
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
