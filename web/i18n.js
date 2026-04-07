const LANGUAGE_STORAGE_KEY = "reagent-ui-lang";

const UI = {
  en: {
    shell: {
      brandEyebrow: "Research OS",
      navChat: "Workspace",
      navControl: "Research Ops",
      navAgent: "Agent",
      navSettings: "Settings",
      sidebarNote: "Discovery, evidence, memory, and delivery live in one research workspace."
    },
    common: {
      status: "Status",
      wechat: "WeChat",
      memory: "Memory",
      sessions: "Sessions",
      send: "Send",
      load: "Load",
      retry: "Retry",
      search: "Search",
      refresh: "Refresh",
      closeNav: "Close navigation",
      toggleNav: "Toggle navigation",
      collapseNav: "Collapse navigation",
      expandNav: "Expand navigation",
      commandPalette: "Search or jump",
      commandPaletteTitle: "Search tabs and commands",
      commandPalettePlaceholder: "Search tabs and commands...",
      commandPaletteFooter: "Press Enter to jump, Esc to close",
      commandPaletteEmpty: "No results.",
      commandGroupTabs: "Tabs",
      commandGroupActions: "Actions",
      commandGoTo: "Go to",
      commandInsert: "Insert"
    },
    tabs: {
      landing: "Home",
      chat: "Chat",
      overview: "Overview",
      graph: "Graph",
      channels: "Channels",
      sessions: "Sessions",
      agents: "Agents",
      skills: "Skills",
      research: "Research",
      memory: "Memory",
      settings: "Settings",
      logs: "Logs"
    },
    tabMeta: {
      landing: { label: "Home", title: "ReAgent Research Workspace", subtitle: "Research operations, evidence synthesis, memory, and delivery in one product surface." },
      chat: { label: "Chat", title: "Agent Desk", subtitle: "Use natural language and slash commands to drive research tasks, memory, and reports." },
      overview: { label: "Overview", title: "Command Center", subtitle: "See the research pipeline, fresh evidence, and latest deliverables in one product surface." },
      graph: { label: "Graph", title: "Research Map", subtitle: "Inspect how directions, evidence, reports, repos, and deliverables connect across the workspace." },
      channels: { label: "Channels", title: "WeChat Transport", subtitle: "Pairing, provider state, connection control, and transport flow." },
      sessions: { label: "Sessions", title: "Agent Sessions", subtitle: "Inspect persisted runtime sessions, activity, and role assignments." },
      agents: { label: "Agents", title: "Agent Workspaces", subtitle: "Configure the active runtime role and workspace skills for chat." },
      skills: { label: "Skills", title: "Skill Registry", subtitle: "See which skills are available and whether the current session enables them." },
      research: { label: "Research", title: "Evidence Workspace", subtitle: "Run a new investigation, inspect task progress, and shape evidence into reusable deliverables." },
      memory: { label: "Memory", title: "Knowledge Vault", subtitle: "Search, write, and inspect file-backed memory that carries research context forward." },
      settings: { label: "Settings", title: "Settings & Infrastructure", subtitle: "Communications, runtime, MCP status, and bridge configuration." },
      logs: { label: "Logs", title: "Runtime Log Tail", subtitle: "Inspect stdout and stderr from the current runtime." }
    },
    chat: {
      kicker: "Agent Desk",
      title: "Research Copilot",
      sub: "Use the agent to queue research, inspect context, and turn findings into reusable outputs.",
      senderLabel: "Display name",
      senderPlaceholder: "Display name (optional)",
      messageLabel: "Message",
      messagePlaceholder: "Message ReAgent or use /research, /memory, /remember",
      overviewTitle: "Overview",
      overviewSub: "Signals that matter before you decide the next research move.",
      agentTitle: "Agent Runtime",
      agentSub: "Switch the active role and enabled skills for this chat session.",
      agentRoleLabel: "Role",
      agentSkillsLabel: "Skills",
      agentSkillsHint: "Enabled skills directly control which local tools the runtime may call.",
      workspaceStatusTitle: "Workspace Status",
      workspaceStatusSub: "Live channel and workspace summary.",
      workspaceLabel: "Workspace",
      wechatProviderLabel: "WeChat provider",
      memoryModeLabel: "Memory search",
      latestResearchTitle: "Latest Research",
      latestResearchSub: "Keep the newest deliverable within one click of the conversation.",
      recentSessionsTitle: "Recent Sessions",
      recentSessionsSub: "Jump back into recent runs without leaving the agent desk.",
      commandModelTitle: "Research Commands",
      commandModelSub: "Use plain language for intent and slash commands for explicit workflow control.",
      commandResearchDesc: "Run the research workflow.",
      commandMemoryDesc: "Search file-backed memory.",
      commandRememberDesc: "Write a note into memory.",
      welcomeBadge: "Research orchestration, not generic chat",
      welcomeHint: "Ask for discovery, evidence synthesis, memory retrieval, or a new report.",
      suggestions: [
        "Summarize what changed in my latest research direction",
        "What evidence do we already have for agentic RAG?",
        "Turn the latest run into a short briefing",
        "/research agentic rag"
      ],
      you: "You",
      assistant: "ReAgent",
      system: "System"
    },
    overview: {
      kicker: "Research OS",
      heading: "Command Center",
      sub: "Move from discovery to evidence to deliverable in one repeatable research workspace.",
      launchResearch: "Queue research",
      openDesk: "Open agent desk",
      openGraph: "Inspect graph",
      stepDiscoverTitle: "Discover",
      stepDiscoverSub: "Track fresh papers and queue research runs.",
      stepMapTitle: "Map",
      stepMapSub: "Inspect directions, links, and reusable modules.",
      stepSynthesizeTitle: "Synthesize",
      stepSynthesizeSub: "Use the agent desk to turn evidence into judgment.",
      stepDeliverTitle: "Deliver",
      stepDeliverSub: "Persist memory and package outputs for the team.",
      liveSignalsTitle: "Live Signals",
      liveSignalsSub: "Use these signals to decide what to investigate next.",
      activityTitle: "Recent Activity",
      activitySub: "The last assistant actions, user prompts, and system transitions.",
      latestResearchTitle: "Latest Deliverable",
      latestResearchSub: "The freshest report, summary, or synthesis generated in this workspace.",
      sessionsTitle: "Recent Runs",
      sessionsSub: "Resume previous investigations without rebuilding context.",
      notesTitle: "Workspace Snapshot",
      notesSub: "Current operational signals, active mode, and delivery context."
    },
    landing: {
      kicker: "Research OS",
      heading: "ReAgent turns ongoing research into a repeatable product workflow.",
      sub: "Discover papers, inspect evidence, preserve memory, and ship usable reports from one integrated workspace.",
      badgeEvidence: "Evidence-first",
      badgeMemory: "Workspace memory",
      badgeDelivery: "Delivery-ready",
      ctaPrimary: "Open evidence workspace",
      ctaSecondary: "View command center",
      ctaTertiary: "Explore research map",
      proofTitle: "Live Product Signals",
      proofSub: "These signals come from the workspace itself, not a mock marketing screenshot.",
      latestTitle: "Latest Deliverable",
      latestSub: "The most recent report or synthesis generated from the active workspace.",
      runsTitle: "Recent Research Runs",
      runsSub: "Resume prior investigations without rebuilding context from scratch.",
      storyDiscoverKicker: "Discover",
      storyDiscoverTitle: "Continuous paper discovery",
      storyDiscoverSub: "Keep tracking target directions instead of restarting the search every week.",
      storyEvidenceKicker: "Evidence",
      storyEvidenceTitle: "Evidence-backed synthesis",
      storyEvidenceSub: "Separate claims, support, critique, and open gaps so outputs stay trustworthy.",
      storyMemoryKicker: "Memory",
      storyMemoryTitle: "Reusable workspace memory",
      storyMemorySub: "Preserve judgments, notes, and directions across runs inside a local file-backed vault.",
      storyDeliveryKicker: "Delivery",
      storyDeliveryTitle: "Reports that can leave the tool",
      storyDeliverySub: "Turn discovery and evidence into direction reports, briefings, and team-ready outputs.",
      audienceResearchersTitle: "For researchers",
      audienceResearchersSub: "Track evolving directions, compare evidence, and keep working context stable.",
      audienceLabsTitle: "For labs and teams",
      audienceLabsSub: "Share research outputs, keep reusable modules visible, and maintain a common evidence base.",
      audienceBuildersTitle: "For AI product builders",
      audienceBuildersSub: "Validate a product shape where research agents, memory, and delivery are one workflow.",
      showcaseKicker: "Workspace Tour",
      showcaseTitle: "One product, four coordinated surfaces.",
      showcaseSub: "ReAgent is not a chatbot with extra panels. It is a connected workspace where command, evidence, provenance, and memory reinforce one another.",
      showcaseFeatureOneTitle: "Command Center",
      showcaseFeatureOneSub: "Orchestrate what matters next.",
      showcaseFeatureTwoTitle: "Evidence Workspace",
      showcaseFeatureTwoSub: "Turn raw sources into supported findings.",
      showcaseFeatureThreeTitle: "Research Map",
      showcaseFeatureThreeSub: "Trace provenance across reports, modules, and artifacts.",
      showcaseFeatureFourTitle: "Knowledge Vault",
      showcaseFeatureFourSub: "Carry context forward instead of starting over.",
      showcasePrimary: "Open command center",
      showcaseSecondary: "Open evidence workspace",
      mockWorkspaceLabel: "Evidence Workspace",
      mockMapLabel: "Research Map",
      mockVaultLabel: "Knowledge Vault",
      mockStatEvidence: "Evidence",
      mockStatCoverage: "Coverage",
      mockStatVerdict: "Verdict",
      mockExecutiveTitle: "Executive Findings",
      mockExecutiveOne: "Retrieval modules remain the most reusable leverage point across recent runs.",
      mockExecutiveTwo: "Citation coverage is strong enough to package into a short team briefing.",
      mockEvidenceTitle: "Evidence Ledger",
      mockEvidenceClaim: "Claim is linked to reusable retrieval patterns.",
      mockEvidenceSupport: "PDF-backed evidence confirms the module design appears across multiple representative papers.",
      mockVaultOne: "Updated with latest judgment and next actions.",
      mockVaultTwo: "Stores the working context that survives across runs.",
      bannerTitle: "Start in the workspace that matches the job.",
      bannerSub: "Use Command Center for orchestration, Evidence Workspace for investigation, Research Map for provenance, and Knowledge Vault for long-term memory.",
      bannerPrimary: "Open command center",
      bannerSecondary: "Open knowledge vault"
    },
    channels: {
      kicker: "Channels",
      heading: "WeChat Transport",
      sub: "Pairing, provider state, connection control, and transport flow.",
      statusTitle: "Status",
      statusSub: "Provider state, connection, pairing, and last status line.",
      pairingTitle: "Pairing",
      pairingSub: "Request or refresh QR login, watch runtime status, or disconnect.",
      displayName: "Display name",
      startPairing: "Start pairing",
      refreshQr: "Refresh QR",
      waitScan: "Wait for scan",
      disconnect: "Disconnect",
      messageFlowTitle: "Message Flow",
      messageFlowSub: "Transport-side WeChat and system events live here.",
      notesTitle: "Operational Notes",
      notesSub: "Bridge details, status hints, and recommended next actions."
    },
    sessions: {
      kicker: "Sessions",
      heading: "Agent Sessions",
      sub: "Inspect persisted runtime sessions, activity, and role assignments."
    },
    agents: {
      kicker: "Agents",
      heading: "Agent Workspaces",
      sub: "Configure the active runtime role and workspace skills for chat."
    },
    skills: {
      kicker: "Skills",
      heading: "Skill Registry",
      sub: "See which skills are available and whether the current session enables them."
    },
    settings: {
      kicker: "Settings",
      heading: "Settings & Infrastructure",
      sub: "Communications, runtime, MCP status, and bridge configuration."
    },
    research: {
      kicker: "Research",
      heading: "Evidence Workspace",
      sub: "Run a new investigation, inspect task progress, and shape evidence into reusable deliverables.",
      capabilityPapers: "Paper discovery",
      capabilityEvidence: "Evidence ledger",
      capabilityReports: "Reports & briefings",
      capabilityMemory: "Memory handoff",
      runTitle: "Launch Research Run",
      runSub: "Brief the system with a topic and optional question to start a new evidence pipeline.",
      loadRunTitle: "Reopen Existing Run",
      loadRunSub: "Load a task by id to review the report, task state, and evidence trail.",
      taskQueueTitle: "Task Queue",
      taskQueueSub: "Track running, failed, and completed research tasks from one side rail.",
      topic: "Topic",
      question: "Question (optional)",
      runButton: "Queue research",
      taskId: "Load report by taskId",
      recentTitle: "Recent Runs",
      recentSub: "Open a recent report without losing the current workspace context.",
      briefTitle: "Research Briefs",
      briefSub: "Define structured research briefs, edit them directly, and import or export markdown.",
      briefId: "Brief ID (optional)",
      briefLabel: "Brief label",
      briefSummary: "Summary",
      briefTlDr: "TL;DR",
      briefBackground: "Background",
      briefTargetProblem: "Target problem",
      briefCurrentGoals: "Current goals, one per line",
      briefOpenQuestions: "Open questions, one per line",
      briefSuccessCriteria: "Success criteria, one per line",
      briefKnownBaselines: "Known baselines, one per line",
      briefEvaluationPriorities: "Evaluation priorities, one per line",
      briefShortTermValidationTargets: "Short-term validation targets, one per line",
      briefQueryHints: "Query hints, one per line",
      briefBlockedDirections: "Blocked directions, one per line",
      briefPreferredVenues: "Preferred venues, one per line",
      briefPreferredDatasets: "Preferred datasets, one per line",
      briefPreferredBenchmarks: "Preferred benchmarks, one per line",
      briefPreferredPaperStyles: "Preferred paper styles, one per line",
      briefEnabled: "Enabled",
      briefSave: "Save brief",
      briefNew: "New brief",
      briefDelete: "Delete brief",
      briefImport: "Import markdown",
      briefExport: "Export selected",
      briefMarkdown: "Paste research brief markdown here",
      directionTitle: "Direction Reports",
      directionSub: "Generate reusable direction summaries from recent papers, baselines, and modules.",
      directionTopic: "Topic or direction label",
      directionId: "Direction ID (optional)",
      directionDays: "Days",
      directionButton: "Generate report",
      feedbackTitle: "Feedback Loop",
      feedbackSub: "Record useful or negative feedback so discovery can adapt over time.",
      feedbackTopic: "Topic or direction",
      feedbackPaper: "Paper title (optional)",
      feedbackNotes: "Notes about what to encourage or avoid",
      feedbackButton: "Save feedback",
      reportTitle: "Report Canvas",
      reportSub: "Executive summary, evidence ledger, risks, and next actions live in one reading surface."
    },
    graph: {
      kicker: "Research Map",
      heading: "Research Map",
      sub: "Trace how directions, artifacts, modules, and reports connect across the workspace.",
      searchLabel: "Search graph",
      searchPlaceholder: "Filter by topic, title, tag, or source",
      windowLabel: "Time window",
      clearFilters: "Clear filters",
      summaryTitle: "Graph Summary",
      summarySub: "Coverage and shape of the current graph slice.",
      focusTitle: "Map Workflow",
      focusSub: "Filter first, then inspect nodes, relationships, and attached artifacts.",
      connectionsTitle: "Map Canvas",
      connectionsSub: "Explore visible nodes and inspect provenance from the graph itself.",
      relationshipsTitle: "Relationships",
      relationshipsSub: "Edges around the current node selection.",
      detailTitle: "Node Detail",
      detailSub: "Metadata, related nodes, structured conclusions, and raw artifacts."
    },
    memory: {
      kicker: "Knowledge Vault",
      heading: "Knowledge Vault",
      sub: "Search, write, and inspect file-backed memory that carries research context forward.",
      searchWriteTitle: "Query Workspace Memory",
      searchWriteSub: "Search across file-backed memory and reopen the exact file context behind each hit.",
      searchPlaceholder: "Search memory",
      title: "Title",
      writePlaceholder: "Write a note into memory",
      saveButton: "Save memory",
      filesTitle: "Vault Files",
      filesSub: "Browse stored memory files and reopen any note in context.",
      viewerTitle: "Document Preview",
      viewerSub: "Inspect the selected file without leaving the workspace.",
      viewerEmpty: "Select a file to preview its content.",
      writeTitle: "Write Memory",
      writeSub: "Capture a new note, decision, or working conclusion into the vault.",
      daily: "daily",
      longTerm: "long-term"
    },
    logs: {
      kicker: "Logs",
      heading: "Runtime Log Tail",
      sub: "Inspect stdout and stderr from the current runtime.",
      stdoutTitle: "Stdout",
      stderrTitle: "Stderr",
      waitingStdout: "Waiting for stdout log...",
      waitingStderr: "Waiting for stderr log..."
    },
    empty: {
      messages: "No messages yet.",
      report: "No report yet.",
      sessions: "No sessions yet.",
      activity: "No activity yet.",
      transport: "No transport messages yet.",
      reportLoaded: "No report loaded.",
      memoryResults: "No memory results yet.",
      memoryFiles: "No files.",
      stdout: "No stdout logs yet.",
      stderr: "No stderr logs yet.",
      findings: "No findings.",
      evidence: "No evidence.",
      notes: "No notes available."
    },
    actions: {
      openTab: "Go to",
      insertPrompt: "Insert"
    }
  },
  zh: {
    shell: {
      brandEyebrow: "\u7814\u7a76\u5de5\u4f5c\u53f0",
      navChat: "\u5de5\u4f5c\u53f0",
      navControl: "\u7814\u7a76\u6d41\u6c34",
      navAgent: "Agent",
      navSettings: "\u8bbe\u7f6e",
      sidebarNote: "\u53d1\u73b0\u3001\u8bc1\u636e\u3001\u8bb0\u5fc6\u548c\u4ea4\u4ed8\u90fd\u5728\u540c\u4e00\u4e2a\u7814\u7a76\u5de5\u4f5c\u533a\u91cc\u5b8c\u6210\u3002"
    },
    common: {
      status: "\u72b6\u6001",
      wechat: "\u5fae\u4fe1",
      memory: "\u8bb0\u5fc6",
      sessions: "\u4f1a\u8bdd",
      send: "\u53d1\u9001",
      load: "\u8bfb\u53d6",
      retry: "\u91cd\u8bd5",
      search: "\u641c\u7d22",
      refresh: "\u5237\u65b0",
      closeNav: "\u5173\u95ed\u5bfc\u822a",
      toggleNav: "\u5207\u6362\u5bfc\u822a",
      collapseNav: "\u6536\u8d77\u5bfc\u822a",
      expandNav: "\u5c55\u5f00\u5bfc\u822a",
      commandPalette: "\u641c\u7d22\u6216\u8df3\u8f6c",
      commandPaletteTitle: "\u641c\u7d22\u6807\u7b7e\u9875\u548c\u547d\u4ee4",
      commandPalettePlaceholder: "\u641c\u7d22\u6807\u7b7e\u9875\u548c\u547d\u4ee4...",
      commandPaletteFooter: "\u56de\u8f66\u6267\u884c\uff0cEsc \u5173\u95ed",
      commandPaletteEmpty: "\u6ca1\u6709\u5339\u914d\u7ed3\u679c\u3002",
      commandGroupTabs: "\u9875\u9762",
      commandGroupActions: "\u547d\u4ee4",
      commandGoTo: "\u8df3\u8f6c",
      commandInsert: "\u586b\u5165"
    },
    tabs: {
      landing: "\u9996\u9875",
      chat: "\u804a\u5929",
      overview: "\u603b\u89c8",
      graph: "Graph",
      channels: "\u6e20\u9053",
      sessions: "\u4f1a\u8bdd",
      agents: "Agents",
      skills: "Skills",
      research: "\u7814\u7a76",
      memory: "\u8bb0\u5fc6",
      settings: "\u8bbe\u7f6e",
      logs: "\u65e5\u5fd7"
    },
    tabMeta: {
      landing: { label: "\u9996\u9875", title: "ReAgent \u7814\u7a76\u5de5\u4f5c\u53f0", subtitle: "\u5728\u4e00\u4e2a\u4ea7\u54c1\u754c\u9762\u91cc\u5b8c\u6210\u7814\u7a76\u8fd0\u4f5c\u3001\u8bc1\u636e\u7efc\u5408\u3001\u8bb0\u5fc6\u6c89\u6dc0\u548c\u4ea4\u4ed8\u3002" },
      chat: { label: "\u804a\u5929", title: "\u667a\u80fd\u4f53\u684c\u9762", subtitle: "\u7528\u81ea\u7136\u8bed\u8a00\u548c slash \u547d\u4ee4\u63a8\u8fdb\u7814\u7a76\u4efb\u52a1\u3001\u8bb0\u5fc6\u548c\u62a5\u544a\u3002" },
      overview: { label: "\u603b\u89c8", title: "\u6307\u6325\u4e2d\u5fc3", subtitle: "\u5728\u4e00\u4e2a\u4ea7\u54c1\u754c\u9762\u91cc\u770b\u6e05\u7814\u7a76\u6d41\u6c34\u3001\u6700\u65b0\u8bc1\u636e\u548c\u6700\u65b0\u4ea4\u4ed8\u7269\u3002" },
      graph: { label: "Graph", title: "\u7814\u7a76\u5730\u56fe", subtitle: "\u67e5\u770b\u5de5\u4f5c\u533a\u4e2d\u7684\u65b9\u5411\u3001\u8bc1\u636e\u3001\u62a5\u544a\u3001\u4ed3\u5e93\u548c\u4ea4\u4ed8\u7269\u4e4b\u95f4\u600e\u6837\u8fde\u63a5\u3002" },
      channels: { label: "\u6e20\u9053", title: "\u5fae\u4fe1\u4f20\u8f93", subtitle: "\u67e5\u770b\u914d\u5bf9\u3001\u63d0\u4f9b\u65b9\u72b6\u6001\u3001\u8fde\u63a5\u63a7\u5236\u548c\u4f20\u8f93\u6d41\u3002" },
      sessions: { label: "\u4f1a\u8bdd", title: "Agent Sessions", subtitle: "\u67e5\u770b\u6301\u4e45\u5316 runtime \u4f1a\u8bdd\u3001\u6700\u8fd1\u6d3b\u52a8\u548c\u89d2\u8272\u72b6\u6001\u3002" },
      agents: { label: "Agents", title: "Agent Workspaces", subtitle: "\u4e3a\u804a\u5929 runtime \u914d\u7f6e\u89d2\u8272\u548c workspace skills\u3002" },
      skills: { label: "Skills", title: "Skill Registry", subtitle: "\u67e5\u770b\u53ef\u7528 skills\uff0c\u4ee5\u53ca\u5f53\u524d\u4f1a\u8bdd\u662f\u5426\u542f\u7528\u5b83\u4eec\u3002" },
      research: { label: "\u7814\u7a76", title: "\u8bc1\u636e\u5de5\u4f5c\u53f0", subtitle: "\u53d1\u8d77\u65b0\u7684\u7814\u7a76\u8c03\u67e5\uff0c\u8ddf\u8fdb\u4efb\u52a1\u8fdb\u5ea6\uff0c\u5e76\u628a\u8bc1\u636e\u6574\u7406\u6210\u53ef\u590d\u7528\u4ea4\u4ed8\u7269\u3002" },
      memory: { label: "\u8bb0\u5fc6", title: "\u77e5\u8bc6\u5e93", subtitle: "\u641c\u7d22\u3001\u5199\u5165\u5e76\u67e5\u770b\u6587\u4ef6\u578b\u8bb0\u5fc6\uff0c\u8ba9\u7814\u7a76\u4e0a\u4e0b\u6587\u80fd\u591f\u8de8 run \u5ef6\u7eed\u3002" },
      settings: { label: "\u8bbe\u7f6e", title: "\u8bbe\u7f6e\u4e0e\u57fa\u7840\u8bbe\u65bd", subtitle: "\u67e5\u770b communications\u3001runtime\u3001MCP \u72b6\u6001\u548c\u6865\u63a5\u914d\u7f6e\u3002" },
      logs: { label: "\u65e5\u5fd7", title: "\u8fd0\u884c\u65f6\u65e5\u5fd7\u5c3e\u90e8", subtitle: "\u67e5\u770b\u5f53\u524d\u8fd0\u884c\u5b9e\u4f8b\u7684 stdout \u548c stderr\u3002" }
    },
    chat: {
      kicker: "\u667a\u80fd\u4f53\u684c\u9762",
      title: "\u7814\u7a76\u526f\u9a7e",
      sub: "\u5728\u8fd9\u91cc\u53d1\u8d77\u7814\u7a76\u3001\u68c0\u7d22\u4e0a\u4e0b\u6587\uff0c\u5e76\u628a\u7ed3\u679c\u53d8\u6210\u53ef\u590d\u7528\u4ea7\u51fa\u3002",
      senderLabel: "\u663e\u793a\u540d\u79f0",
      senderPlaceholder: "\u663e\u793a\u540d\u79f0\uff08\u53ef\u9009\uff09",
      messageLabel: "\u6d88\u606f",
      messagePlaceholder: "\u76f4\u63a5\u548c ReAgent \u8bf4\u8bdd\uff0c\u6216\u8f93\u5165 /research\u3001/memory\u3001/remember",
      overviewTitle: "\u6982\u89c8",
      overviewSub: "\u5148\u770b\u6e05\u5173\u952e\u4fe1\u53f7\uff0c\u518d\u51b3\u5b9a\u4e0b\u4e00\u6b65\u7814\u7a76\u52a8\u4f5c\u3002",
      agentTitle: "Agent Runtime",
      agentSub: "\u4e3a\u5f53\u524d\u804a\u5929\u4f1a\u8bdd\u5207\u6362\u89d2\u8272\u548c\u542f\u7528\u7684 skills\u3002",
      agentRoleLabel: "\u89d2\u8272",
      agentSkillsLabel: "Skills",
      agentSkillsHint: "\u542f\u7528\u7684 skills \u4f1a\u76f4\u63a5\u51b3\u5b9a runtime \u53ef\u4ee5\u8c03\u7528\u54ea\u4e9b\u672c\u5730\u5de5\u5177\u3002",
      workspaceStatusTitle: "\u5de5\u4f5c\u533a\u72b6\u6001",
      workspaceStatusSub: "\u5b9e\u65f6\u67e5\u770b\u6e20\u9053\u548c\u5de5\u4f5c\u533a\u6458\u8981\u3002",
      workspaceLabel: "\u5de5\u4f5c\u533a",
      wechatProviderLabel: "\u5fae\u4fe1\u63d0\u4f9b\u65b9",
      memoryModeLabel: "\u8bb0\u5fc6\u641c\u7d22",
      latestResearchTitle: "\u6700\u65b0\u7814\u7a76",
      latestResearchSub: "\u6700\u65b0\u4ea4\u4ed8\u7269\u4fdd\u6301\u5728\u5bf9\u8bdd\u533a\u65c1\u8fb9\uff0c\u4e0d\u7528\u53cd\u590d\u5207\u9875\u3002",
      recentSessionsTitle: "\u6700\u8fd1\u4f1a\u8bdd",
      recentSessionsSub: "\u4e0d\u79bb\u5f00\u667a\u80fd\u4f53\u684c\u9762\uff0c\u5c31\u80fd\u7ee7\u7eed\u6700\u8fd1\u7684\u7814\u7a76\u8dd1\u6b65\u3002",
      commandModelTitle: "\u7814\u7a76\u547d\u4ee4",
      commandModelSub: "\u81ea\u7136\u8bed\u8a00\u7528\u4e8e\u8868\u8fbe\u610f\u56fe\uff0cslash \u547d\u4ee4\u7528\u4e8e\u660e\u786e\u63a7\u5236\u5de5\u4f5c\u6d41\u3002",
      commandResearchDesc: "\u8fd0\u884c\u7814\u7a76\u5de5\u4f5c\u6d41\u3002",
      commandMemoryDesc: "\u641c\u7d22\u6587\u4ef6\u578b\u8bb0\u5fc6\u3002",
      commandRememberDesc: "\u5199\u5165\u4e00\u6761\u8bb0\u5fc6\u3002",
      welcomeBadge: "\u9762\u5411\u7814\u7a76\u7f16\u6392\uff0c\u800c\u4e0d\u662f\u901a\u7528\u804a\u5929",
      welcomeHint: "\u53ef\u4ee5\u76f4\u63a5\u8981\u6c42\u53d1\u73b0\u3001\u8bc1\u636e\u7efc\u5408\u3001\u8bb0\u5fc6\u68c0\u7d22\u6216\u751f\u6210\u65b0\u62a5\u544a\u3002",
      suggestions: [
        "\u603b\u7ed3\u6211\u6700\u65b0\u7814\u7a76\u65b9\u5411\u91cc\u53d1\u751f\u4e86\u4ec0\u4e48",
        "\u6211\u4eec\u73b0\u5728\u5bf9 agentic RAG \u5df2\u7ecf\u6709\u54ea\u4e9b\u8bc1\u636e\uff1f",
        "\u628a\u6700\u65b0\u4e00\u6b21\u7814\u7a76\u8f6c\u6210\u4e00\u4efd\u77ed briefing",
        "/research agentic rag"
      ],
      you: "\u4f60",
      assistant: "ReAgent",
      system: "\u7cfb\u7edf"
    },
    overview: {
      kicker: "\u7814\u7a76\u5de5\u4f5c\u53f0",
      heading: "\u6307\u6325\u4e2d\u5fc3",
      sub: "\u628a\u53d1\u73b0\u3001\u8bc1\u636e\u3001\u7efc\u5408\u548c\u4ea4\u4ed8\u653e\u5230\u4e00\u4e2a\u53ef\u91cd\u590d\u6267\u884c\u7684\u7814\u7a76\u754c\u9762\u91cc\u3002",
      launchResearch: "\u53d1\u8d77\u7814\u7a76",
      openDesk: "\u6253\u5f00\u667a\u80fd\u4f53\u684c\u9762",
      openGraph: "\u67e5\u770b\u56fe\u8c31",
      stepDiscoverTitle: "\u53d1\u73b0",
      stepDiscoverSub: "\u8ddf\u8e2a\u65b0\u8bba\u6587\uff0c\u5e76\u53d1\u8d77\u65b0\u7684\u7814\u7a76\u8dd1\u6b65\u3002",
      stepMapTitle: "\u5efa\u6a21",
      stepMapSub: "\u68c0\u89c6\u65b9\u5411\u3001\u94fe\u63a5\u548c\u53ef\u590d\u7528\u6a21\u5757\u3002",
      stepSynthesizeTitle: "\u7efc\u5408",
      stepSynthesizeSub: "\u5728\u667a\u80fd\u4f53\u684c\u9762\u91cc\u628a\u8bc1\u636e\u53d8\u6210\u5224\u65ad\u3002",
      stepDeliverTitle: "\u4ea4\u4ed8",
      stepDeliverSub: "\u6c89\u6dc0\u8bb0\u5fc6\uff0c\u5e76\u6253\u5305\u6210\u56e2\u961f\u53ef\u7528\u7684\u4ea7\u51fa\u3002",
      liveSignalsTitle: "\u5b9e\u65f6\u4fe1\u53f7",
      liveSignalsSub: "\u7528\u8fd9\u4e9b\u4fe1\u53f7\u5224\u65ad\u73b0\u5728\u6700\u503c\u5f97\u8ddf\u8fdb\u4ec0\u4e48\u3002",
      activityTitle: "\u6700\u8fd1\u52a8\u4f5c",
      activitySub: "\u6700\u8fd1\u7684 assistant \u6267\u884c\u3001\u7528\u6237\u8bf7\u6c42\u548c\u7cfb\u7edf\u8f6c\u6001\u3002",
      latestResearchTitle: "\u6700\u65b0\u4ea4\u4ed8\u7269",
      latestResearchSub: "\u5f53\u524d\u5de5\u4f5c\u533a\u91cc\u6700\u65b0\u751f\u6210\u7684\u62a5\u544a\u3001\u6458\u8981\u6216\u7814\u7a76\u7efc\u5408\u3002",
      sessionsTitle: "\u6700\u8fd1\u8dd1\u6b65",
      sessionsSub: "\u4e0d\u91cd\u5efa\u4e0a\u4e0b\u6587\uff0c\u76f4\u63a5\u7ee7\u7eed\u4e4b\u524d\u7684\u7814\u7a76\u8c03\u67e5\u3002",
      notesTitle: "\u5de5\u4f5c\u533a\u5feb\u7167",
      notesSub: "\u5f53\u524d\u8fd0\u884c\u4fe1\u53f7\u3001\u6a21\u5f0f\u548c\u4ea4\u4ed8\u4e0a\u4e0b\u6587\u3002"
    },
    landing: {
      kicker: "\u7814\u7a76\u5de5\u4f5c\u53f0",
      heading: "ReAgent \u628a\u6301\u7eed\u7814\u7a76\u53d8\u6210\u4e00\u6761\u53ef\u91cd\u590d\u6267\u884c\u7684\u4ea7\u54c1\u5de5\u4f5c\u6d41\u3002",
      sub: "\u5728\u540c\u4e00\u4e2a\u5de5\u4f5c\u533a\u91cc\u5b8c\u6210\u8bba\u6587\u53d1\u73b0\u3001\u8bc1\u636e\u68c0\u67e5\u3001\u8bb0\u5fc6\u4fdd\u5b58\u548c\u53ef\u4ea4\u4ed8\u62a5\u544a\u751f\u6210\u3002",
      badgeEvidence: "\u8bc1\u636e\u4f18\u5148",
      badgeMemory: "\u5de5\u4f5c\u533a\u8bb0\u5fc6",
      badgeDelivery: "\u53ef\u76f4\u63a5\u4ea4\u4ed8",
      ctaPrimary: "\u6253\u5f00\u8bc1\u636e\u5de5\u4f5c\u53f0",
      ctaSecondary: "\u67e5\u770b\u6307\u6325\u4e2d\u5fc3",
      ctaTertiary: "\u6d4f\u89c8\u7814\u7a76\u5730\u56fe",
      proofTitle: "\u5b9e\u65f6\u4ea7\u54c1\u4fe1\u53f7",
      proofSub: "\u8fd9\u4e9b\u4fe1\u53f7\u76f4\u63a5\u6765\u81ea\u5f53\u524d workspace\uff0c\u4e0d\u662f marketing \u5047\u56fe\u3002",
      latestTitle: "\u6700\u65b0\u4ea4\u4ed8\u7269",
      latestSub: "\u5f53\u524d workspace \u6700\u65b0\u751f\u6210\u7684\u62a5\u544a\u6216\u7814\u7a76\u7efc\u5408\u3002",
      runsTitle: "\u6700\u8fd1\u7814\u7a76\u8dd1\u6b65",
      runsSub: "\u4e0d\u91cd\u5efa\u4e0a\u4e0b\u6587\uff0c\u76f4\u63a5\u7ee7\u7eed\u4e4b\u524d\u7684\u7814\u7a76\u8c03\u67e5\u3002",
      storyDiscoverKicker: "\u53d1\u73b0",
      storyDiscoverTitle: "\u6301\u7eed\u8bba\u6587\u53d1\u73b0",
      storyDiscoverSub: "\u56f4\u7ed5\u76ee\u6807\u65b9\u5411\u6301\u7eed\u8ddf\u8fdb\uff0c\u800c\u4e0d\u662f\u6bcf\u6b21\u90fd\u4ece\u96f6\u641c\u4e00\u904d\u3002",
      storyEvidenceKicker: "\u8bc1\u636e",
      storyEvidenceTitle: "\u6709\u8bc1\u636e\u652f\u6491\u7684\u7efc\u5408",
      storyEvidenceSub: "\u628a claim\u3001support\u3001critique \u548c open gaps \u62c6\u5f00\uff0c\u8ba9\u4ea7\u51fa\u66f4\u53ef\u4fe1\u3002",
      storyMemoryKicker: "\u8bb0\u5fc6",
      storyMemoryTitle: "\u53ef\u590d\u7528\u7684\u5de5\u4f5c\u533a\u8bb0\u5fc6",
      storyMemorySub: "\u5728\u672c\u5730\u6587\u4ef6\u578b vault \u91cc\u4fdd\u7559\u5224\u65ad\u3001notes \u548c direction context\u3002",
      storyDeliveryKicker: "\u4ea4\u4ed8",
      storyDeliveryTitle: "\u80fd\u79bb\u5f00\u5de5\u5177\u7684\u62a5\u544a",
      storyDeliverySub: "\u628a discovery \u548c evidence \u8f6c\u6210 direction reports\u3001briefings \u548c team-ready outputs\u3002",
      audienceResearchersTitle: "\u9762\u5411\u7814\u7a76\u8005",
      audienceResearchersSub: "\u8ddf\u8e2a\u6f14\u5316\u4e2d\u7684\u65b9\u5411\uff0c\u5bf9\u6bd4\u8bc1\u636e\uff0c\u5e76\u4fdd\u6301 working context \u7a33\u5b9a\u3002",
      audienceLabsTitle: "\u9762\u5411 lab \u548c\u56e2\u961f",
      audienceLabsSub: "\u5171\u4eab\u7814\u7a76\u4ea7\u51fa\uff0c\u4fdd\u6301 reusable modules \u53ef\u89c1\uff0c\u5e76\u7ef4\u62a4\u5171\u540c\u8bc1\u636e\u57fa\u7840\u3002",
      audienceBuildersTitle: "\u9762\u5411 AI \u4ea7\u54c1\u6784\u5efa\u8005",
      audienceBuildersSub: "\u9a8c\u8bc1\u4e00\u79cd\u628a research agents\u3001memory \u548c delivery \u5408\u4e3a\u4e00\u4f53\u7684\u4ea7\u54c1\u5f62\u6001\u3002",
      showcaseKicker: "\u4ea7\u54c1\u5bfc\u89c8",
      showcaseTitle: "\u4e00\u4e2a\u4ea7\u54c1\uff0c\u56db\u4e2a\u534f\u540c\u754c\u9762\u3002",
      showcaseSub: "ReAgent \u4e0d\u662f\u201c\u5e26\u51e0\u4e2a\u9644\u52a0 panel \u7684 chatbot\u201d\uff0c\u800c\u662f\u4e00\u4e2a\u8ba9\u6307\u6325\u3001\u8bc1\u636e\u3001provenance \u548c memory \u76f8\u4e92\u589e\u5f3a\u7684\u8fde\u63a5\u5de5\u4f5c\u533a\u3002",
      showcaseFeatureOneTitle: "\u6307\u6325\u4e2d\u5fc3",
      showcaseFeatureOneSub: "\u5148\u51b3\u5b9a\u4ec0\u4e48\u6700\u503c\u5f97\u63a8\u8fdb\u3002",
      showcaseFeatureTwoTitle: "\u8bc1\u636e\u5de5\u4f5c\u53f0",
      showcaseFeatureTwoSub: "\u628a\u539f\u59cb\u6765\u6e90\u53d8\u6210\u6709\u652f\u6491\u7684\u7ed3\u8bba\u3002",
      showcaseFeatureThreeTitle: "\u7814\u7a76\u5730\u56fe",
      showcaseFeatureThreeSub: "\u8ffd\u8e2a report\u3001module \u548c artifact \u4e4b\u95f4\u7684 provenance\u3002",
      showcaseFeatureFourTitle: "\u77e5\u8bc6\u5e93",
      showcaseFeatureFourSub: "\u8ba9 working context \u80fd\u8de8\u8dd1\u6b65\u5ef6\u7eed\uff0c\u800c\u4e0d\u662f\u6bcf\u6b21\u91cd\u6765\u3002",
      showcasePrimary: "\u6253\u5f00\u6307\u6325\u4e2d\u5fc3",
      showcaseSecondary: "\u6253\u5f00\u8bc1\u636e\u5de5\u4f5c\u53f0",
      mockWorkspaceLabel: "\u8bc1\u636e\u5de5\u4f5c\u53f0",
      mockMapLabel: "\u7814\u7a76\u5730\u56fe",
      mockVaultLabel: "\u77e5\u8bc6\u5e93",
      mockStatEvidence: "\u8bc1\u636e",
      mockStatCoverage: "\u8986\u76d6",
      mockStatVerdict: "\u5224\u5b9a",
      mockExecutiveTitle: "\u6838\u5fc3\u7ed3\u8bba",
      mockExecutiveOne: "\u68c0\u7d22\u6a21\u5757\u4ecd\u7136\u662f\u6700\u503c\u5f97\u590d\u7528\u7684 leverage point\u3002",
      mockExecutiveTwo: "\u5f53\u524d citation coverage \u5df2\u7ecf\u8db3\u591f\u652f\u6491\u4e00\u4efd\u77ed briefing\u3002",
      mockEvidenceTitle: "\u8bc1\u636e\u8d26\u672c",
      mockEvidenceClaim: "\u8be5 claim \u5df2\u7ecf\u548c\u53ef\u590d\u7528\u68c0\u7d22\u6a21\u5f0f\u5efa\u7acb\u5173\u8054\u3002",
      mockEvidenceSupport: "PDF-backed evidence \u663e\u793a\u8fd9\u79cd module \u8bbe\u8ba1\u5728\u591a\u7bc7 representative paper \u4e2d\u90fd\u51fa\u73b0\u3002",
      mockVaultOne: "\u5df2\u5199\u5165\u6700\u65b0\u5224\u65ad\u548c next actions\u3002",
      mockVaultTwo: "\u4fdd\u5b58\u80fd\u8de8\u8dd1\u6b65\u5ef6\u7eed\u7684 working context\u3002",
      bannerTitle: "\u4ece\u6700\u5339\u914d\u5f53\u524d\u4efb\u52a1\u7684 workspace \u5f00\u59cb\u3002",
      bannerSub: "\u6307\u6325\u4e2d\u5fc3\u7528\u4e8e\u7f16\u6392\uff0c\u8bc1\u636e\u5de5\u4f5c\u53f0\u7528\u4e8e\u8c03\u67e5\uff0c\u7814\u7a76\u5730\u56fe\u7528\u4e8e provenance\uff0c\u77e5\u8bc6\u5e93\u7528\u4e8e\u957f\u671f\u8bb0\u5fc6\u3002",
      bannerPrimary: "\u6253\u5f00\u6307\u6325\u4e2d\u5fc3",
      bannerSecondary: "\u6253\u5f00\u77e5\u8bc6\u5e93"
    },
    channels: {
      kicker: "\u6e20\u9053",
      heading: "\u5fae\u4fe1\u4f20\u8f93",
      sub: "\u67e5\u770b\u914d\u5bf9\u3001\u63d0\u4f9b\u65b9\u72b6\u6001\u3001\u8fde\u63a5\u63a7\u5236\u548c\u4f20\u8f93\u6d41\u3002",
      statusTitle: "\u72b6\u6001",
      statusSub: "\u67e5\u770b\u63d0\u4f9b\u65b9\u72b6\u6001\u3001\u8fde\u63a5\u3001\u914d\u5bf9\u548c\u6700\u540e\u4e00\u6761\u72b6\u6001\u4fe1\u606f\u3002",
      pairingTitle: "\u914d\u5bf9",
      pairingSub: "\u7533\u8bf7\u6216\u5237\u65b0\u4e8c\u7ef4\u7801\u767b\u5f55\uff0c\u67e5\u770b runtime \u72b6\u6001\uff0c\u6216\u65ad\u5f00\u8fde\u63a5\u3002",
      displayName: "\u663e\u793a\u540d\u79f0",
      startPairing: "\u5f00\u59cb\u914d\u5bf9",
      refreshQr: "\u5237\u65b0\u4e8c\u7ef4\u7801",
      waitScan: "\u7b49\u5f85\u626b\u7801",
      disconnect: "\u65ad\u5f00\u8fde\u63a5",
      messageFlowTitle: "\u6d88\u606f\u6d41",
      messageFlowSub: "\u5fae\u4fe1\u4f20\u8f93\u4fa7\u6d88\u606f\u548c\u7cfb\u7edf\u4e8b\u4ef6\u5355\u72ec\u663e\u793a\u5728\u8fd9\u91cc\u3002",
      notesTitle: "\u8fd0\u884c\u5907\u6ce8",
      notesSub: "\u6865\u63a5\u4fe1\u606f\u3001\u72b6\u6001\u63d0\u793a\u548c\u63a8\u8350\u64cd\u4f5c\u3002"
    },
    sessions: {
      kicker: "\u4f1a\u8bdd",
      heading: "Agent Sessions",
      sub: "\u67e5\u770b\u6301\u4e45\u5316 runtime \u4f1a\u8bdd\u3001\u6700\u8fd1\u6d3b\u52a8\u548c\u89d2\u8272\u72b6\u6001\u3002"
    },
    agents: {
      kicker: "Agents",
      heading: "Agent Workspaces",
      sub: "\u4e3a\u804a\u5929 runtime \u914d\u7f6e\u89d2\u8272\u548c workspace skills\u3002"
    },
    skills: {
      kicker: "Skills",
      heading: "Skill Registry",
      sub: "\u67e5\u770b\u53ef\u7528 skills\uff0c\u4ee5\u53ca\u5f53\u524d\u4f1a\u8bdd\u662f\u5426\u542f\u7528\u5b83\u4eec\u3002"
    },
    settings: {
      kicker: "\u8bbe\u7f6e",
      heading: "\u8bbe\u7f6e\u4e0e\u57fa\u7840\u8bbe\u65bd",
      sub: "\u67e5\u770b communications\u3001runtime\u3001MCP \u72b6\u6001\u548c\u6865\u63a5\u914d\u7f6e\u3002"
    },
    research: {
      kicker: "\u7814\u7a76",
      heading: "\u8bc1\u636e\u5de5\u4f5c\u53f0",
      sub: "\u53d1\u8d77\u65b0\u7684\u7814\u7a76\u8c03\u67e5\uff0c\u8ddf\u8fdb\u4efb\u52a1\u8fdb\u5ea6\uff0c\u5e76\u628a\u8bc1\u636e\u6574\u7406\u6210\u53ef\u590d\u7528\u4ea4\u4ed8\u7269\u3002",
      capabilityPapers: "\u8bba\u6587\u53d1\u73b0",
      capabilityEvidence: "\u8bc1\u636e\u8d26\u672c",
      capabilityReports: "\u62a5\u544a\u4e0e brief",
      capabilityMemory: "\u8bb0\u5fc6\u6c89\u6dc0",
      runTitle: "\u53d1\u8d77\u7814\u7a76\u8dd1\u6b65",
      runSub: "\u8f93\u5165\u4e3b\u9898\u548c\u53ef\u9009\u95ee\u9898\uff0c\u542f\u52a8\u4e00\u6761\u65b0\u7684\u8bc1\u636e\u751f\u6210\u6d41\u6c34\u3002",
      loadRunTitle: "\u91cd\u65b0\u6253\u5f00\u5df2\u6709\u8dd1\u6b65",
      loadRunSub: "\u901a\u8fc7 task id \u52a0\u8f7d\u4efb\u52a1\uff0c\u67e5\u770b\u62a5\u544a\u3001\u4efb\u52a1\u72b6\u6001\u548c\u8bc1\u636e\u8f68\u8ff9\u3002",
      taskQueueTitle: "\u4efb\u52a1\u961f\u5217",
      taskQueueSub: "\u5728\u4e00\u4e2a\u4fa7\u8fb9 rail \u91cc\u7edf\u4e00\u8ddf\u8e2a\u8fd0\u884c\u4e2d\u3001\u5931\u8d25\u548c\u5df2\u5b8c\u6210\u7684\u7814\u7a76\u4efb\u52a1\u3002",
      topic: "\u4e3b\u9898",
      question: "\u95ee\u9898\uff08\u53ef\u9009\uff09",
      runButton: "\u63d0\u4ea4\u7814\u7a76",
      taskId: "\u8f93\u5165 taskId \u8bfb\u53d6\u62a5\u544a",
      recentTitle: "\u6700\u8fd1\u8dd1\u6b65",
      recentSub: "\u4e0d\u4e22\u5931\u5f53\u524d\u5de5\u4f5c\u533a\u4e0a\u4e0b\u6587\uff0c\u76f4\u63a5\u6253\u5f00\u6700\u8fd1\u7684\u62a5\u544a\u3002",
      briefTitle: "Research Briefs",
      briefSub: "\u7ef4\u62a4\u7ed3\u6784\u5316 research brief\uff0c\u652f\u6301\u76f4\u63a5\u7f16\u8f91\u4e0e markdown \u5bfc\u5165\u5bfc\u51fa\u3002",
      briefId: "Brief ID\uff08\u53ef\u9009\uff09",
      briefLabel: "Brief \u6807\u9898",
      briefSummary: "\u6458\u8981",
      briefTlDr: "TL;DR",
      briefBackground: "\u80cc\u666f",
      briefTargetProblem: "\u76ee\u6807\u95ee\u9898",
      briefCurrentGoals: "\u5f53\u524d\u76ee\u6807\uff0c\u6bcf\u884c\u4e00\u6761",
      briefOpenQuestions: "\u5f00\u653e\u95ee\u9898\uff0c\u6bcf\u884c\u4e00\u6761",
      briefSuccessCriteria: "\u6210\u529f\u6807\u51c6\uff0c\u6bcf\u884c\u4e00\u6761",
      briefKnownBaselines: "\u5df2\u77e5 baseline\uff0c\u6bcf\u884c\u4e00\u6761",
      briefEvaluationPriorities: "\u8bc4\u4f30\u4f18\u5148\u7ea7\uff0c\u6bcf\u884c\u4e00\u6761",
      briefShortTermValidationTargets: "\u77ed\u671f\u9a8c\u8bc1\u76ee\u6807\uff0c\u6bcf\u884c\u4e00\u6761",
      briefQueryHints: "\u68c0\u7d22\u63d0\u793a\u8bcd\uff0c\u6bcf\u884c\u4e00\u6761",
      briefBlockedDirections: "\u963b\u585e\u65b9\u5411\uff0c\u6bcf\u884c\u4e00\u6761",
      briefPreferredVenues: "\u504f\u597d\u4f1a\u8bae\uff0c\u6bcf\u884c\u4e00\u6761",
      briefPreferredDatasets: "\u504f\u597d\u6570\u636e\u96c6\uff0c\u6bcf\u884c\u4e00\u6761",
      briefPreferredBenchmarks: "\u504f\u597d benchmark\uff0c\u6bcf\u884c\u4e00\u6761",
      briefPreferredPaperStyles: "\u504f\u597d\u8bba\u6587\u98ce\u683c\uff0c\u6bcf\u884c\u4e00\u6761",
      briefEnabled: "\u542f\u7528",
      briefSave: "\u4fdd\u5b58 brief",
      briefNew: "\u65b0\u5efa brief",
      briefDelete: "\u5220\u9664 brief",
      briefImport: "\u5bfc\u5165 markdown",
      briefExport: "\u5bfc\u51fa\u5f53\u524d brief",
      briefMarkdown: "\u5728\u6b64\u7c98\u8d34 research brief markdown",
      directionTitle: "\u65b9\u5411\u62a5\u544a",
      directionSub: "\u57fa\u4e8e\u6700\u8fd1\u8bba\u6587\u3001baseline \u548c\u6a21\u5757\uff0c\u751f\u6210\u53ef\u590d\u7528\u7684\u65b9\u5411\u7efc\u8ff0\u3002",
      directionTopic: "\u4e3b\u9898\u6216\u65b9\u5411\u6807\u7b7e",
      directionId: "\u65b9\u5411 ID\uff08\u53ef\u9009\uff09",
      directionDays: "\u5929\u6570",
      directionButton: "\u751f\u6210\u62a5\u544a",
      feedbackTitle: "\u53cd\u9988\u95ed\u73af",
      feedbackSub: "\u8bb0\u5f55\u6709\u7528\u6216\u8d1f\u9762\u53cd\u9988\uff0c\u8ba9\u53d1\u73b0\u7b56\u7565\u968f\u65f6\u8c03\u6574\u3002",
      feedbackTopic: "\u4e3b\u9898\u6216\u65b9\u5411",
      feedbackPaper: "\u8bba\u6587\u6807\u9898\uff08\u53ef\u9009\uff09",
      feedbackNotes: "\u8bb0\u5f55\u9700\u8981\u9f13\u52b1\u6216\u907f\u514d\u7684\u8981\u70b9",
      feedbackButton: "\u4fdd\u5b58\u53cd\u9988",
      reportTitle: "\u62a5\u544a\u753b\u5e03",
      reportSub: "\u5728\u4e00\u4e2a\u9605\u8bfb\u9762\u677f\u91cc\u540c\u65f6\u67e5\u770b executive summary\u3001\u8bc1\u636e\u8d26\u672c\u3001\u98ce\u9669\u548c\u4e0b\u4e00\u6b65\u884c\u52a8\u3002"
    },
    graph: {
      kicker: "\u7814\u7a76\u5730\u56fe",
      heading: "\u7814\u7a76\u5730\u56fe",
      sub: "\u8ffd\u8e2a\u5de5\u4f5c\u533a\u91cc\u7684\u65b9\u5411\u3001\u4ea7\u7269\u3001\u6a21\u5757\u548c\u62a5\u544a\u662f\u600e\u4e48\u8fde\u63a5\u5728\u4e00\u8d77\u7684\u3002",
      searchLabel: "\u641c\u7d22\u56fe\u8c31",
      searchPlaceholder: "\u6309\u4e3b\u9898\u3001\u6807\u9898\u3001tag \u6216 source \u8fc7\u6ee4",
      windowLabel: "\u65f6\u95f4\u7a97\u53e3",
      clearFilters: "\u6e05\u7a7a\u8fc7\u6ee4",
      summaryTitle: "\u5730\u56fe\u6458\u8981",
      summarySub: "\u5f53\u524d\u56fe\u8c31\u5207\u7247\u7684\u8986\u76d6\u8303\u56f4\u548c\u7ed3\u6784\u3002",
      focusTitle: "\u5730\u56fe\u6d41\u7a0b",
      focusSub: "\u5148\u8fc7\u6ee4\uff0c\u518d\u68c0\u67e5 node\u3001relationship \u548c\u9644\u5e26 artifact\u3002",
      connectionsTitle: "\u5730\u56fe\u753b\u5e03",
      connectionsSub: "\u76f4\u63a5\u5728\u56fe\u8c31\u91cc\u6d4f\u89c8\u53ef\u89c1 node\uff0c\u5e76\u68c0\u67e5 provenance\u3002",
      relationshipsTitle: "\u5173\u7cfb",
      relationshipsSub: "\u56f4\u7ed5\u5f53\u524d\u9009\u4e2d node \u7684 edge \u5217\u8868\u3002",
      detailTitle: "Node Detail",
      detailSub: "\u67e5\u770b metadata\u3001related nodes\u3001structured conclusions \u548c raw artifacts\u3002"
    },
    memory: {
      kicker: "\u77e5\u8bc6\u5e93",
      heading: "\u77e5\u8bc6\u5e93",
      sub: "\u641c\u7d22\u3001\u5199\u5165\u5e76\u67e5\u770b\u6587\u4ef6\u578b\u8bb0\u5fc6\uff0c\u8ba9\u7814\u7a76\u4e0a\u4e0b\u6587\u80fd\u591f\u8de8 run \u5ef6\u7eed\u3002",
      searchWriteTitle: "\u68c0\u7d22\u5de5\u4f5c\u533a\u8bb0\u5fc6",
      searchWriteSub: "\u5728\u6587\u4ef6\u578b memory \u4e2d\u68c0\u7d22\uff0c\u5e76\u76f4\u63a5\u6253\u5f00\u547d\u4e2d\u7684\u539f\u59cb\u6587\u4ef6\u4e0a\u4e0b\u6587\u3002",
      searchPlaceholder: "\u641c\u7d22\u8bb0\u5fc6",
      title: "\u6807\u9898",
      writePlaceholder: "\u5199\u5165\u4e00\u6761\u8bb0\u5fc6",
      saveButton: "\u4fdd\u5b58\u8bb0\u5fc6",
      filesTitle: "\u77e5\u8bc6\u5e93\u6587\u4ef6",
      filesSub: "\u6d4f\u89c8\u5df2\u5b58\u7684 memory files\uff0c\u5e76\u5728\u539f\u59cb\u4e0a\u4e0b\u6587\u4e2d\u91cd\u65b0\u6253\u5f00\u3002",
      viewerTitle: "\u6587\u6863\u9884\u89c8",
      viewerSub: "\u4e0d\u79bb\u5f00\u5de5\u4f5c\u533a\u76f4\u63a5\u68c0\u67e5\u9009\u4e2d\u6587\u4ef6\u3002",
      viewerEmpty: "\u9009\u62e9\u4e00\u4e2a\u6587\u4ef6\u540e\u5728\u8fd9\u91cc\u9884\u89c8\u5185\u5bb9\u3002",
      writeTitle: "\u5199\u5165\u8bb0\u5fc6",
      writeSub: "\u628a\u65b0\u7684\u7ed3\u8bba\u3001\u51b3\u7b56\u6216 working note \u5199\u5165 knowledge vault\u3002",
      daily: "\u6bcf\u65e5",
      longTerm: "\u957f\u671f"
    },
    logs: {
      kicker: "\u65e5\u5fd7",
      heading: "\u8fd0\u884c\u65f6\u65e5\u5fd7\u5c3e\u90e8",
      sub: "\u67e5\u770b\u5f53\u524d\u8fd0\u884c\u5b9e\u4f8b\u7684 stdout \u548c stderr\u3002",
      stdoutTitle: "\u6807\u51c6\u8f93\u51fa",
      stderrTitle: "\u6807\u51c6\u9519\u8bef",
      waitingStdout: "\u7b49\u5f85 stdout \u65e5\u5fd7...",
      waitingStderr: "\u7b49\u5f85 stderr \u65e5\u5fd7..."
    },
    empty: {
      messages: "\u8fd8\u6ca1\u6709\u6d88\u606f\u3002",
      report: "\u8fd8\u6ca1\u6709\u62a5\u544a\u3002",
      sessions: "\u8fd8\u6ca1\u6709\u4f1a\u8bdd\u3002",
      activity: "\u8fd8\u6ca1\u6709\u6d3b\u52a8\u3002",
      transport: "\u8fd8\u6ca1\u6709\u4f20\u8f93\u4fa7\u6d88\u606f\u3002",
      reportLoaded: "\u8fd8\u6ca1\u6709\u8bfb\u53d6\u62a5\u544a\u3002",
      memoryResults: "\u8fd8\u6ca1\u6709\u8bb0\u5fc6\u7ed3\u679c\u3002",
      memoryFiles: "\u6ca1\u6709\u6587\u4ef6\u3002",
      stdout: "\u8fd8\u6ca1\u6709 stdout \u65e5\u5fd7\u3002",
      stderr: "\u8fd8\u6ca1\u6709 stderr \u65e5\u5fd7\u3002",
      findings: "\u6ca1\u6709\u7ed3\u8bba\u3002",
      evidence: "\u6ca1\u6709\u8bc1\u636e\u3002",
      notes: "\u6682\u65e0\u5907\u6ce8\u3002"
    },
    actions: {
      openTab: "\u8df3\u8f6c",
      insertPrompt: "\u586b\u5165"
    }
  }
};

function resolvePath(source, path) {
  return path.split(".").reduce((value, key) => (value && key in value ? value[key] : undefined), source);
}

function current(state) {
  return UI[state.lang] ?? UI.zh;
}

function getStoredLanguage() {
  try {
    const value = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return value === "en" ? "en" : "zh";
  } catch {
    return "zh";
  }
}

function setIfFound(element, value, prop = "textContent") {
  if (!element || value == null) return;
  element[prop] = String(value);
}

function apply(state) {
  const copy = current(state);
  document.documentElement.lang = state.lang === "zh" ? "zh-CN" : "en";
  document.title = state.lang === "zh" ? "ReAgent \u7814\u7a76\u5de5\u4f5c\u53f0" : "ReAgent Research Workspace";

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const value = resolvePath(copy, element.dataset.i18n || "");
    setIfFound(element, value);
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    const value = resolvePath(copy, element.dataset.i18nPlaceholder || "");
    setIfFound(element, value, "placeholder");
  });

  document.querySelectorAll("[data-i18n-title]").forEach((element) => {
    const value = resolvePath(copy, element.dataset.i18nTitle || "");
    setIfFound(element, value, "title");
  });

  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    const value = resolvePath(copy, element.dataset.i18nAriaLabel || "");
    setIfFound(element, value, "ariaLabel");
  });

  document.querySelectorAll("[data-lang]").forEach((button) => {
    button.classList.toggle("lang-switch__btn--active", button.dataset.lang === state.lang);
  });
}

function init(state) {
  state.lang = getStoredLanguage();
  document.querySelectorAll("[data-lang]").forEach((button) => {
    button.addEventListener("click", () => {
      state.lang = button.dataset.lang === "en" ? "en" : "zh";
      try {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, state.lang);
      } catch {}
      window.dispatchEvent(new CustomEvent("reagent-language-change"));
    });
  });
}

function getTabMeta(state, tab) {
  return current(state).tabMeta[tab] ?? UI.en.tabMeta[tab];
}

function t(state, path) {
  return resolvePath(current(state), path);
}

window.ReAgentI18n = { init, apply, getTabMeta, getCopy: current, t };
