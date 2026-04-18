export function renderWorkspacePulseView(ctx) {
  const {
    state,
    els,
    trimText,
    escapeHtml,
    formatRelativeTime,
    formatResearchTaskState,
    getLatestSummary,
    getActiveResearchTask,
    getTransportStatus,
    bindOpenTabButtons,
    bindReportButtons,
  } = ctx;

  if (!els.workspacePulseMetrics || !els.workspacePulseActions) return;

  const summary = getLatestSummary();
  const activeTask = getActiveResearchTask();
  const transport = getTransportStatus(state.channels?.wechat);
  const healthOk = state.health?.status === "ok";
  const memoryFiles = state.memoryStatus?.files ?? 0;
  const briefsCount = state.researchBriefs.length;
  const reportsCount = state.recentReports.length;
  const starterProfileActive = state.runtimeMeta?.llmProvider === "fallback" && state.runtimeMeta?.wechatProvider === "mock";
  const noArtifactsYet = memoryFiles === 0 && briefsCount === 0 && reportsCount === 0 && !activeTask;

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
    subtitle = `${formatResearchTaskState(activeTask)} 璺?${trimText(activeTask.topic || activeTask.taskId || "-", 92)}`;
  } else if (summary) {
    headline = state.lang === "zh"
      ? "\u6700\u65b0\u4ea7\u51fa\u5df2\u5c31\u7eea\uff0c\u53ef\u4ee5\u7ee7\u7eed\u5ba1\u9605\u6216\u4ea4\u4ed8\u3002"
      : "The latest output is ready for review or delivery.";
    subtitle = `${trimText(summary.topic || summary.taskId || "-", 92)} 璺?${formatRelativeTime(summary.generatedAt)}`;
  }

  if (healthOk && starterProfileActive && noArtifactsYet) {
    headline = state.lang === "zh"
      ? "Starter profile 瀹告彃鎯庨悽顭掔礉閸欘垯浜掗惄瀛樺复鐠х柉绐囩粭顑跨閺夛紕鐖虹粚鑸电ウ閵?"
      : "The starter profile is active and the workspace is ready for the first run.";
    subtitle = state.lang === "zh"
      ? "瑜版挸澧犳担璺ㄦ暏 fallback + mock閿涘矂鈧倸鎮庢＃鏍偧娴ｆ捇鐛欓妴鍌涘复娑撳娼甸幍鎾崇磻 Research 妞ょ敻娼伴崚娑樼紦缁楊兛绔存稉?brief 閹?task閵?"
      : "ReAgent is currently using fallback + mock for first-run evaluation. Open Research and create the first brief or task next.";
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
      hint: `${formatResearchTaskState(activeTask)} 璺?${trimText(activeTask.topic || activeTask.taskId || "-", 64)}`,
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

export function renderLandingCommandBarView(ctx) {
  const {
    state,
    els,
    t,
    trimText,
    escapeHtml,
    formatRelativeTime,
    formatResearchTaskState,
    getLatestSummary,
    getActiveResearchTask,
    getTransportStatus,
    bindOpenTabButtons,
    bindReportButtons,
  } = ctx;

  if (!els.landingCommandBar) return;

  const summary = getLatestSummary();
  const activeTask = getActiveResearchTask();
  const transport = getTransportStatus(state.channels?.wechat);
  const memoryFiles = state.memoryStatus?.files ?? 0;
  const briefsCount = state.researchBriefs.length;
  const deploymentModes = state.runtimeMeta?.deployment?.alwaysOn?.modes || [];
  const deploymentMeta = deploymentModes.map((mode) => mode.label).join(" / ");
  const starterProfileActive = state.runtimeMeta?.llmProvider === "fallback" && state.runtimeMeta?.wechatProvider === "mock";
  const noArtifactsYet = memoryFiles === 0 && briefsCount === 0 && state.recentReports.length === 0 && !activeTask;

  const cards = [
    summary?.taskId
      ? {
          eyebrow: t("landing.commandLatestEyebrow", "Latest Deliverable"),
          title: t("landing.commandLatestTitle", "Review the latest deliverable"),
          meta: `${formatRelativeTime(summary.generatedAt)} 璺?${trimText(summary.topic || summary.taskId, 52)}`,
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
            title: starterProfileActive && noArtifactsYet
              ? (state.lang === "zh" ? "Starter profile 瀹告彃鎯庨悽?" : "Starter profile is active")
              : t("landing.commandStartTitle", "Start the first scoped investigation"),
            meta: starterProfileActive && noArtifactsYet
              ? (state.lang === "zh"
                ? "fallback + mock 瀹告彃姘ㄧ紒顏勩偨閿涘本甯存稉瀣降閸掓稑缂撶粭顑跨娑?brief 閹?task閵?"
                : "fallback + mock is ready for evaluation. Create the first brief or task next.")
              : t("landing.commandStartMeta", "Open the evidence workspace and queue the first topic."),
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
        ? `${memoryFiles} files 璺?${state.memoryStatus.searchMode}`
        : (state.lang === "zh" ? "\u67e5\u770b\u5df2\u4fdd\u5b58\u6587\u4ef6\u5e76\u6253\u5f00\u539f\u59cb\u4e0a\u4e0b\u6587" : "Inspect saved files and reopen raw context."),
      tab: "memory"
    },
    {
      eyebrow: t("landing.commandDeliveryEyebrow", "Delivery"),
      title: t("landing.commandDeliveryStatusTitle", "Delivery status"),
      meta: transport.tone === "warn" || transport.tone === "danger"
        ? `${formatResearchTaskState(activeTask)} 璺?${transport.value}`
        : `${transport.value} 璺?${transport.hint || "-"}`,
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

export function renderLaunchChecklistView(ctx) {
  const {
    state,
    els,
    t,
    trimText,
    escapeHtml,
    getLatestSummary,
    bindOpenTabButtons,
    bindReportButtons,
  } = ctx;

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

export function renderLandingSurfacesView(ctx) {
  const {
    state,
    els,
    renderLandingCommandBar,
    renderLaunchChecklist,
    renderOverviewCards,
    renderLatestReport,
    renderSessionCards,
    getLatestSummary,
  } = ctx;

  renderLandingCommandBar();
  renderLaunchChecklist();
  renderOverviewCards(els.landingLiveCards, false);
  renderLatestReport(els.landingLatestReport, getLatestSummary());
  renderSessionCards(els.landingSessionList, state.recentReports.slice(0, 4), true);
}
