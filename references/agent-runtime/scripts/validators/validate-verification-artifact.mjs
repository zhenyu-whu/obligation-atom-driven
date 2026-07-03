#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  INLINE_PROOF_SLICES_MODEL_PATH,
  PROOF_SLICES_TRACE_PATH,
  PROOF_SLICES_TRACE_SCHEMA,
  RENDER_CONTRACT_VERSION,
  TRACE_CONTRACT_VERSION,
  TRACE_SCHEMA,
  VERIFICATION_TRACE_PATH,
  renderChangeArtifact,
} from "../render-production-artifacts.mjs";

const VERIFICATION_ARTIFACT_PATH = "verification.md";
const RUNTIME_TRACE_PATH = "trace/runtime-acceptance.trace.json";
const RUNTIME_ARTIFACT_PATH = "runtime-acceptance.md";
const PROPOSAL_TRACE_PATH = "trace/proposal.trace.json";

const DEFAULT_SCHEMA = "production-default-acceptance-driven";
const OBLIGATION_SCHEMA = "production-obligation-atom-driven";

const RUNTIME_ROW_ID_RE = /^(RS|OP|ST|CH)-\d{3}$/u;
const PROOF_SLICE_ID_RE = /^PS-\d{3}$/u;
const BRANCH_ID_RE = /^VRB-\d{3}$/u;
const KEBAB_KEY_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;
const TEST_FILE_RE = /(?:^|\/)[^/\s]+\.(?:test|spec)\.[cm]?[jt]sx?\b/u;
const EVIDENCE_PATH_RE = /(?:^|\/)(?:openspec-results|test-results)\//u;
const COMMAND_RE = /\b(?:pnpm|npm|yarn|npx|vitest|jest|playwright test|go test|pytest|cargo test|bun test|node\s+(?:--[a-z-]+|[-\w./]+\.m?js))\b/u;
const OWNER_LIST_RE = /[,;，；、]|\s+(?:and|和)\s+/iu;

const PRIMITIVE_TYPES = new Set([
  "operation",
  "state",
  "failure",
  "negative-boundary",
  "layout",
  "observability",
  "fixture-variant",
  "authorization",
]);

const PRIMARY_LAYERS = new Set([
  "unit",
  "component",
  "route/API",
  "DB/integration",
  "contract",
  "worker/job",
  "realtime/SSE",
  "browser/e2e",
  "visual/responsive",
  "security/negative",
]);

const PROOF_EVIDENCE_MODES = new Set([
  "durable-test",
  "readiness-command",
  "build-command",
  "codegen-command",
  "compose-config-readback",
  "static-boundary-readback",
  "manual-environment",
]);

const PLACEMENT_BASES = new Set([
  "existing-tests-directory",
  "planned-layer-subdirectory",
  "workspace-tests-directory",
  "nonpersistent-evidence",
]);

const BRANCH_HANDLINGS = new Set(["proof-slice", "manual-environment", "not-applicable"]);
const RECONCILIATION_STATUSES = new Set(["covered", "manual-environment", "not-applicable", "blocked"]);
const VERIFICATION_SCOPE_ROLES = new Set(["required behavior", "preserve boundary", "proof-only"]);

const LAYER_TEST_SUBTREES = {
  unit: ["tests/unit/**"],
  component: ["tests/component/**"],
  "route/API": ["tests/api/**", "tests/contract/**"],
  "DB/integration": ["tests/integration/**"],
  contract: ["tests/contract/**"],
  "worker/job": ["tests/worker/**"],
  "realtime/SSE": ["tests/integration/**"],
  "browser/e2e": ["tests/e2e/**"],
  "visual/responsive": ["tests/e2e/**"],
  "security/negative": ["tests/security/**"],
};

const RUNTIME_INDEX_SECTIONS = [
  ["surface-rows", "surface", /^RS-\d{3}$/u],
  ["operation-rows", "operation", /^OP-\d{3}$/u],
  ["state-rows", "state", /^ST-\d{3}$/u],
  ["chain-rows", "chain", /^CH-\d{3}$/u],
];

export function validateVerificationArtifact(options = {}) {
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

  validateVerificationIfPresent(ctx);

  return resultFor(ctx);
}

function validateVerificationIfPresent(ctx) {
  const inventory = collectVerificationInventory(ctx);
  if (!inventory.hasAnyVerificationOutput) {
    addWarning(ctx, "VAL-VERIFICATION-000", VERIFICATION_TRACE_PATH, "未发现 verification trace/artifact/manifest entry；partial validator 跳过 verification。");
    return;
  }

  if (inventory.legacySidecarExists) {
    addError(ctx, "VAL-VERIFICATION-INLINE-001", PROOF_SLICES_TRACE_PATH, "新格式 verification 不得生成 legacy trace/verification.proof-slices.json sidecar。");
  }

  if (!inventory.traceExists) {
    addError(ctx, "VAL-VERIFICATION-001", VERIFICATION_TRACE_PATH, "verification artifact、legacy sidecar 或 manifest entry 已存在，但 trace/verification.trace.json 缺失。");
    return;
  }

  const verificationTrace = readJson(ctx, path.join(ctx.changeDir, VERIFICATION_TRACE_PATH));
  const runtimeTrace = readJson(ctx, path.join(ctx.changeDir, RUNTIME_TRACE_PATH));
  const proposalTrace = readJson(ctx, path.join(ctx.changeDir, PROPOSAL_TRACE_PATH));
  if (!verificationTrace || !runtimeTrace || !proposalTrace) return;

  const expected = buildExpectedModel(ctx, verificationTrace, runtimeTrace, proposalTrace);
  const runtimeModel = buildRuntimeModel(ctx, runtimeTrace);

  validateKebabCaseKeys(ctx, verificationTrace);
  validateCommonTrace(ctx, verificationTrace, expected);
  validateManifest(ctx);
  validateForbiddenStringLeaves(ctx, verificationTrace);

  const proofModel = validateProofSliceModel(ctx, verificationTrace, runtimeModel, expected);
  validateBranchInventory(ctx, verificationTrace, runtimeModel, proofModel);
  validateRuntimeCoverageReconciliation(ctx, verificationTrace, runtimeModel, proofModel);
  validateRender(ctx);
}

function collectVerificationInventory(ctx) {
  const traceFullPath = path.join(ctx.changeDir, VERIFICATION_TRACE_PATH);
  const artifactFullPath = path.join(ctx.changeDir, VERIFICATION_ARTIFACT_PATH);
  const sidecarFullPath = path.join(ctx.changeDir, PROOF_SLICES_TRACE_PATH);
  const manifestEntries = readManifestEntriesLenient(ctx).filter(isVerificationManifestEntry);
  return {
    traceExists: fs.existsSync(traceFullPath),
    artifactExists: fs.existsSync(artifactFullPath),
    legacySidecarExists: fs.existsSync(sidecarFullPath),
    manifestEntries,
    hasAnyVerificationOutput:
      fs.existsSync(traceFullPath) ||
      fs.existsSync(artifactFullPath) ||
      fs.existsSync(sidecarFullPath) ||
      manifestEntries.length > 0,
  };
}

function buildExpectedModel(ctx, verificationTrace, runtimeTrace, proposalTrace) {
  const proposalSchema = strip(proposalTrace["schema-name"]);
  if (proposalSchema !== OBLIGATION_SCHEMA && proposalSchema !== DEFAULT_SCHEMA) {
    addError(ctx, "VAL-VERIFICATION-PROPOSAL-001", PROPOSAL_TRACE_PATH, `不支持的 proposal schema-name：${proposalSchema || "(empty)"}`);
  }

  const runtimeSchema = strip(runtimeTrace["schema-name"]);
  const traceSchema = strip(verificationTrace["schema-name"]);
  const changeKind = strip(proposalTrace["proposal-alignment-gate"]?.["change-kind"]) || "business";
  return {
    schemaName: proposalSchema || runtimeSchema || traceSchema,
    runtimeSchema,
    changeKind,
  };
}

function validateCommonTrace(ctx, trace, expected) {
  expectEqual(ctx, "VAL-VERIFICATION-TRACE-001", VERIFICATION_TRACE_PATH, trace["trace-schema"], TRACE_SCHEMA, "trace-schema");
  expectEqual(ctx, "VAL-VERIFICATION-TRACE-002", VERIFICATION_TRACE_PATH, trace["artifact-id"], "verification", "artifact-id");
  expectEqual(ctx, "VAL-VERIFICATION-TRACE-003", VERIFICATION_TRACE_PATH, trace["artifact-path"], VERIFICATION_ARTIFACT_PATH, "artifact-path");
  expectEqual(ctx, "VAL-VERIFICATION-TRACE-004", VERIFICATION_TRACE_PATH, trace["change-name"], ctx.change, "change-name");
  expectEqual(ctx, "VAL-VERIFICATION-TRACE-005", VERIFICATION_TRACE_PATH, trace["schema-name"], expected.schemaName, "schema-name");
  expectEqual(ctx, "VAL-VERIFICATION-TRACE-006", VERIFICATION_TRACE_PATH, expected.runtimeSchema, expected.schemaName, "runtime schema-name");
  requireString(ctx, "VAL-VERIFICATION-TRACE-007", VERIFICATION_TRACE_PATH, trace["agent-role"], "agent-role");
  const sourceInterface = requireObject(ctx, "VAL-VERIFICATION-TRACE-008", VERIFICATION_TRACE_PATH, trace["source-interface"], "source-interface");
  requireObject(ctx, "VAL-VERIFICATION-TRACE-009", VERIFICATION_TRACE_PATH, trace["delivery-plane"], "delivery-plane");

  expectEqual(ctx, "VAL-VERIFICATION-SOURCE-001", VERIFICATION_TRACE_PATH, sourceInterface["runtime-source-artifact"], RUNTIME_ARTIFACT_PATH, "source-interface.runtime-source-artifact");
  expectEqual(ctx, "VAL-VERIFICATION-SOURCE-002", VERIFICATION_TRACE_PATH, sourceInterface["runtime-source-trace"], RUNTIME_TRACE_PATH, "source-interface.runtime-source-trace");
  expectEqual(ctx, "VAL-VERIFICATION-SOURCE-003", VERIFICATION_TRACE_PATH, sourceInterface["proof-slice-model"], INLINE_PROOF_SLICES_MODEL_PATH, "source-interface.proof-slice-model");
}

function validateManifest(ctx) {
  const manifestRelPath = "trace/manifest.json";
  const manifest = readJson(ctx, path.join(ctx.changeDir, manifestRelPath));
  if (!manifest) return;

  expectEqual(ctx, "VAL-VERIFICATION-MANIFEST-001", manifestRelPath, manifest["trace-schema"], TRACE_SCHEMA, "trace-schema");
  expectEqual(ctx, "VAL-VERIFICATION-MANIFEST-002", manifestRelPath, manifest["render-contract-version"], RENDER_CONTRACT_VERSION, "render-contract-version");
  expectEqual(ctx, "VAL-VERIFICATION-MANIFEST-003", manifestRelPath, manifest["trace-contract-version"], TRACE_CONTRACT_VERSION, "trace-contract-version");

  const artifacts = requireArray(ctx, "VAL-VERIFICATION-MANIFEST-004", manifestRelPath, manifest.artifacts, "artifacts");
  const sidecarEntries = artifacts.filter((entry) => strip(entry?.["trace-path"]) === PROOF_SLICES_TRACE_PATH);
  if (sidecarEntries.length > 0) {
    addError(ctx, "VAL-VERIFICATION-INLINE-002", manifestRelPath, "新格式 manifest 不得注册 trace/verification.proof-slices.json。");
  }

  const entries = artifacts.filter(isVerificationManifestEntry);
  const mainEntries = entries.filter(
    (entry) =>
      strip(entry?.["artifact-id"]) === "verification" &&
      strip(entry?.["artifact-path"]) === VERIFICATION_ARTIFACT_PATH &&
      strip(entry?.["trace-path"]) === VERIFICATION_TRACE_PATH,
  );
  if (mainEntries.length !== 1 || entries.length !== 1) {
    addError(ctx, "VAL-VERIFICATION-MANIFEST-005", manifestRelPath, "manifest 必须有且仅有一个 verification -> trace/verification.trace.json registry entry，且不得包含 legacy proof-slices entry。");
    return;
  }
  expectEqual(ctx, "VAL-VERIFICATION-MANIFEST-006", manifestRelPath, mainEntries[0]["trace-schema"], TRACE_SCHEMA, "verification entry trace-schema");
}

function validateRender(ctx) {
  const artifactFullPath = path.join(ctx.changeDir, VERIFICATION_ARTIFACT_PATH);
  if (!fs.existsSync(artifactFullPath)) {
    addError(ctx, "VAL-VERIFICATION-RENDER-001", VERIFICATION_ARTIFACT_PATH, "verification.md 缺失；writer 必须通过 renderer 生成 Markdown。");
    return;
  }

  let rendered;
  try {
    rendered = renderChangeArtifact({
      root: ctx.root,
      change: ctx.change,
      artifact: "verification",
    }).markdown;
  } catch (error) {
    addError(ctx, "VAL-VERIFICATION-RENDER-002", VERIFICATION_TRACE_PATH, error.message);
    return;
  }

  const actual = fs.readFileSync(artifactFullPath, "utf8");
  if (actual !== rendered) {
    addError(ctx, "VAL-VERIFICATION-RENDER-003", VERIFICATION_ARTIFACT_PATH, "verification.md 与 renderer 从 trace/verification.trace.json 生成的结果不一致。");
  }
}

function buildRuntimeModel(ctx, runtimeTrace) {
  const index = requireObject(ctx, "VAL-VERIFICATION-RUNTIME-001", RUNTIME_TRACE_PATH, runtimeTrace["canonical-row-index"], "canonical-row-index");
  const rowsById = new Map();
  const indexIds = [];

  for (const [section, rowType, regex] of RUNTIME_INDEX_SECTIONS) {
    const ids = requireArray(ctx, "VAL-VERIFICATION-RUNTIME-002", RUNTIME_TRACE_PATH, index[section], `canonical-row-index.${section}`)
      .map(strip)
      .filter(Boolean);
    for (const id of ids) {
      if (!regex.test(id)) {
        addError(ctx, "VAL-VERIFICATION-RUNTIME-003", RUNTIME_TRACE_PATH, `canonical-row-index.${section} 包含非法 runtime row id：${id}。`);
        continue;
      }
      if (rowsById.has(id)) {
        addError(ctx, "VAL-VERIFICATION-RUNTIME-004", RUNTIME_TRACE_PATH, `canonical-row-index runtime row id 重复：${id}。`);
        continue;
      }
      rowsById.set(id, {
        id,
        rowType,
        scopeRole: "",
      });
      indexIds.push(id);
    }
  }

  const delivery = requireObject(ctx, "VAL-VERIFICATION-RUNTIME-005", RUNTIME_TRACE_PATH, runtimeTrace["delivery-plane"], "delivery-plane");
  const canonicalRows = requireArray(ctx, "VAL-VERIFICATION-RUNTIME-006", RUNTIME_TRACE_PATH, delivery["canonical-rows"], "delivery-plane.canonical-rows");
  const deliveryIds = new Set();
  for (const [index, row] of canonicalRows.entries()) {
    const id = strip(row?.id ?? row?.["surface-id"] ?? row?.["operation-id"] ?? row?.["state-id"] ?? row?.["chain-id"]);
    if (!id) {
      addError(ctx, "VAL-VERIFICATION-RUNTIME-007", RUNTIME_TRACE_PATH, `delivery-plane.canonical-rows[${index}] 缺少 runtime row id。`);
      continue;
    }
    if (!RUNTIME_ROW_ID_RE.test(id)) {
      addError(ctx, "VAL-VERIFICATION-RUNTIME-008", RUNTIME_TRACE_PATH, `delivery-plane.canonical-rows[${index}] runtime row id 非法：${id}。`);
      continue;
    }
    deliveryIds.add(id);
    const record = rowsById.get(id);
    if (!record) {
      addError(ctx, "VAL-VERIFICATION-RUNTIME-009", RUNTIME_TRACE_PATH, `delivery-plane.canonical-rows[${index}] 未出现在 canonical-row-index：${id}。`);
      continue;
    }
    record.scopeRole = strip(row?.["scope-role"]);
    if (!VERIFICATION_SCOPE_ROLES.has(record.scopeRole)) {
      addError(ctx, "VAL-VERIFICATION-RUNTIME-010", RUNTIME_TRACE_PATH, `${id} scope-role 必须是 required behavior、preserve boundary 或 proof-only。`);
    }
  }

  for (const id of indexIds) {
    if (!deliveryIds.has(id)) {
      addError(ctx, "VAL-VERIFICATION-RUNTIME-011", RUNTIME_TRACE_PATH, `canonical-row-index row 未出现在 delivery-plane.canonical-rows：${id}。`);
    }
  }

  return {
    rowsById,
    verificationRowIds: [...rowsById.values()]
      .filter((row) => VERIFICATION_SCOPE_ROLES.has(row.scopeRole))
      .map((row) => row.id),
  };
}

function validateProofSliceModel(ctx, trace, runtimeModel, expected) {
  const model = requireObject(ctx, "VAL-VERIFICATION-MODEL-001", VERIFICATION_TRACE_PATH, trace["proof-slice-model"], "proof-slice-model");
  expectEqual(ctx, "VAL-VERIFICATION-MODEL-002", VERIFICATION_TRACE_PATH, model["model-schema"], PROOF_SLICES_TRACE_SCHEMA, "proof-slice-model.model-schema");
  const summary = requireObject(ctx, "VAL-VERIFICATION-MODEL-003", VERIFICATION_TRACE_PATH, model["proof-slice-summary"], "proof-slice-model.proof-slice-summary");
  const slices = requireArray(ctx, "VAL-VERIFICATION-MODEL-004", VERIFICATION_TRACE_PATH, model["proof-slices"], "proof-slice-model.proof-slices");
  if (slices.length === 0) {
    addError(ctx, "VAL-VERIFICATION-MODEL-005", VERIFICATION_TRACE_PATH, "proof-slice-model.proof-slices 不能为空。");
  }

  const proofSlicesById = new Map();
  const runtimeRowsBySlice = new Map();
  let persistentCount = 0;
  for (const [index, slice] of slices.entries()) {
    const label = `proof-slice-model.proof-slices[${index}]`;
    const sliceId = validateProofSliceId(ctx, slice?.["slice-id"], `${label}.slice-id`);
    if (!sliceId) continue;
    if (proofSlicesById.has(sliceId)) {
      addError(ctx, "VAL-VERIFICATION-SLICE-002", VERIFICATION_TRACE_PATH, `Proof Slice ID 重复：${sliceId}。`);
    }
    proofSlicesById.set(sliceId, slice);

    const rowIds = requireRuntimeRowIdArray(ctx, "VAL-VERIFICATION-SLICE-003", VERIFICATION_TRACE_PATH, slice?.["runtime-row-ids"], `${label}.runtime-row-ids`);
    if (rowIds.length === 0) {
      addError(ctx, "VAL-VERIFICATION-SLICE-004", VERIFICATION_TRACE_PATH, `${sliceId} 必须至少引用一个 runtime row。`);
    }
    for (const rowId of rowIds) {
      if (!runtimeModel.rowsById.has(rowId)) {
        addError(ctx, "VAL-VERIFICATION-SLICE-005", VERIFICATION_TRACE_PATH, `${sliceId} 引用未定义 runtime row：${rowId}。`);
      }
    }
    runtimeRowsBySlice.set(sliceId, new Set(rowIds));

    const primaryRowId = requireId(ctx, "VAL-VERIFICATION-SLICE-006", VERIFICATION_TRACE_PATH, slice?.["primary-runtime-row-id"], `${label}.primary-runtime-row-id`, RUNTIME_ROW_ID_RE);
    if (primaryRowId && !rowIds.includes(primaryRowId)) {
      addError(ctx, "VAL-VERIFICATION-SLICE-007", VERIFICATION_TRACE_PATH, `${sliceId} primary-runtime-row-id 必须包含在 runtime-row-ids 中。`);
    }
    if (primaryRowId && !runtimeModel.rowsById.has(primaryRowId)) {
      addError(ctx, "VAL-VERIFICATION-SLICE-008", VERIFICATION_TRACE_PATH, `${sliceId} primary-runtime-row-id 未定义：${primaryRowId}。`);
    }

    validateEnum(ctx, "VAL-VERIFICATION-SLICE-009", VERIFICATION_TRACE_PATH, slice?.["primitive-type"], PRIMITIVE_TYPES, `${label}.primitive-type`);
    validateEnum(ctx, "VAL-VERIFICATION-SLICE-010", VERIFICATION_TRACE_PATH, slice?.["primary-layer"], PRIMARY_LAYERS, `${label}.primary-layer`);
    validateEnum(ctx, "VAL-VERIFICATION-SLICE-011", VERIFICATION_TRACE_PATH, slice?.["proof-evidence-mode"], PROOF_EVIDENCE_MODES, `${label}.proof-evidence-mode`);
    for (const field of [
      "branch-variant",
      "observable-surface",
      "oracle-fragment",
      "failure-signal",
      "primary-assertion-shape",
      "fixture-mock-boundary",
      "regression-intent",
    ]) {
      requireString(ctx, "VAL-VERIFICATION-SLICE-012", VERIFICATION_TRACE_PATH, slice?.[field], `${label}.${field}`);
    }
    validateProductionOwner(ctx, slice?.["production-owner"], `${label}.production-owner`);

    const persistent = requireBoolean(ctx, "VAL-VERIFICATION-SLICE-013", VERIFICATION_TRACE_PATH, slice?.["persistent-test-required"], `${label}.persistent-test-required`);
    if (persistent) persistentCount += 1;
    if (!Object.hasOwn(slice ?? {}, "manual-environment-gate")) {
      addError(ctx, "VAL-VERIFICATION-SLICE-014", VERIFICATION_TRACE_PATH, `${label}.manual-environment-gate 必须存在。`);
    }

    validateTestContract(ctx, {
      slice,
      sliceId,
      label,
      persistent,
      primaryLayer: strip(slice?.["primary-layer"]),
      proofEvidenceMode: strip(slice?.["proof-evidence-mode"]),
      changeKind: expected.changeKind,
    });
  }

  validateSummary(ctx, summary, {
    sliceCount: slices.length,
    persistentCount,
    runtimeRowCount: new Set([...runtimeRowsBySlice.values()].flatMap((ids) => [...ids])).size,
  });

  return {
    proofSlicesById,
    runtimeRowsBySlice,
  };
}

function validateTestContract(ctx, options) {
  const contract = requireObject(ctx, "VAL-VERIFICATION-CONTRACT-001", VERIFICATION_TRACE_PATH, options.slice?.["test-contract"], `${options.label}.test-contract`);
  expectEqual(ctx, "VAL-VERIFICATION-CONTRACT-002", VERIFICATION_TRACE_PATH, contract["allow-shared-setup"], true, `${options.label}.test-contract.allow-shared-setup`);
  expectEqual(ctx, "VAL-VERIFICATION-CONTRACT-003", VERIFICATION_TRACE_PATH, contract["allow-multi-slice-primary-test"], false, `${options.label}.test-contract.allow-multi-slice-primary-test`);
  expectEqual(ctx, "VAL-VERIFICATION-CONTRACT-004", VERIFICATION_TRACE_PATH, contract["waiver-required-for-multi-slice"], true, `${options.label}.test-contract.waiver-required-for-multi-slice`);

  const placement = requireObject(ctx, "VAL-VERIFICATION-CONTRACT-005", VERIFICATION_TRACE_PATH, contract.placement, `${options.label}.test-contract.placement`);
  const plannedDirectory = requireString(ctx, "VAL-VERIFICATION-CONTRACT-006", VERIFICATION_TRACE_PATH, placement["planned-test-directory"], `${options.label}.test-contract.placement.planned-test-directory`);
  const placementBasis = validateEnum(ctx, "VAL-VERIFICATION-CONTRACT-007", VERIFICATION_TRACE_PATH, placement["placement-basis"], PLACEMENT_BASES, `${options.label}.test-contract.placement.placement-basis`);
  requireString(ctx, "VAL-VERIFICATION-CONTRACT-008", VERIFICATION_TRACE_PATH, placement["placement-reason"], `${options.label}.test-contract.placement.placement-reason`);

  if (options.changeKind !== "foundation" && isNoManualGate(options.slice?.["manual-environment-gate"]) && options.persistent !== true) {
    addError(ctx, "VAL-VERIFICATION-PERSISTENCE-001", VERIFICATION_TRACE_PATH, `${options.sliceId} business change 且 manual-environment-gate 为 None/空/null 时必须 persistent-test-required=true。`);
  }

  if (options.persistent === true) {
    expectEqual(ctx, "VAL-VERIFICATION-PERSISTENCE-002", VERIFICATION_TRACE_PATH, options.proofEvidenceMode, "durable-test", `${options.sliceId}.proof-evidence-mode`);
    expectEqual(ctx, "VAL-VERIFICATION-PERSISTENCE-003", VERIFICATION_TRACE_PATH, contract["primary-test-cardinality"], "exactly-one", `${options.sliceId}.test-contract.primary-test-cardinality`);
    expectEqual(ctx, "VAL-VERIFICATION-PERSISTENCE-004", VERIFICATION_TRACE_PATH, contract["test-title-prefix"], options.sliceId, `${options.sliceId}.test-contract.test-title-prefix`);
    if (placementBasis === "nonpersistent-evidence") {
      addError(ctx, "VAL-VERIFICATION-PLACEMENT-001", VERIFICATION_TRACE_PATH, `${options.sliceId} persistent slice 不得使用 nonpersistent-evidence placement-basis。`);
    }
    validatePersistentPlacement(ctx, options.sliceId, options.primaryLayer, plannedDirectory);
    return;
  }

  if (options.persistent === false) {
    if (options.proofEvidenceMode === "durable-test") {
      addError(ctx, "VAL-VERIFICATION-PERSISTENCE-005", VERIFICATION_TRACE_PATH, `${options.sliceId} non-persistent slice 不得使用 durable-test evidence mode。`);
    }
    expectEqual(ctx, "VAL-VERIFICATION-PERSISTENCE-006", VERIFICATION_TRACE_PATH, contract["primary-test-cardinality"], "none", `${options.sliceId}.test-contract.primary-test-cardinality`);
    if (strip(contract["test-title-prefix"]) && strip(contract["test-title-prefix"]) !== options.sliceId) {
      addError(ctx, "VAL-VERIFICATION-PERSISTENCE-007", VERIFICATION_TRACE_PATH, `${options.sliceId}.test-contract.test-title-prefix 如提供必须等于 slice-id。`);
    }
    expectEqual(ctx, "VAL-VERIFICATION-PLACEMENT-002", VERIFICATION_TRACE_PATH, plannedDirectory, "N/A", `${options.sliceId}.placement.planned-test-directory`);
    expectEqual(ctx, "VAL-VERIFICATION-PLACEMENT-003", VERIFICATION_TRACE_PATH, placementBasis, "nonpersistent-evidence", `${options.sliceId}.placement.placement-basis`);
  }
}

function validatePersistentPlacement(ctx, sliceId, primaryLayer, plannedDirectory) {
  if (!plannedDirectory.endsWith("/**")) {
    addError(ctx, "VAL-VERIFICATION-PLACEMENT-004", VERIFICATION_TRACE_PATH, `${sliceId} planned-test-directory 必须是以 /** 结尾的目录 glob。`);
  }
  if (!/(?:^|\/)tests\//u.test(plannedDirectory)) {
    addError(ctx, "VAL-VERIFICATION-PLACEMENT-005", VERIFICATION_TRACE_PATH, `${sliceId} planned-test-directory 必须落在外置 tests/ 子树。`);
  }
  if (TEST_FILE_RE.test(plannedDirectory)) {
    addError(ctx, "VAL-VERIFICATION-PLACEMENT-006", VERIFICATION_TRACE_PATH, `${sliceId} planned-test-directory 不得写具体 .test/.spec 文件。`);
  }
  const allowedSubtrees = LAYER_TEST_SUBTREES[primaryLayer] ?? [];
  if (allowedSubtrees.length > 0 && !allowedSubtrees.some((subtree) => plannedDirectory.endsWith(subtree))) {
    addError(ctx, "VAL-VERIFICATION-PLACEMENT-007", VERIFICATION_TRACE_PATH, `${sliceId} planned-test-directory 与 primary-layer ${primaryLayer} 的默认 tests 子树不匹配。`);
  }
}

function validateBranchInventory(ctx, trace, runtimeModel, proofModel) {
  const manualRows = requireArray(
    ctx,
    "VAL-VERIFICATION-MANUAL-001",
    VERIFICATION_TRACE_PATH,
    trace["manual-not-applicable-inventory"],
    "manual-not-applicable-inventory",
  );
  const manualByBranchId = new Map();
  for (const [index, row] of manualRows.entries()) {
    const branchId = requireId(ctx, "VAL-VERIFICATION-MANUAL-002", VERIFICATION_TRACE_PATH, row?.["branch-id"], `manual-not-applicable-inventory[${index}].branch-id`, BRANCH_ID_RE);
    const runtimeRowId = requireId(ctx, "VAL-VERIFICATION-MANUAL-003", VERIFICATION_TRACE_PATH, row?.["runtime-row-id"], `manual-not-applicable-inventory[${index}].runtime-row-id`, RUNTIME_ROW_ID_RE);
    const handling = validateEnum(ctx, "VAL-VERIFICATION-MANUAL-004", VERIFICATION_TRACE_PATH, row?.handling, new Set(["manual-environment", "not-applicable"]), `manual-not-applicable-inventory[${index}].handling`);
    requireString(ctx, "VAL-VERIFICATION-MANUAL-005", VERIFICATION_TRACE_PATH, row?.["basis-field"], `manual-not-applicable-inventory[${index}].basis-field`);
    requireString(ctx, "VAL-VERIFICATION-MANUAL-006", VERIFICATION_TRACE_PATH, row?.reason, `manual-not-applicable-inventory[${index}].reason`);
    if (runtimeRowId && !runtimeModel.rowsById.has(runtimeRowId)) {
      addError(ctx, "VAL-VERIFICATION-MANUAL-007", VERIFICATION_TRACE_PATH, `manual-not-applicable-inventory[${index}] 引用未定义 runtime row：${runtimeRowId}。`);
    }
    if (branchId) {
      if (manualByBranchId.has(branchId)) {
        addError(ctx, "VAL-VERIFICATION-MANUAL-008", VERIFICATION_TRACE_PATH, `manual-not-applicable-inventory branch-id 重复：${branchId}。`);
      }
      manualByBranchId.set(branchId, { index, row, runtimeRowId, handling });
    }
  }

  const branchRows = requireArray(
    ctx,
    "VAL-VERIFICATION-BRANCH-001",
    VERIFICATION_TRACE_PATH,
    trace["runtime-row-branch-inventory"],
    "runtime-row-branch-inventory",
  );
  const seenBranchIds = new Set();
  const referencedManualBranchIds = new Set();
  for (const [index, row] of branchRows.entries()) {
    const label = `runtime-row-branch-inventory[${index}]`;
    const branchId = requireId(ctx, "VAL-VERIFICATION-BRANCH-002", VERIFICATION_TRACE_PATH, row?.["branch-id"], `${label}.branch-id`, BRANCH_ID_RE);
    if (branchId) {
      if (seenBranchIds.has(branchId)) {
        addError(ctx, "VAL-VERIFICATION-BRANCH-003", VERIFICATION_TRACE_PATH, `${label}.branch-id 重复：${branchId}。`);
      }
      seenBranchIds.add(branchId);
    }
    const runtimeRowId = requireId(ctx, "VAL-VERIFICATION-BRANCH-004", VERIFICATION_TRACE_PATH, row?.["runtime-row-id"], `${label}.runtime-row-id`, RUNTIME_ROW_ID_RE);
    const runtimeRow = runtimeModel.rowsById.get(runtimeRowId);
    if (runtimeRowId && !runtimeRow) {
      addError(ctx, "VAL-VERIFICATION-BRANCH-005", VERIFICATION_TRACE_PATH, `${label} 引用未定义 runtime row：${runtimeRowId}。`);
    }
    if (runtimeRow) {
      expectEqual(ctx, "VAL-VERIFICATION-BRANCH-006", VERIFICATION_TRACE_PATH, row?.["runtime-row-type"], runtimeRow.rowType, `${label}.runtime-row-type`);
      expectEqual(ctx, "VAL-VERIFICATION-BRANCH-007", VERIFICATION_TRACE_PATH, row?.["scope-role"], runtimeRow.scopeRole, `${label}.scope-role`);
    }
    requireString(ctx, "VAL-VERIFICATION-BRANCH-008", VERIFICATION_TRACE_PATH, row?.["branch-source-field"], `${label}.branch-source-field`);
    requireString(ctx, "VAL-VERIFICATION-BRANCH-009", VERIFICATION_TRACE_PATH, row?.["branch-variant"], `${label}.branch-variant`);
    requireString(ctx, "VAL-VERIFICATION-BRANCH-010", VERIFICATION_TRACE_PATH, row?.["handling-reason"], `${label}.handling-reason`);
    const handling = validateEnum(ctx, "VAL-VERIFICATION-BRANCH-011", VERIFICATION_TRACE_PATH, row?.handling, BRANCH_HANDLINGS, `${label}.handling`);
    const expectedSlices = requireProofSliceIdArray(ctx, "VAL-VERIFICATION-BRANCH-012", VERIFICATION_TRACE_PATH, row?.["expected-proof-slice-ids"], `${label}.expected-proof-slice-ids`);

    if (handling === "proof-slice") {
      if (expectedSlices.length === 0) {
        addError(ctx, "VAL-VERIFICATION-BRANCH-013", VERIFICATION_TRACE_PATH, `${label} handling=proof-slice 时必须声明 expected-proof-slice-ids。`);
      }
      for (const sliceId of expectedSlices) {
        if (!proofModel.proofSlicesById.has(sliceId)) {
          addError(ctx, "VAL-VERIFICATION-BRANCH-014", VERIFICATION_TRACE_PATH, `${label} 引用不存在的 Proof Slice：${sliceId}。`);
          continue;
        }
        if (runtimeRowId && !proofModel.runtimeRowsBySlice.get(sliceId)?.has(runtimeRowId)) {
          addError(ctx, "VAL-VERIFICATION-BRANCH-015", VERIFICATION_TRACE_PATH, `${label} 引用的 ${sliceId} 未反向包含 runtime row ${runtimeRowId}。`);
        }
      }
      continue;
    }

    if (expectedSlices.length > 0) {
      addError(ctx, "VAL-VERIFICATION-BRANCH-016", VERIFICATION_TRACE_PATH, `${label} manual/not-applicable branch 不得声明 expected-proof-slice-ids。`);
    }
    const manualRow = manualByBranchId.get(branchId);
    if (!manualRow) {
      addError(ctx, "VAL-VERIFICATION-BRANCH-017", VERIFICATION_TRACE_PATH, `${label} manual/not-applicable branch 必须在 manual-not-applicable-inventory 中有同 branch-id row。`);
    } else {
      referencedManualBranchIds.add(branchId);
      expectEqual(ctx, "VAL-VERIFICATION-BRANCH-018", VERIFICATION_TRACE_PATH, manualRow.runtimeRowId, runtimeRowId, `${label} manual inventory runtime-row-id`);
      expectEqual(ctx, "VAL-VERIFICATION-BRANCH-019", VERIFICATION_TRACE_PATH, manualRow.handling, handling, `${label} manual inventory handling`);
    }
  }

  for (const branchId of manualByBranchId.keys()) {
    if (!referencedManualBranchIds.has(branchId)) {
      addError(ctx, "VAL-VERIFICATION-MANUAL-009", VERIFICATION_TRACE_PATH, `manual-not-applicable-inventory 包含未被 runtime-row-branch-inventory 引用的 branch-id：${branchId}。`);
    }
  }
}

function validateRuntimeCoverageReconciliation(ctx, trace, runtimeModel, proofModel) {
  const rows = requireArray(
    ctx,
    "VAL-VERIFICATION-RECONCILIATION-001",
    VERIFICATION_TRACE_PATH,
    trace["runtime-coverage-reconciliation"],
    "runtime-coverage-reconciliation",
  );
  const recordsByRuntimeRowId = new Map();
  for (const [index, row] of rows.entries()) {
    const label = `runtime-coverage-reconciliation[${index}]`;
    const runtimeRowId = requireId(ctx, "VAL-VERIFICATION-RECONCILIATION-002", VERIFICATION_TRACE_PATH, row?.["runtime-row-id"], `${label}.runtime-row-id`, RUNTIME_ROW_ID_RE);
    if (!runtimeRowId) continue;
    if (recordsByRuntimeRowId.has(runtimeRowId)) {
      addError(ctx, "VAL-VERIFICATION-RECONCILIATION-003", VERIFICATION_TRACE_PATH, `${label}.runtime-row-id 重复：${runtimeRowId}。`);
    }
    recordsByRuntimeRowId.set(runtimeRowId, { index, row });

    const runtimeRow = runtimeModel.rowsById.get(runtimeRowId);
    if (!runtimeRow) {
      addError(ctx, "VAL-VERIFICATION-RECONCILIATION-004", VERIFICATION_TRACE_PATH, `${label} 引用未定义 runtime row：${runtimeRowId}。`);
      continue;
    }
    expectEqual(ctx, "VAL-VERIFICATION-RECONCILIATION-005", VERIFICATION_TRACE_PATH, row?.["row-type"], runtimeRow.rowType, `${label}.row-type`);
    expectEqual(ctx, "VAL-VERIFICATION-RECONCILIATION-006", VERIFICATION_TRACE_PATH, row?.["scope-role"], runtimeRow.scopeRole, `${label}.scope-role`);

    const expectedSlices = requireProofSliceIdArray(ctx, "VAL-VERIFICATION-RECONCILIATION-007", VERIFICATION_TRACE_PATH, row?.["expected-proof-slice-ids"], `${label}.expected-proof-slice-ids`);
    const missingSlices = requireProofSliceIdArray(ctx, "VAL-VERIFICATION-RECONCILIATION-008", VERIFICATION_TRACE_PATH, row?.["missing-proof-slice-ids"], `${label}.missing-proof-slice-ids`);
    const coverageStatus = validateEnum(ctx, "VAL-VERIFICATION-RECONCILIATION-009", VERIFICATION_TRACE_PATH, row?.["coverage-status"], RECONCILIATION_STATUSES, `${label}.coverage-status`);
    if (coverageStatus === "blocked") {
      addError(ctx, "VAL-VERIFICATION-RECONCILIATION-010", VERIFICATION_TRACE_PATH, `${label} coverage-status=blocked 是 artifact blocker。`);
    }

    if (coverageStatus === "covered") {
      if (missingSlices.length > 0) {
        addError(ctx, "VAL-VERIFICATION-RECONCILIATION-011", VERIFICATION_TRACE_PATH, `${label} coverage-status=covered 时 missing-proof-slice-ids 必须为空。`);
      }
      if (expectedSlices.length === 0) {
        addError(ctx, "VAL-VERIFICATION-RECONCILIATION-012", VERIFICATION_TRACE_PATH, `${label} coverage-status=covered 时必须声明 expected-proof-slice-ids。`);
      }
      for (const sliceId of expectedSlices) {
        if (!proofModel.proofSlicesById.has(sliceId)) {
          addError(ctx, "VAL-VERIFICATION-RECONCILIATION-013", VERIFICATION_TRACE_PATH, `${label} 引用不存在的 Proof Slice：${sliceId}。`);
          continue;
        }
        if (!proofModel.runtimeRowsBySlice.get(sliceId)?.has(runtimeRowId)) {
          addError(ctx, "VAL-VERIFICATION-RECONCILIATION-014", VERIFICATION_TRACE_PATH, `${label} 引用的 ${sliceId} 未反向包含 runtime row ${runtimeRowId}。`);
        }
      }
      continue;
    }

    if (coverageStatus === "manual-environment" || coverageStatus === "not-applicable") {
      if (expectedSlices.length > 0 || missingSlices.length > 0) {
        addError(ctx, "VAL-VERIFICATION-RECONCILIATION-015", VERIFICATION_TRACE_PATH, `${label} manual/not-applicable reconciliation 不得声明 expected/missing Proof Slice。`);
      }
      const reason = strip(row?.["gap-not-covered-reason"]);
      if (!reason || /^none$/iu.test(reason)) {
        addError(ctx, "VAL-VERIFICATION-RECONCILIATION-016", VERIFICATION_TRACE_PATH, `${label}.gap-not-covered-reason 必须给出 source/scope-backed reason。`);
      }
    }
  }

  expectSameSet(
    ctx,
    "VAL-VERIFICATION-RECONCILIATION-017",
    VERIFICATION_TRACE_PATH,
    [...recordsByRuntimeRowId.keys()],
    runtimeModel.verificationRowIds,
    "runtime-coverage-reconciliation runtime rows",
  );
}

function validateSummary(ctx, summary, expected) {
  expectEqual(ctx, "VAL-VERIFICATION-SUMMARY-001", VERIFICATION_TRACE_PATH, summary["proof-slice-count"], expected.sliceCount, "proof-slice-summary.proof-slice-count");
  expectEqual(ctx, "VAL-VERIFICATION-SUMMARY-002", VERIFICATION_TRACE_PATH, summary["persistent-test-required-count"], expected.persistentCount, "proof-slice-summary.persistent-test-required-count");
  expectEqual(ctx, "VAL-VERIFICATION-SUMMARY-003", VERIFICATION_TRACE_PATH, summary["non-persistent-proof-slice-count"], expected.sliceCount - expected.persistentCount, "proof-slice-summary.non-persistent-proof-slice-count");
  expectEqual(ctx, "VAL-VERIFICATION-SUMMARY-004", VERIFICATION_TRACE_PATH, summary["runtime-row-count"], expected.runtimeRowCount, "proof-slice-summary.runtime-row-count");
  expectEqual(ctx, "VAL-VERIFICATION-SUMMARY-005", VERIFICATION_TRACE_PATH, summary["slice-id-format"], "PS-###", "proof-slice-summary.slice-id-format");
}

function validateKebabCaseKeys(ctx, value, pointer = "") {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      validateKebabCaseKeys(ctx, item, `${pointer}/${index}`);
    }
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (!KEBAB_KEY_RE.test(key)) {
      addError(ctx, "VAL-VERIFICATION-KEY-001", VERIFICATION_TRACE_PATH, `verification trace JSON key 必须使用 kebab-case：${pointer}/${escapePointer(key)}。`);
    }
    validateKebabCaseKeys(ctx, child, `${pointer}/${escapePointer(key)}`);
  }
}

function validateForbiddenStringLeaves(ctx, trace) {
  for (const item of collectStringLeaves(trace)) {
    const value = item.value.replace(/\\/gu, "/");
    if (TEST_FILE_RE.test(value) || EVIDENCE_PATH_RE.test(value) || COMMAND_RE.test(value)) {
      addError(ctx, "VAL-VERIFICATION-FORBIDDEN-001", VERIFICATION_TRACE_PATH, `verification trace 不得包含具体测试文件、固定命令或 evidence/result 路径：${item.pointer}。`);
    }
  }
}

function validateProductionOwner(ctx, value, label) {
  const owner = requireString(ctx, "VAL-VERIFICATION-OWNER-001", VERIFICATION_TRACE_PATH, value, label);
  if (!owner) return;
  if (OWNER_LIST_RE.test(owner)) {
    addError(ctx, "VAL-VERIFICATION-OWNER-002", VERIFICATION_TRACE_PATH, `${label} 必须是单一 production owner token，不能是 owner list。`);
  }
  if (/^(?:tests?|openspec-results|test-results)(?:\/|$)/iu.test(owner) || TEST_FILE_RE.test(owner) || EVIDENCE_PATH_RE.test(owner) || COMMAND_RE.test(owner)) {
    addError(ctx, "VAL-VERIFICATION-OWNER-003", VERIFICATION_TRACE_PATH, `${label} 不得写成测试路径、命令、runner 或 evidence/result 路径。`);
  }
}

function isVerificationManifestEntry(entry) {
  return (
    strip(entry?.["artifact-id"]) === "verification" ||
    strip(entry?.["artifact-path"]) === VERIFICATION_ARTIFACT_PATH ||
    strip(entry?.["trace-path"]) === VERIFICATION_TRACE_PATH ||
    strip(entry?.["trace-path"]) === PROOF_SLICES_TRACE_PATH
  );
}

function readManifestEntriesLenient(ctx) {
  const manifestFullPath = path.join(ctx.changeDir, "trace", "manifest.json");
  if (!fs.existsSync(manifestFullPath)) return [];
  try {
    return asArray(JSON.parse(fs.readFileSync(manifestFullPath, "utf8")).artifacts);
  } catch {
    return [
      {
        "artifact-id": "verification",
        "artifact-path": VERIFICATION_ARTIFACT_PATH,
        "trace-path": VERIFICATION_TRACE_PATH,
      },
    ];
  }
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
    return null;
  }
  return value;
}

function requireId(ctx, ruleId, file, value, label, regex) {
  const id = requireString(ctx, ruleId, file, value, label);
  if (id && !regex.test(id)) {
    addError(ctx, ruleId, file, `${label} 包含非法 ID：${id}。`);
  }
  return id;
}

function validateProofSliceId(ctx, value, label) {
  return requireId(ctx, "VAL-VERIFICATION-SLICE-001", VERIFICATION_TRACE_PATH, value, label, PROOF_SLICE_ID_RE);
}

function requireProofSliceIdArray(ctx, ruleId, file, value, label) {
  return requireIdArray(ctx, ruleId, file, value, label, PROOF_SLICE_ID_RE);
}

function requireRuntimeRowIdArray(ctx, ruleId, file, value, label) {
  return requireIdArray(ctx, ruleId, file, value, label, RUNTIME_ROW_ID_RE);
}

function requireIdArray(ctx, ruleId, file, value, label, regex) {
  const values = requireArray(ctx, ruleId, file, value, label).map(strip).filter(Boolean);
  const seen = new Set();
  for (const id of values) {
    if (!regex.test(id)) {
      addError(ctx, ruleId, file, `${label} 包含非法 ID：${id}。`);
    }
    if (seen.has(id)) {
      addError(ctx, ruleId, file, `${label} 包含重复 ID：${id}。`);
    }
    seen.add(id);
  }
  return values;
}

function validateEnum(ctx, ruleId, file, value, allowed, label) {
  const actual = requireString(ctx, ruleId, file, value, label);
  if (actual && !allowed.has(actual)) {
    addError(ctx, ruleId, file, `${label} 非法：${actual}。允许值：${[...allowed].join(", ")}。`);
  }
  return actual;
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

function isNoManualGate(value) {
  if (value === null || value === undefined) return true;
  return strip(value) === "" || /^none$/iu.test(strip(value));
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
  lines.push(`${result.ok ? "PASS" : "FAIL"} validate-verification-artifact${options.change ? ` --change ${options.change}` : ""}`);
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
  node openspec/agent-runtime/scripts/validators/validate-verification-artifact.mjs --change <slug> [--root <path>]
`;
}

function rel(ctx, fullPath) {
  return path.relative(ctx.root, fullPath) || ".";
}

function formatValue(value) {
  return value === undefined ? "(undefined)" : JSON.stringify(value);
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(usage());
      process.exit(0);
    }
    const result = validateVerificationArtifact(options);
    process.stdout.write(formatResult(result, options));
    process.exit(result.ok ? 0 : 1);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
