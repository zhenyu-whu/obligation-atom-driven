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
const SPECS_TRACE_DIR = "trace/specs";
const NO_DELTA_TRACE_PATH = "trace/specs/no-spec-delta/README.trace.json";
const RUNTIME_TRACE_PATH = "trace/runtime-acceptance.trace.json";
const RUNTIME_ARTIFACT_PATH = "runtime-acceptance.md";

const GA_ID_RE = /^GA-\d{4}$/u;
const SI_ID_RE = /^SI-\d{3}$/u;
const ANY_GA_ID_RE = /\bGA-\d{4}\b/u;
const ANY_SI_ID_RE = /\bSI-\d{3}\b/u;
const DECISION_ID_RE = /^D-\d{3}$/u;
const RUNTIME_ROW_ID_RE = /^(RS|OP|ST|CH)-\d{3}$/u;
const MARKDOWN_INPUT_RE = /(?:^|\/)(?:proposal|design)\.md$|(?:^|\/)specs\/.+\.md$/iu;

const FORBIDDEN_TRACE_KEYS = new Set([
  "tasks",
  "task-id",
  "acceptance-slices",
  "ac-id",
  "test-file",
  "test-command",
  "evidence",
  "deposit",
  "proof-slice-model",
  "proof-slices",
]);

export function validateRuntimeAcceptanceArtifact(options = {}) {
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

  validateRuntimeIfPresent(ctx);

  return resultFor(ctx);
}

function validateRuntimeIfPresent(ctx) {
  const inventory = collectRuntimeInventory(ctx);
  if (!inventory.hasAnyRuntimeOutput) {
    addWarning(ctx, "VAL-RUNTIME-000", RUNTIME_TRACE_PATH, "未发现 runtime acceptance trace/artifact/manifest entry；partial validator 跳过 runtime-acceptance。");
    return;
  }

  if (!inventory.traceExists) {
    addError(ctx, "VAL-RUNTIME-001", RUNTIME_TRACE_PATH, "runtime-acceptance artifact 或 manifest entry 已存在，但 trace/runtime-acceptance.trace.json 缺失。");
    return;
  }

  const runtimeTrace = readJson(ctx, path.join(ctx.changeDir, RUNTIME_TRACE_PATH));
  const proposalTrace = readJson(ctx, path.join(ctx.changeDir, PROPOSAL_TRACE_PATH));
  if (!runtimeTrace || !proposalTrace) return;

  const expected = buildExpectedRuntimeModel(ctx, proposalTrace);
  if (!expected) return;

  const specs = buildSpecsTraceModel(ctx, expected.schemaName);
  const designTrace = readJson(ctx, path.join(ctx.changeDir, DESIGN_TRACE_PATH));

  validateCommonRuntimeTrace(ctx, runtimeTrace, expected, specs);
  validateRuntimeManifest(ctx);
  validateRuntimeRender(ctx);
  validateProfileLeaks(ctx, runtimeTrace, expected);
  validateForbiddenTraceShape(ctx, runtimeTrace);

  if (!designTrace) return;

  const expectedUpstream = buildExpectedUpstreamModel(ctx, expected, specs, designTrace);
  const canonicalRows = collectCanonicalRuntimeRowIds(ctx, runtimeTrace);
  const inventoryModel = validateRuntimeObligationInventory(ctx, runtimeTrace, expected, expectedUpstream);
  const notApplicableKeys = validateRuntimeNotApplicableInventory(ctx, runtimeTrace, inventoryModel);
  const upstreamCoverage = validateRuntimeUpstreamCoverageMap(
    ctx,
    runtimeTrace,
    expected,
    expectedUpstream,
    inventoryModel,
    notApplicableKeys,
    canonicalRows,
  );
  validateRuntimeCoverageSourceMap(ctx, runtimeTrace, canonicalRows);
  validateCanonicalRuntimeRowCoverage(ctx, canonicalRows, upstreamCoverage.coveredRuntimeRows);
}

function collectRuntimeInventory(ctx) {
  const traceFullPath = path.join(ctx.changeDir, RUNTIME_TRACE_PATH);
  const artifactFullPath = path.join(ctx.changeDir, RUNTIME_ARTIFACT_PATH);
  const manifestEntries = readManifestEntriesLenient(ctx).filter(isRuntimeManifestEntry);
  return {
    traceExists: fs.existsSync(traceFullPath),
    artifactExists: fs.existsSync(artifactFullPath),
    manifestEntries,
    hasAnyRuntimeOutput: fs.existsSync(traceFullPath) || fs.existsSync(artifactFullPath) || manifestEntries.length > 0,
  };
}

function buildExpectedRuntimeModel(ctx, proposalTrace) {
  const schemaName = strip(proposalTrace["schema-name"]);
  if (schemaName === OBLIGATION_SCHEMA) {
    const register = requireArray(
      ctx,
      "VAL-RUNTIME-PROPOSAL-001",
      PROPOSAL_TRACE_PATH,
      proposalTrace["change-atom-coverage-register"],
      "change-atom-coverage-register",
    );
    return buildExpectedModel({
      schemaName,
      rows: register,
      idField: "global-atom-id",
      idRegex: GA_ID_RE,
      projectionField: "artifact-projection",
      proposalUpstreamType: "proposal-direct-atom",
      oppositeIdRegex: ANY_SI_ID_RE,
      oppositeIdLabel: "SI-###",
      forbiddenIdentityKey: "scope-item-id",
    });
  }

  if (schemaName === DEFAULT_SCHEMA) {
    const scopeCoverage = requireArray(
      ctx,
      "VAL-RUNTIME-PROPOSAL-010",
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
      proposalUpstreamType: "proposal-scope-item",
      oppositeIdRegex: ANY_GA_ID_RE,
      oppositeIdLabel: "GA-####",
      forbiddenIdentityKey: "global-atom-id",
    });
  }

  addError(ctx, "VAL-RUNTIME-PROPOSAL-020", PROPOSAL_TRACE_PATH, `不支持的 proposal schema-name：${schemaName || "(empty)"}`);
  return null;
}

function buildExpectedModel(config) {
  const proposalRowsByKey = new Map();
  for (const row of config.rows) {
    const id = strip(row?.[config.idField]);
    if (!id) continue;
    proposalRowsByKey.set(upstreamKey(config.proposalUpstreamType, id), row);
  }
  return {
    ...config,
    proposalRowsByKey,
  };
}

function buildSpecsTraceModel(ctx, schemaName) {
  const tracePaths = listFiles(path.join(ctx.changeDir, SPECS_TRACE_DIR))
    .filter((file) => file.endsWith(".trace.json"))
    .map((file) => toPosix(path.relative(ctx.changeDir, file)))
    .sort();

  if (tracePaths.length === 0) {
    addError(ctx, "VAL-RUNTIME-SPECS-001", SPECS_TRACE_DIR, "runtime-acceptance 已存在，但未发现 specs trace；runtime acceptance 必须消费已完成 specs trace。");
    return {
      mode: "",
      tracePaths,
      scenarios: [],
    };
  }

  const hasNoDelta = tracePaths.includes(NO_DELTA_TRACE_PATH);
  if (hasNoDelta && tracePaths.length > 1) {
    addError(ctx, "VAL-RUNTIME-SPECS-002", SPECS_TRACE_DIR, "runtime source-interface 不能同时包含 no-delta specs marker 和 normal specs traces。");
  }

  if (hasNoDelta) {
    const trace = readJson(ctx, path.join(ctx.changeDir, NO_DELTA_TRACE_PATH));
    if (trace) {
      expectEqual(ctx, "VAL-RUNTIME-SPECS-003", NO_DELTA_TRACE_PATH, trace["schema-name"], schemaName, "specs schema-name");
      expectEqual(ctx, "VAL-RUNTIME-SPECS-004", NO_DELTA_TRACE_PATH, trace["specs-completion-mode"], NO_DELTA_SPECS_COMPLETION_MODE, "specs-completion-mode");
    }
    return {
      mode: NO_DELTA_SPECS_COMPLETION_MODE,
      tracePaths,
      scenarios: [],
    };
  }

  const scenarios = [];
  for (const tracePath of tracePaths) {
    const trace = readJson(ctx, path.join(ctx.changeDir, tracePath));
    if (!trace) continue;
    expectEqual(ctx, "VAL-RUNTIME-SPECS-010", tracePath, trace["artifact-id"], "specs", "artifact-id");
    expectEqual(ctx, "VAL-RUNTIME-SPECS-011", tracePath, trace["schema-name"], schemaName, "schema-name");
    expectEqual(ctx, "VAL-RUNTIME-SPECS-012", tracePath, trace["specs-completion-mode"], "delta", "specs-completion-mode");
    const rows = requireArray(ctx, "VAL-RUNTIME-SPECS-013", tracePath, trace["requirement-source-trace"], "requirement-source-trace");
    for (const [index, row] of rows.entries()) {
      requireString(ctx, "VAL-RUNTIME-SPECS-014", tracePath, row?.requirement, `requirement-source-trace[${index}].requirement`);
      requireString(ctx, "VAL-RUNTIME-SPECS-015", tracePath, row?.scenario, `requirement-source-trace[${index}].scenario`);
      scenarios.push({
        tracePath,
        tracePointer: `#/requirement-source-trace/${index}`,
        requirement: strip(row?.requirement),
        scenario: strip(row?.scenario),
      });
    }
  }

  return {
    mode: "delta",
    tracePaths,
    scenarios,
  };
}

function validateCommonRuntimeTrace(ctx, trace, expected, specs) {
  expectEqual(ctx, "VAL-RUNTIME-TRACE-001", RUNTIME_TRACE_PATH, trace["trace-schema"], TRACE_SCHEMA, "trace-schema");
  expectEqual(ctx, "VAL-RUNTIME-TRACE-002", RUNTIME_TRACE_PATH, trace["artifact-id"], "runtime-acceptance", "artifact-id");
  expectEqual(ctx, "VAL-RUNTIME-TRACE-003", RUNTIME_TRACE_PATH, trace["artifact-path"], RUNTIME_ARTIFACT_PATH, "artifact-path");
  expectEqual(ctx, "VAL-RUNTIME-TRACE-004", RUNTIME_TRACE_PATH, trace["change-name"], ctx.change, "change-name");
  expectEqual(ctx, "VAL-RUNTIME-TRACE-005", RUNTIME_TRACE_PATH, trace["schema-name"], expected.schemaName, "schema-name");
  requireString(ctx, "VAL-RUNTIME-TRACE-006", RUNTIME_TRACE_PATH, trace["agent-role"], "agent-role");
  const sourceInterface = requireObject(ctx, "VAL-RUNTIME-TRACE-007", RUNTIME_TRACE_PATH, trace["source-interface"], "source-interface");
  requireObject(ctx, "VAL-RUNTIME-TRACE-008", RUNTIME_TRACE_PATH, trace["delivery-plane"], "delivery-plane");

  expectEqual(ctx, "VAL-RUNTIME-SOURCE-INTERFACE-001", RUNTIME_TRACE_PATH, sourceInterface["proposal-trace"], PROPOSAL_TRACE_PATH, "source-interface.proposal-trace");
  expectEqual(ctx, "VAL-RUNTIME-SOURCE-INTERFACE-002", RUNTIME_TRACE_PATH, sourceInterface["design-trace"], DESIGN_TRACE_PATH, "source-interface.design-trace");
  expectEqual(ctx, "VAL-RUNTIME-SOURCE-INTERFACE-003", RUNTIME_TRACE_PATH, sourceInterface["specs-completion-mode"], specs.mode, "source-interface.specs-completion-mode");
  const specTraces = requireArray(ctx, "VAL-RUNTIME-SOURCE-INTERFACE-004", RUNTIME_TRACE_PATH, sourceInterface["spec-traces"], "source-interface.spec-traces")
    .map(strip)
    .filter(Boolean);
  expectSameSet(ctx, "VAL-RUNTIME-SOURCE-INTERFACE-005", RUNTIME_TRACE_PATH, specTraces, specs.tracePaths, "source-interface.spec-traces");
  validateSourceInterfaceStringLeaves(ctx, sourceInterface, specs.tracePaths);
}

function validateSourceInterfaceStringLeaves(ctx, sourceInterface, specTracePaths) {
  const allowedTracePaths = new Set([PROPOSAL_TRACE_PATH, DESIGN_TRACE_PATH, ...specTracePaths]);
  for (const item of collectStringLeaves(sourceInterface)) {
    const value = item.value.replace(/\\/gu, "/");
    if (MARKDOWN_INPUT_RE.test(value)) {
      addError(ctx, "VAL-RUNTIME-SOURCE-INTERFACE-010", RUNTIME_TRACE_PATH, `source-interface${item.pointer} 不得把 proposal/spec/design Markdown 作为 semantic input。`);
    }
    if (/^trace\/.+\.json$/u.test(value) && !allowedTracePaths.has(value)) {
      addError(ctx, "VAL-RUNTIME-SOURCE-INTERFACE-011", RUNTIME_TRACE_PATH, `source-interface${item.pointer} 只能列 proposal/spec/design JSON trace 输入，不能引用 ${value}。`);
    }
  }
}

function validateRuntimeManifest(ctx) {
  const manifestRelPath = "trace/manifest.json";
  const manifest = readJson(ctx, path.join(ctx.changeDir, manifestRelPath));
  if (!manifest) return;

  expectEqual(ctx, "VAL-RUNTIME-MANIFEST-001", manifestRelPath, manifest["trace-schema"], TRACE_SCHEMA, "trace-schema");
  expectEqual(ctx, "VAL-RUNTIME-MANIFEST-002", manifestRelPath, manifest["render-contract-version"], RENDER_CONTRACT_VERSION, "render-contract-version");
  expectEqual(ctx, "VAL-RUNTIME-MANIFEST-003", manifestRelPath, manifest["trace-contract-version"], TRACE_CONTRACT_VERSION, "trace-contract-version");

  const entries = requireArray(ctx, "VAL-RUNTIME-MANIFEST-004", manifestRelPath, manifest.artifacts, "artifacts").filter(isRuntimeManifestEntry);
  if (entries.length !== 1) {
    addError(ctx, "VAL-RUNTIME-MANIFEST-005", manifestRelPath, "manifest 必须有且仅有一个 runtime-acceptance -> trace/runtime-acceptance.trace.json registry entry。");
    return;
  }
  expectEqual(ctx, "VAL-RUNTIME-MANIFEST-006", manifestRelPath, entries[0]["artifact-id"], "runtime-acceptance", "runtime entry artifact-id");
  expectEqual(ctx, "VAL-RUNTIME-MANIFEST-007", manifestRelPath, entries[0]["artifact-path"], RUNTIME_ARTIFACT_PATH, "runtime entry artifact-path");
  expectEqual(ctx, "VAL-RUNTIME-MANIFEST-008", manifestRelPath, entries[0]["trace-path"], RUNTIME_TRACE_PATH, "runtime entry trace-path");
  expectEqual(ctx, "VAL-RUNTIME-MANIFEST-009", manifestRelPath, entries[0]["trace-schema"], TRACE_SCHEMA, "runtime entry trace-schema");
}

function validateRuntimeRender(ctx) {
  const artifactFullPath = path.join(ctx.changeDir, RUNTIME_ARTIFACT_PATH);
  if (!fs.existsSync(artifactFullPath)) {
    addError(ctx, "VAL-RUNTIME-RENDER-001", RUNTIME_ARTIFACT_PATH, "runtime-acceptance.md 缺失；writer 必须通过 renderer 生成 Markdown。");
    return;
  }

  let rendered;
  try {
    rendered = renderChangeArtifact({
      root: ctx.root,
      change: ctx.change,
      artifact: "runtime-acceptance",
    }).markdown;
  } catch (error) {
    addError(ctx, "VAL-RUNTIME-RENDER-002", RUNTIME_TRACE_PATH, error.message);
    return;
  }

  const actual = fs.readFileSync(artifactFullPath, "utf8");
  if (actual !== rendered) {
    addError(ctx, "VAL-RUNTIME-RENDER-003", RUNTIME_ARTIFACT_PATH, "runtime-acceptance.md 与 renderer 从 trace/runtime-acceptance.trace.json 生成的结果不一致。");
  }
}

function validateProfileLeaks(ctx, trace, expected) {
  const keyRefs = collectObjectKeyRefs(trace);
  for (const ref of keyRefs) {
    if (ref.key === expected.forbiddenIdentityKey) {
      addError(ctx, "VAL-RUNTIME-PROFILE-001", RUNTIME_TRACE_PATH, `${expected.schemaName} runtime trace 不得包含 ${expected.forbiddenIdentityKey}。`);
    }
  }
  for (const ref of collectIds(trace, expected.oppositeIdRegex)) {
    addError(ctx, "VAL-RUNTIME-PROFILE-002", RUNTIME_TRACE_PATH, `${expected.schemaName} runtime trace 不得出现 ${expected.oppositeIdLabel}：${ref.id}。`);
  }
}

function validateForbiddenTraceShape(ctx, trace) {
  for (const ref of collectObjectKeyRefs(trace)) {
    if (FORBIDDEN_TRACE_KEYS.has(ref.key.toLowerCase())) {
      addError(ctx, "VAL-RUNTIME-FORBIDDEN-001", RUNTIME_TRACE_PATH, `runtime trace 不得包含任务/测试/evidence/Proof Slice 专属字段：${ref.pointer}。`);
    }
  }
}

function buildExpectedUpstreamModel(ctx, expected, specs, designTrace) {
  const expectedRows = new Map();
  for (const [key, row] of expected.proposalRowsByKey.entries()) {
    expectedRows.set(key, {
      type: expected.proposalUpstreamType,
      id: strip(row?.[expected.idField]),
      proposalRow: row,
    });
  }

  for (const scenario of specs.scenarios) {
    const id = `${scenario.tracePath}${scenario.tracePointer}`;
    expectedRows.set(upstreamKey("spec-scenario", id), {
      type: "spec-scenario",
      id,
      scenario,
    });
  }

  const decisionRows = requireArray(ctx, "VAL-RUNTIME-DESIGN-001", DESIGN_TRACE_PATH, designTrace["design-decision-index"], "design-decision-index");
  for (const [index, row] of decisionRows.entries()) {
    const id = requireId(ctx, "VAL-RUNTIME-DESIGN-002", DESIGN_TRACE_PATH, row?.["decision-id"], `design-decision-index[${index}].decision-id`, DECISION_ID_RE);
    if (!id) continue;
    expectedRows.set(upstreamKey("design-decision", id), {
      type: "design-decision",
      id,
      designDecision: row,
    });
  }

  return expectedRows;
}

function collectCanonicalRuntimeRowIds(ctx, trace) {
  const delivery = requireObject(ctx, "VAL-RUNTIME-CANONICAL-001", RUNTIME_TRACE_PATH, trace["delivery-plane"], "delivery-plane");
  const value = delivery["canonical-rows"];
  if (value === undefined) {
    addError(ctx, "VAL-RUNTIME-CANONICAL-002", RUNTIME_TRACE_PATH, "delivery-plane.canonical-rows 必须存在。");
    return new Set();
  }

  const ids = [];
  const rows = Array.isArray(value)
    ? value
    : Object.entries(requireObject(ctx, "VAL-RUNTIME-CANONICAL-003", RUNTIME_TRACE_PATH, value, "delivery-plane.canonical-rows"))
        .map(([id, row]) => ({ id, ...Object(row) }));

  for (const [index, row] of rows.entries()) {
    const id = strip(row?.id ?? row?.["surface-id"] ?? row?.["operation-id"] ?? row?.["state-id"] ?? row?.["chain-id"]);
    if (!id) {
      addError(ctx, "VAL-RUNTIME-CANONICAL-004", RUNTIME_TRACE_PATH, `delivery-plane.canonical-rows[${index}] 缺少 runtime row id。`);
      continue;
    }
    if (!RUNTIME_ROW_ID_RE.test(id)) {
      addError(ctx, "VAL-RUNTIME-CANONICAL-005", RUNTIME_TRACE_PATH, `delivery-plane.canonical-rows[${index}] runtime row id 非法：${id}。`);
      continue;
    }
    ids.push(id);
  }

  return new Set(ids);
}

function validateRuntimeObligationInventory(ctx, trace, expected, expectedUpstream) {
  const rows = requireArray(
    ctx,
    "VAL-RUNTIME-INVENTORY-001",
    RUNTIME_TRACE_PATH,
    trace["upstream-runtime-obligation-inventory"],
    "upstream-runtime-obligation-inventory",
  );
  const records = parseUpstreamRows(ctx, rows, "upstream-runtime-obligation-inventory", "VAL-RUNTIME-INVENTORY-002");
  expectSameSet(ctx, "VAL-RUNTIME-INVENTORY-003", RUNTIME_TRACE_PATH, [...records.byKey.keys()], [...expectedUpstream.keys()], "upstream-runtime-obligation-inventory upstream keys");

  for (const [key, record] of records.byKey.entries()) {
    const expectedRecord = expectedUpstream.get(key);
    if (!expectedRecord) continue;
    validateProposalProjectionIfNeeded(ctx, record.row, expected, expectedRecord, `upstream-runtime-obligation-inventory[${record.index}]`);
  }

  return records;
}

function validateRuntimeNotApplicableInventory(ctx, trace, inventoryModel) {
  const rows = requireArray(
    ctx,
    "VAL-RUNTIME-NOT-APPLICABLE-001",
    RUNTIME_TRACE_PATH,
    trace["runtime-not-applicable-inventory"],
    "runtime-not-applicable-inventory",
  );
  const records = parseUpstreamRows(ctx, rows, "runtime-not-applicable-inventory", "VAL-RUNTIME-NOT-APPLICABLE-002");
  for (const [key, record] of records.byKey.entries()) {
    if (!inventoryModel.byKey.has(key)) {
      addError(ctx, "VAL-RUNTIME-NOT-APPLICABLE-003", RUNTIME_TRACE_PATH, `runtime-not-applicable-inventory[${record.index}] 不属于 upstream-runtime-obligation-inventory：${key}。`);
    }
    requireString(ctx, "VAL-RUNTIME-NOT-APPLICABLE-004", RUNTIME_TRACE_PATH, record.row?.["not-applicable-reason"], `runtime-not-applicable-inventory[${record.index}].not-applicable-reason`);
    const rowIds = idArrayFromValue(record.row?.["runtime-row-ids"] ?? record.row?.["row-ids"]);
    if (rowIds.length > 0) {
      addError(ctx, "VAL-RUNTIME-NOT-APPLICABLE-005", RUNTIME_TRACE_PATH, `runtime-not-applicable-inventory[${record.index}] 不得声明 runtime-row-ids。`);
    }
  }
  return new Set(records.byKey.keys());
}

function validateRuntimeUpstreamCoverageMap(ctx, trace, expected, expectedUpstream, inventoryModel, notApplicableKeys, canonicalRows) {
  const rows = requireArray(
    ctx,
    "VAL-RUNTIME-COVERAGE-001",
    RUNTIME_TRACE_PATH,
    trace["runtime-upstream-coverage-map"],
    "runtime-upstream-coverage-map",
  );
  const records = parseUpstreamRows(ctx, rows, "runtime-upstream-coverage-map", "VAL-RUNTIME-COVERAGE-002");
  expectSameSet(ctx, "VAL-RUNTIME-COVERAGE-003", RUNTIME_TRACE_PATH, [...records.byKey.keys()], [...inventoryModel.byKey.keys()], "runtime-upstream-coverage-map upstream keys");

  const coveredRuntimeRows = new Set();
  for (const [key, record] of records.byKey.entries()) {
    const row = record.row;
    const label = `runtime-upstream-coverage-map[${record.index}]`;
    requireString(ctx, "VAL-RUNTIME-COVERAGE-004", RUNTIME_TRACE_PATH, row?.["projection-handling"], `${label}.projection-handling`);
    const coverageMode = strip(row?.["coverage-mode"]);
    if (notApplicableKeys.has(key)) {
      expectEqual(ctx, "VAL-RUNTIME-COVERAGE-005", RUNTIME_TRACE_PATH, coverageMode, "not-applicable", `${label}.coverage-mode`);
    }

    validateProposalProjectionIfNeeded(ctx, row, expected, expectedUpstream.get(key), label);

    const rowIds = requireRuntimeRowIds(ctx, row?.["runtime-row-ids"], `${label}.runtime-row-ids`);
    if (coverageMode === "covered-by-runtime-rows") {
      if (rowIds.length === 0) {
        addError(ctx, "VAL-RUNTIME-COVERAGE-006", RUNTIME_TRACE_PATH, `${label} covered row 必须映射至少一个 runtime row。`);
      }
      for (const rowId of rowIds) {
        if (!canonicalRows.has(rowId)) {
          addError(ctx, "VAL-RUNTIME-COVERAGE-007", RUNTIME_TRACE_PATH, `${label} 引用未定义 runtime row：${rowId}。`);
        }
        coveredRuntimeRows.add(rowId);
      }
    } else if (coverageMode === "not-applicable") {
      requireString(ctx, "VAL-RUNTIME-COVERAGE-008", RUNTIME_TRACE_PATH, row?.["not-applicable-reason"], `${label}.not-applicable-reason`);
      if (rowIds.length > 0) {
        addError(ctx, "VAL-RUNTIME-COVERAGE-009", RUNTIME_TRACE_PATH, `${label} not-applicable row 不得声明 runtime-row-ids。`);
      }
    } else {
      addError(ctx, "VAL-RUNTIME-COVERAGE-010", RUNTIME_TRACE_PATH, `${label}.coverage-mode 必须是 covered-by-runtime-rows 或 not-applicable。`);
    }
  }

  return {
    records,
    coveredRuntimeRows,
  };
}

function validateRuntimeCoverageSourceMap(ctx, trace, canonicalRows) {
  const rows = requireArray(
    ctx,
    "VAL-RUNTIME-SOURCE-MAP-001",
    RUNTIME_TRACE_PATH,
    trace["runtime-coverage-source-map"],
    "runtime-coverage-source-map",
  );
  for (const [index, row] of rows.entries()) {
    const rowIds = requireRuntimeRowIds(ctx, row?.["row-ids"] ?? row?.["runtime-row-ids"], `runtime-coverage-source-map[${index}].row-ids`);
    for (const rowId of rowIds) {
      if (!canonicalRows.has(rowId)) {
        addError(ctx, "VAL-RUNTIME-SOURCE-MAP-002", RUNTIME_TRACE_PATH, `runtime-coverage-source-map[${index}] 引用未定义 runtime row：${rowId}。`);
      }
    }
  }
}

function validateCanonicalRuntimeRowCoverage(ctx, canonicalRows, coveredRuntimeRows) {
  expectSameSet(
    ctx,
    "VAL-RUNTIME-CANONICAL-COVERAGE-001",
    RUNTIME_TRACE_PATH,
    [...coveredRuntimeRows],
    [...canonicalRows],
    "canonical runtime rows covered by runtime-upstream-coverage-map",
  );
}

function validateProposalProjectionIfNeeded(ctx, row, expected, expectedRecord, label) {
  if (!expectedRecord || expectedRecord.type !== expected.proposalUpstreamType) return;
  const expectedProjection = strip(expectedRecord.proposalRow?.[expected.projectionField]);
  expectEqual(
    ctx,
    "VAL-RUNTIME-PROJECTION-001",
    RUNTIME_TRACE_PATH,
    row?.[expected.projectionField],
    expectedProjection,
    `${label}.${expected.projectionField}`,
  );
}

function parseUpstreamRows(ctx, rows, section, ruleId) {
  const byKey = new Map();
  for (const [index, row] of rows.entries()) {
    const id = requireString(ctx, ruleId, RUNTIME_TRACE_PATH, row?.["upstream-item-id"], `${section}[${index}].upstream-item-id`);
    const type = requireString(ctx, ruleId, RUNTIME_TRACE_PATH, row?.["upstream-item-type"], `${section}[${index}].upstream-item-type`);
    if (!id || !type) continue;
    const key = upstreamKey(type, id);
    if (byKey.has(key)) {
      addError(ctx, ruleId, RUNTIME_TRACE_PATH, `${section}[${index}] upstream key 重复：${key}。`);
    }
    byKey.set(key, {
      index,
      row,
      id,
      type,
    });
  }
  return { byKey };
}

function requireRuntimeRowIds(ctx, value, label) {
  return requireIdArray(ctx, "VAL-RUNTIME-ROW-ID-001", RUNTIME_TRACE_PATH, value ?? [], label, RUNTIME_ROW_ID_RE);
}

function idArrayFromValue(value) {
  return Array.isArray(value) ? value.map(strip).filter(Boolean) : [];
}

function upstreamKey(type, id) {
  return `${type}::${id}`;
}

function readManifestEntriesLenient(ctx) {
  const manifestFullPath = path.join(ctx.changeDir, "trace", "manifest.json");
  if (!fs.existsSync(manifestFullPath)) return [];
  try {
    return asArray(JSON.parse(fs.readFileSync(manifestFullPath, "utf8")).artifacts);
  } catch {
    return [
      {
        "artifact-id": "runtime-acceptance",
        "artifact-path": RUNTIME_ARTIFACT_PATH,
        "trace-path": RUNTIME_TRACE_PATH,
      },
    ];
  }
}

function isRuntimeManifestEntry(entry) {
  return (
    strip(entry?.["artifact-id"]) === "runtime-acceptance" ||
    strip(entry?.["artifact-path"]) === RUNTIME_ARTIFACT_PATH ||
    strip(entry?.["trace-path"]) === RUNTIME_TRACE_PATH
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

function collectStringLeaves(value, pointer = "") {
  if (typeof value === "string") {
    return [{ value, pointer }];
  }
  if (!value || typeof value !== "object") return [];
  const rows = [];
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      rows.push(...collectStringLeaves(item, `${pointer}/${index}`));
    }
    return rows;
  }
  for (const [key, child] of Object.entries(value)) {
    rows.push(...collectStringLeaves(child, `${pointer}/${escapePointer(key)}`));
  }
  return rows;
}

function collectObjectKeyRefs(value, pointer = "") {
  if (!value || typeof value !== "object") return [];
  const refs = [];
  if (Array.isArray(value)) {
    for (const [index, child] of value.entries()) {
      refs.push(...collectObjectKeyRefs(child, `${pointer}/${index}`));
    }
    return refs;
  }
  for (const [key, child] of Object.entries(value)) {
    const childPointer = `${pointer}/${escapePointer(key)}`;
    refs.push({ key, pointer: childPointer });
    refs.push(...collectObjectKeyRefs(child, childPointer));
  }
  return refs;
}

function collectIds(value, regex, pointer = "") {
  if (typeof value === "string") {
    return [...value.matchAll(new RegExp(regex.source, "gu"))].map((match) => ({
      id: match[0],
      pointer,
    }));
  }
  if (!value || typeof value !== "object") return [];
  const rows = [];
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      rows.push(...collectIds(item, regex, `${pointer}/${index}`));
    }
    return rows;
  }
  for (const [key, child] of Object.entries(value)) {
    rows.push(...collectIds(child, regex, `${pointer}/${escapePointer(key)}`));
  }
  return rows;
}

function escapePointer(value) {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
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
  lines.push(`${result.ok ? "PASS" : "FAIL"} validate-runtime-acceptance-artifact${options.change ? ` --change ${options.change}` : ""}`);
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
  node openspec/agent-runtime/scripts/validators/validate-runtime-acceptance-artifact.mjs --change <slug> [--root <path>]
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
    const result = validateRuntimeAcceptanceArtifact(options);
    process.stdout.write(formatResult(result, options));
    process.exit(result.ok ? 0 : 1);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
