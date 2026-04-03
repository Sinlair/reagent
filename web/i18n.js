const LANGUAGE_STORAGE_KEY = "reagent-ui-lang";

const UI = {
  en: {
    shell: {
      brandEyebrow: "Control UI",
      navChat: "Chat",
      navControl: "Control",
      navAgent: "Agent",
      navSettings: "Settings",
      sidebarNote: "Research, memory, chat, and transport stay in one workspace shell."
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
      chat: "Chat",
      overview: "Overview",
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
      chat: { label: "Chat", title: "Chat Workspace", subtitle: "Direct chat and slash-command control live in the same thread." },
      overview: { label: "Overview", title: "Workspace Overview", subtitle: "Recent activity, live system status, and the latest research snapshot." },
      channels: { label: "Channels", title: "WeChat Transport", subtitle: "Pairing, provider state, connection control, and transport flow." },
      sessions: { label: "Sessions", title: "Agent Sessions", subtitle: "Inspect persisted runtime sessions, activity, and role assignments." },
      agents: { label: "Agents", title: "Agent Workspaces", subtitle: "Configure the active runtime role and workspace skills for chat." },
      skills: { label: "Skills", title: "Skill Registry", subtitle: "See which skills are available and whether the current session enables them." },
      research: { label: "Research", title: "Workflow Runner", subtitle: "Launch new reports and inspect the latest synthesis." },
      memory: { label: "Memory", title: "Memory Workspace", subtitle: "Search, write, and inspect file-backed memory." },
      settings: { label: "Settings", title: "Settings & Infrastructure", subtitle: "Communications, runtime, MCP status, and bridge configuration." },
      logs: { label: "Logs", title: "Runtime Log Tail", subtitle: "Inspect stdout and stderr from the current runtime." }
    },
    chat: {
      kicker: "Conversation",
      title: "Chat Workspace",
      sub: "Direct chat and slash-command control live in the same thread.",
      senderLabel: "Display name",
      senderPlaceholder: "Display name (optional)",
      messageLabel: "Message",
      messagePlaceholder: "Message ReAgent or use /research, /memory, /remember",
      overviewTitle: "Overview",
      overviewSub: "At-a-glance workspace signals.",
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
      latestResearchSub: "The latest report stays one click away from the thread.",
      recentSessionsTitle: "Recent Sessions",
      recentSessionsSub: "Recent research runs surfaced next to the chat thread.",
      commandModelTitle: "Command Model",
      commandModelSub: "Plain text chats. Slash commands control the workspace.",
      commandResearchDesc: "Run the research workflow.",
      commandMemoryDesc: "Search file-backed memory.",
      commandRememberDesc: "Write a note into memory.",
      welcomeBadge: "OpenClaw-style shell adapted for ReAgent",
      welcomeHint: "Type a message below or press / for control commands.",
      suggestions: [
        "What can you do?",
        "Summarize my recent sessions",
        "Help me configure the WeChat channel",
        "/research agentic rag"
      ],
      you: "You",
      assistant: "ReAgent",
      system: "System"
    },
    overview: {
      kicker: "Overview",
      heading: "Workspace Overview",
      sub: "Recent activity, live system status, and the latest research snapshot.",
      activityTitle: "Recent Activity",
      activitySub: "Latest inbound, outbound, and system events.",
      latestResearchTitle: "Latest Research",
      latestResearchSub: "The most recent report snapshot in this workspace.",
      sessionsTitle: "Recent Sessions",
      sessionsSub: "Jump back into recent research runs.",
      notesTitle: "Workspace Notes",
      notesSub: "Key operational details from the current workspace."
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
      heading: "Workflow Runner",
      sub: "Launch new reports and inspect the latest synthesis.",
      runTitle: "Run Research",
      runSub: "Launch a new research workflow or load an existing report.",
      taskQueueTitle: "Task Queue",
      taskQueueSub: "Track running, failed, and completed research tasks.",
      topic: "Topic",
      question: "Question (optional)",
      runButton: "Queue research",
      taskId: "Load report by taskId",
      recentTitle: "Recent Research",
      recentSub: "Open a recent report without leaving the workflow view.",
      reportTitle: "Research Report",
      reportSub: "The full report is rendered here, not squeezed into chat bubbles."
    },
    memory: {
      kicker: "Memory",
      heading: "Memory Workspace",
      sub: "Search, write, and inspect file-backed memory.",
      searchWriteTitle: "Search and Write",
      searchWriteSub: "Search workspace memory or write new notes.",
      searchPlaceholder: "Search memory",
      title: "Title",
      writePlaceholder: "Write a note into memory",
      saveButton: "Save memory",
      filesTitle: "Memory Files",
      filesSub: "Inspect files and open file contents.",
      viewerTitle: "File Preview",
      viewerSub: "Read the selected memory file without leaving the workspace.",
      viewerEmpty: "Select a file to preview its content.",
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
      brandEyebrow: "\u63a7\u5236\u53f0",
      navChat: "\u804a\u5929",
      navControl: "\u63a7\u5236",
      navAgent: "Agent",
      navSettings: "\u8bbe\u7f6e",
      sidebarNote: "\u7814\u7a76\u3001\u8bb0\u5fc6\u3001\u804a\u5929\u548c\u4f20\u8f93\u90fd\u5728\u540c\u4e00\u4e2a\u5de5\u4f5c\u533a\u58f3\u5b50\u91cc\u5b8c\u6210\u3002"
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
      chat: "\u804a\u5929",
      overview: "\u603b\u89c8",
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
      chat: { label: "\u804a\u5929", title: "\u804a\u5929\u5de5\u4f5c\u533a", subtitle: "\u666e\u901a\u804a\u5929\u548c slash \u63a7\u5236\u547d\u4ee4\u90fd\u5728\u540c\u4e00\u6761\u7ebf\u7a0b\u91cc\u3002" },
      overview: { label: "\u603b\u89c8", title: "\u5de5\u4f5c\u533a\u603b\u89c8", subtitle: "\u67e5\u770b\u6700\u8fd1\u6d3b\u52a8\u3001\u7cfb\u7edf\u72b6\u6001\u548c\u6700\u65b0\u7814\u7a76\u5feb\u7167\u3002" },
      channels: { label: "\u6e20\u9053", title: "\u5fae\u4fe1\u4f20\u8f93", subtitle: "\u67e5\u770b\u914d\u5bf9\u3001\u63d0\u4f9b\u65b9\u72b6\u6001\u3001\u8fde\u63a5\u63a7\u5236\u548c\u4f20\u8f93\u6d41\u3002" },
      sessions: { label: "\u4f1a\u8bdd", title: "Agent Sessions", subtitle: "\u67e5\u770b\u6301\u4e45\u5316 runtime \u4f1a\u8bdd\u3001\u6700\u8fd1\u6d3b\u52a8\u548c\u89d2\u8272\u72b6\u6001\u3002" },
      agents: { label: "Agents", title: "Agent Workspaces", subtitle: "\u4e3a\u804a\u5929 runtime \u914d\u7f6e\u89d2\u8272\u548c workspace skills\u3002" },
      skills: { label: "Skills", title: "Skill Registry", subtitle: "\u67e5\u770b\u53ef\u7528 skills\uff0c\u4ee5\u53ca\u5f53\u524d\u4f1a\u8bdd\u662f\u5426\u542f\u7528\u5b83\u4eec\u3002" },
      research: { label: "\u7814\u7a76", title: "\u7814\u7a76\u5de5\u4f5c\u6d41", subtitle: "\u53d1\u8d77\u65b0\u62a5\u544a\u5e76\u67e5\u770b\u6700\u65b0\u7efc\u5408\u7ed3\u679c\u3002" },
      memory: { label: "\u8bb0\u5fc6", title: "\u8bb0\u5fc6\u5de5\u4f5c\u533a", subtitle: "\u641c\u7d22\u3001\u5199\u5165\u5e76\u67e5\u770b\u6587\u4ef6\u578b\u8bb0\u5fc6\u3002" },
      settings: { label: "\u8bbe\u7f6e", title: "\u8bbe\u7f6e\u4e0e\u57fa\u7840\u8bbe\u65bd", subtitle: "\u67e5\u770b communications\u3001runtime\u3001MCP \u72b6\u6001\u548c\u6865\u63a5\u914d\u7f6e\u3002" },
      logs: { label: "\u65e5\u5fd7", title: "\u8fd0\u884c\u65f6\u65e5\u5fd7\u5c3e\u90e8", subtitle: "\u67e5\u770b\u5f53\u524d\u8fd0\u884c\u5b9e\u4f8b\u7684 stdout \u548c stderr\u3002" }
    },
    chat: {
      kicker: "\u5bf9\u8bdd",
      title: "\u804a\u5929\u5de5\u4f5c\u533a",
      sub: "\u666e\u901a\u804a\u5929\u548c slash \u63a7\u5236\u547d\u4ee4\u90fd\u5728\u540c\u4e00\u6761\u7ebf\u7a0b\u91cc\u3002",
      senderLabel: "\u663e\u793a\u540d\u79f0",
      senderPlaceholder: "\u663e\u793a\u540d\u79f0\uff08\u53ef\u9009\uff09",
      messageLabel: "\u6d88\u606f",
      messagePlaceholder: "\u76f4\u63a5\u548c ReAgent \u8bf4\u8bdd\uff0c\u6216\u8f93\u5165 /research\u3001/memory\u3001/remember",
      overviewTitle: "\u6982\u89c8",
      overviewSub: "\u4e00\u773c\u770b\u6e05\u5de5\u4f5c\u533a\u72b6\u6001\u3002",
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
      latestResearchSub: "\u6700\u65b0\u62a5\u544a\u5c31\u5728\u804a\u5929\u4fa7\u8fb9\uff0c\u4e0d\u7528\u6765\u56de\u5207\u9875\u3002",
      recentSessionsTitle: "\u6700\u8fd1\u4f1a\u8bdd",
      recentSessionsSub: "\u6700\u8fd1\u7814\u7a76\u4efb\u52a1\u76f4\u63a5\u6302\u5728\u804a\u5929\u65c1\u8fb9\u3002",
      commandModelTitle: "\u547d\u4ee4\u6a21\u5f0f",
      commandModelSub: "\u666e\u901a\u6587\u672c\u7528\u4e8e\u804a\u5929\uff0cslash \u547d\u4ee4\u7528\u4e8e\u63a7\u5236\u5de5\u4f5c\u533a\u3002",
      commandResearchDesc: "\u8fd0\u884c\u7814\u7a76\u5de5\u4f5c\u6d41\u3002",
      commandMemoryDesc: "\u641c\u7d22\u6587\u4ef6\u578b\u8bb0\u5fc6\u3002",
      commandRememberDesc: "\u5199\u5165\u4e00\u6761\u8bb0\u5fc6\u3002",
      welcomeBadge: "\u53c2\u8003 OpenClaw \u5916\u58f3\u6539\u9020\u7684 ReAgent \u754c\u9762",
      welcomeHint: "\u76f4\u63a5\u8f93\u5165\u6d88\u606f\uff0c\u6216\u6309 / \u4f7f\u7528\u63a7\u5236\u547d\u4ee4\u3002",
      suggestions: [
        "\u4f60\u80fd\u505a\u4ec0\u4e48\uff1f",
        "\u603b\u7ed3\u4e00\u4e0b\u6700\u8fd1\u7684\u4f1a\u8bdd",
        "\u5e2e\u6211\u914d\u7f6e\u5fae\u4fe1\u6e20\u9053",
        "/research agentic rag"
      ],
      you: "\u4f60",
      assistant: "ReAgent",
      system: "\u7cfb\u7edf"
    },
    overview: {
      kicker: "\u603b\u89c8",
      heading: "\u5de5\u4f5c\u533a\u603b\u89c8",
      sub: "\u67e5\u770b\u6700\u8fd1\u6d3b\u52a8\u3001\u7cfb\u7edf\u72b6\u6001\u548c\u6700\u65b0\u7814\u7a76\u5feb\u7167\u3002",
      activityTitle: "\u6700\u8fd1\u6d3b\u52a8",
      activitySub: "\u6700\u65b0\u7684\u5165\u7ad9\u3001\u51fa\u7ad9\u548c\u7cfb\u7edf\u4e8b\u4ef6\u3002",
      latestResearchTitle: "\u6700\u65b0\u7814\u7a76",
      latestResearchSub: "\u5f53\u524d\u5de5\u4f5c\u533a\u6700\u8fd1\u4e00\u6b21\u7814\u7a76\u4efb\u52a1\u7684\u5feb\u7167\u3002",
      sessionsTitle: "\u6700\u8fd1\u4f1a\u8bdd",
      sessionsSub: "\u5feb\u901f\u56de\u5230\u6700\u8fd1\u7684\u7814\u7a76\u4efb\u52a1\u3002",
      notesTitle: "\u5de5\u4f5c\u533a\u5907\u6ce8",
      notesSub: "\u5f53\u524d\u5de5\u4f5c\u533a\u91cc\u7684\u5173\u952e\u8fd0\u884c\u4fe1\u606f\u3002"
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
      heading: "\u7814\u7a76\u5de5\u4f5c\u6d41",
      sub: "\u53d1\u8d77\u65b0\u62a5\u544a\u5e76\u67e5\u770b\u6700\u65b0\u7efc\u5408\u7ed3\u679c\u3002",
      runTitle: "\u8fd0\u884c\u7814\u7a76",
      runSub: "\u53d1\u8d77\u65b0\u7684\u7814\u7a76\u4efb\u52a1\uff0c\u6216\u8bfb\u53d6\u5df2\u6709\u62a5\u544a\u3002",
      taskQueueTitle: "\u4efb\u52a1\u961f\u5217",
      taskQueueSub: "\u8ddf\u8e2a\u8fd0\u884c\u4e2d\u3001\u5931\u8d25\u548c\u5df2\u5b8c\u6210\u7684\u7814\u7a76\u4efb\u52a1\u3002",
      topic: "\u4e3b\u9898",
      question: "\u95ee\u9898\uff08\u53ef\u9009\uff09",
      runButton: "\u63d0\u4ea4\u7814\u7a76",
      taskId: "\u8f93\u5165 taskId \u8bfb\u53d6\u62a5\u544a",
      recentTitle: "\u6700\u8fd1\u7814\u7a76",
      recentSub: "\u4e0d\u7528\u79bb\u5f00\u9875\u9762\u5c31\u80fd\u6253\u5f00\u6700\u8fd1\u62a5\u544a\u3002",
      reportTitle: "\u7814\u7a76\u62a5\u544a",
      reportSub: "\u5b8c\u6574\u62a5\u544a\u76f4\u63a5\u6e32\u67d3\u5728\u8fd9\u91cc\uff0c\u4e0d\u6324\u8fdb\u804a\u5929\u6c14\u6ce1\u3002"
    },
    memory: {
      kicker: "\u8bb0\u5fc6",
      heading: "\u8bb0\u5fc6\u5de5\u4f5c\u533a",
      sub: "\u641c\u7d22\u3001\u5199\u5165\u5e76\u67e5\u770b\u6587\u4ef6\u578b\u8bb0\u5fc6\u3002",
      searchWriteTitle: "\u641c\u7d22\u4e0e\u5199\u5165",
      searchWriteSub: "\u641c\u7d22\u5de5\u4f5c\u533a\u8bb0\u5fc6\uff0c\u6216\u5199\u5165\u65b0\u7684\u8bb0\u5f55\u3002",
      searchPlaceholder: "\u641c\u7d22\u8bb0\u5fc6",
      title: "\u6807\u9898",
      writePlaceholder: "\u5199\u5165\u4e00\u6761\u8bb0\u5fc6",
      saveButton: "\u4fdd\u5b58\u8bb0\u5fc6",
      filesTitle: "\u8bb0\u5fc6\u6587\u4ef6",
      filesSub: "\u67e5\u770b\u6587\u4ef6\u5e76\u6253\u5f00\u5185\u5bb9\u3002",
      viewerTitle: "\u6587\u4ef6\u9884\u89c8",
      viewerSub: "\u4e0d\u79bb\u5f00\u5de5\u4f5c\u533a\u76f4\u63a5\u67e5\u770b\u9009\u4e2d\u6587\u4ef6\u3002",
      viewerEmpty: "\u9009\u62e9\u4e00\u4e2a\u6587\u4ef6\u540e\u5728\u8fd9\u91cc\u9884\u89c8\u5185\u5bb9\u3002",
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
  document.title = state.lang === "zh" ? "ReAgent \u63a7\u5236\u53f0" : "ReAgent";

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
