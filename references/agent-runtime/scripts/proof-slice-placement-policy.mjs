export function isAutomatedProofSliceRequired(slice) {
  const gate = field(slice, "manual-environment-gate", "manual").toLowerCase();
  return !gate || gate === "none" || gate === "null";
}

export function isProofSlicePlacementSupported(slice) {
  const owner = ownerFor(slice);
  const layer = layerFor(slice);

  if (!owner || !layer) return false;

  if (layer === "browser/e2e" || layer === "visual/responsive") {
    return true;
  }
  if (layer === "worker/job") {
    return true;
  }
  if (owner === "apps/web") {
    return (
      layer === "component" ||
      layer === "route/API" ||
      layer === "realtime/SSE" ||
      layer === "security/negative"
    );
  }
  if (/^packages\/[^/]+$/.test(owner)) {
    return (
      layer === "unit" ||
      layer === "contract" ||
      layer === "route/API" ||
      layer === "DB/integration" ||
      layer === "security/negative"
    );
  }
  return false;
}

export function isPlacementAllowed(file, slice) {
  const normalized = strip(file).replace(/\\/g, "/");
  const owner = ownerFor(slice);
  const layer = layerFor(slice);
  if (!normalized) return false;

  if (layer === "browser/e2e" || layer === "visual/responsive") {
    return normalized.startsWith("apps/web/tests/e2e/");
  }
  if (layer === "worker/job") {
    return normalized.startsWith("apps/worker/tests/");
  }
  if (owner === "apps/web") {
    if (layer === "component") return normalized.startsWith("apps/web/tests/component/");
    if (layer === "route/API") return normalized.startsWith("apps/web/tests/api/");
    if (layer === "realtime/SSE") {
      return normalized.startsWith("apps/web/tests/integration/") || normalized.startsWith("apps/web/tests/api/");
    }
    if (layer === "security/negative") {
      return /^apps\/web\/tests\/(?:api|component|e2e|integration)\//.test(normalized);
    }
  }

  const packageMatch = owner.match(/^packages\/([^/]+)$/);
  if (packageMatch) {
    const base = `packages/${packageMatch[1]}/tests/`;
    if (layer === "unit") return normalized.startsWith(`${base}unit/`);
    if (layer === "contract" || layer === "route/API") return normalized.startsWith(`${base}contract/`);
    if (layer === "DB/integration") return normalized.startsWith(`${base}integration/`);
    if (layer === "security/negative") {
      return (
        normalized.startsWith(`${base}unit/`) ||
        normalized.startsWith(`${base}contract/`) ||
        normalized.startsWith(`${base}integration/`)
      );
    }
  }
  return false;
}

function ownerFor(slice) {
  return field(slice, "production-owner", "owner").replace(/`/g, "");
}

function layerFor(slice) {
  return field(slice, "primary-layer", "layer");
}

function field(slice, kebabName, modelName) {
  return strip(slice?.[kebabName] ?? slice?.[modelName]);
}

function strip(value) {
  return typeof value === "string" ? value.trim() : "";
}
