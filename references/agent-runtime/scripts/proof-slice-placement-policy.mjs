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
  if (owner === "apps/web" || owner === "apps/console-web") {
    return (
      layer === "component" ||
      layer === "route/API" ||
      layer === "realtime/SSE" ||
      layer === "security/negative"
    );
  }
  if (owner === "apps/control-api") {
    return (
      layer === "unit" ||
      layer === "route/API" ||
      layer === "DB/integration" ||
      layer === "security/negative"
    );
  }
  if (owner === "apps/control-worker") {
    return (
      layer === "unit" ||
      layer === "worker/job" ||
      layer === "DB/integration" ||
      layer === "security/negative"
    );
  }
  if (owner === "apps/executor-go") {
    return (
      layer === "unit" ||
      layer === "route/API" ||
      layer === "contract" ||
      layer === "security/negative"
    );
  }
  if (owner === "infra/docker-compose" || owner === "infra/k8s") {
    return (
      layer === "contract" ||
      layer === "DB/integration" ||
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
    if (owner === "apps/console-web") return normalized.startsWith("apps/console-web/tests/e2e/");
    return normalized.startsWith("apps/web/tests/e2e/");
  }
  if (layer === "worker/job") {
    if (owner === "apps/control-worker") return normalized.startsWith("apps/control-worker/tests/");
    return normalized.startsWith("apps/worker/tests/");
  }
  if (owner === "apps/web" || owner === "apps/console-web") {
    const appBase = owner === "apps/console-web" ? "apps/console-web/tests" : "apps/web/tests";
    if (layer === "component") return normalized.startsWith(`${appBase}/component/`);
    if (layer === "route/API") return normalized.startsWith(`${appBase}/api/`);
    if (layer === "realtime/SSE") {
      return normalized.startsWith(`${appBase}/integration/`) || normalized.startsWith(`${appBase}/api/`);
    }
    if (layer === "security/negative") {
      return new RegExp(`^${appBase.replaceAll("/", "\\/")}\\/(?:api|component|e2e|integration)\\/`).test(normalized);
    }
  }
  if (owner === "apps/control-api") {
    if (layer === "unit") return normalized.startsWith("apps/control-api/tests/unit/");
    if (layer === "route/API") return normalized.startsWith("apps/control-api/tests/api/");
    if (layer === "DB/integration") return normalized.startsWith("apps/control-api/tests/integration/");
    if (layer === "security/negative") {
      return /^apps\/control-api\/tests\/(?:api|integration|unit)\//.test(normalized);
    }
  }
  if (owner === "apps/control-worker") {
    if (layer === "unit") return normalized.startsWith("apps/control-worker/tests/unit/");
    if (layer === "worker/job") return normalized.startsWith("apps/control-worker/tests/");
    if (layer === "DB/integration") return normalized.startsWith("apps/control-worker/tests/integration/");
    if (layer === "security/negative") {
      return /^apps\/control-worker\/tests\/(?:integration|unit)\//.test(normalized);
    }
  }
  if (owner === "apps/executor-go") {
    if (layer === "unit") return normalized.startsWith("apps/executor-go/tests/unit/");
    if (layer === "route/API" || layer === "contract") return normalized.startsWith("apps/executor-go/tests/contract/");
    if (layer === "security/negative") {
      return /^apps\/executor-go\/tests\/(?:contract|unit)\//.test(normalized);
    }
  }
  if (owner === "infra/docker-compose" || owner === "infra/k8s") {
    const infraBase = owner === "infra/docker-compose" ? "infra/docker-compose/tests" : "infra/k8s/tests";
    if (layer === "contract") return normalized.startsWith(`${infraBase}/contract/`);
    if (layer === "DB/integration") return normalized.startsWith(`${infraBase}/integration/`);
    if (layer === "security/negative") {
      return normalized.startsWith(`${infraBase}/contract/`) || normalized.startsWith(`${infraBase}/integration/`);
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
