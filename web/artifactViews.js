export function renderDirectionReportView(ctx, report) {
  const {
    state,
    els,
    escapeHtml,
    renderPill,
    renderStringList,
    formatTime,
  } = ctx;

  if (!report) {
    els.researchReport.className = "empty-state";
    els.researchReport.textContent = "No report loaded.";
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
                  ${paper.sourceUrl ? `<a class="graph-inline-link research-paper-card__link" href="${escapeHtml(paper.sourceUrl)}" target="_blank" rel="noopener">${escapeHtml(state.lang === "zh" ? "閹垫挸绱戦弶銉︾爱" : "Open source")}</a>` : ""}
                </div>
              </div>
              <p>${escapeHtml(paper.reason)}</p>
            </article>
          `
        )
        .join("")
    : `<div class="empty-state compact-empty">${escapeHtml(state.lang === "zh" ? "No representative papers." : "No representative papers.")}</div>`;

  const renderList = (items, emptyText) =>
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
          <span>${escapeHtml(state.lang === "zh" ? "娴狅綀銆冪拋鐑樻瀮" : "Representative papers")}</span>
          <strong>${escapeHtml(String(report.representativePapers?.length || 0))}</strong>
        </article>
        <article class="research-stat">
          <span>${escapeHtml(state.lang === "zh" ? "瀵ら缚顔呯捄顖滃殠" : "Suggested routes")}</span>
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
          <div class="result-stack">${renderList(report.suggestedRoutes, state.lang === "zh" ? "No suggested routes." : "No suggested routes.")}</div>
        </article>

        <article class="report-block">
          <div class="report-item-head">
            <h3>${escapeHtml(state.lang === "zh" ? "Supporting Signals" : "Supporting Signals")}</h3>
            ${renderPill(String(report.supportingSignals?.length || 0))}
          </div>
          <div class="result-stack">${renderList(report.supportingSignals, state.lang === "zh" ? "No supporting signals." : "No supporting signals.")}</div>
        </article>
      </div>

      <aside class="stack research-report-side">
        <article class="report-block">
          <div class="report-item-head">
            <h3>${escapeHtml(state.lang === "zh" ? "Common Baselines" : "Common Baselines")}</h3>
            ${renderPill(String(report.commonBaselines?.length || 0))}
          </div>
          <div class="result-stack">${renderList(report.commonBaselines, state.lang === "zh" ? "No baselines recorded." : "No baselines recorded.")}</div>
        </article>

        <article class="report-block">
          <div class="report-item-head">
            <h3>${escapeHtml(state.lang === "zh" ? "Common Modules" : "Common Modules")}</h3>
            ${renderPill(String(report.commonModules?.length || 0))}
          </div>
          <div class="result-stack">${renderList(report.commonModules, state.lang === "zh" ? "No common modules recorded." : "No common modules recorded.")}</div>
        </article>

        <article class="report-block">
          <div class="report-item-head">
            <h3>${escapeHtml(state.lang === "zh" ? "Open Problems" : "Open Problems")}</h3>
            ${renderPill(String(report.openProblems?.length || 0), "warn")}
          </div>
          <div class="result-stack">${renderList(report.openProblems, state.lang === "zh" ? "No open problems recorded." : "No open problems recorded.")}</div>
        </article>
      </aside>
    </div>
  `;
}

export function renderPresentationArtifactView(ctx, presentation) {
  const {
    state,
    els,
    escapeHtml,
    renderPill,
    renderStringList,
    formatTime,
    clipBlock,
  } = ctx;

  if (!presentation) {
    els.researchReport.className = "empty-state";
    els.researchReport.textContent = "No report loaded.";
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
          <p>${escapeHtml(state.lang === "zh" ? "Generated meeting material and export files." : "Generated meeting material and export files.")}</p>
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
              <small><a class="graph-inline-link" href="${escapeHtml(markdownHref)}" target="_blank" rel="noopener">${escapeHtml(state.lang === "zh" ? "閹垫挸绱戦弬鍥︽" : "Open file")}</a></small>
            </article>
            ${presentation.pptxPath ? `
              <article class="result-item">
                <h3>${escapeHtml("PPTX")}</h3>
                <p>${escapeHtml(presentation.pptxPath)}</p>
                <small><a class="graph-inline-link" href="${escapeHtml(pptxHref)}" target="_blank" rel="noopener">${escapeHtml(state.lang === "zh" ? "閹垫挸绱戦弬鍥︽" : "Open file")}</a></small>
              </article>
            ` : ""}
          </div>
        </article>
        <article class="report-block">
          <div class="report-item-head">
            <h3>${escapeHtml(state.lang === "zh" ? "Source Reports" : "Source Reports")}</h3>
            ${renderPill(String(presentation.sourceReportTaskIds?.length || 0))}
          </div>
          <div class="result-stack">${renderStringList(presentation.sourceReportTaskIds, state.lang === "zh" ? "No source reports recorded." : "No source reports recorded.")}</div>
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
                    <small><a class="graph-inline-link" href="/api/research/artifact?path=${encodeURIComponent(filePath)}" target="_blank" rel="noopener">${escapeHtml(state.lang === "zh" ? "閹垫挸绱戦弬鍥︽" : "Open file")}</a></small>
                  </article>
                `).join("")
              : `<div class="empty-state compact-empty">${escapeHtml(state.lang === "zh" ? "No image assets recorded." : "No image assets recorded.")}</div>`}
          </div>
        </article>
      </aside>
    </div>
  `;
}

export function renderModuleAssetView(ctx, asset) {
  const {
    state,
    els,
    escapeHtml,
    renderPill,
    renderStringList,
    formatTime,
  } = ctx;

  if (!asset) {
    els.researchReport.className = "empty-state";
    els.researchReport.textContent = "No report loaded.";
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
          <p>${escapeHtml(state.lang === "zh" ? "Archived reusable modules and repository snapshots." : "Archived reusable modules and repository snapshots.")}</p>
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
          <div class="result-stack">${renderStringList(asset.selectedPaths, state.lang === "zh" ? "No selected paths recorded." : "No selected paths recorded.")}</div>
        </article>
        <article class="report-block">
          <div class="report-item-head">
            <h3>${escapeHtml(state.lang === "zh" ? "Notes" : "Notes")}</h3>
            ${renderPill(String(asset.notes?.length || 0))}
          </div>
          <div class="result-stack">${renderStringList(asset.notes, state.lang === "zh" ? "No notes recorded." : "No notes recorded.")}</div>
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
              <small><a class="graph-inline-link" href="${escapeHtml(asset.repoUrl)}" target="_blank" rel="noopener">${escapeHtml(state.lang === "zh" ? "閹垫挸绱戞禒鎾崇氨" : "Open repo")}</a></small>
            </article>
            ${asset.archivePath ? `
              <article class="result-item">
                <h3>${escapeHtml(state.lang === "zh" ? "Archive Path" : "Archive Path")}</h3>
                <p>${escapeHtml(asset.archivePath)}</p>
                <small><a class="graph-inline-link" href="${escapeHtml(archiveHref)}" target="_blank" rel="noopener">${escapeHtml(state.lang === "zh" ? "閹垫挸绱戣ぐ鎺撱€?" : "Open archive")}</a></small>
              </article>
            ` : ""}
          </div>
        </article>
      </aside>
    </div>
  `;
}

export function renderWorkstreamMemoView(ctx, workstreamMemo) {
  const {
    els,
    escapeHtml,
    renderPill,
    formatTime,
    clipBlock,
  } = ctx;

  if (!workstreamMemo) {
    els.researchReport.className = "empty-state";
    els.researchReport.textContent = "No report loaded.";
    return;
  }

  const fileHref = workstreamMemo.path ? `/api/research/artifact?path=${encodeURIComponent(workstreamMemo.path)}` : "";

  els.researchReport.className = "research-report";
  els.researchReport.innerHTML = `
    <article class="report-hero">
      <div class="report-hero__head">
        <div>
          <div class="section-kicker">${escapeHtml("Workstream Memo")}</div>
          <h3>${escapeHtml(`${workstreamMemo.label || workstreamMemo.workstreamId} / ${workstreamMemo.topic || workstreamMemo.taskId}`)}</h3>
          <p>${escapeHtml("Reopen the saved workstream memo without re-running the task.")}</p>
        </div>
        <div class="report-chip-list">
          ${renderPill(workstreamMemo.workstreamId || "-")}
          ${workstreamMemo.taskId ? renderPill(workstreamMemo.taskId) : ""}
          ${workstreamMemo.updatedAt ? renderPill(formatTime(workstreamMemo.updatedAt)) : ""}
        </div>
      </div>
    </article>
    <div class="research-report-layout">
      <div class="stack research-report-main">
        <article class="report-block report-block--feature">
          <div class="report-item-head">
            <h3>${escapeHtml("Memo")}</h3>
            ${renderPill(String((workstreamMemo.content || "").split("\n").length))}
          </div>
          <pre class="code-panel">${escapeHtml(clipBlock(workstreamMemo.content || "", 6000))}</pre>
        </article>
      </div>
      <aside class="stack research-report-side">
        <article class="report-block">
          <div class="report-item-head">
            <h3>${escapeHtml("Artifact")}</h3>
          </div>
          <div class="result-stack">
            <article class="result-item">
              <h3>${escapeHtml("Path")}</h3>
              <p>${escapeHtml(workstreamMemo.path || "-")}</p>
              ${fileHref ? `<small><a class="graph-inline-link" href="${escapeHtml(fileHref)}" target="_blank" rel="noopener">${escapeHtml("Open file")}</a></small>` : ""}
            </article>
          </div>
        </article>
      </aside>
    </div>
  `;
}
