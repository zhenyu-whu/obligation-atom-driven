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
const DECISION_ID_RE = /^D-\d{3}$/u;
const PLACEMENT_ID_RE = /^P-\d{3}$/u;
const GUARD_HANDLINGS = new Set(["must-not", "preserve-boundary", "non-goal"]);
const PROOF_HANDOFF_KINDS = new Set(["runtime-acceptance", "verification", "none"]);
const DELIVERY_LEAK_KEY_RE = /(?:trace|gate|coverage|map|register|matrix)/iu;

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
  validateDesignManifest(ctx);
  validateDesignRender(ctx);
  validateProductionSourceMap(ctx, designTrace, expected, specs);
  validateSpecScenarioDesignMap(ctx, designTrace, expected, specs);

  const refs = validateDesignReferenceSections(ctx, designTrace, expected, specs);
  validateDesignObligationMatrix(ctx, designTrace, expected, specs, refs);
  validateUiControlContracts(ctx, designTrace, expected);
  validateProofExpectationHandoff(ctx, designTrace, expected);
  validateDesignGate(ctx, designTrace, expected);
  validateDeliveryPlane(ctx, designTrace, expected);
  validateResolvedReferences(ctx, refs);

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
      proposalTrace["change-atom-coverage-register"],
      "change-atom-coverage-register",
    );
    return buildExpectedModel({
      schemaName,
      rows: register,
      sourcePath: PROPOSAL_TRACE_PATH,
      sourcePointerRoot: "change-atom-coverage-register",
      idField: "global-atom-id",
      idRegex: GA_ID_RE,
      capabilityField: "owner-capability",
      projectionField: "artifact-projection",
      specProjection: "spec-requirement",
      guardProjection: "spec-guard",
      designProjection: "design-obligation",
      proofProjection: "verification-obligation",
      contextProjection: "contextual-only",
      specsProjectionField: "source-projection",
      specAnchorCapabilityField: "owner-capability",
      productionSourceFields: [
        "global-atom-id",
        "owner-capability",
        "source-document",
        "lines",
        "atom-type",
        "source-fact",
        "normativity",
        "artifact-projection",
      ],
      matrixFields: ["global-atom-id", "owner-capability", "artifact-projection", "source-fact"],
      gateCountField: "direct-atom-count",
      gateIdsField: "direct-atom-ids",
      gateMatrixIdsField: "design-obligation-ids",
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
      sourcePath: PROPOSAL_TRACE_PATH,
      sourcePointerRoot: "change-scope-coverage",
      idField: "scope-item-id",
      idRegex: SI_ID_RE,
      capabilityField: "capability",
      projectionField: "artifact-handling",
      specProjection: "spec",
      guardProjection: "guard",
      designProjection: "design",
      proofProjection: "proof",
      contextProjection: "context",
      specsProjectionField: "artifact-handling",
      specAnchorCapabilityField: "capability",
      productionSourceFields: ["scope-item-id", "capability", "source", "source-fact", "artifact-handling"],
      matrixFields: ["scope-item-id", "capability", "artifact-handling", "source-fact"],
      gateCountField: "scope-item-count",
      gateIdsField: "scope-item-ids",
      gateMatrixIdsField: "design-scope-item-ids",
    });
  }

  addError(ctx, "VAL-DESIGN-PROPOSAL-020", PROPOSAL_TRACE_PATH, `不支持的 proposal schema-name：${schemaName || "(empty)"}`);
  return null;
}

function buildExpectedModel(config) {
  const rows = [];
  const rowsById = new Map();
  const indexById = new Map();
  for (const [index, row] of config.rows.entries()) {
    const id = strip(row?.[config.idField]);
    if (!id) continue;
    rows.push(row);
    if (!rowsById.has(id)) {
      rowsById.set(id, row);
      indexById.set(id, index);
    }
  }
  const specRelevantIds = rows
    .filter((row) => isSpecRelevantProjection(strip(row?.[config.projectionField]), config))
    .map((row) => strip(row?.[config.idField]))
    .filter(Boolean);
  return {
    ...config,
    rows,
    rowsById,
    indexById,
    ids: rows.map((row) => strip(row?.[config.idField])).filter(Boolean),
    specRelevantIds,
  };
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
    const sourceTrace = requireArray(ctx, "VAL-DESIGN-SPECS-005", NO_DELTA_TRACE_PATH, trace["requirement-source-trace"], "requirement-source-trace");
    if (sourceTrace.length !== 0) {
      addError(ctx, "VAL-DESIGN-SPECS-006", NO_DELTA_TRACE_PATH, "no-delta specs trace 的 requirement-source-trace 必须为空。");
    }
    if (expected.specRelevantIds.length > 0) {
      addError(ctx, "VAL-DESIGN-SPECS-007", NO_DELTA_TRACE_PATH, "proposal 存在 spec/guard item 时，design 不能消费 no-delta specs marker。");
    }
    return {
      mode: NO_DELTA_SPECS_COMPLETION_MODE,
      tracePaths,
      anchors: [],
      anchorsByKey: new Map(),
      anchorsById: new Map(),
    };
  }

  const anchors = [];
  const anchorsByKey = new Map();
  const anchorsById = new Map();
  for (const tracePath of tracePaths) {
    const trace = readJson(ctx, path.join(ctx.changeDir, tracePath));
    if (!trace) continue;
    expectEqual(ctx, "VAL-DESIGN-SPECS-010", tracePath, trace["artifact-id"], "specs", "artifact-id");
    expectEqual(ctx, "VAL-DESIGN-SPECS-011", tracePath, trace["schema-name"], expected.schemaName, "schema-name");
    expectEqual(ctx, "VAL-DESIGN-SPECS-012", tracePath, trace["specs-completion-mode"], "delta", "specs-completion-mode");

    const sourceTrace = requireArray(ctx, "VAL-DESIGN-SPECS-013", tracePath, trace["requirement-source-trace"], "requirement-source-trace");
    for (const [index, row] of sourceTrace.entries()) {
      const id = requireId(ctx, "VAL-DESIGN-SPECS-014", tracePath, row?.[expected.idField], `requirement-source-trace[${index}].${expected.idField}`, expected.idRegex);
      if (!id) continue;
      if (!expected.rowsById.has(id)) {
        addError(ctx, "VAL-DESIGN-SPECS-015", tracePath, `${id} 不属于 proposal source/scope set。`);
      } else {
        const proposalRow = expected.rowsById.get(id);
        const projection = strip(proposalRow?.[expected.projectionField]);
        if (!isSpecRelevantProjection(projection, expected)) {
          addError(ctx, "VAL-DESIGN-SPECS-016", tracePath, `${id} 不是 proposal spec/guard item，不能作为 specs anchor。`);
        }
      }

      const pointer = `#/requirement-source-trace/${index}`;
      const key = anchorKey(tracePath, pointer);
      const anchor = {
        key,
        tracePath,
        tracePointer: pointer,
        id,
        capability: strip(row?.[expected.specAnchorCapabilityField]),
        requirement: strip(row?.requirement),
        scenario: strip(row?.scenario),
        specHandling: strip(row?.["spec-handling"]),
        projection: strip(row?.[expected.specsProjectionField]),
      };
      anchors.push(anchor);
      if (anchorsByKey.has(key)) {
        addError(ctx, "VAL-DESIGN-SPECS-017", tracePath, `重复 specs anchor：${key}`);
      }
      anchorsByKey.set(key, anchor);
      if (!anchorsById.has(id)) anchorsById.set(id, []);
      anchorsById.get(id).push(anchor);
    }
  }

  return {
    mode: "delta",
    tracePaths,
    anchors,
    anchorsByKey,
    anchorsById,
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
  requireObject(ctx, "VAL-DESIGN-TRACE-009", DESIGN_TRACE_PATH, trace["production-alignment-gate"], "production-alignment-gate");

  expectEqual(ctx, "VAL-DESIGN-SOURCE-INTERFACE-001", DESIGN_TRACE_PATH, sourceInterface["proposal-trace"], PROPOSAL_TRACE_PATH, "source-interface.proposal-trace");
  expectEqual(ctx, "VAL-DESIGN-SOURCE-INTERFACE-002", DESIGN_TRACE_PATH, sourceInterface["specs-completion-mode"], specs.mode, "source-interface.specs-completion-mode");
  const specTraces = requireArray(ctx, "VAL-DESIGN-SOURCE-INTERFACE-003", DESIGN_TRACE_PATH, sourceInterface["spec-traces"], "source-interface.spec-traces")
    .map(strip)
    .filter(Boolean);
  expectSameSet(ctx, "VAL-DESIGN-SOURCE-INTERFACE-004", DESIGN_TRACE_PATH, specTraces, specs.tracePaths, "source-interface.spec-traces");
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

function validateProductionSourceMap(ctx, trace, expected, specs) {
  const rows = requireArray(ctx, "VAL-DESIGN-SOURCE-001", DESIGN_TRACE_PATH, trace["production-source-map"], "production-source-map");
  const actualIds = [];
  const seenIds = new Set();
  for (const [index, row] of rows.entries()) {
    rejectGroupedIds(ctx, row, "VAL-DESIGN-SOURCE-002", DESIGN_TRACE_PATH, `production-source-map[${index}]`);
    const id = requireId(ctx, "VAL-DESIGN-SOURCE-003", DESIGN_TRACE_PATH, row?.[expected.idField], `production-source-map[${index}].${expected.idField}`, expected.idRegex);
    if (!id) continue;
    if (seenIds.has(id)) {
      addError(ctx, "VAL-DESIGN-SOURCE-010", DESIGN_TRACE_PATH, `production-source-map source/scope ID 重复：${id}`);
    }
    seenIds.add(id);
    actualIds.push(id);

    const proposalRow = expected.rowsById.get(id);
    if (!proposalRow) {
      addError(ctx, "VAL-DESIGN-SOURCE-004", DESIGN_TRACE_PATH, `${id} 不属于 proposal source/scope set。`);
      continue;
    }

    for (const field of expected.productionSourceFields) {
      expectEqual(ctx, "VAL-DESIGN-SOURCE-005", DESIGN_TRACE_PATH, row?.[field], proposalRow?.[field], `production-source-map[${index}].${field}`);
    }
    expectEqual(
      ctx,
      "VAL-DESIGN-SOURCE-006",
      DESIGN_TRACE_PATH,
      row?.["proposal-trace-anchor"],
      `${PROPOSAL_TRACE_PATH}#/${expected.sourcePointerRoot}/${expected.indexById.get(id)}`,
      `production-source-map[${index}].proposal-trace-anchor`,
    );

    const anchors = requireArray(ctx, "VAL-DESIGN-SOURCE-007", DESIGN_TRACE_PATH, row?.["spec-trace-anchors"] ?? [], `production-source-map[${index}].spec-trace-anchors`);
    validateInlineSpecAnchors(ctx, anchors, specs.anchorsById.get(id) ?? [], expected, `production-source-map[${index}].spec-trace-anchors`);
    validateIdArrayReferences(ctx, row?.["design-handling-ids"] ?? [], DECISION_ID_RE, `production-source-map[${index}].design-handling-ids`, DESIGN_TRACE_PATH);
    validateIdArrayReferences(ctx, row?.["implementation-placement-ids"] ?? [], PLACEMENT_ID_RE, `production-source-map[${index}].implementation-placement-ids`, DESIGN_TRACE_PATH);
    requireString(ctx, "VAL-DESIGN-SOURCE-009", DESIGN_TRACE_PATH, row?.["no-scope-expansion-check"], `production-source-map[${index}].no-scope-expansion-check`);
  }

  expectSameSet(ctx, "VAL-DESIGN-SOURCE-008", DESIGN_TRACE_PATH, actualIds, expected.ids, "production-source-map IDs");
}

function validateInlineSpecAnchors(ctx, rows, expectedAnchors, expected, label) {
  const actualKeys = [];
  for (const [index, row] of rows.entries()) {
    const key = anchorKey(strip(row?.["trace-path"]), strip(row?.["trace-pointer"]));
    actualKeys.push(key);
    const anchor = expectedAnchors.find((candidate) => candidate.key === key);
    if (!anchor) {
      addError(ctx, "VAL-DESIGN-SOURCE-020", DESIGN_TRACE_PATH, `${label}[${index}] 引用未知 specs anchor：${key}`);
      continue;
    }
    expectEqual(ctx, "VAL-DESIGN-SOURCE-021", DESIGN_TRACE_PATH, row?.[expected.specAnchorCapabilityField], anchor.capability, `${label}[${index}].${expected.specAnchorCapabilityField}`);
    expectEqual(ctx, "VAL-DESIGN-SOURCE-022", DESIGN_TRACE_PATH, row?.requirement, anchor.requirement, `${label}[${index}].requirement`);
    expectEqual(ctx, "VAL-DESIGN-SOURCE-023", DESIGN_TRACE_PATH, row?.scenario, anchor.scenario, `${label}[${index}].scenario`);
    expectEqual(ctx, "VAL-DESIGN-SOURCE-024", DESIGN_TRACE_PATH, row?.["spec-handling"], anchor.specHandling, `${label}[${index}].spec-handling`);
    expectEqual(ctx, "VAL-DESIGN-SOURCE-025", DESIGN_TRACE_PATH, row?.[expected.specsProjectionField], anchor.projection, `${label}[${index}].${expected.specsProjectionField}`);
  }
  expectSameSet(ctx, "VAL-DESIGN-SOURCE-026", DESIGN_TRACE_PATH, actualKeys, expectedAnchors.map((anchor) => anchor.key), label);
}

function validateSpecScenarioDesignMap(ctx, trace, expected, specs) {
  const rows = requireArray(ctx, "VAL-DESIGN-SPEC-001", DESIGN_TRACE_PATH, trace["spec-scenario-design-map"], "spec-scenario-design-map");
  const actualKeys = [];
  const seenKeys = new Set();
  for (const [index, row] of rows.entries()) {
    const key = anchorKey(strip(row?.["trace-path"]), strip(row?.["trace-pointer"]));
    if (seenKeys.has(key)) {
      addError(ctx, "VAL-DESIGN-SPEC-010", DESIGN_TRACE_PATH, `spec-scenario-design-map anchor 重复：${key}`);
    }
    seenKeys.add(key);
    actualKeys.push(key);
    const anchor = specs.anchorsByKey.get(key);
    if (!anchor) {
      addError(ctx, "VAL-DESIGN-SPEC-002", DESIGN_TRACE_PATH, `spec-scenario-design-map[${index}] 引用未知 specs anchor：${key}`);
      continue;
    }

    expectEqual(ctx, "VAL-DESIGN-SPEC-003", DESIGN_TRACE_PATH, row?.[expected.idField], anchor.id, `spec-scenario-design-map[${index}].${expected.idField}`);
    expectEqual(ctx, "VAL-DESIGN-SPEC-004", DESIGN_TRACE_PATH, row?.[expected.specAnchorCapabilityField], anchor.capability, `spec-scenario-design-map[${index}].${expected.specAnchorCapabilityField}`);
    expectEqual(ctx, "VAL-DESIGN-SPEC-005", DESIGN_TRACE_PATH, row?.requirement, anchor.requirement, `spec-scenario-design-map[${index}].requirement`);
    expectEqual(ctx, "VAL-DESIGN-SPEC-006", DESIGN_TRACE_PATH, row?.scenario, anchor.scenario, `spec-scenario-design-map[${index}].scenario`);
    const decisionIds = validateIdArrayReferences(ctx, row?.["decision-ids"] ?? [], DECISION_ID_RE, `spec-scenario-design-map[${index}].decision-ids`, DESIGN_TRACE_PATH);
    const placementIds = validateIdArrayReferences(ctx, row?.["placement-ids"] ?? [], PLACEMENT_ID_RE, `spec-scenario-design-map[${index}].placement-ids`, DESIGN_TRACE_PATH);
    if (decisionIds.length === 0 && placementIds.length === 0) {
      addError(ctx, "VAL-DESIGN-SPEC-007", DESIGN_TRACE_PATH, `spec-scenario-design-map[${index}] 必须至少引用一个 D-### 或 P-###。`);
    }
    requireString(ctx, "VAL-DESIGN-SPEC-009", DESIGN_TRACE_PATH, row?.["design-handling"], `spec-scenario-design-map[${index}].design-handling`);
  }
  expectSameSet(ctx, "VAL-DESIGN-SPEC-008", DESIGN_TRACE_PATH, actualKeys, specs.anchors.map((anchor) => anchor.key), "spec-scenario-design-map anchors");
}

function validateDesignReferenceSections(ctx, trace, expected) {
  const refs = {
    ctx,
    expected,
    definedDecisions: new Set(),
    definedPlacements: new Set(),
    referencedDecisions: new Set(),
    referencedPlacements: new Set(),
    sourceRefs: [],
  };

  const decisionRows = requireArray(ctx, "VAL-DESIGN-DECISION-001", DESIGN_TRACE_PATH, trace["design-decision-index"], "design-decision-index");
  for (const [index, row] of decisionRows.entries()) {
    const decisionId = requireId(ctx, "VAL-DESIGN-DECISION-002", DESIGN_TRACE_PATH, row?.["decision-id"], `design-decision-index[${index}].decision-id`, DECISION_ID_RE);
    if (decisionId) {
      if (refs.definedDecisions.has(decisionId)) {
        addError(ctx, "VAL-DESIGN-DECISION-003", DESIGN_TRACE_PATH, `design-decision-index decision-id 重复：${decisionId}`);
      }
      refs.definedDecisions.add(decisionId);
    }
    requireString(ctx, "VAL-DESIGN-DECISION-004", DESIGN_TRACE_PATH, row?.title, `design-decision-index[${index}].title`);
    requireString(ctx, "VAL-DESIGN-DECISION-005", DESIGN_TRACE_PATH, row?.["design-handling"], `design-decision-index[${index}].design-handling`);
    refs.sourceRefs.push(...validateSourceIdArray(ctx, expected, row?.["source-item-ids"] ?? [], `design-decision-index[${index}].source-item-ids`));
    addReferencedIds(refs.referencedPlacements, validateIdArrayReferences(ctx, row?.["placement-ids"] ?? [], PLACEMENT_ID_RE, `design-decision-index[${index}].placement-ids`, DESIGN_TRACE_PATH));
  }

  const sourceScopeMap = requireObject(ctx, "VAL-DESIGN-SCOPE-001", DESIGN_TRACE_PATH, trace["source-scope-map"], "source-scope-map");
  const placementRows = requireArray(ctx, "VAL-DESIGN-SCOPE-002", DESIGN_TRACE_PATH, sourceScopeMap["implementation-placement-map"], "source-scope-map.implementation-placement-map");
  for (const [index, row] of placementRows.entries()) {
    const placementId = requireId(ctx, "VAL-DESIGN-SCOPE-003", DESIGN_TRACE_PATH, row?.["placement-id"], `implementation-placement-map[${index}].placement-id`, PLACEMENT_ID_RE);
    if (placementId) {
      if (refs.definedPlacements.has(placementId)) {
        addError(ctx, "VAL-DESIGN-SCOPE-004", DESIGN_TRACE_PATH, `implementation-placement-map placement-id 重复：${placementId}`);
      }
      refs.definedPlacements.add(placementId);
    }
    for (const field of ["placement", "path-boundary", "owner", "implementation-contract"]) {
      requireString(ctx, "VAL-DESIGN-SCOPE-005", DESIGN_TRACE_PATH, row?.[field], `implementation-placement-map[${index}].${field}`);
    }
  }

  const directRows = requireArray(ctx, "VAL-DESIGN-SCOPE-010", DESIGN_TRACE_PATH, sourceScopeMap["direct-source-item-handling"], "source-scope-map.direct-source-item-handling");
  const directIds = [];
  const seenDirectIds = new Set();
  for (const [index, row] of directRows.entries()) {
    const id = requireId(ctx, "VAL-DESIGN-SCOPE-011", DESIGN_TRACE_PATH, row?.[expected.idField], `direct-source-item-handling[${index}].${expected.idField}`, expected.idRegex);
    if (id) {
      if (seenDirectIds.has(id)) {
        addError(ctx, "VAL-DESIGN-SCOPE-016", DESIGN_TRACE_PATH, `direct-source-item-handling source/scope ID 重复：${id}`);
      }
      seenDirectIds.add(id);
      directIds.push(id);
    }
    refs.sourceRefs.push(id);
    requireString(ctx, "VAL-DESIGN-SCOPE-012", DESIGN_TRACE_PATH, row?.handling, `direct-source-item-handling[${index}].handling`);
    requireString(ctx, "VAL-DESIGN-SCOPE-013", DESIGN_TRACE_PATH, row?.["no-scope-expansion"], `direct-source-item-handling[${index}].no-scope-expansion`);
    addReferencedIds(refs.referencedDecisions, validateIdArrayReferences(ctx, row?.["decision-ids"] ?? [], DECISION_ID_RE, `direct-source-item-handling[${index}].decision-ids`, DESIGN_TRACE_PATH));
    addReferencedIds(refs.referencedPlacements, validateIdArrayReferences(ctx, row?.["placement-ids"] ?? [], PLACEMENT_ID_RE, `direct-source-item-handling[${index}].placement-ids`, DESIGN_TRACE_PATH));
  }
  expectSameSet(ctx, "VAL-DESIGN-SCOPE-014", DESIGN_TRACE_PATH, directIds, expected.ids, "direct-source-item-handling IDs");
  requireArray(ctx, "VAL-DESIGN-SCOPE-015", DESIGN_TRACE_PATH, sourceScopeMap["non-direct-boundary-handling"] ?? [], "source-scope-map.non-direct-boundary-handling");

  const deliveryDecisions = asArray(trace["delivery-plane"]?.decisions);
  const deliveryDecisionIds = [];
  for (const [index, row] of deliveryDecisions.entries()) {
    const decisionId = requireId(ctx, "VAL-DESIGN-DELIVERY-020", DESIGN_TRACE_PATH, row?.["decision-id"], `delivery-plane.decisions[${index}].decision-id`, DECISION_ID_RE);
    if (decisionId) deliveryDecisionIds.push(decisionId);
  }
  expectSameSet(ctx, "VAL-DESIGN-DELIVERY-021", DESIGN_TRACE_PATH, deliveryDecisionIds, [...refs.definedDecisions], "delivery-plane decisions vs design-decision-index");

  return refs;
}

function validateDesignObligationMatrix(ctx, trace, expected, specs, refs) {
  const rows = requireArray(ctx, "VAL-DESIGN-MATRIX-001", DESIGN_TRACE_PATH, trace["design-obligation-matrix"], "design-obligation-matrix");
  const actualIds = [];
  const seenIds = new Set();
  const proofRows = new Set();

  for (const [index, row] of rows.entries()) {
    rejectGroupedIds(ctx, row, "VAL-DESIGN-MATRIX-002", DESIGN_TRACE_PATH, `design-obligation-matrix[${index}]`);
    requireString(ctx, "VAL-DESIGN-MATRIX-003", DESIGN_TRACE_PATH, row?.["matrix-row-id"], `design-obligation-matrix[${index}].matrix-row-id`);
    const id = requireId(ctx, "VAL-DESIGN-MATRIX-004", DESIGN_TRACE_PATH, row?.[expected.idField], `design-obligation-matrix[${index}].${expected.idField}`, expected.idRegex);
    if (!id) continue;
    if (seenIds.has(id)) {
      addError(ctx, "VAL-DESIGN-MATRIX-031", DESIGN_TRACE_PATH, `design-obligation-matrix source/scope ID 重复：${id}`);
    }
    seenIds.add(id);
    actualIds.push(id);
    refs.sourceRefs.push(id);

    const proposalRow = expected.rowsById.get(id);
    if (!proposalRow) {
      addError(ctx, "VAL-DESIGN-MATRIX-005", DESIGN_TRACE_PATH, `${id} 不属于 proposal source/scope set。`);
      continue;
    }
    for (const field of expected.matrixFields) {
      expectEqual(ctx, "VAL-DESIGN-MATRIX-006", DESIGN_TRACE_PATH, row?.[field], proposalRow?.[field], `design-obligation-matrix[${index}].${field}`);
    }

    const projection = strip(proposalRow?.[expected.projectionField]);
    const decisionIds = validateIdArrayReferences(ctx, row?.["decision-ids"] ?? [], DECISION_ID_RE, `design-obligation-matrix[${index}].decision-ids`, DESIGN_TRACE_PATH);
    const placementIds = validateIdArrayReferences(ctx, row?.["placement-ids"] ?? [], PLACEMENT_ID_RE, `design-obligation-matrix[${index}].placement-ids`, DESIGN_TRACE_PATH);
    addReferencedIds(refs.referencedDecisions, decisionIds);
    addReferencedIds(refs.referencedPlacements, placementIds);

    validateMatrixSpecAnchors(ctx, row, id, specs, `design-obligation-matrix[${index}].spec-scenario-anchors`);
    validateMatrixProjectionHandling(ctx, row, projection, decisionIds, placementIds, expected, id, index, proofRows);
    requireString(ctx, "VAL-DESIGN-MATRIX-020", DESIGN_TRACE_PATH, row?.["no-scope-expansion"], `design-obligation-matrix[${index}].no-scope-expansion`);
    if (!isNoLike(row?.["explicit-blocker"])) {
      addError(ctx, "VAL-DESIGN-MATRIX-021", DESIGN_TRACE_PATH, `design-obligation-matrix[${index}].explicit-blocker 必须为空、无、None 或 N/A。`);
    }
  }

  expectSameSet(ctx, "VAL-DESIGN-MATRIX-030", DESIGN_TRACE_PATH, actualIds, expected.ids, "design-obligation-matrix IDs");
  refs.proofRows = proofRows;
}

function validateMatrixSpecAnchors(ctx, row, id, specs, label) {
  const expectedLabels = (specs.anchorsById.get(id) ?? []).map(specAnchorLabel);
  const actualLabels = requireArray(ctx, "VAL-DESIGN-MATRIX-010", DESIGN_TRACE_PATH, row?.["spec-scenario-anchors"] ?? [], label)
    .map(strip)
    .filter(Boolean);
  expectSameSet(ctx, "VAL-DESIGN-MATRIX-011", DESIGN_TRACE_PATH, actualLabels, expectedLabels, label);
}

function validateMatrixProjectionHandling(ctx, row, projection, decisionIds, placementIds, expected, id, index, proofRows) {
  const hasDesignHandling = decisionIds.length > 0 || placementIds.length > 0;
  if (projection === expected.specProjection || projection === expected.guardProjection || projection === expected.designProjection) {
    if (!hasDesignHandling) {
      addError(ctx, "VAL-DESIGN-MATRIX-040", DESIGN_TRACE_PATH, `${id} 是 ${projection} item，必须至少引用一个 D-### 或 P-###。`);
    }
  }

  if (projection === expected.guardProjection) {
    const guardHandling = strip(row?.["guard-handling"]);
    if (!GUARD_HANDLINGS.has(guardHandling)) {
      addError(ctx, "VAL-DESIGN-MATRIX-041", DESIGN_TRACE_PATH, `design-obligation-matrix[${index}].guard-handling 必须是 must-not / preserve-boundary / non-goal。`);
    }
  }

  if (projection === expected.proofProjection) {
    proofRows.add(id);
    if (isNoLike(row?.["proof-expectation"])) {
      addError(ctx, "VAL-DESIGN-MATRIX-042", DESIGN_TRACE_PATH, `${id} 是 proof item，proof-expectation 必须记录 handoff。`);
    }
  }

  if (projection === expected.contextProjection) {
    if (hasDesignHandling) {
      addError(ctx, "VAL-DESIGN-MATRIX-043", DESIGN_TRACE_PATH, `${id} 是 context item，只能保留 no-scope handling，不得引用 D/P implementation handling。`);
    }
    if (!isNoLike(row?.["proof-expectation"])) {
      addError(ctx, "VAL-DESIGN-MATRIX-044", DESIGN_TRACE_PATH, `${id} 是 context item，不得声明 proof expectation。`);
    }
  }
}

function validateUiControlContracts(ctx, trace, expected) {
  const rows = requireArray(ctx, "VAL-DESIGN-UI-001", DESIGN_TRACE_PATH, trace["ui-control-contracts"] ?? [], "ui-control-contracts");
  for (const [index, row] of rows.entries()) {
    requireString(ctx, "VAL-DESIGN-UI-002", DESIGN_TRACE_PATH, row?.["control-id"], `ui-control-contracts[${index}].control-id`);
    for (const field of [
      "owner-component",
      "event-trigger",
      "handler-or-api-route",
      "request-payload",
      "response-merge-or-reload",
      "submitting-disabled-error-retry",
    ]) {
      requireString(ctx, "VAL-DESIGN-UI-003", DESIGN_TRACE_PATH, row?.[field], `ui-control-contracts[${index}].${field}`);
    }
    validateSourceIdArray(ctx, expected, row?.["source-item-ids"] ?? [], `ui-control-contracts[${index}].source-item-ids`);
  }
}

function validateProofExpectationHandoff(ctx, trace, expected) {
  const rows = requireArray(ctx, "VAL-DESIGN-PROOF-001", DESIGN_TRACE_PATH, trace["proof-expectation-handoff"] ?? [], "proof-expectation-handoff");
  const rowsById = new Map();
  for (const [index, row] of rows.entries()) {
    const id = requireId(ctx, "VAL-DESIGN-PROOF-002", DESIGN_TRACE_PATH, row?.["source-item-id"], `proof-expectation-handoff[${index}].source-item-id`, expected.idRegex);
    if (!id) continue;
    if (!expected.rowsById.has(id)) {
      addError(ctx, "VAL-DESIGN-PROOF-003", DESIGN_TRACE_PATH, `${id} 不属于 proposal source/scope set。`);
    }
    if (!rowsById.has(id)) rowsById.set(id, []);
    rowsById.get(id).push(row);

    const handoffKind = strip(row?.["handoff-kind"]);
    if (!PROOF_HANDOFF_KINDS.has(handoffKind)) {
      addError(ctx, "VAL-DESIGN-PROOF-004", DESIGN_TRACE_PATH, `proof-expectation-handoff[${index}].handoff-kind 必须是 runtime-acceptance / verification / none。`);
    }
    requireString(ctx, "VAL-DESIGN-PROOF-005", DESIGN_TRACE_PATH, row?.expectation, `proof-expectation-handoff[${index}].expectation`);
  }

  const proofIds = expected.rows
    .filter((row) => strip(row?.[expected.projectionField]) === expected.proofProjection)
    .map((row) => strip(row?.[expected.idField]))
    .filter(Boolean);
  for (const id of proofIds) {
    const rowsForId = rowsById.get(id) ?? [];
    if (rowsForId.length === 0) {
      addError(ctx, "VAL-DESIGN-PROOF-006", DESIGN_TRACE_PATH, `${id} 是 proof item，必须存在 proof-expectation-handoff row。`);
      continue;
    }
    if (!rowsForId.some((row) => strip(row?.["handoff-kind"]) !== "none")) {
      addError(ctx, "VAL-DESIGN-PROOF-007", DESIGN_TRACE_PATH, `${id} 是 proof item，handoff-kind 不能全部为 none。`);
    }
  }
}

function validateDesignGate(ctx, trace, expected) {
  const gate = requireObject(ctx, "VAL-DESIGN-GATE-001", DESIGN_TRACE_PATH, trace["production-alignment-gate"], "production-alignment-gate");
  const blockers = requireArray(ctx, "VAL-DESIGN-GATE-002", DESIGN_TRACE_PATH, gate.blockers ?? [], "production-alignment-gate.blockers");
  if (blockers.length !== 0) {
    addError(ctx, "VAL-DESIGN-GATE-003", DESIGN_TRACE_PATH, "production-alignment-gate.blockers 必须为空；非空 blocker 不能进入 validator pass。");
  }

  expectEqual(ctx, "VAL-DESIGN-GATE-004", DESIGN_TRACE_PATH, gate["change-slug"], ctx.change, "production-alignment-gate.change-slug");
  expectEqual(ctx, "VAL-DESIGN-GATE-005", DESIGN_TRACE_PATH, gate["schema-name"], expected.schemaName, "production-alignment-gate.schema-name");
  const ids = requireIdArray(ctx, "VAL-DESIGN-GATE-006", DESIGN_TRACE_PATH, gate[expected.gateIdsField] ?? [], `production-alignment-gate.${expected.gateIdsField}`, expected.idRegex);
  expectEqual(ctx, "VAL-DESIGN-GATE-007", DESIGN_TRACE_PATH, gate[expected.gateCountField], ids.length, `production-alignment-gate.${expected.gateCountField}`);
  expectSameSet(ctx, "VAL-DESIGN-GATE-008", DESIGN_TRACE_PATH, ids, expected.ids, `production-alignment-gate.${expected.gateIdsField}`);
  const matrixIds = requireIdArray(ctx, "VAL-DESIGN-GATE-009", DESIGN_TRACE_PATH, gate[expected.gateMatrixIdsField] ?? [], `production-alignment-gate.${expected.gateMatrixIdsField}`, expected.idRegex);
  expectSameSet(ctx, "VAL-DESIGN-GATE-010", DESIGN_TRACE_PATH, matrixIds, expected.ids, `production-alignment-gate.${expected.gateMatrixIdsField}`);
}

function validateDeliveryPlane(ctx, trace, expected) {
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
}

function validateResolvedReferences(ctx, refs) {
  for (const id of refs.sourceRefs.map(strip).filter(Boolean)) {
    if (!refs.expected.rowsById.has(id)) {
      addError(ctx, "VAL-DESIGN-REF-001", DESIGN_TRACE_PATH, `引用了未知 source/scope ID：${id}`);
    }
  }

  for (const decisionId of refs.referencedDecisions) {
    if (!refs.definedDecisions.has(decisionId)) {
      addError(ctx, "VAL-DESIGN-REF-002", DESIGN_TRACE_PATH, `引用了未定义 decision-id：${decisionId}`);
    }
  }
  for (const decisionId of refs.definedDecisions) {
    if (!refs.referencedDecisions.has(decisionId)) {
      addError(ctx, "VAL-DESIGN-REF-003", DESIGN_TRACE_PATH, `design-decision-index 存在 orphan decision-id：${decisionId}`);
    }
  }

  for (const placementId of refs.referencedPlacements) {
    if (!refs.definedPlacements.has(placementId)) {
      addError(ctx, "VAL-DESIGN-REF-004", DESIGN_TRACE_PATH, `引用了未定义 placement-id：${placementId}`);
    }
  }
  for (const placementId of refs.definedPlacements) {
    if (!refs.referencedPlacements.has(placementId)) {
      addError(ctx, "VAL-DESIGN-REF-005", DESIGN_TRACE_PATH, `implementation-placement-map 存在 orphan placement-id：${placementId}`);
    }
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

function validateSourceIdArray(ctx, expected, value, label) {
  const ids = requireIdArray(ctx, "VAL-DESIGN-SOURCE-ID-001", DESIGN_TRACE_PATH, value, label, expected.idRegex);
  for (const id of ids) {
    if (!expected.rowsById.has(id)) {
      addError(ctx, "VAL-DESIGN-SOURCE-ID-002", DESIGN_TRACE_PATH, `${label} 引用未知 source/scope ID：${id}`);
    }
  }
  return ids;
}

function validateIdArrayReferences(ctx, value, regex, label, file) {
  return requireIdArray(ctx, "VAL-DESIGN-IDREF-001", file, value, label, regex);
}

function addReferencedIds(target, ids) {
  for (const id of ids) target.add(id);
}

function isSpecRelevantProjection(projection, expected) {
  return projection === expected.specProjection || projection === expected.guardProjection;
}

function specAnchorLabel(anchor) {
  return `${anchor.capability}::${anchor.requirement}::${anchor.scenario}`;
}

function anchorKey(tracePath, tracePointer) {
  return `${tracePath}#${tracePointer}`;
}

function isNoLike(value) {
  const text = strip(value);
  return !text || text === "无" || text === "None" || text === "N/A" || text === "none" || text === "n/a";
}

function rejectGroupedIds(ctx, row, ruleId, tracePath, label) {
  for (const field of ["global-atom-ids", "atom-ids", "scope-item-ids", "ids"]) {
    if (field in Object(row)) {
      addError(ctx, ruleId, tracePath, `${label} 不得使用 ${field} 汇总多个 ID。`);
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
