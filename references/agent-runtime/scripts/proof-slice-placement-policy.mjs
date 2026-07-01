export function isAutomatedProofSliceRequired(slice) {
  const gate = field(slice, "manual-environment-gate", "manual").toLowerCase();
  return !gate || gate === "none" || gate === "null";
}

export function isPersistentTestRequired(slice) {
  return slice?.["persistent-test-required"] === true || field(slice, "persistent-test-required", "persistent").toLowerCase() === "true";
}

export function isProofEvidenceRequired(slice) {
  return slice?.["persistent-test-required"] === false || field(slice, "persistent-test-required", "persistent").toLowerCase() === "false";
}

export function isForbiddenTestPlacement(file) {
  const normalized = strip(file).replace(/\\/g, "/");
  if (!normalized) return true;
  if (
    normalized.startsWith("openspec-results/") ||
    normalized.startsWith("test-results/") ||
    normalized.startsWith("openspec/changes/") ||
    normalized.startsWith("tests/runtime/") ||
    normalized.startsWith("scripts/")
  ) {
    return true;
  }
  if (!/(^|\/)tests\//.test(normalized)) {
    return true;
  }
  if (/(^|\/)(?:src|app|cmd|internal|pkg)\//.test(normalized) && /\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(normalized)) {
    return true;
  }
  if (/(^|\/)__tests__\//.test(normalized) && !/(^|\/)tests\//.test(normalized)) {
    return true;
  }
  return false;
}

export function isProofSlicePlacementSupported(slice) {
  return Boolean(field(slice, "primary-layer", "layer"));
}

export function isPlacementAllowed(file) {
  return !isForbiddenTestPlacement(file);
}

function field(slice, kebabName, modelName) {
  return strip(slice?.[kebabName] ?? slice?.[modelName]);
}

function strip(value) {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}
