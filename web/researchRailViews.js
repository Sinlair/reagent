export function applyDailyDigestPresetView(ctx) {
  const {
    state,
    els,
    formatListInput,
    UI_AGENT_SENDER_ID,
  } = ctx;

  const selectedDirectionIds = state.selectedResearchBriefId
    ? [state.selectedResearchBriefId]
    : state.researchBriefs.length > 0
      ? [state.researchBriefs[0].id]
      : [];

  if (els.discoverySchedulerEnabled) els.discoverySchedulerEnabled.checked = true;
  if (els.discoverySchedulerTime) els.discoverySchedulerTime.value = "09:00";
  if (els.discoverySchedulerSenderId && !els.discoverySchedulerSenderId.value.trim()) {
    els.discoverySchedulerSenderId.value = UI_AGENT_SENDER_ID;
  }
  if (els.discoverySchedulerSenderName && !els.discoverySchedulerSenderName.value.trim()) {
    els.discoverySchedulerSenderName.value = "ReAgent Daily Digest";
  }
  if (els.discoverySchedulerTopK) els.discoverySchedulerTopK.value = "5";
  if (els.discoverySchedulerMaxPapers) els.discoverySchedulerMaxPapers.value = "4";
  if (els.discoverySchedulerDirectionIds) {
    els.discoverySchedulerDirectionIds.value = formatListInput(selectedDirectionIds);
  }
}

export function renderDiscoverySchedulerView(ctx, status) {
  const {
    state,
    els,
    escapeHtml,
    formatListInput,
    formatTime,
    isSchedulerFormActive,
  } = ctx;

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
    : [state.lang === "zh" ? "All enabled templates" : "All enabled templates"];
  const lastRuns = Object.entries(scheduler.lastRunDateByDirection || {});

  els.discoverySchedulerStatus.innerHTML = [
    [state.lang === "zh" ? "閸氬骸褰寸拋鈥冲灊娴犺濮?" : "Background schedule", scheduler.running ? (state.lang === "zh" ? "Running" : "Running") : (state.lang === "zh" ? "Not running" : "Not running")],
    [state.lang === "zh" ? "閺勵垰鎯侀崥顖滄暏" : "Enabled", String(Boolean(scheduler.enabled))],
    [state.lang === "zh" ? "濮ｅ繑妫╅弮鍫曟？" : "Daily time", scheduler.dailyTimeLocal || "09:00"],
    [state.lang === "zh" ? "Push target" : "Push target", scheduler.senderId || "-"],
    [state.lang === "zh" ? "鐟曞棛娲婃稉濠氼暯" : "Topics", selectedDirections.join(" | ")],
    ["Top K", String(scheduler.topK || 5)],
    [state.lang === "zh" ? "濮ｅ繑顐煎Λ鈧槐銏ｎ啈閺傚洦鏆?" : "Papers / search", String(scheduler.maxPapersPerQuery || 4)],
    [state.lang === "zh" ? "Updated" : "Updated", scheduler.updatedAt ? formatTime(scheduler.updatedAt) : "-"],
    [state.lang === "zh" ? "Recent runs" : "Recent runs", lastRuns.length ? lastRuns.map(([directionId, value]) => `${directionMap.get(directionId) || directionId}: ${value}`).join(" | ") : (state.lang === "zh" ? "None yet" : "None yet")],
  ]
    .map(([label, value]) => `<div class="detail-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join("");

  if (els.discoverySchedulerHint) {
    let hint = "";
    if (!scheduler.enabled) {
      hint = state.lang === "zh"
        ? "Scheduler is currently disabled. Use the daily digest preset or enable the schedule after filling the sender."
        : "Scheduler is currently disabled. Use the daily digest preset or enable the schedule after filling the sender.";
    } else if (!scheduler.senderId?.trim()) {
      hint = state.lang === "zh"
        ? "A sender id is still required before the scheduler can push daily digests."
        : "A sender id is still required before the scheduler can push daily digests.";
    } else if (!(scheduler.directionIds || []).length && !state.researchBriefs.length) {
      hint = state.lang === "zh"
        ? "No research brief is configured yet. Create one first, or the preset will have nothing to target."
        : "No research brief is configured yet. Create one first, or the preset will have nothing to target.";
    } else if (!(scheduler.directionIds || []).length) {
      hint = state.lang === "zh"
        ? "No explicit brief is pinned, so the scheduler will use all enabled templates."
        : "No explicit brief is pinned, so the scheduler will use all enabled templates.";
    }

    els.discoverySchedulerHint.className = hint ? "alert-strip alert-strip--warn" : "empty-state compact-empty";
    els.discoverySchedulerHint.textContent = hint || (state.lang === "zh" ? "Daily digest preset is ready." : "Daily digest preset is ready.");
  }
}

export function renderDiscoveryRunsView(ctx) {
  const {
    state,
    els,
    escapeHtml,
    formatRelativeTime,
    hydrateDiscoveryRun,
    renderDiscoveryRunDetail,
  } = ctx;

  if (!els.discoverySchedulerRuns) return;

  const runs = (state.discoveryRuns || []).slice(0, 6);
  if (!runs.length) {
    els.discoverySchedulerRuns.className = "empty-state compact-empty";
    els.discoverySchedulerRuns.textContent = state.lang === "zh" ? "No scheduled runs yet." : "No scheduled runs yet.";
    renderDiscoveryRunDetail(null);
    return;
  }

  els.discoverySchedulerRuns.className = "session-list";
  els.discoverySchedulerRuns.innerHTML = runs
    .map(
      (run) => `
        <button class="session-item ${state.selectedDiscoveryRunId === run.runId ? "session-item--current" : ""}" type="button" data-discovery-run-id="${escapeHtml(run.runId)}">
          <div class="message__meta">
            <span class="message__author">${escapeHtml((run.directionLabels || []).join(", ") || "-")}</span>
            <span>${escapeHtml(formatRelativeTime(run.generatedAt))}</span>
          </div>
          <p>${escapeHtml(run.topTitle || (state.lang === "zh" ? "No top paper recorded." : "No top paper recorded."))}</p>
          <small>${escapeHtml(`${run.itemCount || 0} items 璺?${run.pushed ? "pushed" : "local"}`)}</small>
        </button>
      `
    )
    .join("");

  els.discoverySchedulerRuns.querySelectorAll("[data-discovery-run-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const runId = button.dataset.discoveryRunId;
      if (!runId) return;
      await hydrateDiscoveryRun(runId);
    });
  });
}

export function renderDiscoveryRunDetailView(ctx, run) {
  const {
    state,
    els,
    escapeHtml,
    renderPill,
    summarizeDiscoveryCandidateReasons,
    buildDiscoveryRunState,
  } = ctx;

  if (!els.discoveryRunDetail) return;

  if (!run) {
    els.discoveryRunDetail.className = "empty-state compact-empty";
    els.discoveryRunDetail.textContent = state.lang === "zh" ? "Select a discovery run to inspect candidate quality." : "Select a discovery run to inspect candidate quality.";
    return;
  }

  const runState = buildDiscoveryRunState(run);
  const items = Array.isArray(run.items) ? run.items : [];
  const warnings = Array.isArray(run.warnings) ? run.warnings : [];
  const detailCopy =
    runState.kind === "empty"
      ? "This run did not return strong candidates. Adjust the direction scope, venues, or query hints before rerunning."
      : runState.kind === "weak"
        ? "This run produced only a narrow candidate set. Inspect the ranking reasons before investing in deeper reading."
        : "This run returned ranked candidates with usable metadata and ranking context.";

  const warningMarkup = warnings.length
    ? `
      <div class="result-stack">
        ${warnings.map((warning) => `
          <div class="alert-strip alert-strip--warn">
            <strong>${escapeHtml("Discovery note")}</strong>
            <span>${escapeHtml(warning)}</span>
          </div>
        `).join("")}
      </div>
    `
    : "";

  const itemMarkup = items.length
    ? items.map((item, index) => {
      const reasons = summarizeDiscoveryCandidateReasons(item);
      const metadata = [item.source, item.year ? String(item.year) : "", item.venue || ""].filter(Boolean);
      return `
        <article class="report-block report-block--dense report-evidence-card">
          <div class="report-item-head">
            <div>
              <div class="card-sub">${escapeHtml(`${index + 1}. Candidate`)}</div>
              <h3>${escapeHtml(item.title)}</h3>
            </div>
            <div class="report-chip-list">
              ${item.directionLabel ? renderPill(item.directionLabel) : ""}
              ${item.rank ? renderPill(`#${item.rank}`, "ok") : ""}
            </div>
          </div>
          <div class="report-chip-list">
            ${metadata.map((value) => renderPill(value)).join("")}
          </div>
          <p>${escapeHtml(item.queryReason || item.relevanceReason || "No ranking context recorded.")}</p>
          <div class="result-stack">
            ${reasons.length
              ? reasons.map((reason) => `<article class="result-item"><p>${escapeHtml(reason)}</p></article>`).join("")
              : `<div class="empty-state compact-empty">${escapeHtml("No ranking reasons recorded.")}</div>`}
          </div>
          <div class="report-chip-list">
            ${item.url ? `<a class="graph-inline-link research-paper-card__link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml("Open source")}</a>` : ""}
            ${item.pdfUrl ? `<a class="graph-inline-link research-paper-card__link" href="${escapeHtml(item.pdfUrl)}" target="_blank" rel="noopener">${escapeHtml("PDF")}</a>` : ""}
          </div>
        </article>
      `;
    }).join("")
    : `<div class="empty-state compact-empty">${escapeHtml("No candidate cards are available for this run.")}</div>`;

  els.discoveryRunDetail.className = "stack";
  els.discoveryRunDetail.innerHTML = `
    <article class="report-block">
      <div class="report-item-head">
        <h3>${escapeHtml("Discovery candidate context")}</h3>
        ${renderPill(runState.kind, runState.tone)}
      </div>
      <p>${escapeHtml(run.digest || detailCopy)}</p>
      <small>${escapeHtml(detailCopy)}</small>
    </article>
    ${warningMarkup}
    <div class="result-stack">${itemMarkup}</div>
  `;
}
