#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  NO_DELTA_SPECS_ARTIFACT_PATH,
  NO_DELTA_SPECS_COMPLETION_MODE,
  TRACE_CONTRACT_VERSION,
  TRACE_SCHEMA,
} from "../render-production-artifacts.mjs";

const OBLIGATION_SCHEMA = "production-obligation-atom-driven";
const DEFAULT_SCHEMA = "production-default-acceptance-driven";

const PROPOSAL_TRACE_PATH = "trace/proposal.trace.json";
const SPECS_TRACE_DIR = "trace/specs";
const SPECS_ARTIFACT_DIR = "specs";
const NO_DELTA_TRACE_PATH = "trace/specs/no-spec-delta/README.trace.json";

const GA_ID_RE = /^GA-\d{4}$/u;
const SI_ID_RE = /^SI-\d{3}$/u;
const DELTA_ID_RE = /^SD-\d{3}$/u;
const ANY_GA_ID_RE = /\bGA-\d{4}\b/u;
const ANY_SCOPE_ID_RE = /\bSI-\d{3}\b/u;

const DEFAULT_SPEC_HANDLINGS = new Set(["spec", "guard"]);
const GUARD_PROJECTIONS = new Set(["spec-guard", "guard"]);
const DELTA_OPS = new Set(["added", "modified", "removed", "renamed"]);
const EXISTING_SPEC_STATUSES = new Set(["absent", "parsed", "parse-blocked"]);
const GUARD_HANDLINGS = new Set(["must-not", "preserve-boundary", "non-goal"]);
const SPEC_GATE_FIELDS = [
  "blockers",
  "orphan-source-ids",
  "source-set-mismatch",
  "existing-spec-state-violations",
  "delivery-projection-mismatch",
];
const DELIVERY_LEAK_KEY_RE = /(?:trace|gate|coverage|map|register)/iu;

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
    return;
  }

  for (const group of expected.groups.values()) {
    const tracePath = `trace/specs/${group.capability}.trace.json`;
    const artifactPath = `specs/${group.capability}/spec.md`;
    const trace = readJson(ctx, path.join(ctx.changeDir, tracePath));
    if (!trace) continue;
    validateNormalSpecsTrace(ctx, trace, group, expected, tracePath, artifactPath);
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
  addWarning(ctx, "VAL-SPECS-UPSTREAM-001", PROPOSAL_TRACE_PATH, `无法从 proposal schema-name 派生 specs 期望集合：${schemaName || "(empty)"}`);
  return null;
}

function buildObligationExpectedSpecsModel(ctx, proposalTrace) {
  const register = readUpstreamArray(ctx, proposalTrace["change-ga-register"], "change-ga-register");
  if (!register) return null;

  const rows = [];
  const rowsById = new Map();
  for (const [index, row] of register.entries()) {
    const specRoutes = getArtifactRoutes(row, "specs");
    if (specRoutes.length === 0) continue;

    const id = readUpstreamId(ctx, row?.["ga-id"], `change-ga-register[${index}].ga-id`, GA_ID_RE);
    if (!id) continue;
    if (rowsById.has(id)) {
      addWarning(ctx, "VAL-SPECS-UPSTREAM-003", PROPOSAL_TRACE_PATH, `change-ga-register ga-id 重复；specs 期望集合使用首个有效 row：${id}`);
      continue;
    }
    const role = specRoutes[0]?.role;
    if (specRoutes.length > 1) {
      addWarning(ctx, "VAL-SPECS-UPSTREAM-004", PROPOSAL_TRACE_PATH, `${id} 存在多个 specs artifact route；specs 期望集合使用首个 route。`);
    }
    const routedRow = { ...row, "routing-role": role };
    rows.push(routedRow);
    rowsById.set(id, routedRow);
  }

  return buildExpectedModel({
    schemaName: OBLIGATION_SCHEMA,
    idField: "ga-id",
    idRegex: GA_ID_RE,
    capabilityField: "capability",
    projectionField: "routing-role",
    guardProjection: "spec-guard",
    rows,
    rowsById,
  });
}

function getArtifactRoutes(row, artifact) {
  return asArray(row?.["artifact-routes"]).filter((route) => strip(route?.artifact) === artifact);
}

function buildDefaultExpectedSpecsModel(ctx, proposalTrace) {
  const scopeCoverage = readUpstreamArray(ctx, proposalTrace["change-scope-coverage"], "change-scope-coverage");
  if (!scopeCoverage) return null;

  const rows = [];
  const rowsById = new Map();
  for (const [index, row] of scopeCoverage.entries()) {
    const handling = strip(row?.["artifact-handling"]);
    if (!DEFAULT_SPEC_HANDLINGS.has(handling)) continue;

    const id = readUpstreamId(ctx, row?.["scope-item-id"], `change-scope-coverage[${index}].scope-item-id`, SI_ID_RE);
    if (!id) continue;
    if (rowsById.has(id)) {
      addWarning(ctx, "VAL-SPECS-UPSTREAM-003", PROPOSAL_TRACE_PATH, `change-scope-coverage scope-item-id 重复；specs 期望集合使用首个有效 row：${id}`);
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
    guardProjection: "guard",
    rows,
    rowsById,
  });
}

function readUpstreamArray(ctx, value, label) {
  if (Array.isArray(value)) return value;
  addWarning(ctx, "VAL-SPECS-UPSTREAM-002", PROPOSAL_TRACE_PATH, `无法从 proposal.${label} 派生 specs 期望集合；该结构问题由 proposal validator 负责。`);
  return null;
}

function readUpstreamId(ctx, value, label, regex) {
  const id = strip(value);
  if (!id) {
    addWarning(ctx, "VAL-SPECS-UPSTREAM-005", PROPOSAL_TRACE_PATH, `跳过缺少 ${label} 的 proposal row；该结构问题由 proposal validator 负责。`);
    return "";
  }
  if (!regex.test(id)) {
    addWarning(ctx, "VAL-SPECS-UPSTREAM-006", PROPOSAL_TRACE_PATH, `跳过包含非法 ${label} 的 proposal row：${id}；该结构问题由 proposal validator 负责。`);
    return "";
  }
  return id;
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
        ids: [],
        guardIds: [],
      });
    }
    const id = strip(row?.[config.idField]);
    const projection = strip(row?.[config.projectionField]);
    const group = groups.get(capability);
    group.rows.push(row);
    group.rowsById.set(id, row);
    group.ids.push(id);
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

  const register = requireArray(ctx, "VAL-SPECS-NO-DELTA-002", NO_DELTA_TRACE_PATH, trace["spec-delta-register"], "spec-delta-register");
  if (register.length !== 0) {
    addError(ctx, "VAL-SPECS-NO-DELTA-003", NO_DELTA_TRACE_PATH, "no-delta specs trace 的 spec-delta-register 必须为空。");
  }

  validateSpecGate(ctx, trace, expected, [], NO_DELTA_TRACE_PATH);

  const delivery = requireObject(ctx, "VAL-SPECS-NO-DELTA-004", NO_DELTA_TRACE_PATH, trace["delivery-plane"], "delivery-plane");
  validateDeliveryPlaneNoLeaks(ctx, delivery, NO_DELTA_TRACE_PATH);
  expectEqual(ctx, "VAL-SPECS-NO-DELTA-005", NO_DELTA_TRACE_PATH, delivery["completion-mode"], NO_DELTA_SPECS_COMPLETION_MODE, "delivery-plane.completion-mode");
  for (const key of ["added-requirements", "modified-requirements", "removed-requirements", "renamed-requirements"]) {
    if (asArray(delivery[key]).length > 0) {
      addError(ctx, "VAL-SPECS-NO-DELTA-006", NO_DELTA_TRACE_PATH, `no-delta delivery-plane 不得包含 ${key}。`);
    }
  }

  if (expected.schemaName === DEFAULT_SCHEMA) {
    validateDefaultTraceHasNoGa(ctx, trace, NO_DELTA_TRACE_PATH);
  }
}

function validateNormalSpecsTrace(ctx, trace, group, expected, tracePath, artifactPath) {
  validateCommonTraceFields(ctx, trace, expected, tracePath, artifactPath);
  expectEqual(ctx, "VAL-SPECS-TRACE-020", tracePath, trace["source-proposal-trace-path"], PROPOSAL_TRACE_PATH, "source-proposal-trace-path");
  expectEqual(ctx, "VAL-SPECS-TRACE-021", tracePath, trace["specs-completion-mode"], "delta", "specs-completion-mode");
  expectEqual(ctx, "VAL-SPECS-TRACE-022", tracePath, trace.capability, group.capability, "capability");

  validateSourceInterface(ctx, trace, tracePath);
  const existingState = validateExistingSpecState(ctx, trace, tracePath);

  const register = requireArray(ctx, "VAL-SPECS-TRACE-023", tracePath, trace["spec-delta-register"], "spec-delta-register");
  const registerModel = validateSpecDeltaRegister(ctx, register, group, expected, existingState, tracePath);
  const delivery = requireObject(ctx, "VAL-SPECS-TRACE-024", tracePath, trace["delivery-plane"], "delivery-plane");
  validateDeliveryPlane(ctx, delivery, registerModel, tracePath);
  validateSpecGate(ctx, trace, expected, group.ids, tracePath);

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
  requireObject(ctx, "VAL-SPECS-TRACE-008", tracePath, trace["source-interface"], "source-interface");
  requireObject(ctx, "VAL-SPECS-TRACE-009", tracePath, trace["existing-spec-state"], "existing-spec-state");
  requireArray(ctx, "VAL-SPECS-TRACE-010", tracePath, trace["spec-delta-register"], "spec-delta-register");
  requireObject(ctx, "VAL-SPECS-TRACE-011", tracePath, trace["spec-gate"], "spec-gate");
}

function validateSourceInterface(ctx, trace, tracePath) {
  const sourceInterface = requireObject(ctx, "VAL-SPECS-SOURCE-IFACE-001", tracePath, trace["source-interface"], "source-interface");
  const existingState = requireObject(ctx, "VAL-SPECS-SOURCE-IFACE-008", tracePath, trace["existing-spec-state"], "existing-spec-state");
  expectEqual(ctx, "VAL-SPECS-SOURCE-IFACE-002", tracePath, sourceInterface["proposal-trace"], PROPOSAL_TRACE_PATH, "source-interface.proposal-trace");
  requireString(ctx, "VAL-SPECS-SOURCE-IFACE-003", tracePath, sourceInterface["existing-spec"], "source-interface.existing-spec");
  const mode = requireString(ctx, "VAL-SPECS-SOURCE-IFACE-004", tracePath, sourceInterface["existing-spec-read-mode"], "source-interface.existing-spec-read-mode");
  if (mode && !EXISTING_SPEC_STATUSES.has(mode)) {
    addError(ctx, "VAL-SPECS-SOURCE-IFACE-005", tracePath, "source-interface.existing-spec-read-mode 必须是 absent / parsed / parse-blocked。");
  }
  if (mode && existingState.status && mode !== strip(existingState.status)) {
    addError(ctx, "VAL-SPECS-SOURCE-IFACE-008", tracePath, "source-interface.existing-spec-read-mode 必须与 existing-spec-state.status 一致。");
  }
  requireString(ctx, "VAL-SPECS-SOURCE-IFACE-006", tracePath, sourceInterface["input-policy"], "source-interface.input-policy");

  for (const [field, value] of Object.entries(sourceInterface)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      addError(ctx, "VAL-SPECS-SOURCE-IFACE-007", tracePath, `source-interface.${field} 必须是字符串或字符串数组，不能内联 object metadata。`);
    }
  }
}

function validateExistingSpecState(ctx, trace, tracePath) {
  const state = requireObject(ctx, "VAL-SPECS-EXISTING-001", tracePath, trace["existing-spec-state"], "existing-spec-state");
  const status = requireString(ctx, "VAL-SPECS-EXISTING-002", tracePath, state.status, "existing-spec-state.status");
  if (status && !EXISTING_SPEC_STATUSES.has(status)) {
    addError(ctx, "VAL-SPECS-EXISTING-003", tracePath, "existing-spec-state.status 必须是 absent / parsed / parse-blocked。");
  }
  requireString(ctx, "VAL-SPECS-EXISTING-004", tracePath, state.path, "existing-spec-state.path");
  requireArray(ctx, "VAL-SPECS-EXISTING-005", tracePath, state["requirement-anchors"] ?? [], "existing-spec-state.requirement-anchors");
  if (status === "parse-blocked" && !strip(state.blocker)) {
    addError(ctx, "VAL-SPECS-EXISTING-006", tracePath, "existing-spec-state.parse-blocked 必须提供 blocker。");
  }
  return state;
}

function validateSpecDeltaRegister(ctx, register, group, expected, existingState, tracePath) {
  const actualSourceIds = [];
  const registerRows = [];
  const seenDeltaIds = new Set();
  const existingStatus = strip(existingState?.status);

  if (register.length === 0) {
    addError(ctx, "VAL-SPECS-DELTA-001", tracePath, "normal specs delta 必须包含至少一个 spec-delta-register row。");
  }

  for (const [index, row] of register.entries()) {
    rejectGroupedIds(ctx, row, tracePath, index);
    const deltaId = requireId(ctx, "VAL-SPECS-DELTA-002", tracePath, row?.["delta-id"], `spec-delta-register[${index}].delta-id`, DELTA_ID_RE);
    if (deltaId) {
      if (seenDeltaIds.has(deltaId)) {
        addError(ctx, "VAL-SPECS-DELTA-003", tracePath, `spec-delta-register delta-id 重复：${deltaId}`);
      }
      seenDeltaIds.add(deltaId);
    }

    const deltaOp = requireString(ctx, "VAL-SPECS-DELTA-004", tracePath, row?.["delta-op"], `spec-delta-register[${index}].delta-op`);
    if (deltaOp && !DELTA_OPS.has(deltaOp)) {
      addError(ctx, "VAL-SPECS-DELTA-005", tracePath, `spec-delta-register[${index}].delta-op 必须是 added / modified / removed / renamed。`);
    }
    if (existingStatus === "absent" && deltaOp && deltaOp !== "added") {
      addError(ctx, "VAL-SPECS-DELTA-008", tracePath, `existing spec absent 时只能生成 added delta，不能生成 ${deltaOp}。`);
    }
    if (existingStatus === "parse-blocked" && deltaOp && deltaOp !== "added") {
      addError(ctx, "VAL-SPECS-DELTA-009", tracePath, `existing spec parse-blocked 时不能 pass 非 added delta：${deltaOp}。`);
    }

    const requirement = requireString(ctx, "VAL-SPECS-DELTA-006", tracePath, row?.requirement, `spec-delta-register[${index}].requirement`);
    const sourceIds = validateSourceIds(ctx, row?.["source-ids"] ?? [], group, expected, tracePath, `spec-delta-register[${index}].source-ids`);
    actualSourceIds.push(...sourceIds);

    const rowUsesGuard = sourceIds.some((id) => isGuardSource(id, group, expected));
    if (rowUsesGuard) {
      const guardHandling = strip(row?.["guard-handling"]);
      if (!GUARD_HANDLINGS.has(guardHandling)) {
        addError(ctx, "VAL-SPECS-DELTA-007", tracePath, `spec-delta-register[${index}].guard-handling 必须是 must-not / preserve-boundary / non-goal。`);
      }
    }

    if (deltaOp === "added" || deltaOp === "modified") {
      requireTextValue(ctx, "VAL-SPECS-DELTA-010", tracePath, row?.body, `spec-delta-register[${index}].body`);
      const scenarios = requireArray(ctx, "VAL-SPECS-DELTA-011", tracePath, row?.scenarios, `spec-delta-register[${index}].scenarios`);
      if (scenarios.length === 0) {
        addError(ctx, "VAL-SPECS-DELTA-012", tracePath, `spec-delta-register[${index}] added/modified 必须包含至少一个 scenario。`);
      }
      if (deltaOp === "modified") {
        requireString(ctx, "VAL-SPECS-DELTA-013", tracePath, row?.["existing-anchor"], `spec-delta-register[${index}].existing-anchor`);
      }
      for (const [scenarioIndex, scenario] of scenarios.entries()) {
        const scenarioName = requireString(ctx, "VAL-SPECS-DELTA-014", tracePath, scenario?.name, `spec-delta-register[${index}].scenarios[${scenarioIndex}].name`);
        if (!scenario?.body && !scenario?.given && !scenario?.when && !scenario?.then) {
          addError(ctx, "VAL-SPECS-DELTA-015", tracePath, `spec-delta-register[${index}].scenarios[${scenarioIndex}] 必须包含 body 或 given/when/then。`);
        }
        const scenarioSourceIds = validateSourceIds(
          ctx,
          scenario?.["source-ids"] ?? sourceIds,
          group,
          expected,
          tracePath,
          `spec-delta-register[${index}].scenarios[${scenarioIndex}].source-ids`,
        );
        actualSourceIds.push(...scenarioSourceIds);
        const pointer = `#/spec-delta-register/${index}/scenarios/${scenarioIndex}`;
        registerRows.push({ deltaOp, requirement, scenario: scenarioName, pointer });
      }
    }

    if (deltaOp === "removed") {
      requireString(ctx, "VAL-SPECS-DELTA-020", tracePath, row?.["existing-anchor"], `spec-delta-register[${index}].existing-anchor`);
      requireTextValue(ctx, "VAL-SPECS-DELTA-021", tracePath, row?.reason, `spec-delta-register[${index}].reason`);
      requireTextValue(ctx, "VAL-SPECS-DELTA-022", tracePath, row?.migration, `spec-delta-register[${index}].migration`);
      if (Array.isArray(row?.scenarios) && row.scenarios.length > 0) {
        addError(ctx, "VAL-SPECS-DELTA-023", tracePath, `spec-delta-register[${index}] removed 不得包含 scenarios。`);
      }
      registerRows.push({ deltaOp, requirement, pointer: `#/spec-delta-register/${index}` });
    }

    if (deltaOp === "renamed") {
      requireString(ctx, "VAL-SPECS-DELTA-030", tracePath, row?.["existing-anchor"], `spec-delta-register[${index}].existing-anchor`);
      const from = requireString(ctx, "VAL-SPECS-DELTA-031", tracePath, row?.from, `spec-delta-register[${index}].from`);
      const to = requireString(ctx, "VAL-SPECS-DELTA-032", tracePath, row?.to, `spec-delta-register[${index}].to`);
      if (row?.body || row?.reason || row?.migration || (Array.isArray(row?.scenarios) && row.scenarios.length > 0)) {
        addError(ctx, "VAL-SPECS-DELTA-033", tracePath, `spec-delta-register[${index}] renamed 不得包含行为变化字段。`);
      }
      registerRows.push({ deltaOp, requirement, from, to, pointer: `#/spec-delta-register/${index}` });
    }
  }

  expectSameSet(ctx, "VAL-SPECS-DELTA-040", tracePath, actualSourceIds, group.ids, "spec-delta-register source IDs");

  return {
    actualSourceIds,
    registerRows,
  };
}

function validateSourceIds(ctx, value, group, expected, tracePath, label) {
  const ids = requireIdArray(ctx, "VAL-SPECS-SOURCE-001", tracePath, value, label, expected.idRegex);
  for (const id of ids) {
    if (!group.rowsById.has(id)) {
      addError(ctx, "VAL-SPECS-SOURCE-002", tracePath, `${label} 引用的 ${id} 不属于 ${group.capability} 的 proposal spec-relevant set。`);
    }
  }
  return ids;
}

function isGuardSource(id, group, expected) {
  const row = group.rowsById.get(id);
  return GUARD_PROJECTIONS.has(strip(row?.[expected.projectionField]));
}

function validateSpecGate(ctx, trace, expected, expectedIds, tracePath) {
  const gate = requireObject(ctx, "VAL-SPECS-GATE-001", tracePath, trace["spec-gate"], "spec-gate");
  for (const field of SPEC_GATE_FIELDS) {
    const values = requireArray(ctx, "VAL-SPECS-GATE-002", tracePath, gate[field] ?? [], `spec-gate.${field}`);
    if (values.length !== 0) {
      addError(ctx, "VAL-SPECS-GATE-003", tracePath, `spec-gate.${field} 必须为空；非空表示 specs 未闭合。`);
    }
  }

  if (expectedIds.length === 0 && asArray(trace["spec-delta-register"]).length !== 0) {
    addError(ctx, "VAL-SPECS-GATE-004", tracePath, "proposal 没有 spec-relevant item 时 spec-delta-register 必须为空。");
  }
}

function validateDeliveryPlane(ctx, delivery, registerModel, tracePath) {
  validateDeliveryPlaneNoLeaks(ctx, delivery, tracePath);

  const deliveryRows = [];
  for (const [deltaOp, key] of [
    ["added", "added-requirements"],
    ["modified", "modified-requirements"],
  ]) {
    for (const [requirementIndex, requirement] of asArray(delivery[key]).entries()) {
      const requirementName = strip(requirement?.name);
      requireTextValue(ctx, "VAL-SPECS-DELIVERY-020", tracePath, requirement?.body, `delivery-plane.${key}[${requirementName}].body`);
      const scenarios = asArray(requirement?.scenarios);
      if (scenarios.length === 0) {
        addError(ctx, "VAL-SPECS-DELIVERY-021", tracePath, `delivery-plane.${key}[${requirementIndex}] 必须包含至少一个 scenario。`);
      }
      for (const scenario of scenarios) {
        const scenarioName = strip(scenario?.name);
        if (requirementName && scenarioName) {
          deliveryRows.push(`${deltaOp}\u0000${requirementName}\u0000${scenarioName}`);
        }
      }
    }
  }

  for (const requirement of asArray(delivery["removed-requirements"])) {
    const name = strip(requirement?.name);
    if (name) deliveryRows.push(`removed\u0000${name}\u0000`);
    requireTextValue(ctx, "VAL-SPECS-DELIVERY-030", tracePath, requirement?.reason, `delivery-plane.removed-requirements[${name}].reason`);
    requireTextValue(ctx, "VAL-SPECS-DELIVERY-031", tracePath, requirement?.migration, `delivery-plane.removed-requirements[${name}].migration`);
  }

  for (const requirement of asArray(delivery["renamed-requirements"])) {
    const from = strip(requirement?.from);
    const to = strip(requirement?.to);
    if (from && to) deliveryRows.push(`renamed\u0000${from}\u0000${to}`);
  }

  const normalizedRegisterRows = [];
  const renamedRegisterRows = [];
  for (const row of registerModel.registerRows) {
    if (row.deltaOp === "renamed") {
      renamedRegisterRows.push(`renamed\u0000${strip(row.from)}\u0000${strip(row.to)}`);
    } else {
      normalizedRegisterRows.push(`${row.deltaOp}\u0000${strip(row.requirement)}\u0000${strip(row.scenario)}`);
    }
  }

  expectSameSet(ctx, "VAL-SPECS-DELIVERY-001", tracePath, deliveryRows.filter((row) => !row.startsWith("renamed\u0000")), normalizedRegisterRows, "delivery-plane requirements vs spec-delta-register");
  expectSameSet(ctx, "VAL-SPECS-DELIVERY-040", tracePath, deliveryRows.filter((row) => row.startsWith("renamed\u0000")), renamedRegisterRows, "delivery-plane renamed requirements vs spec-delta-register");
}

function validateDeliveryPlaneNoLeaks(ctx, delivery, tracePath) {
  const json = JSON.stringify(delivery);
  if (ANY_GA_ID_RE.test(json) || ANY_SCOPE_ID_RE.test(json)) {
    addError(ctx, "VAL-SPECS-DELIVERY-010", tracePath, "delivery-plane 不得泄漏 GA/SI trace ID。");
  }

  for (const key of collectObjectKeys(delivery)) {
    if (DELIVERY_LEAK_KEY_RE.test(key)) {
      addError(ctx, "VAL-SPECS-DELIVERY-011", tracePath, `delivery-plane 不得包含 trace/gate/coverage/map/register 字段：${key}`);
    }
  }
}

function validateDefaultTraceHasNoGa(ctx, trace, tracePath) {
  if (ANY_GA_ID_RE.test(JSON.stringify(trace))) {
    addError(ctx, "VAL-SPECS-DEFAULT-001", tracePath, "production-default-acceptance-driven specs trace 不得包含 GA-####。");
  }
}

function rejectGroupedIds(ctx, row, tracePath, index) {
  for (const field of ["global-atom-ids", "atom-ids", "scope-item-ids", "ids"]) {
    if (field in Object(row)) {
      addError(ctx, "VAL-SPECS-SOURCE-030", tracePath, `spec-delta-register[${index}] 不得使用 ${field} 汇总多个 ID。`);
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

function requireTextValue(ctx, ruleId, file, value, label) {
  if (typeof value === "string" && strip(value)) return value;
  if (Array.isArray(value) && value.length > 0 && value.every((item) => strip(item))) return value;
  addError(ctx, ruleId, file, `${label} 必须是非空字符串或非空字符串数组。`);
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
