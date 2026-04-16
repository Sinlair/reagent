const LOW_COVERAGE_THRESHOLD = 0.5;

function toFiniteNumber(value) {
  return Number.isFinite(value) ? value : 0;
}

export function formatResearchCoveragePercent(value) {
  return `${Math.round(toFiniteNumber(value) * 100)}%`;
}

export function deriveResearchEvidenceSupportKind(item) {
  const sourceType = typeof item?.sourceType === "string" ? item.sourceType.toLowerCase() : "";

  if (sourceType === "repo" || sourceType === "repo_link" || sourceType === "code") {
    return "code";
  }

  if (item?.paperId || sourceType === "abstract" || sourceType === "pdf" || sourceType === "metadata") {
    return "paper";
  }

  return "inference";
}

export function summarizeResearchSupportKinds(report) {
  const evidence = Array.isArray(report?.evidence) ? report.evidence : [];
  const findingsCount = Array.isArray(report?.findings) ? report.findings.length : 0;
  const supportedEvidenceCount = toFiniteNumber(report?.critique?.supportedEvidenceCount);
  const unsupportedEvidenceCount = toFiniteNumber(report?.critique?.unsupportedEvidenceCount);
  const kinds = [];
  const seen = new Set();

  for (const item of evidence) {
    const kind = deriveResearchEvidenceSupportKind(item);
    if (!seen.has(kind)) {
      seen.add(kind);
      kinds.push(kind);
    }
  }

  if (evidence.length > 0 && findingsCount > 0 && (supportedEvidenceCount === 0 || unsupportedEvidenceCount > supportedEvidenceCount)) {
    if (!seen.has("inference")) {
      kinds.push("inference");
    }
  }

  return kinds;
}

export function buildResearchReportWarnings(report) {
  const evidence = Array.isArray(report?.evidence) ? report.evidence : [];
  const findingsCount = Array.isArray(report?.findings) ? report.findings.length : 0;
  const supportedEvidenceCount = toFiniteNumber(report?.critique?.supportedEvidenceCount);
  const unsupportedEvidenceCount = toFiniteNumber(report?.critique?.unsupportedEvidenceCount);
  const citationCoverage = toFiniteNumber(report?.critique?.citationCoverage);
  const warnings = [];

  if (evidence.length === 0) {
    warnings.push({ kind: "no_evidence", tone: "danger" });
  }

  if (evidence.length > 0 && findingsCount > 0 && citationCoverage < LOW_COVERAGE_THRESHOLD) {
    warnings.push({
      kind: "low_coverage",
      tone: supportedEvidenceCount === 0 ? "danger" : "warn",
      coverage: citationCoverage,
    });
  }

  if (unsupportedEvidenceCount > 0) {
    warnings.push({
      kind: "unsupported_evidence",
      tone: "warn",
      count: unsupportedEvidenceCount,
    });
  }

  if (evidence.length > 0 && findingsCount > 0 && (supportedEvidenceCount === 0 || unsupportedEvidenceCount > supportedEvidenceCount)) {
    warnings.push({
      kind: "inference_heavy",
      tone: supportedEvidenceCount === 0 ? "danger" : "warn",
      supportedCount: supportedEvidenceCount,
      unsupportedCount: unsupportedEvidenceCount,
    });
  }

  return warnings;
}
