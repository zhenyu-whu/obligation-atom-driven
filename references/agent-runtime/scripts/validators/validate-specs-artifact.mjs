#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  NO_DELTA_SPECS_ARTIFACT_PATH,
  NO_DELTA_SPECS_COMPLETION_MODE,
  RENDER_CONTRACT_VERSION,
  TRACE_CONTRACT_VERSION,
  TRACE_SCHEMA,
  renderChangeArtifact,
} from "../render-production-artifacts.mjs";

const OBLIGATION_SCHEMA = "production-obligation-atom-driven";
const DEFAULT_SCHEMA = "production-default-acceptance-driven";

const PROPOSAL_TRACE_PATH = "trace/proposal.trace.json";
const SPECS_TRACE_DIR = "trace/specs";
const SPECS_ARTIFACT_DIR = "specs";
const NO_DELTA_TRACE_PATH = "trace/specs/no-spec-delta/README.trace.json";

const GA_ID_RE = /^GA-\d{4}$/u;
const SI_ID_RE = /^SI-\d{3}$/u;
const ANY_GA_ID_RE = /GA-\d{4}/u;
const ANY_SCOPE_ID_RE = /SI-\d{3}/u;

const OBLIGATION_SPEC_PROJECTIONS = new Set(["spec-requirement", "spec-guard"]);
const DEFAULT_SPEC_HANDLINGS = new Set(["spec", "guard"]);
const GUARD_HANDLINGS = new Set(["must-not", "preserve-boundary", "non-goal"]);
const DELIVERY_LEAK_KEY_RE = /(?:trace|gate|coverage|map)/iu;

export function validateSpecsArtifact(options = {}) {
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

  validateSpecsIfPresent(ctx);

  return resultFor(ctx);
}

function validateSpecsIfPresent(ctx) {
  const inventory = collectSpecsInventory(ctx);
  if (!inventory.hasAnySpecsOutput) {
    addWarning(ctx, "VAL-SPECS-000", SPECS_TRACE_DIR, "未发现 specs trace/artifact/manifest entry；partial validator 跳过 specs。");
    return;
  }

  const proposalTrace = readJson(ctx, path.join(ctx.changeDir, PROPOSAL_TRACE_PATH));
  if (!proposalTrace) return;

  const expected = buildExpectedSpecsModel(ctx, proposalTrace);
  if (!expected) return;

  validateInventoryShape(ctx, inventory, expected);
  validateSpecsManifest(ctx, expected.expectedEntries);

  if (expected.noDeltaExpected) {
    validateNoDeltaSpecsTrace(ctx, expected);
    validateSpecsRender(ctx, { noDelta: true, artifactPath: NO_DELTA_SPECS_ARTIFACT_PATH, tracePath: NO_DELTA_TRACE_PATH });
    return;
  }

  for (const group of expected.groups.values()) {
    const tracePath = `trace/specs/${group.capability}.trace.json`;
    const artifactPath = `specs/${group.capability}/spec.md`;
    const trace = readJson(ctx, path.join(ctx.changeDir, tracePath));
    if (!trace) continue;
    validateNormalSpecsTrace(ctx, trace, group, expected, tracePath, artifactPath);
    validateSpecsRender(ctx, { capability: group.capability, artifactPath, tracePath });
  }
}

function collectSpecsInventory(ctx) {
  const tracePaths = listFiles(path.join(ctx.changeDir, SPECS_TRACE_DIR))
    .filter((file) => file.endsWith(".trace.json"))
    .map((file) => toPosix(path.relative(ctx.changeDir, file)))
    .sort();
  const artifactPaths = listFiles(path.join(ctx.changeDir, SPECS_ARTIFACT_DIR))
    .filter((file) => file.endsWith(".md"))
    .map((file) => toPosix(path.relative(ctx.changeDir, file)))
    .sort();
  const manifestEntries = readManifestEntriesLenient(ctx).filter(isSpecsManifestEntry);

  return {
    tracePaths,
    artifactPaths,
    manifestEntries,
    hasAnySpecsOutput: tracePaths.length > 0 || artifactPaths.length > 0 || manifestEntries.length > 0,
  };
}

function buildExpectedSpecsModel(ctx, proposalTrace) {
  const schemaName = strip(proposalTrace["schema-name"]);
  if (schemaName === OBLIGATION_SCHEMA) {
    return buildObligationExpectedSpecsModel(ctx, proposalTrace);
  }
  if (schemaName === DEFAULT_SCHEMA) {
    return buildDefaultExpectedSpecsModel(ctx, proposalTrace);
  }
  addError(ctx, "VAL-SPECS-PROPOSAL-001", PROPOSAL_TRACE_PATH, `不支持的 proposal schema-name：${schemaName || "(empty)"}`);
  return null;
}

function buildObligationExpectedSpecsModel(ctx, proposalTrace) {
  const register = requireArray(
    ctx,
    "VAL-SPECS-PROPOSAL-010",
    PROPOSAL_TRACE_PATH,
    proposalTrace["change-atom-coverage-register"],
    "change-atom-coverage-register",
  );
  const rows = [];
  const rowsById = new Map();
  for (const [index, row] of register.entries()) {
    const projection = strip(row?.["artifact-projection"]);
    if (!OBLIGATION_SPEC_PROJECTIONS.has(projection)) continue;

    const id = requireId(ctx, "VAL-SPECS-PROPOSAL-011", PROPOSAL_TRACE_PATH, row?.["global-atom-id"], `change-atom-coverage-register[${index}].global-atom-id`, GA_ID_RE);
    if (!id) continue;
    const relation = strip(row?.["atom-relation"]);
    const coverageStatus = strip(row?.["coverage-status"]);
    if (relation !== "direct" || coverageStatus !== "direct") {
      addError(ctx, "VAL-SPECS-PROPOSAL-012", PROPOSAL_TRACE_PATH, `${id} 是 specs projection，但不是 direct proposal register row。`);
      continue;
    }
    if (rowsById.has(id)) {
      addError(ctx, "VAL-SPECS-PROPOSAL-013", PROPOSAL_TRACE_PATH, `change-atom-coverage-register global-atom-id 重复：${id}`);
      continue;
    }
    rows.push(row);
    rowsById.set(id, row);
  }

  return buildExpectedModel({
    schemaName: OBLIGATION_SCHEMA,
    idField: "global-atom-id",
    idRegex: GA_ID_RE,
    capabilityField: "owner-capability",
    projectionField: "artifact-projection",
    requirementProjection: "spec-requirement",
    guardProjection: "spec-guard",
    traceCapabilityField: "owner-capability",
    sourceFields: ["source-document", "lines", "source-fact"],
    gateGroupField: "spec-relevant-atoms",
    gateOrphanField: "orphan-spec-atoms",
    mapCapabilityField: "owner-capability",
    mapRequirementIdsField: "spec-requirement-ids",
    mapGuardIdsField: "spec-guard-ids",
    rows,
    rowsById,
  });
}

function buildDefaultExpectedSpecsModel(ctx, proposalTrace) {
  const scopeCoverage = requireArray(
    ctx,
    "VAL-SPECS-PROPOSAL-020",
    PROPOSAL_TRACE_PATH,
    proposalTrace["change-scope-coverage"],
    "change-scope-coverage",
  );
  const rows = [];
  const rowsById = new Map();
  for (const [index, row] of scopeCoverage.entries()) {
    const handling = strip(row?.["artifact-handling"]);
    if (!DEFAULT_SPEC_HANDLINGS.has(handling)) continue;

    const id = requireId(ctx, "VAL-SPECS-PROPOSAL-021", PROPOSAL_TRACE_PATH, row?.["scope-item-id"], `change-scope-coverage[${index}].scope-item-id`, SI_ID_RE);
    if (!id) continue;
    if (rowsById.has(id)) {
      addError(ctx, "VAL-SPECS-PROPOSAL-022", PROPOSAL_TRACE_PATH, `change-scope-coverage scope-item-id 重复：${id}`);
      continue;
    }
    rows.push(row);
    rowsById.set(id, row);
  }

  return buildExpectedModel({
    schemaName: DEFAULT_SCHEMA,
    idField: "scope-item-id",
    idRegex: SI_ID_RE,
    capabilityField: "capability",
    projectionField: "artifact-handling",
    requirementProjection: "spec",
    guardProjection: "guard",
    traceCapabilityField: "capability",
    sourceFields: ["source", "source-fact"],
    gateGroupField: "spec-relevant-scope-items",
    gateOrphanField: "orphan-spec-scope-items",
    mapCapabilityField: "capability",
    mapRequirementIdsField: "spec-scope-item-ids",
    mapGuardIdsField: "guard-scope-item-ids",
    rows,
    rowsById,
  });
}

function buildExpectedModel(config) {
  const groups = new Map();
  for (const row of config.rows) {
    const capability = strip(row?.[config.capabilityField]);
    if (!groups.has(capability)) {
      groups.set(capability, {
        capability,
        rows: [],
        rowsById: new Map(),
        requirementIds: [],
        guardIds: [],
        ids: [],
      });
    }
    const id = strip(row?.[config.idField]);
    const projection = strip(row?.[config.projectionField]);
    const group = groups.get(capability);
    group.rows.push(row);
    group.rowsById.set(id, row);
    group.ids.push(id);
    if (projection === config.requirementProjection) group.requirementIds.push(id);
    if (projection === config.guardProjection) group.guardIds.push(id);
  }

  const expectedEntries = config.rows.length === 0
    ? [
        {
          artifactPath: NO_DELTA_SPECS_ARTIFACT_PATH,
          tracePath: NO_DELTA_TRACE_PATH,
        },
      ]
    : [...groups.values()].map((group) => ({
        artifactPath: `specs/${group.capability}/spec.md`,
        tracePath: `trace/specs/${group.capability}.trace.json`,
      }));

  return {
    ...config,
    groups,
    expectedEntries,
    noDeltaExpected: config.rows.length === 0,
    expectedIds: config.rows.map((row) => strip(row?.[config.idField])).filter(Boolean),
  };
}

function validateInventoryShape(ctx, inventory, expected) {
  const expectedTracePaths = expected.expectedEntries.map((entry) => entry.tracePath);
  const expectedArtifactPaths = expected.expectedEntries.map((entry) => entry.artifactPath);
  const manifestTracePaths = inventory.manifestEntries.map((entry) => strip(entry["trace-path"])).filter(Boolean);
  const manifestArtifactPaths = inventory.manifestEntries.map((entry) => strip(entry["artifact-path"])).filter(Boolean);

  if (expected.noDeltaExpected) {
    const normalTracePaths = inventory.tracePaths.filter((tracePath) => tracePath !== NO_DELTA_TRACE_PATH);
    const normalArtifactPaths = inventory.artifactPaths.filter((artifactPath) => artifactPath !== NO_DELTA_SPECS_ARTIFACT_PATH);
    const normalManifestEntries = inventory.manifestEntries.filter((entry) => strip(entry["trace-path"]) !== NO_DELTA_TRACE_PATH);
    if (normalTracePaths.length > 0 || normalArtifactPaths.length > 0 || normalManifestEntries.length > 0) {
      addError(ctx, "VAL-SPECS-MODE-001", SPECS_TRACE_DIR, "proposal 没有 spec-relevant item 时，只允许 no-delta specs marker，不允许 normal specs delta。");
    }
  } else {
    const hasNoDelta =
      inventory.tracePaths.includes(NO_DELTA_TRACE_PATH) ||
      inventory.artifactPaths.includes(NO_DELTA_SPECS_ARTIFACT_PATH) ||
      inventory.manifestEntries.some((entry) => strip(entry["trace-path"]) === NO_DELTA_TRACE_PATH);
    if (hasNoDelta) {
      addError(ctx, "VAL-SPECS-MODE-002", NO_DELTA_TRACE_PATH, "proposal 存在 spec-relevant item 时，不允许 no-delta specs marker。");
    }
  }

  expectSameSet(ctx, "VAL-SPECS-INVENTORY-001", SPECS_TRACE_DIR, inventory.tracePaths, expectedTracePaths, "specs trace files");
  expectSameSet(ctx, "VAL-SPECS-INVENTORY-002", SPECS_ARTIFACT_DIR, inventory.artifactPaths, expectedArtifactPaths, "specs artifact files");
  expectSameSet(ctx, "VAL-SPECS-INVENTORY-003", "trace/manifest.json", manifestTracePaths, expectedTracePaths, "manifest specs trace entries");
  expectSameSet(ctx, "VAL-SPECS-INVENTORY-004", "trace/manifest.json", manifestArtifactPaths, expectedArtifactPaths, "manifest specs artifact entries");
}

function validateSpecsManifest(ctx, expectedEntries) {
  const manifestRelPath = "trace/manifest.json";
  const manifest = readJson(ctx, path.join(ctx.changeDir, manifestRelPath));
  if (!manifest) return;

  expectEqual(ctx, "VAL-SPECS-MANIFEST-001", manifestRelPath, manifest["trace-schema"], TRACE_SCHEMA, "trace-schema");
  expectEqual(ctx, "VAL-SPECS-MANIFEST-002", manifestRelPath, manifest["render-contract-version"], RENDER_CONTRACT_VERSION, "render-contract-version");
  expectEqual(ctx, "VAL-SPECS-MANIFEST-003", manifestRelPath, manifest["trace-contract-version"], TRACE_CONTRACT_VERSION, "trace-contract-version");

  const specsEntries = requireArray(ctx, "VAL-SPECS-MANIFEST-004", manifestRelPath, manifest.artifacts, "artifacts")
    .filter(isSpecsManifestEntry);
  const expectedPairs = expectedEntries.map((entry) => `${entry.artifactPath} -> ${entry.tracePath}`);
  const actualPairs = specsEntries.map((entry) => `${strip(entry["artifact-path"])} -> ${strip(entry["trace-path"])}`);
  expectSameSet(ctx, "VAL-SPECS-MANIFEST-005", manifestRelPath, actualPairs, expectedPairs, "manifest specs registry entries");

  for (const entry of specsEntries) {
    expectEqual(ctx, "VAL-SPECS-MANIFEST-006", manifestRelPath, entry["artifact-id"], "specs", "specs entry artifact-id");
    expectEqual(ctx, "VAL-SPECS-MANIFEST-007", manifestRelPath, entry["trace-schema"], TRACE_SCHEMA, "specs entry trace-schema");
  }
}

function validateNoDeltaSpecsTrace(ctx, expected) {
  const trace = readJson(ctx, path.join(ctx.changeDir, NO_DELTA_TRACE_PATH));
  if (!trace) return;

  validateCommonTraceFields(ctx, trace, expected, NO_DELTA_TRACE_PATH, NO_DELTA_SPECS_ARTIFACT_PATH);
  expectEqual(ctx, "VAL-SPECS-NO-DELTA-001", NO_DELTA_TRACE_PATH, trace["specs-completion-mode"], NO_DELTA_SPECS_COMPLETION_MODE, "specs-completion-mode");

  const sourceTrace = requireArray(ctx, "VAL-SPECS-NO-DELTA-002", NO_DELTA_TRACE_PATH, trace["requirement-source-trace"], "requirement-source-trace");
  if (sourceTrace.length !== 0) {
    addError(ctx, "VAL-SPECS-NO-DELTA-003", NO_DELTA_TRACE_PATH, "no-delta specs trace 的 requirement-source-trace 必须为空。");
  }

  const gate = requireObject(ctx, "VAL-SPECS-NO-DELTA-004", NO_DELTA_TRACE_PATH, trace["production-alignment-gate"], "production-alignment-gate");
  validateGateBasics(ctx, gate, expected, [], NO_DELTA_TRACE_PATH);

  const delivery = requireObject(ctx, "VAL-SPECS-NO-DELTA-005", NO_DELTA_TRACE_PATH, trace["delivery-plane"], "delivery-plane");
  expectEqual(ctx, "VAL-SPECS-NO-DELTA-006", NO_DELTA_TRACE_PATH, delivery["completion-mode"], NO_DELTA_SPECS_COMPLETION_MODE, "delivery-plane.completion-mode");

  if (expected.schemaName === DEFAULT_SCHEMA) {
    validateDefaultTraceHasNoGa(ctx, trace, NO_DELTA_TRACE_PATH);
  }
}

function validateNormalSpecsTrace(ctx, trace, group, expected, tracePath, artifactPath) {
  validateCommonTraceFields(ctx, trace, expected, tracePath, artifactPath);
  expectEqual(ctx, "VAL-SPECS-TRACE-020", tracePath, trace["source-proposal-trace-path"], PROPOSAL_TRACE_PATH, "source-proposal-trace-path");
  expectEqual(ctx, "VAL-SPECS-TRACE-021", tracePath, trace["specs-completion-mode"], "delta", "specs-completion-mode");
  expectEqual(ctx, "VAL-SPECS-TRACE-022", tracePath, trace.capability, group.capability, "capability");

  requireArray(ctx, "VAL-SPECS-TRACE-023", tracePath, trace["existing-spec-read-set"], "existing-spec-read-set");
  validateCapabilitySourceMap(ctx, trace, group, expected, tracePath, artifactPath);

  const sourceTrace = requireArray(ctx, "VAL-SPECS-TRACE-024", tracePath, trace["requirement-source-trace"], "requirement-source-trace");
  validateRequirementSourceTrace(ctx, sourceTrace, group, expected, tracePath);

  const gate = requireObject(ctx, "VAL-SPECS-TRACE-025", tracePath, trace["production-alignment-gate"], "production-alignment-gate");
  validateGateBasics(ctx, gate, expected, group.ids, tracePath);

  const delivery = requireObject(ctx, "VAL-SPECS-TRACE-026", tracePath, trace["delivery-plane"], "delivery-plane");
  validateDeliveryPlane(ctx, delivery, sourceTrace, tracePath);

  if (expected.schemaName === DEFAULT_SCHEMA) {
    validateDefaultTraceHasNoGa(ctx, trace, tracePath);
  }
}

function validateCommonTraceFields(ctx, trace, expected, tracePath, artifactPath) {
  expectEqual(ctx, "VAL-SPECS-TRACE-001", tracePath, trace["trace-schema"], TRACE_SCHEMA, "trace-schema");
  expectEqual(ctx, "VAL-SPECS-TRACE-002", tracePath, trace["artifact-id"], "specs", "artifact-id");
  expectEqual(ctx, "VAL-SPECS-TRACE-003", tracePath, trace["artifact-path"], artifactPath, "artifact-path");
  expectEqual(ctx, "VAL-SPECS-TRACE-004", tracePath, trace["change-name"], ctx.change, "change-name");
  expectEqual(ctx, "VAL-SPECS-TRACE-005", tracePath, trace["schema-name"], expected.schemaName, "schema-name");
  requireString(ctx, "VAL-SPECS-TRACE-006", tracePath, trace["agent-role"], "agent-role");
  requireObject(ctx, "VAL-SPECS-TRACE-007", tracePath, trace["delivery-plane"], "delivery-plane");
  requireObject(ctx, "VAL-SPECS-TRACE-008", tracePath, trace["production-alignment-gate"], "production-alignment-gate");
}

function validateCapabilitySourceMap(ctx, trace, group, expected, tracePath, artifactPath) {
  const rows = requireArray(ctx, "VAL-SPECS-MAP-001", tracePath, trace["capability-source-map"], "capability-source-map");
  if (rows.length === 0) {
    addError(ctx, "VAL-SPECS-MAP-002", tracePath, "capability-source-map 至少需要一行汇总当前 capability。");
  }

  const requirementIds = [];
  const guardIds = [];
  for (const [index, row] of rows.entries()) {
    const capability = strip(row?.[expected.mapCapabilityField]);
    if (capability !== group.capability) {
      addError(ctx, "VAL-SPECS-MAP-003", tracePath, `capability-source-map[${index}] capability 不一致：实际 ${capability || "(empty)"}，期望 ${group.capability}。`);
    }
    expectEqual(ctx, "VAL-SPECS-MAP-004", tracePath, row?.["artifact-path"], artifactPath, `capability-source-map[${index}].artifact-path`);
    expectEqual(ctx, "VAL-SPECS-MAP-005", tracePath, row?.["trace-path"], tracePath, `capability-source-map[${index}].trace-path`);
    requirementIds.push(...requireIdArray(ctx, "VAL-SPECS-MAP-006", tracePath, row?.[expected.mapRequirementIdsField] ?? [], `capability-source-map[${index}].${expected.mapRequirementIdsField}`, expected.idRegex));
    guardIds.push(...requireIdArray(ctx, "VAL-SPECS-MAP-007", tracePath, row?.[expected.mapGuardIdsField] ?? [], `capability-source-map[${index}].${expected.mapGuardIdsField}`, expected.idRegex));
  }

  expectSameSet(ctx, "VAL-SPECS-MAP-008", tracePath, requirementIds, group.requirementIds, "capability-source-map requirement IDs");
  expectSameSet(ctx, "VAL-SPECS-MAP-009", tracePath, guardIds, group.guardIds, "capability-source-map guard IDs");
}

function validateRequirementSourceTrace(ctx, sourceTrace, group, expected, tracePath) {
  const actualIds = [];
  for (const [index, row] of sourceTrace.entries()) {
    rejectGroupedIds(ctx, row, tracePath, index);
    const id = requireId(ctx, "VAL-SPECS-SOURCE-001", tracePath, row?.[expected.idField], `requirement-source-trace[${index}].${expected.idField}`, expected.idRegex);
    if (!id) continue;
    actualIds.push(id);

    const proposalRow = group.rowsById.get(id);
    if (!proposalRow) {
      addError(ctx, "VAL-SPECS-SOURCE-002", tracePath, `${id} 不属于 ${group.capability} 的 proposal spec-relevant set。`);
      continue;
    }

    expectEqual(ctx, "VAL-SPECS-SOURCE-003", tracePath, row?.[expected.traceCapabilityField], group.capability, `requirement-source-trace[${index}].${expected.traceCapabilityField}`);
    for (const field of expected.sourceFields) {
      expectEqual(ctx, "VAL-SPECS-SOURCE-004", tracePath, row?.[field], proposalRow?.[field], `requirement-source-trace[${index}].${field}`);
    }

    const projection = strip(proposalRow?.[expected.projectionField]);
    expectEqual(ctx, "VAL-SPECS-SOURCE-005", tracePath, row?.[expected.projectionField === "artifact-handling" ? "artifact-handling" : "source-projection"], projection, `requirement-source-trace[${index}] projection`);
    validateSpecHandling(ctx, row, projection, expected, tracePath, index);
    requireString(ctx, "VAL-SPECS-SOURCE-006", tracePath, row?.requirement, `requirement-source-trace[${index}].requirement`);
    requireString(ctx, "VAL-SPECS-SOURCE-007", tracePath, row?.scenario, `requirement-source-trace[${index}].scenario`);
  }

  expectSameSet(ctx, "VAL-SPECS-SOURCE-008", tracePath, actualIds, group.ids, "requirement-source-trace IDs");
}

function validateSpecHandling(ctx, row, projection, expected, tracePath, index) {
  if (projection === expected.requirementProjection) {
    expectEqual(ctx, "VAL-SPECS-SOURCE-020", tracePath, row?.["spec-handling"], "direct-spec-requirement", `requirement-source-trace[${index}].spec-handling`);
    return;
  }

  if (projection === expected.guardProjection) {
    expectEqual(ctx, "VAL-SPECS-SOURCE-021", tracePath, row?.["spec-handling"], "direct-spec-guard", `requirement-source-trace[${index}].spec-handling`);
    const guardHandling = strip(row?.["guard-handling"]);
    if (!GUARD_HANDLINGS.has(guardHandling)) {
      addError(ctx, "VAL-SPECS-SOURCE-022", tracePath, `requirement-source-trace[${index}].guard-handling 必须是 must-not / preserve-boundary / non-goal。`);
    }
    return;
  }

  addError(ctx, "VAL-SPECS-SOURCE-023", tracePath, `不允许的 specs projection：${projection || "(empty)"}`);
}

function validateGateBasics(ctx, gate, expected, expectedIds, tracePath) {
  const blockers = requireArray(ctx, "VAL-SPECS-GATE-001", tracePath, gate.blockers ?? [], "production-alignment-gate.blockers");
  if (blockers.length !== 0) {
    addError(ctx, "VAL-SPECS-GATE-002", tracePath, "production-alignment-gate.blockers 必须为空；非空 blocker 不能进入 validator pass。");
  }

  const relevant = requireObject(ctx, "VAL-SPECS-GATE-003", tracePath, gate[expected.gateGroupField], `production-alignment-gate.${expected.gateGroupField}`);
  const ids = requireIdArray(ctx, "VAL-SPECS-GATE-004", tracePath, relevant.ids ?? [], `production-alignment-gate.${expected.gateGroupField}.ids`, expected.idRegex);
  expectEqual(ctx, "VAL-SPECS-GATE-005", tracePath, relevant.count, ids.length, `production-alignment-gate.${expected.gateGroupField}.count`);
  expectSameSet(ctx, "VAL-SPECS-GATE-006", tracePath, ids, expectedIds, `production-alignment-gate.${expected.gateGroupField}.ids`);

  const orphan = requireArray(ctx, "VAL-SPECS-GATE-007", tracePath, gate[expected.gateOrphanField] ?? [], `production-alignment-gate.${expected.gateOrphanField}`);
  if (orphan.length !== 0) {
    addError(ctx, "VAL-SPECS-GATE-008", tracePath, `production-alignment-gate.${expected.gateOrphanField} 必须为空。`);
  }

  const deliveryOnly = requireArray(ctx, "VAL-SPECS-GATE-009", tracePath, gate["delivery-only-scenarios"] ?? [], "production-alignment-gate.delivery-only-scenarios");
  if (deliveryOnly.length !== 0) {
    addError(ctx, "VAL-SPECS-GATE-010", tracePath, "production-alignment-gate.delivery-only-scenarios 必须为空。");
  }
}

function validateDeliveryPlane(ctx, delivery, sourceTrace, tracePath) {
  validateDeliveryPlaneNoLeaks(ctx, delivery, tracePath);

  const anchors = new Set();
  for (const requirement of [
    ...asArray(delivery["added-requirements"]),
    ...asArray(delivery["modified-requirements"]),
  ]) {
    const requirementName = strip(requirement?.name);
    for (const scenario of asArray(requirement?.scenarios)) {
      const scenarioName = strip(scenario?.name);
      if (requirementName && scenarioName) anchors.add(anchorKey(requirementName, scenarioName));
    }
  }

  const traceAnchors = new Set(
    sourceTrace
      .map((row) => anchorKey(strip(row?.requirement), strip(row?.scenario)))
      .filter((anchor) => anchor !== "\u0000"),
  );

  for (const anchor of anchors) {
    if (!traceAnchors.has(anchor)) {
      addError(ctx, "VAL-SPECS-DELIVERY-001", tracePath, `delivery-plane scenario 没有 requirement-source-trace row：${formatAnchor(anchor)}`);
    }
  }
  for (const anchor of traceAnchors) {
    if (!anchors.has(anchor)) {
      addError(ctx, "VAL-SPECS-DELIVERY-002", tracePath, `requirement-source-trace row 无法解析到 added/modified scenario：${formatAnchor(anchor)}`);
    }
  }
}

function validateDeliveryPlaneNoLeaks(ctx, delivery, tracePath) {
  const json = JSON.stringify(delivery);
  if (ANY_GA_ID_RE.test(json) || ANY_SCOPE_ID_RE.test(json)) {
    addError(ctx, "VAL-SPECS-DELIVERY-010", tracePath, "delivery-plane 不得泄漏 GA/SI trace ID。");
  }

  for (const key of collectObjectKeys(delivery)) {
    if (DELIVERY_LEAK_KEY_RE.test(key)) {
      addError(ctx, "VAL-SPECS-DELIVERY-011", tracePath, `delivery-plane 不得包含 trace/gate/coverage/map 字段：${key}`);
    }
  }
}

function validateDefaultTraceHasNoGa(ctx, trace, tracePath) {
  if (ANY_GA_ID_RE.test(JSON.stringify(trace))) {
    addError(ctx, "VAL-SPECS-DEFAULT-001", tracePath, "production-default-acceptance-driven specs trace 不得包含 GA-####。");
  }
}

function validateSpecsRender(ctx, options) {
  const artifactFullPath = path.join(ctx.changeDir, options.artifactPath);
  if (!fs.existsSync(artifactFullPath)) {
    addError(ctx, "VAL-SPECS-RENDER-001", options.artifactPath, "specs Markdown 缺失；writer 必须通过 renderer 生成 Markdown。");
    return;
  }

  let rendered;
  try {
    rendered = renderChangeArtifact({
      root: ctx.root,
      change: ctx.change,
      artifact: "specs",
      capability: options.capability,
      noDeltaSpecs: Boolean(options.noDelta),
    }).markdown;
  } catch (error) {
    addError(ctx, "VAL-SPECS-RENDER-002", options.tracePath, error.message);
    return;
  }

  const actual = fs.readFileSync(artifactFullPath, "utf8");
  if (actual !== rendered) {
    addError(ctx, "VAL-SPECS-RENDER-003", options.artifactPath, "specs Markdown 与 renderer 从 specs trace 生成的结果不一致。");
  }
}

function rejectGroupedIds(ctx, row, tracePath, index) {
  for (const field of ["global-atom-ids", "atom-ids", "scope-item-ids", "ids"]) {
    if (field in Object(row)) {
      addError(ctx, "VAL-SPECS-SOURCE-030", tracePath, `requirement-source-trace[${index}] 不得使用 ${field} 汇总多个 ID。`);
    }
  }
}

function readManifestEntriesLenient(ctx) {
  const manifestFullPath = path.join(ctx.changeDir, "trace", "manifest.json");
  if (!fs.existsSync(manifestFullPath)) return [];
  try {
    return asArray(JSON.parse(fs.readFileSync(manifestFullPath, "utf8")).artifacts);
  } catch {
    return [
      {
        "artifact-id": "specs",
        "artifact-path": SPECS_ARTIFACT_DIR,
        "trace-path": SPECS_TRACE_DIR,
      },
    ];
  }
}

function isSpecsManifestEntry(entry) {
  return (
    strip(entry?.["artifact-id"]) === "specs" ||
    strip(entry?.["artifact-path"]).startsWith("specs/") ||
    strip(entry?.["trace-path"]).startsWith("trace/specs/")
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

function anchorKey(requirement, scenario) {
  if (!requirement || !scenario) return "\u0000";
  return `${requirement}\u0000${scenario}`;
}

function formatAnchor(anchor) {
  const [requirement, scenario] = anchor.split("\u0000");
  return `${requirement} / ${scenario}`;
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
  lines.push(`${result.ok ? "PASS" : "FAIL"} validate-specs-artifact${options.change ? ` --change ${options.change}` : ""}`);
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
  node openspec/agent-runtime/scripts/validators/validate-specs-artifact.mjs --change <slug> [--root <path>]
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
    const result = validateSpecsArtifact(options);
    process.stdout.write(formatResult(result, options));
    process.exit(result.ok ? 0 : 1);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
