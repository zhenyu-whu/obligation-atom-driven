#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  NO_DELTA_SPECS_COMPLETION_MODE,
  RENDER_CONTRACT_VERSION,
  TRACE_CONTRACT_VERSION,
  TRACE_SCHEMA,
  renderChangeArtifact,
} from "../render-production-artifacts.mjs";

const OBLIGATION_SCHEMA = "production-obligation-atom-driven";
const DEFAULT_SCHEMA = "production-default-acceptance-driven";

const PROPOSAL_TRACE_PATH = "trace/proposal.trace.json";
const DESIGN_TRACE_PATH = "trace/design.trace.json";
const DESIGN_ARTIFACT_PATH = "design.md";
const SPECS_TRACE_DIR = "trace/specs";
const NO_DELTA_TRACE_PATH = "trace/specs/no-spec-delta/README.trace.json";

const GA_ID_RE = /^GA-\d{4}$/u;
const SI_ID_RE = /^SI-\d{3}$/u;
const ANY_GA_ID_RE = /\bGA-\d{4}\b/u;
const ANY_SCOPE_ID_RE = /\bSI-\d{3}\b/u;
const IMPLEMENTATION_DESIGN_ID_RE = /^IDR-\d{3}$/u;
const IMPLEMENTATION_DETAIL_ID_RE = /^(IDR-\d{3})-D\d{3}$/u;
const DELIVERY_LEAK_KEY_RE = /(?:trace|gate|coverage|map|register|matrix)/iu;
const DETAIL_RENDERED_LEAK_RE = /\bGA-\d{4}\b|\bSI-\d{3}\b|(?:^|[/"'`])trace\/|#\//u;
const DELIVERY_DECISION_ALLOWED_FIELDS = new Set(["decision-id"]);
const PLACEHOLDER_RE = /\b(?:TBD|TODO)\b|待定|后续完善|视情况|实现时决定/u;
const JSON_CODE_FENCE_RE = /```json\s*\n([\s\S]*?)\n```/iu;
const CODE_FENCE_RE = /```([a-z0-9_-]*)\s*\n[\s\S]*?\n```/iu;
const MARKDOWN_TABLE_RE = /\|[^\n]*\|\s*\n\|(?:\s*:?-{3,}:?\s*\|)+/u;
const DATA_MODEL_TYPE_RE = /\b(?:type|类型|uuid|varchar|char|text|jsonb?|int|integer|bigint|smallint|boolean|bool|timestamp|timestamptz|datetime|date|decimal|numeric|float|double|enum|String|Boolean|DateTime|Json)\b/u;
const API_METHOD_PATH_RE = /\b(?:GET|POST|PUT|PATCH|DELETE)\b[\s|]+\/[^\s|)]*/u;
const HTTP_STATUS_RE = /\b[245]\d\d\b/u;
const DETAIL_MIN_LINES = {
  "module-boundary": 2,
  "data-model": 4,
  "json-shape": 4,
  "api-contract": 4,
  "dto-contract": 4,
  "frontend-contract": 4,
  "validation-error-contract": 4,
  "state-lifecycle": 4,
  "integration-boundary": 3,
  "migration-compatibility": 3,
  "observability-ops": 3,
  "rollout-compatibility": 3,
  "non-applicable": 2,
};

const DESIGN_LAYERS = new Set([
  "architecture-module-boundary",
  "domain-data-migration",
  "api-auth-security",
  "async-realtime-ai-worker",
  "frontend-ux",
  "observability-ops-deployment",
  "verification-rollout",
]);

const DETAIL_TYPES = new Set([
  "module-boundary",
  "data-model",
  "json-shape",
  "api-contract",
  "dto-contract",
  "frontend-contract",
  "validation-error-contract",
  "state-lifecycle",
  "integration-boundary",
  "migration-compatibility",
  "observability-ops",
  "rollout-compatibility",
  "non-applicable",
]);

const LAYER_DETAIL_COVERAGE = {
  "architecture-module-boundary": ["module-boundary", "integration-boundary"],
  "domain-data-migration": ["data-model", "json-shape", "migration-compatibility"],
  "api-auth-security": ["api-contract", "dto-contract", "validation-error-contract"],
  "async-realtime-ai-worker": ["integration-boundary", "state-lifecycle"],
  "frontend-ux": ["frontend-contract", "state-lifecycle", "validation-error-contract"],
  "observability-ops-deployment": ["observability-ops", "rollout-compatibility"],
  "verification-rollout": ["rollout-compatibility", "observability-ops"],
};

const DESIGN_GATE_FIELDS = [
  "blockers",
  "uncovered-spec-anchors",
  "uncovered-design-inputs",
  "invalid-design-inputs",
  "missing-implementation-details",
  "invalid-implementation-details",
  "detail-basis-violations",
  "layer-detail-coverage-gaps",
  "fragmented-design-subjects",
  "placeholder-detail-content",
  "delivery-projection-mismatch",
];

const LEGACY_DESIGN_FIELDS = [
  "production-source-map",
  "spec-scenario-design-map",
  "design-decision-index",
  "design-obligation-matrix",
  "source-scope-map",
  "ui-control-contracts",
  "proof-expectation-handoff",
  "production-alignment-gate",
];

export function validateDesignArtifact(options = {}) {
  const root = path.resolve(options.root ?? process.cwd());
  const change = strip(options.change);
  const ctx = {
    root,
    change,
    changeDir: path.join(root, "openspec", "changes", change),
    errors: [],
    warnings: [],
  };

  if (!change) {
    addError(ctx, "VAL-CLI-001", ".", "缺少 --change <slug>。");
    return resultFor(ctx);
  }

  if (!fs.existsSync(ctx.changeDir)) {
    addError(ctx, "VAL-CHANGE-001", rel(ctx, ctx.changeDir), `change 目录不存在：${ctx.changeDir}`);
    return resultFor(ctx);
  }

  validateDesignIfPresent(ctx);

  return resultFor(ctx);
}

function validateDesignIfPresent(ctx) {
  const inventory = collectDesignInventory(ctx);
  if (!inventory.hasAnyDesignOutput) {
    addWarning(ctx, "VAL-DESIGN-000", DESIGN_TRACE_PATH, "未发现 design trace/artifact/manifest entry；partial validator 跳过 design。");
    return;
  }

  if (!inventory.traceExists) {
    addError(ctx, "VAL-DESIGN-001", DESIGN_TRACE_PATH, "design artifact 或 manifest entry 已存在，但 trace/design.trace.json 缺失。");
    return;
  }

  const proposalTrace = readJson(ctx, path.join(ctx.changeDir, PROPOSAL_TRACE_PATH));
  const designTrace = readJson(ctx, path.join(ctx.changeDir, DESIGN_TRACE_PATH));
  if (!proposalTrace || !designTrace) return;

  const expected = buildExpectedDesignModel(ctx, proposalTrace);
  if (!expected) return;
  const specs = buildSpecsAnchorModel(ctx, expected);
  if (!specs) return;

  validateCommonDesignTrace(ctx, designTrace, expected, specs);
  validateLegacyFieldsAbsent(ctx, designTrace);
  validateDesignManifest(ctx);
  validateDesignRender(ctx);

  const designModel = validateImplementationDesignRegister(ctx, designTrace, expected, specs);
  validateDesignGate(ctx, designTrace);
  validateDeliveryPlane(ctx, designTrace, expected, designModel);

  if (expected.schemaName === DEFAULT_SCHEMA) {
    validateDefaultTraceHasNoObligationLeak(ctx, designTrace);
  }
}

function collectDesignInventory(ctx) {
  const traceFullPath = path.join(ctx.changeDir, DESIGN_TRACE_PATH);
  const artifactFullPath = path.join(ctx.changeDir, DESIGN_ARTIFACT_PATH);
  const manifestEntries = readManifestEntriesLenient(ctx).filter(isDesignManifestEntry);
  return {
    traceExists: fs.existsSync(traceFullPath),
    artifactExists: fs.existsSync(artifactFullPath),
    manifestEntries,
    hasAnyDesignOutput: fs.existsSync(traceFullPath) || fs.existsSync(artifactFullPath) || manifestEntries.length > 0,
  };
}

function buildExpectedDesignModel(ctx, proposalTrace) {
  const schemaName = strip(proposalTrace["schema-name"]);
  if (schemaName === OBLIGATION_SCHEMA) {
    const register = requireArray(
      ctx,
      "VAL-DESIGN-PROPOSAL-001",
      PROPOSAL_TRACE_PATH,
      proposalTrace["change-ga-register"],
      "change-ga-register",
    );
    return buildExpectedModel({
      schemaName,
      rows: register,
      idField: "ga-id",
      idRegex: GA_ID_RE,
      projectionField: "routing-role",
      specProjection: "spec-requirement",
      guardProjection: "spec-guard",
      designProjection: "design-input",
      routeBacked: true,
    });
  }

  if (schemaName === DEFAULT_SCHEMA) {
    const scopeCoverage = requireArray(
      ctx,
      "VAL-DESIGN-PROPOSAL-010",
      PROPOSAL_TRACE_PATH,
      proposalTrace["change-scope-coverage"],
      "change-scope-coverage",
    );
    return buildExpectedModel({
      schemaName,
      rows: scopeCoverage,
      idField: "scope-item-id",
      idRegex: SI_ID_RE,
      projectionField: "artifact-handling",
      specProjection: "spec",
      guardProjection: "guard",
      designProjection: "design",
    });
  }

  addError(ctx, "VAL-DESIGN-PROPOSAL-020", PROPOSAL_TRACE_PATH, `不支持的 proposal schema-name：${schemaName || "(empty)"}`);
  return null;
}

function buildExpectedModel(config) {
  const rows = [];
  const rowsById = new Map();
  for (const row of config.rows) {
    const id = strip(row?.[config.idField]);
    if (!id) continue;
    const normalizedRow = normalizeExpectedRow(row, config);
    rows.push(normalizedRow);
    if (!rowsById.has(id)) rowsById.set(id, normalizedRow);
  }
  const specRelevantIds = rows
    .filter((row) => config.routeBacked ? row["routed-to-specs"] : isSpecRelevantProjection(strip(row?.[config.projectionField]), config))
    .map((row) => strip(row?.[config.idField]))
    .filter(Boolean);
  const designInputIds = rows
    .filter((row) => config.routeBacked ? row["routed-to-design"] : strip(row?.[config.projectionField]) === config.designProjection)
    .map((row) => strip(row?.[config.idField]))
    .filter(Boolean);
  return {
    ...config,
    rows,
    rowsById,
    ids: rows.map((row) => strip(row?.[config.idField])).filter(Boolean),
    specRelevantIds,
    designInputIds,
  };
}

function normalizeExpectedRow(row, config) {
  if (!config.routeBacked) return row;
  const specRoutes = getArtifactRoutes(row, "specs");
  const designRoutes = getArtifactRoutes(row, "design");
  let routingRole = "";
  if (designRoutes.length > 0) {
    routingRole = "design-input";
  } else if (specRoutes.length > 0) {
    routingRole = specRoutes[0]?.role;
  }
  return {
    ...row,
    "routing-role": routingRole,
    "routed-to-specs": specRoutes.length > 0,
    "routed-to-design": designRoutes.length > 0,
  };
}

function getArtifactRoutes(row, artifact) {
  return asArray(row?.["artifact-routes"]).filter((route) => strip(route?.artifact) === artifact);
}

function buildSpecsAnchorModel(ctx, expected) {
  const tracePaths = listFiles(path.join(ctx.changeDir, SPECS_TRACE_DIR))
    .filter((file) => file.endsWith(".trace.json"))
    .map((file) => toPosix(path.relative(ctx.changeDir, file)))
    .sort();

  if (tracePaths.length === 0) {
    addError(ctx, "VAL-DESIGN-SPECS-001", SPECS_TRACE_DIR, "design 已存在，但未发现 specs trace；design 必须消费已完成 specs trace。");
    return null;
  }

  const hasNoDelta = tracePaths.includes(NO_DELTA_TRACE_PATH);
  if (hasNoDelta && tracePaths.length > 1) {
    addError(ctx, "VAL-DESIGN-SPECS-002", SPECS_TRACE_DIR, "design 输入不能同时包含 no-delta specs marker 和 normal specs traces。");
    return null;
  }

  if (hasNoDelta) {
    const trace = readJson(ctx, path.join(ctx.changeDir, NO_DELTA_TRACE_PATH));
    if (!trace) return null;
    expectEqual(ctx, "VAL-DESIGN-SPECS-003", NO_DELTA_TRACE_PATH, trace["schema-name"], expected.schemaName, "specs schema-name");
    expectEqual(ctx, "VAL-DESIGN-SPECS-004", NO_DELTA_TRACE_PATH, trace["specs-completion-mode"], NO_DELTA_SPECS_COMPLETION_MODE, "specs-completion-mode");
    const deltaRegister = requireArray(ctx, "VAL-DESIGN-SPECS-005", NO_DELTA_TRACE_PATH, trace["spec-delta-register"], "spec-delta-register");
    if (deltaRegister.length !== 0) {
      addError(ctx, "VAL-DESIGN-SPECS-006", NO_DELTA_TRACE_PATH, "no-delta specs trace 的 spec-delta-register 必须为空。");
    }
    if (expected.specRelevantIds.length > 0) {
      addError(ctx, "VAL-DESIGN-SPECS-007", NO_DELTA_TRACE_PATH, "proposal 存在 spec/guard item 时，design 不能消费 no-delta specs marker。");
    }
    return {
      mode: NO_DELTA_SPECS_COMPLETION_MODE,
      tracePaths,
      anchors: [],
      anchorsByPointer: new Map(),
    };
  }

  const anchors = [];
  const anchorsByPointer = new Map();
  for (const tracePath of tracePaths) {
    const trace = readJson(ctx, path.join(ctx.changeDir, tracePath));
    if (!trace) continue;
    expectEqual(ctx, "VAL-DESIGN-SPECS-010", tracePath, trace["artifact-id"], "specs", "artifact-id");
    expectEqual(ctx, "VAL-DESIGN-SPECS-011", tracePath, trace["schema-name"], expected.schemaName, "schema-name");
    expectEqual(ctx, "VAL-DESIGN-SPECS-012", tracePath, trace["specs-completion-mode"], "delta", "specs-completion-mode");

    const deltaRegister = requireArray(ctx, "VAL-DESIGN-SPECS-013", tracePath, trace["spec-delta-register"], "spec-delta-register");
    for (const [deltaIndex, row] of deltaRegister.entries()) {
      const deltaOp = strip(row?.["delta-op"]);
      if (deltaOp !== "added" && deltaOp !== "modified") continue;
      const requirement = requireString(ctx, "VAL-DESIGN-SPECS-014", tracePath, row?.requirement, `spec-delta-register[${deltaIndex}].requirement`);
      const rowSourceIds = validateSpecAnchorSourceIds(ctx, row?.["source-ids"] ?? [], expected, tracePath, `spec-delta-register[${deltaIndex}].source-ids`);
      for (const [scenarioIndex, scenario] of requireArray(ctx, "VAL-DESIGN-SPECS-018", tracePath, row?.scenarios, `spec-delta-register[${deltaIndex}].scenarios`).entries()) {
        const scenarioName = requireString(ctx, "VAL-DESIGN-SPECS-019", tracePath, scenario?.name, `spec-delta-register[${deltaIndex}].scenarios[${scenarioIndex}].name`);
        const sourceIds = validateSpecAnchorSourceIds(
          ctx,
          scenario?.["source-ids"] ?? rowSourceIds,
          expected,
          tracePath,
          `spec-delta-register[${deltaIndex}].scenarios[${scenarioIndex}].source-ids`,
        );
        const tracePointer = `#/spec-delta-register/${deltaIndex}/scenarios/${scenarioIndex}`;
        const pointerKey = anchorPointerKey(tracePath, tracePointer);
        const anchor = {
          pointerKey,
          tracePath,
          tracePointer,
          deltaId: strip(row?.["delta-id"]),
          deltaOp,
          capability: strip(trace.capability),
          requirement,
          scenario: scenarioName,
          sourceIds,
        };
        if (anchorsByPointer.has(pointerKey)) {
          addError(ctx, "VAL-DESIGN-SPECS-017", tracePath, `重复 specs scenario anchor：${pointerKey}`);
        }
        anchors.push(anchor);
        anchorsByPointer.set(pointerKey, anchor);
      }
    }
  }

  return {
    mode: "delta",
    tracePaths,
    anchors,
    anchorsByPointer,
  };
}

function validateCommonDesignTrace(ctx, trace, expected, specs) {
  expectEqual(ctx, "VAL-DESIGN-TRACE-001", DESIGN_TRACE_PATH, trace["trace-schema"], TRACE_SCHEMA, "trace-schema");
  expectEqual(ctx, "VAL-DESIGN-TRACE-002", DESIGN_TRACE_PATH, trace["artifact-id"], "design", "artifact-id");
  expectEqual(ctx, "VAL-DESIGN-TRACE-003", DESIGN_TRACE_PATH, trace["artifact-path"], DESIGN_ARTIFACT_PATH, "artifact-path");
  expectEqual(ctx, "VAL-DESIGN-TRACE-004", DESIGN_TRACE_PATH, trace["change-name"], ctx.change, "change-name");
  expectEqual(ctx, "VAL-DESIGN-TRACE-005", DESIGN_TRACE_PATH, trace["schema-name"], expected.schemaName, "schema-name");
  requireString(ctx, "VAL-DESIGN-TRACE-006", DESIGN_TRACE_PATH, trace["agent-role"], "agent-role");
  const sourceInterface = requireObject(ctx, "VAL-DESIGN-TRACE-007", DESIGN_TRACE_PATH, trace["source-interface"], "source-interface");
  requireObject(ctx, "VAL-DESIGN-TRACE-008", DESIGN_TRACE_PATH, trace["delivery-plane"], "delivery-plane");
  requireArray(ctx, "VAL-DESIGN-TRACE-009", DESIGN_TRACE_PATH, trace["implementation-design-register"], "implementation-design-register");
  requireObject(ctx, "VAL-DESIGN-TRACE-010", DESIGN_TRACE_PATH, trace["design-gate"], "design-gate");

  expectEqual(ctx, "VAL-DESIGN-SOURCE-INTERFACE-001", DESIGN_TRACE_PATH, sourceInterface["proposal-trace"], PROPOSAL_TRACE_PATH, "source-interface.proposal-trace");
  expectEqual(ctx, "VAL-DESIGN-SOURCE-INTERFACE-002", DESIGN_TRACE_PATH, sourceInterface["specs-completion-mode"], specs.mode, "source-interface.specs-completion-mode");
  const specTraces = requireArray(ctx, "VAL-DESIGN-SOURCE-INTERFACE-003", DESIGN_TRACE_PATH, sourceInterface["spec-traces"], "source-interface.spec-traces")
    .map(strip)
    .filter(Boolean);
  expectSameSet(ctx, "VAL-DESIGN-SOURCE-INTERFACE-004", DESIGN_TRACE_PATH, specTraces, specs.tracePaths, "source-interface.spec-traces");
  for (const [field, value] of Object.entries(sourceInterface)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      addError(ctx, "VAL-DESIGN-SOURCE-INTERFACE-005", DESIGN_TRACE_PATH, `source-interface.${field} 必须是字符串或字符串数组，不能内联 object metadata。`);
    }
  }
}

function validateLegacyFieldsAbsent(ctx, trace) {
  for (const field of LEGACY_DESIGN_FIELDS) {
    if (Object.hasOwn(trace, field)) {
      addError(ctx, "VAL-DESIGN-LEGACY-001", DESIGN_TRACE_PATH, `design trace 不得包含旧字段：${field}。`);
    }
  }
}

function validateDesignManifest(ctx) {
  const manifestRelPath = "trace/manifest.json";
  const manifest = readJson(ctx, path.join(ctx.changeDir, manifestRelPath));
  if (!manifest) return;

  expectEqual(ctx, "VAL-DESIGN-MANIFEST-001", manifestRelPath, manifest["trace-schema"], TRACE_SCHEMA, "trace-schema");
  expectEqual(ctx, "VAL-DESIGN-MANIFEST-002", manifestRelPath, manifest["render-contract-version"], RENDER_CONTRACT_VERSION, "render-contract-version");
  expectEqual(ctx, "VAL-DESIGN-MANIFEST-003", manifestRelPath, manifest["trace-contract-version"], TRACE_CONTRACT_VERSION, "trace-contract-version");

  const entries = requireArray(ctx, "VAL-DESIGN-MANIFEST-004", manifestRelPath, manifest.artifacts, "artifacts").filter(isDesignManifestEntry);
  if (entries.length !== 1) {
    addError(ctx, "VAL-DESIGN-MANIFEST-005", manifestRelPath, "manifest 必须有且仅有一个 design -> trace/design.trace.json registry entry。");
    return;
  }
  expectEqual(ctx, "VAL-DESIGN-MANIFEST-006", manifestRelPath, entries[0]["artifact-id"], "design", "design entry artifact-id");
  expectEqual(ctx, "VAL-DESIGN-MANIFEST-007", manifestRelPath, entries[0]["artifact-path"], DESIGN_ARTIFACT_PATH, "design entry artifact-path");
  expectEqual(ctx, "VAL-DESIGN-MANIFEST-008", manifestRelPath, entries[0]["trace-path"], DESIGN_TRACE_PATH, "design entry trace-path");
  expectEqual(ctx, "VAL-DESIGN-MANIFEST-009", manifestRelPath, entries[0]["trace-schema"], TRACE_SCHEMA, "design entry trace-schema");
}

function validateDesignRender(ctx) {
  const artifactFullPath = path.join(ctx.changeDir, DESIGN_ARTIFACT_PATH);
  if (!fs.existsSync(artifactFullPath)) {
    addError(ctx, "VAL-DESIGN-RENDER-001", DESIGN_ARTIFACT_PATH, "design.md 缺失；writer 必须通过 renderer 生成 Markdown。");
    return;
  }

  let rendered;
  try {
    rendered = renderChangeArtifact({
      root: ctx.root,
      change: ctx.change,
      artifact: "design",
    }).markdown;
  } catch (error) {
    addError(ctx, "VAL-DESIGN-RENDER-002", DESIGN_TRACE_PATH, error.message);
    return;
  }

  const actual = fs.readFileSync(artifactFullPath, "utf8");
  if (actual !== rendered) {
    addError(ctx, "VAL-DESIGN-RENDER-003", DESIGN_ARTIFACT_PATH, "design.md 与 renderer 从 trace/design.trace.json 生成的结果不一致。");
  }
}

function validateImplementationDesignRegister(ctx, trace, expected, specs) {
  const rows = requireArray(ctx, "VAL-DESIGN-REGISTER-001", DESIGN_TRACE_PATH, trace["implementation-design-register"], "implementation-design-register");
  const ids = [];
  const seenIds = new Set();
  const actualSpecAnchors = [];
  const actualDesignInputs = [];
  const actualDetailTypes = [];
  const detailSubjectOwners = new Map();
  const seenDetailIds = new Set();

  if (rows.length === 0) {
    addError(ctx, "VAL-DESIGN-REGISTER-002", DESIGN_TRACE_PATH, "implementation-design-register 至少需要一个设计决策 row。");
  }

  for (const [index, row] of rows.entries()) {
    const label = `implementation-design-register[${index}]`;
    const id = requireId(ctx, "VAL-DESIGN-REGISTER-003", DESIGN_TRACE_PATH, row?.["implementation-design-id"], `${label}.implementation-design-id`, IMPLEMENTATION_DESIGN_ID_RE);
    if (id) {
      if (seenIds.has(id)) {
        addError(ctx, "VAL-DESIGN-REGISTER-004", DESIGN_TRACE_PATH, `implementation-design-id 重复：${id}`);
      }
      seenIds.add(id);
      ids.push(id);
    }

    const layer = requireString(ctx, "VAL-DESIGN-REGISTER-005", DESIGN_TRACE_PATH, row?.layer, `${label}.layer`);
    if (layer && !DESIGN_LAYERS.has(layer)) {
      addError(ctx, "VAL-DESIGN-REGISTER-006", DESIGN_TRACE_PATH, `${label}.layer 不在允许集合：${layer}`);
    }

    for (const field of [
      "title",
      "decision",
      "implementation-boundary",
      "implementation-contract",
      "guard-failure-handling",
      "verification-handoff",
      "no-scope-expansion",
    ]) {
      requireString(ctx, "VAL-DESIGN-REGISTER-007", DESIGN_TRACE_PATH, row?.[field], `${label}.${field}`);
    }

    if (!isNoLike(row?.blocker)) {
      addError(ctx, "VAL-DESIGN-REGISTER-008", DESIGN_TRACE_PATH, `${label}.blocker 必须为空、无、None 或 N/A。`);
    }

    const specAnchors = validateRegisterSpecAnchors(ctx, row?.["spec-anchors"], specs, `${label}.spec-anchors`);
    actualSpecAnchors.push(...specAnchors);

    const designInputs = validateRegisterDesignInputs(ctx, row?.["design-inputs"], expected, `${label}.design-inputs`);
    actualDesignInputs.push(...designInputs);

    const detailTypes = validateImplementationDetails(ctx, {
      row,
      label,
      parentId: id,
      layer,
      parentSpecAnchors: specAnchors,
      parentDesignInputs: designInputs,
      seenDetailIds,
      detailSubjectOwners,
    });
    actualDetailTypes.push(...detailTypes);

    if (specAnchors.length === 0 && designInputs.length === 0) {
      addError(ctx, "VAL-DESIGN-REGISTER-009", DESIGN_TRACE_PATH, `${label} 必须至少包含一个 spec-anchors 或 design-inputs。`);
    }
  }

  expectSameSet(
    ctx,
    "VAL-DESIGN-REGISTER-020",
    DESIGN_TRACE_PATH,
    actualSpecAnchors,
    specs.anchors.map((anchor) => anchor.pointerKey),
    "implementation-design-register spec-anchors",
  );
  expectSameSet(
    ctx,
    "VAL-DESIGN-REGISTER-021",
    DESIGN_TRACE_PATH,
    actualDesignInputs,
    expected.designInputIds,
    "implementation-design-register design-inputs",
  );

  return {
    registerIds: ids,
    detailTypes: unique(actualDetailTypes),
  };
}

function validateImplementationDetails(ctx, options) {
  const {
    row,
    label,
    parentId,
    layer,
    parentSpecAnchors,
    parentDesignInputs,
    seenDetailIds,
    detailSubjectOwners,
  } = options;
  const rows = requireArray(ctx, "VAL-DESIGN-DETAIL-001", DESIGN_TRACE_PATH, row?.["implementation-details"], `${label}.implementation-details`);
  const detailTypes = [];

  if (rows.length === 0) {
    addError(ctx, "VAL-DESIGN-DETAIL-002", DESIGN_TRACE_PATH, `${label}.implementation-details 至少需要一个 implementation detail。`);
  }

  for (const [index, detail] of rows.entries()) {
    const detailLabel = `${label}.implementation-details[${index}]`;
    const detailId = requireId(ctx, "VAL-DESIGN-DETAIL-003", DESIGN_TRACE_PATH, detail?.["detail-id"], `${detailLabel}.detail-id`, IMPLEMENTATION_DETAIL_ID_RE);
    if (detailId) {
      const [, detailParentId] = IMPLEMENTATION_DETAIL_ID_RE.exec(detailId) ?? [];
      if (detailParentId !== parentId) {
        addError(ctx, "VAL-DESIGN-DETAIL-004", DESIGN_TRACE_PATH, `${detailLabel}.detail-id 必须以前缀 ${parentId}-D 开头：${detailId}`);
      }
      if (seenDetailIds.has(detailId)) {
        addError(ctx, "VAL-DESIGN-DETAIL-005", DESIGN_TRACE_PATH, `detail-id 重复：${detailId}`);
      }
      seenDetailIds.add(detailId);
    }

    const detailType = requireString(ctx, "VAL-DESIGN-DETAIL-006", DESIGN_TRACE_PATH, detail?.["detail-type"], `${detailLabel}.detail-type`);
    if (detailType) {
      detailTypes.push(detailType);
      if (!DETAIL_TYPES.has(detailType)) {
        addError(ctx, "VAL-DESIGN-DETAIL-007", DESIGN_TRACE_PATH, `${detailLabel}.detail-type 不在允许集合：${detailType}`);
      }
    }

    const owner = requireString(ctx, "VAL-DESIGN-DETAIL-008", DESIGN_TRACE_PATH, detail?.owner, `${detailLabel}.owner`);
    const subject = requireString(ctx, "VAL-DESIGN-DETAIL-009", DESIGN_TRACE_PATH, detail?.subject, `${detailLabel}.subject`);
    if (owner && /[,，;+、]|(?:^|\s)(?:and|和|与)(?:\s|$)/iu.test(owner)) {
      addError(ctx, "VAL-DESIGN-DETAIL-010", DESIGN_TRACE_PATH, `${detailLabel}.owner 必须是单一 production owner。`);
    }
    if (detailType && owner && subject) {
      const subjectKey = `${detailType}\u0000${owner}\u0000${subject}`;
      const existingParentId = detailSubjectOwners.get(subjectKey);
      if (existingParentId && existingParentId !== parentId) {
        addError(ctx, "VAL-DESIGN-DETAIL-030", DESIGN_TRACE_PATH, `${detailLabel} 将同一 detail-type + owner + subject 拆到多个 IDR：${detailType} / ${owner} / ${subject}。`);
      } else if (!existingParentId) {
        detailSubjectOwners.set(subjectKey, parentId);
      }
    }

    validateDetailBasis(ctx, detail?.basis, {
      detailLabel,
      parentSpecAnchors,
      parentDesignInputs,
    });

    let contentText = "";
    if (typeof detail?.content !== "string") {
      addError(ctx, "VAL-DESIGN-DETAIL-011", DESIGN_TRACE_PATH, `${detailLabel}.content 必须是 string，不能是 array 或 object。`);
    } else {
      contentText = detail.content;
      if (!strip(contentText)) {
        addError(ctx, "VAL-DESIGN-DETAIL-012", DESIGN_TRACE_PATH, `${detailLabel}.content 必须包含非空正文。`);
      }
    }
    const noScopeExpansion = requireString(ctx, "VAL-DESIGN-DETAIL-014", DESIGN_TRACE_PATH, detail?.["no-scope-expansion"], `${detailLabel}.no-scope-expansion`);
    validateTechnicalDetailContent(ctx, detailLabel, detailType, contentText);
    validateRenderedDetailText(ctx, detailLabel, {
      "detail-id": detailId,
      "detail-type": detailType,
      owner,
      subject,
      content: contentText,
      "no-scope-expansion": noScopeExpansion,
    });
  }

  validateLayerDetailCoverage(ctx, label, layer, detailTypes);
  return detailTypes;
}

function validateDetailBasis(ctx, value, options) {
  const { detailLabel, parentSpecAnchors, parentDesignInputs } = options;
  const basis = requireObject(ctx, "VAL-DESIGN-DETAIL-BASIS-001", DESIGN_TRACE_PATH, value, `${detailLabel}.basis`);
  const inheritsParentSpecAnchors = requireBoolean(
    ctx,
    "VAL-DESIGN-DETAIL-BASIS-002",
    DESIGN_TRACE_PATH,
    basis["inherits-parent-spec-anchors"],
    `${detailLabel}.basis.inherits-parent-spec-anchors`,
  );
  const specAnchors = requireArray(ctx, "VAL-DESIGN-DETAIL-BASIS-003", DESIGN_TRACE_PATH, basis["spec-anchors"] ?? [], `${detailLabel}.basis.spec-anchors`)
    .map(strip)
    .filter(Boolean);
  if (!inheritsParentSpecAnchors && parentSpecAnchors.length > 0 && specAnchors.length === 0) {
    addError(ctx, "VAL-DESIGN-DETAIL-BASIS-004", DESIGN_TRACE_PATH, `${detailLabel}.basis 未继承父 spec anchors 时必须列出父 spec-anchors 子集。`);
  }
  const parentSpecAnchorSet = new Set(parentSpecAnchors);
  for (const anchor of specAnchors) {
    if (!parentSpecAnchorSet.has(anchor)) {
      addError(ctx, "VAL-DESIGN-DETAIL-BASIS-005", DESIGN_TRACE_PATH, `${detailLabel}.basis.spec-anchors 引用父 IDR 未覆盖的 specs anchor：${anchor}`);
    }
  }

  const designInputs = requireArray(ctx, "VAL-DESIGN-DETAIL-BASIS-006", DESIGN_TRACE_PATH, basis["design-inputs"] ?? [], `${detailLabel}.basis.design-inputs`)
    .map(strip)
    .filter(Boolean);
  const parentDesignInputSet = new Set(parentDesignInputs);
  for (const id of designInputs) {
    if (!parentDesignInputSet.has(id)) {
      addError(ctx, "VAL-DESIGN-DETAIL-BASIS-007", DESIGN_TRACE_PATH, `${detailLabel}.basis.design-inputs 引用父 IDR 未覆盖的 design input：${id}`);
    }
  }
}

function validateRenderedDetailText(ctx, label, fields) {
  for (const [field, value] of Object.entries(fields)) {
    const text = strip(value);
    if (!text) continue;
    if (DETAIL_RENDERED_LEAK_RE.test(text)) {
      addError(ctx, "VAL-DESIGN-DETAIL-020", DESIGN_TRACE_PATH, `${label}.${field} 是 rendered detail 字段，不得包含 GA/SI ID 或 trace pointer。`);
    }
    if (field === "content" || field === "no-scope-expansion") {
      if (PLACEHOLDER_RE.test(text)) {
        addError(ctx, "VAL-DESIGN-DETAIL-021", DESIGN_TRACE_PATH, `${label}.${field} 不得包含 TBD/TODO/待定/后续完善等占位内容。`);
      }
    }
  }
}

function validateTechnicalDetailContent(ctx, label, detailType, contentText) {
  if (!detailType) return;
  const text = String(contentText ?? "");
  const nonEmptyLines = text.split(/\r?\n/u).map(strip).filter(Boolean);
  const minLines = DETAIL_MIN_LINES[detailType];
  if (minLines && nonEmptyLines.length < minLines) {
    addError(ctx, "VAL-DESIGN-DETAIL-050", DESIGN_TRACE_PATH, `${label}.content 对 ${detailType} 必须是至少 ${minLines} 行的结构化技术设计，不能是一行长文本。`);
  }

  if (detailType === "module-boundary") {
    if (!/(?:boundary|边界|responsibilit|职责|owner|归属|module|模块|route|路由|component|组件|dependency|依赖|persistence|持久|API|control-api)/iu.test(text)) {
      addError(ctx, "VAL-DESIGN-DETAIL-058", DESIGN_TRACE_PATH, `${label}.content[module-boundary] 必须明确模块/路由/组件边界、职责归属或依赖方向。`);
    }
  }

  if (detailType === "data-model") {
    if (!(MARKDOWN_TABLE_RE.test(text) || CODE_FENCE_RE.test(text)) || !DATA_MODEL_TYPE_RE.test(text)) {
      addError(ctx, "VAL-DESIGN-DETAIL-051", DESIGN_TRACE_PATH, `${label}.content[data-model] 必须使用 Markdown 表格或 DDL/schema code fence，并明确字段类型。`);
    }
  }

  if (detailType === "json-shape") {
    const jsonBlocks = extractJsonCodeBlocks(text);
    if (jsonBlocks.length === 0) {
      addError(ctx, "VAL-DESIGN-DETAIL-052", DESIGN_TRACE_PATH, `${label}.content[json-shape] 必须包含 fenced json code block。`);
      return;
    }
    for (const [index, block] of jsonBlocks.entries()) {
      try {
        JSON.parse(block);
      } catch (error) {
        addError(ctx, "VAL-DESIGN-DETAIL-053", DESIGN_TRACE_PATH, `${label}.content[json-shape] 第 ${index + 1} 个 json code block 不是合法 JSON：${error.message}`);
      }
    }
  }

  if (detailType === "api-contract") {
    const hasContractShape =
      (API_METHOD_PATH_RE.test(text) && HTTP_STATUS_RE.test(text)) ||
      /```(?:http|openapi|yaml|yml)\s*\n[\s\S]*?\n```/iu.test(text);
    if (!hasContractShape) {
      addError(ctx, "VAL-DESIGN-DETAIL-054", DESIGN_TRACE_PATH, `${label}.content[api-contract] 必须明确 HTTP method/path 与响应状态，或使用 http/openapi/yaml code fence。`);
    }
    if (!/\b(?:request|请求|body|query|params?)\b/iu.test(text) || !/\b(?:response|响应|error|错误)\b/iu.test(text)) {
      addError(ctx, "VAL-DESIGN-DETAIL-055", DESIGN_TRACE_PATH, `${label}.content[api-contract] 必须同时描述 request 和 response/error contract。`);
    }
  }

  if (detailType === "dto-contract") {
    const hasDtoShape =
      /```(?:ts|tsx|typescript|json|jsonschema|schema)\s*\n[\s\S]*?\n```/iu.test(text) ||
      (MARKDOWN_TABLE_RE.test(text) && DATA_MODEL_TYPE_RE.test(text));
    if (!hasDtoShape) {
      addError(ctx, "VAL-DESIGN-DETAIL-056", DESIGN_TRACE_PATH, `${label}.content[dto-contract] 必须包含 TypeScript/JSON schema code fence 或字段类型表。`);
    }
    if (!/\b(?:required|optional|nullable|可选|必填|可空|enum|枚举)\b/iu.test(text)) {
      addError(ctx, "VAL-DESIGN-DETAIL-057", DESIGN_TRACE_PATH, `${label}.content[dto-contract] 必须明确 required/optional/nullable 或 enum 规则。`);
    }
  }

  if (detailType === "frontend-contract") {
    if (!/(?:route|路由|component|组件|state|状态|event|事件|fetch|request|请求|error|错误|loading|validation|校验|UI)/iu.test(text)) {
      addError(ctx, "VAL-DESIGN-DETAIL-059", DESIGN_TRACE_PATH, `${label}.content[frontend-contract] 必须明确 route/component/state/event/data-fetching/error-display 等前端契约。`);
    }
  }

  if (detailType === "validation-error-contract") {
    const checks = [
      /(?:error\s*code|错误码|code|ERR[_-]|\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b)/u,
      /(?:field|path|pointer|字段|路径|定位)/iu,
      /(?:severity|blocking|blocker|warn|warning|级别|阻断|告警)/iu,
      /(?:message|copy|i18n|文案|消息|提示|UI)/iu,
    ];
    if (!checks.every((pattern) => pattern.test(text))) {
      addError(ctx, "VAL-DESIGN-DETAIL-060", DESIGN_TRACE_PATH, `${label}.content[validation-error-contract] 必须明确 error code、field/path、severity/blocking 和 message/UI 定位。`);
    }
  }

  if (detailType === "state-lifecycle") {
    const checks = [
      /(?:state|状态|phase|阶段)/iu,
      /(?:enter|entry|进入|condition|条件)/iu,
      /(?:transition|转移|流转|next|from|to)/iu,
      /(?:failure|rollback|失败|回滚|persist|持久|restore|恢复)/iu,
    ];
    if (!checks.every((pattern) => pattern.test(text))) {
      addError(ctx, "VAL-DESIGN-DETAIL-061", DESIGN_TRACE_PATH, `${label}.content[state-lifecycle] 必须明确 state、进入条件、状态转移和失败/持久化/回滚行为。`);
    }
  }

  if (detailType === "integration-boundary") {
    const checks = [
      /(?:boundary|边界|integration|集成|external|外部|provider|dependency|依赖)/iu,
      /(?:inbound|outbound|调用|输入|输出|protocol|协议|API|queue|event|事件)/iu,
      /(?:failure|timeout|retry|fallback|失败|超时|重试|降级)/iu,
    ];
    if (!checks.every((pattern) => pattern.test(text))) {
      addError(ctx, "VAL-DESIGN-DETAIL-062", DESIGN_TRACE_PATH, `${label}.content[integration-boundary] 必须明确集成边界、调用方向/协议和失败/超时/重试策略。`);
    }
  }

  if (detailType === "migration-compatibility") {
    const checks = [
      /(?:migration|migrate|DDL|backfill|迁移|回填|变更)/iu,
      /(?:compatib|兼容|version|版本|default|默认|legacy|旧)/iu,
      /(?:rollback|roll back|回滚|replay|重放|safe|安全)/iu,
    ];
    if (!checks.every((pattern) => pattern.test(text))) {
      addError(ctx, "VAL-DESIGN-DETAIL-063", DESIGN_TRACE_PATH, `${label}.content[migration-compatibility] 必须明确迁移/回填步骤、兼容策略和回滚/安全边界。`);
    }
  }

  if (detailType === "observability-ops") {
    const signals = [
      /(?:metric|metrics|指标|SLO|SLI)/iu,
      /(?:log|logging|日志)/iu,
      /(?:alert|报警|告警)/iu,
      /(?:dashboard|runbook|trace|tracing|面板|看板|运维手册|追踪)/iu,
    ].filter((pattern) => pattern.test(text)).length;
    if (signals < 2) {
      addError(ctx, "VAL-DESIGN-DETAIL-064", DESIGN_TRACE_PATH, `${label}.content[observability-ops] 必须至少覆盖 metrics/logs/alerts/dashboard/runbook/tracing 中的两类运维信号。`);
    }
  }

  if (detailType === "rollout-compatibility") {
    const checks = [
      /(?:rollout|发布|灰度|上线|deploy|deployment|flag|feature flag|开关)/iu,
      /(?:compatib|兼容|backward|forward|version|版本|client|客户端)/iu,
      /(?:rollback|回滚|disable|禁用|gate|门禁|monitor|监控)/iu,
    ];
    if (!checks.every((pattern) => pattern.test(text))) {
      addError(ctx, "VAL-DESIGN-DETAIL-065", DESIGN_TRACE_PATH, `${label}.content[rollout-compatibility] 必须明确 rollout/flag、兼容策略和回滚/门禁/监控行为。`);
    }
  }

  if (detailType === "non-applicable") {
    if (!/(?:reason|原因|because|由于|not applicable|N\/A|不适用)/iu.test(text) || !/(?:rejected|拒绝|不新增|无须|无需|out of scope|scope 外)/iu.test(text)) {
      addError(ctx, "VAL-DESIGN-DETAIL-066", DESIGN_TRACE_PATH, `${label}.content[non-applicable] 必须明确不适用原因和拒绝的 scope-expanding 行为。`);
    }
  }
}

function extractJsonCodeBlocks(text) {
  const blocks = [];
  const globalJsonFence = new RegExp(JSON_CODE_FENCE_RE.source, "giu");
  for (const match of text.matchAll(globalJsonFence)) {
    blocks.push(match[1].trim());
  }
  return blocks;
}

function validateLayerDetailCoverage(ctx, label, layer, detailTypes) {
  if (!layer || !DESIGN_LAYERS.has(layer)) return;
  const typeSet = new Set(detailTypes);
  if (typeSet.has("non-applicable")) return;
  const required = LAYER_DETAIL_COVERAGE[layer] ?? [];
  if (!required.some((type) => typeSet.has(type))) {
    addError(ctx, "VAL-DESIGN-DETAIL-040", DESIGN_TRACE_PATH, `${label}.implementation-details 缺少 layer=${layer} 所需 detail type：${required.join(" / ")}，或使用 non-applicable。`);
  }
}

function validateRegisterSpecAnchors(ctx, value, specs, label) {
  const anchors = requireArray(ctx, "VAL-DESIGN-SPEC-ANCHOR-001", DESIGN_TRACE_PATH, value ?? [], label)
    .map(strip)
    .filter(Boolean);
  const seen = new Set();
  for (const anchor of anchors) {
    if (seen.has(anchor)) {
      addError(ctx, "VAL-DESIGN-SPEC-ANCHOR-002", DESIGN_TRACE_PATH, `${label} 包含重复 specs anchor：${anchor}`);
    }
    seen.add(anchor);
    if (!specs.anchorsByPointer.has(anchor)) {
      addError(ctx, "VAL-DESIGN-SPEC-ANCHOR-003", DESIGN_TRACE_PATH, `${label} 引用未知 specs scenario anchor：${anchor}`);
    }
  }
  return anchors;
}

function validateRegisterDesignInputs(ctx, value, expected, label) {
  const rows = requireArray(ctx, "VAL-DESIGN-INPUT-001", DESIGN_TRACE_PATH, value ?? [], label);
  const ids = [];
  const seen = new Set();
  for (const [index, row] of rows.entries()) {
    const itemLabel = `${label}[${index}]`;
    const id = requireId(ctx, "VAL-DESIGN-INPUT-002", DESIGN_TRACE_PATH, row?.["source-item-id"], `${itemLabel}.source-item-id`, expected.idRegex);
    if (id) {
      if (seen.has(id)) {
        addError(ctx, "VAL-DESIGN-INPUT-003", DESIGN_TRACE_PATH, `${label} 包含重复 design input：${id}`);
      }
      seen.add(id);
      ids.push(id);

      const proposalRow = expected.rowsById.get(id);
      if (!proposalRow) {
        addError(ctx, "VAL-DESIGN-INPUT-004", DESIGN_TRACE_PATH, `${itemLabel}.source-item-id 不属于 proposal direct source/scope set：${id}`);
      } else if (expected.routeBacked ? !proposalRow["routed-to-design"] : strip(proposalRow?.[expected.projectionField]) !== expected.designProjection) {
        addError(ctx, "VAL-DESIGN-INPUT-005", DESIGN_TRACE_PATH, `${itemLabel}.source-item-id 不是 design 类型 source/scope item：${id}`);
      }
    }
    requireString(ctx, "VAL-DESIGN-INPUT-006", DESIGN_TRACE_PATH, row?.use, `${itemLabel}.use`);
  }
  return ids;
}

function validateDesignGate(ctx, trace) {
  const gate = requireObject(ctx, "VAL-DESIGN-GATE-001", DESIGN_TRACE_PATH, trace["design-gate"], "design-gate");
  for (const field of DESIGN_GATE_FIELDS) {
    const rows = requireArray(ctx, "VAL-DESIGN-GATE-002", DESIGN_TRACE_PATH, gate[field] ?? [], `design-gate.${field}`);
    if (rows.length !== 0) {
      addError(ctx, "VAL-DESIGN-GATE-003", DESIGN_TRACE_PATH, `design-gate.${field} 必须为空；非空表示 design 未闭合。`);
    }
  }
}

function validateDeliveryPlane(ctx, trace, expected, designModel) {
  const delivery = requireObject(ctx, "VAL-DESIGN-DELIVERY-001", DESIGN_TRACE_PATH, trace["delivery-plane"], "delivery-plane");
  const json = JSON.stringify(delivery);
  if (ANY_GA_ID_RE.test(json) || ANY_SCOPE_ID_RE.test(json)) {
    addError(ctx, "VAL-DESIGN-DELIVERY-002", DESIGN_TRACE_PATH, "delivery-plane 不得泄漏 GA/SI trace ID。");
  }
  for (const key of collectObjectKeys(delivery)) {
    if (DELIVERY_LEAK_KEY_RE.test(key)) {
      addError(ctx, "VAL-DESIGN-DELIVERY-003", DESIGN_TRACE_PATH, `delivery-plane 不得包含 trace/gate/coverage/map/register/matrix 字段：${key}`);
    }
  }
  if (expected.schemaName === DEFAULT_SCHEMA && ANY_GA_ID_RE.test(json)) {
    addError(ctx, "VAL-DESIGN-DELIVERY-004", DESIGN_TRACE_PATH, "default design delivery-plane 不得包含 GA-####。");
  }

  const deliveryDecisions = asArray(delivery.decisions);
  const deliveryDecisionIds = [];
  for (const [index, row] of deliveryDecisions.entries()) {
    const decision = requireObject(ctx, "VAL-DESIGN-DELIVERY-020", DESIGN_TRACE_PATH, row, `delivery-plane.decisions[${index}]`);
    for (const key of Object.keys(decision)) {
      if (!DELIVERY_DECISION_ALLOWED_FIELDS.has(key)) {
        addError(ctx, "VAL-DESIGN-DELIVERY-022", DESIGN_TRACE_PATH, `delivery-plane.decisions[${index}] 只能包含 decision-id，不能包含旧 summary 字段：${key}`);
      }
    }
    const decisionId = requireId(ctx, "VAL-DESIGN-DELIVERY-020", DESIGN_TRACE_PATH, decision["decision-id"], `delivery-plane.decisions[${index}].decision-id`, IMPLEMENTATION_DESIGN_ID_RE);
    if (decisionId) deliveryDecisionIds.push(decisionId);
  }
  expectSameSet(ctx, "VAL-DESIGN-DELIVERY-021", DESIGN_TRACE_PATH, deliveryDecisionIds, designModel.registerIds, "delivery-plane decisions vs implementation-design-register");
  validateDetailRenderOrder(ctx, delivery, designModel.detailTypes);
}

function validateDetailRenderOrder(ctx, delivery, actualDetailTypes) {
  const values = requireArray(ctx, "VAL-DESIGN-DELIVERY-030", DESIGN_TRACE_PATH, delivery["detail-render-order"], "delivery-plane.detail-render-order")
    .map(strip)
    .filter(Boolean);
  const seen = new Set();
  for (const detailType of values) {
    if (!DETAIL_TYPES.has(detailType)) {
      addError(ctx, "VAL-DESIGN-DELIVERY-031", DESIGN_TRACE_PATH, `delivery-plane.detail-render-order 包含未知 detail type：${detailType}`);
    }
    if (seen.has(detailType)) {
      addError(ctx, "VAL-DESIGN-DELIVERY-032", DESIGN_TRACE_PATH, `delivery-plane.detail-render-order 重复：${detailType}`);
    }
    seen.add(detailType);
  }
  const missing = unique(actualDetailTypes).filter((detailType) => !seen.has(detailType));
  if (missing.length > 0) {
    addError(ctx, "VAL-DESIGN-DELIVERY-033", DESIGN_TRACE_PATH, `delivery-plane.detail-render-order 缺少实际存在的 detail type：${missing.join(", ")}`);
  }
}

function validateDefaultTraceHasNoObligationLeak(ctx, trace) {
  const text = JSON.stringify(trace ?? {});
  const forbidden = [
    [ANY_GA_ID_RE, "GA-####"],
    [/openspec\/orchestrate/u, "openspec/orchestrate"],
    [/final-packet-index/u, "final-packet-index"],
    [/obligation-atom-index/u, "obligation-atom-index"],
    [/capability-anchors/u, "capability-anchors"],
    [/global-atom-id/u, "global-atom-id"],
    [/global atom index/iu, "global atom index"],
  ];
  for (const [pattern, label] of forbidden) {
    if (pattern.test(text)) {
      addError(ctx, "VAL-DESIGN-DEFAULT-001", DESIGN_TRACE_PATH, `default design trace 不得包含 obligation authority：${label}`);
    }
  }
}

function validateSpecAnchorSourceIds(ctx, value, expected, tracePath, label) {
  const ids = requireIdArray(ctx, "VAL-DESIGN-SPECS-015", tracePath, value, label, expected.idRegex);
  for (const id of ids) {
    if (!expected.rowsById.has(id)) {
      addError(ctx, "VAL-DESIGN-SPECS-016", tracePath, `${id} 不属于 proposal source/scope set。`);
      continue;
    }
    const proposalRow = expected.rowsById.get(id);
    const isSpecRelevant = expected.routeBacked
      ? proposalRow["routed-to-specs"]
      : isSpecRelevantProjection(strip(proposalRow?.[expected.projectionField]), expected);
    if (!isSpecRelevant) {
      addError(ctx, "VAL-DESIGN-SPECS-020", tracePath, `${id} 不是 proposal spec/guard item，不能作为 specs anchor。`);
    }
  }
  return ids;
}

function isSpecRelevantProjection(projection, expected) {
  return projection === expected.specProjection || projection === expected.guardProjection;
}

function anchorPointerKey(tracePath, tracePointer) {
  return `${tracePath}${tracePointer.startsWith("#") ? "" : "#"}${tracePointer}`;
}

function isNoLike(value) {
  const text = strip(value);
  return !text || text === "无" || text === "None" || text === "N/A" || text === "none" || text === "n/a";
}

function readManifestEntriesLenient(ctx) {
  const manifestFullPath = path.join(ctx.changeDir, "trace", "manifest.json");
  if (!fs.existsSync(manifestFullPath)) return [];
  try {
    return asArray(JSON.parse(fs.readFileSync(manifestFullPath, "utf8")).artifacts);
  } catch {
    return [
      {
        "artifact-id": "design",
        "artifact-path": DESIGN_ARTIFACT_PATH,
        "trace-path": DESIGN_TRACE_PATH,
      },
    ];
  }
}

function isDesignManifestEntry(entry) {
  return (
    strip(entry?.["artifact-id"]) === "design" ||
    strip(entry?.["artifact-path"]) === DESIGN_ARTIFACT_PATH ||
    strip(entry?.["trace-path"]) === DESIGN_TRACE_PATH
  );
}

function listFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const output = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      output.push(...listFiles(fullPath));
    } else if (entry.isFile()) {
      output.push(fullPath);
    }
  }
  return output;
}

function readJson(ctx, fullPath) {
  if (!fs.existsSync(fullPath)) {
    addError(ctx, "VAL-JSON-001", rel(ctx, fullPath), "JSON 文件不存在。");
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch (error) {
    addError(ctx, "VAL-JSON-002", rel(ctx, fullPath), `严格 JSON 解析失败：${error.message}`);
    return null;
  }
}

function requireObject(ctx, ruleId, file, value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    addError(ctx, ruleId, file, `${label} 必须是 object。`);
    return {};
  }
  return value;
}

function requireArray(ctx, ruleId, file, value, label) {
  if (!Array.isArray(value)) {
    addError(ctx, ruleId, file, `${label} 必须是 array。`);
    return [];
  }
  return value;
}

function requireString(ctx, ruleId, file, value, label) {
  if (!strip(value)) {
    addError(ctx, ruleId, file, `${label} 必须是非空字符串。`);
    return "";
  }
  return strip(value);
}

function requireBoolean(ctx, ruleId, file, value, label) {
  if (typeof value !== "boolean") {
    addError(ctx, ruleId, file, `${label} 必须是 boolean。`);
    return false;
  }
  return value;
}

function requireId(ctx, ruleId, file, value, label, regex) {
  const id = requireString(ctx, ruleId, file, value, label);
  if (id && !regex.test(id)) {
    addError(ctx, ruleId, file, `${label} 包含非法 ID：${id}`);
  }
  return id;
}

function requireIdArray(ctx, ruleId, file, value, label, regex) {
  const values = requireArray(ctx, ruleId, file, value, label).map(strip).filter(Boolean);
  const seen = new Set();
  for (const id of values) {
    if (!regex.test(id)) {
      addError(ctx, ruleId, file, `${label} 包含非法 ID：${id}`);
    }
    if (seen.has(id)) {
      addError(ctx, ruleId, file, `${label} 包含重复 ID：${id}`);
    }
    seen.add(id);
  }
  return values;
}

function expectEqual(ctx, ruleId, file, actual, expected, label) {
  if (actual !== expected) {
    addError(ctx, ruleId, file, `${label} 不一致：实际 ${formatValue(actual)}，期望 ${formatValue(expected)}。`);
  }
}

function expectSameSet(ctx, ruleId, file, actualValues, expectedValues, label) {
  const actual = unique(actualValues.map(strip).filter(Boolean));
  const expected = unique(expectedValues.map(strip).filter(Boolean));
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = expected.filter((value) => !actualSet.has(value));
  const extra = actual.filter((value) => !expectedSet.has(value));
  if (missing.length > 0 || extra.length > 0) {
    const parts = [];
    if (missing.length > 0) parts.push(`缺失 ${missing.join(", ")}`);
    if (extra.length > 0) parts.push(`多出 ${extra.join(", ")}`);
    addError(ctx, ruleId, file, `${label} 集合不一致：${parts.join("；")}。`);
  }
}

function collectObjectKeys(value, keys = []) {
  if (!value || typeof value !== "object") return keys;
  if (Array.isArray(value)) {
    for (const item of value) collectObjectKeys(item, keys);
    return keys;
  }
  for (const [key, child] of Object.entries(value)) {
    keys.push(key);
    collectObjectKeys(child, keys);
  }
  return keys;
}

function addError(ctx, ruleId, file, message) {
  ctx.errors.push({ level: "error", ruleId, file, message });
}

function addWarning(ctx, ruleId, file, message) {
  ctx.warnings.push({ level: "warning", ruleId, file, message });
}

function resultFor(ctx) {
  return {
    ok: ctx.errors.length === 0,
    errors: ctx.errors,
    warnings: ctx.warnings,
  };
}

function formatResult(result, options = {}) {
  const lines = [];
  lines.push(`${result.ok ? "PASS" : "FAIL"} validate-design-artifact${options.change ? ` --change ${options.change}` : ""}`);
  if (result.errors.length > 0) {
    lines.push("");
    lines.push("Errors:");
    for (const item of result.errors) {
      lines.push(`- ${item.ruleId} ${item.file}: ${item.message}`);
    }
  }
  if (result.warnings.length > 0) {
    lines.push("");
    lines.push("Warnings:");
    for (const item of result.warnings) {
      lines.push(`- ${item.ruleId} ${item.file}: ${item.message}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--change") options.change = argv[++index];
    else if (arg === "--root") options.root = argv[++index];
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function usage() {
  return `Usage:
  node openspec/agent-runtime/scripts/validators/validate-design-artifact.mjs --change <slug> [--root <path>]
`;
}

function rel(ctx, fullPath) {
  return path.relative(ctx.root, fullPath) || ".";
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function strip(value) {
  return String(value ?? "").trim();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function unique(values) {
  return [...new Set(values)];
}

function formatValue(value) {
  if (typeof value === "string") return `"${value}"`;
  return JSON.stringify(value);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(usage());
      process.exit(0);
    }
    const result = validateDesignArtifact(options);
    process.stdout.write(formatResult(result, options));
    process.exit(result.ok ? 0 : 1);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
