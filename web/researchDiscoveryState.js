function toItems(run) {
  return Array.isArray(run?.items) ? run.items : [];
}

function toWarnings(run) {
  return Array.isArray(run?.warnings) ? run.warnings : [];
}

export function summarizeDiscoveryCandidateReasons(item) {
  const reasons = [
    ...(Array.isArray(item?.rankingReasons) ? item.rankingReasons : []),
    typeof item?.queryReason === "string" ? item.queryReason : "",
    typeof item?.relevanceReason === "string" ? item.relevanceReason : "",
  ]
    .map((value) => value.trim())
    .filter(Boolean);

  return reasons.slice(0, 3);
}

export function buildDiscoveryRunState(run) {
  const items = toItems(run);
  const warnings = toWarnings(run);

  if (items.length === 0) {
    return {
      kind: "empty",
      tone: "warn",
    };
  }

  if (warnings.length > 0 || items.length < 3) {
    return {
      kind: "weak",
      tone: "warn",
    };
  }

  return {
    kind: "ready",
    tone: "ok",
  };
}
