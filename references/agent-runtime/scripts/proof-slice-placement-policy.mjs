export function isAutomatedProofSliceRequired(slice) {
  return field(slice, "proof-evidence-mode", "evidenceMode") !== "manual-environment";
}

export function isPersistentTestRequired(slice) {
  return field(slice, "proof-evidence-mode", "evidenceMode") === "durable-test";
}

export function isProofEvidenceRequired(slice) {
  const mode = field(slice, "proof-evidence-mode", "evidenceMode");
  return Boolean(mode && mode !== "durable-test");
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

export function isForbiddenPlannedTestDirectory(directory) {
  const normalized = normalizeDirectory(directory);
  if (!normalized || normalized === "N/A") return true;
  if (!normalized.endsWith("/**")) return true;
  if (/\.(?:test|spec)\.[cm]?[jt]sx?(?:\/|$)/u.test(normalized)) return true;
  return isForbiddenTestPlacement(normalized.slice(0, -3));
}

export function isProofSlicePlacementSupported(slice) {
  const placement = placementFor(slice);
  if (isProofEvidenceRequired(slice)) {
    return placement.directory === "N/A";
  }
  return isPlannedDirectoryAllowedForLayer(placement.directory, field(slice, "test-layer", "layer"));
}

export function isPlacementAllowed(file, slice = {}) {
  return !isForbiddenTestPlacement(file) && isActualFileWithinPlannedDirectory(file, slice);
}

export function isActualFileWithinPlannedDirectory(file, slice = {}) {
  const normalizedFile = strip(file).replace(/\\/g, "/");
  const plannedDirectory = placementFor(slice).directory;
  if (!normalizedFile || isForbiddenTestPlacement(normalizedFile)) return false;
  if (!isPlannedDirectoryGlob(plannedDirectory)) return false;
  const prefix = normalizeDirectory(plannedDirectory).slice(0, -3);
  return normalizedFile.startsWith(`${prefix}/`) && normalizedFile.length > prefix.length + 1;
}

export function placementFor(slice = {}) {
  return {
    directory: normalizeDirectory(slice?.["planned-test-directory"]),
    basis: isPersistentTestRequired(slice) ? "durable-test" : "nonpersistent-evidence",
    reason: strip(slice?.["non-persistent-reason"]),
  };
}

export function isPlannedDirectoryGlob(directory) {
  const normalized = normalizeDirectory(directory);
  return Boolean(normalized && normalized !== "N/A" && normalized.endsWith("/**") && /(^|\/)tests\//.test(normalized));
}

export function isPlannedDirectoryAllowedForLayer(directory, layer) {
  const normalized = normalizeDirectory(directory);
  const testKind = testSubdirectoryKind(normalized);
  if (!testKind || isForbiddenPlannedTestDirectory(normalized)) return false;

  switch (strip(layer)) {
    case "unit":
      return testKind === "unit";
    case "component":
      return testKind === "component";
    case "route/API":
      return testKind === "api" || testKind === "contract";
    case "DB/integration":
      return testKind === "integration";
    case "contract":
      return testKind === "contract";
    case "worker/job":
      return testKind === "worker";
    case "realtime/SSE":
      return testKind === "integration";
    case "browser/e2e":
    case "visual/responsive":
      return testKind === "e2e";
    case "security/negative":
      return ["security", "api", "contract", "integration", "component", "e2e", "unit", "worker"].includes(testKind);
    default:
      return false;
  }
}

function testSubdirectoryKind(directory) {
  const normalized = normalizeDirectory(directory);
  const match = normalized.match(/(^|\/)tests\/([^/]+)/u);
  return match ? match[2] : "";
}

function normalizeDirectory(directory) {
  const value = strip(directory).replace(/\\/g, "/").replace(/\/+/g, "/");
  return value.replace(/\/$/u, "");
}

function field(slice, kebabName, modelName) {
  return strip(slice?.[kebabName] ?? slice?.[modelName]);
}

function strip(value) {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}
