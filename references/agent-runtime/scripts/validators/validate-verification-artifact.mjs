#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  PROOF_SLICES_TRACE_PATH,
  TRACE_CONTRACT_VERSION,
  TRACE_SCHEMA,
  VERIFICATION_SLICE_REGISTER_PATH,
  VERIFICATION_TRACE_PATH,
} from "../render-production-artifacts.mjs";

const VERIFICATION_ARTIFACT_PATH = "verification.md";
const RUNTIME_TRACE_PATH = "trace/runtime-acceptance.trace.json";
const DESIGN_TRACE_PATH = "trace/design.trace.json";

const DEFAULT_SCHEMA = "production-default-acceptance-driven";
const OBLIGATION_SCHEMA = "production-obligation-atom-driven";

const RUNTIME_FACT_ID_RE = /^(RS|OP|ST|CH)-\d{3}$/u;
const PROOF_SLICE_ID_RE = /^PS-\d{3}$/u;
const KEBAB_KEY_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;
const TEST_FILE_RE = /(?:^|\/)[^/\s]+\.(?:test|spec)\.[cm]?[jt]sx?\b/u;
const EVIDENCE_PATH_RE = /(?:^|\/)(?:openspec-results|test-results)\//u;
const COMMAND_RE = /\b(?:pnpm|npm|yarn|npx|vitest|jest|playwright test|go test|pytest|cargo test|bun test|node\s+(?:--[a-z-]+|[-\w./]+\.m?js))\b/u;
const OWNER_LIST_RE = /[,;，；、]|\s+(?:and|和|与)\s+/iu;

const ALLOWED_TOP_LEVEL_KEYS = new Set([
  "trace-schema",
  "artifact-id",
  "artifact-path",
  "change-name",
  "schema-name",
  "agent-role",
  "source-interface",
  "verification-slice-register",
  "verification-gate",
  "delivery-plane",
]);

const FORBIDDEN_TOP_LEVEL_KEYS = new Set([
  "proof-slice-model",
  "proof-slice-summary",
  "runtime-fact-branch-inventory",
  "manual-not-applicable-inventory",
  "runtime-coverage-reconciliation",
  "slice-consistency-checklist",
]);

const REQUIRED_SLICE_FIELDS = [
  "slice-id",
  "runtime-fact-ids",
  "primary-runtime-fact-id",
  "proof-type",
  "branch",
  "oracle",
  "failure-signal",
  "test-layer",
  "production-owner",
  "assertion-shape",
  "fixture-boundary",
  "proof-evidence-mode",
  "planned-test-directory",
  "non-persistent-reason",
];

const FORBIDDEN_SLICE_KEYS = new Set([
  "primitive-type",
  "branch-variant",
  "observable-surface",
  "oracle-fragment",
  "primary-layer",
  "persistent-test-required",
  "primary-assertion-shape",
  "fixture-mock-boundary",
  "regression-intent",
  "manual-environment-gate",
  "test-contract",
]);

const PROOF_TYPES = new Set([
  "operation",
  "state",
  "failure",
  "negative-boundary",
  "layout",
  "observability",
  "fixture-variant",
  "authorization",
]);

const TEST_LAYERS = new Set([
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

const VERIFICATION_SCOPE_ROLES = new Set(["required behavior", "preserve boundary"]);

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

const REQUIRED_GATE_FIELDS = [
  "blockers",
  "uncovered-runtime-facts",
  "invalid-runtime-refs",
  "non-atomic-slices",
  "invalid-proof-modes",
  "invalid-test-placement",
  "delivery-projection-mismatch",
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
    addError(ctx, "VAL-VERIFICATION-V2-LEGACY-001", PROOF_SLICES_TRACE_PATH, "verification-slice-register-v2 不得生成 legacy trace/verification.proof-slices.json sidecar。");
  }

  if (!inventory.traceExists) {
    addError(ctx, "VAL-VERIFICATION-001", VERIFICATION_TRACE_PATH, "verification artifact、legacy sidecar 或 manifest entry 已存在，但 trace/verification.trace.json 缺失。");
    return;
  }

  const verificationTrace = readJson(ctx, path.join(ctx.changeDir, VERIFICATION_TRACE_PATH));
  const runtimeTrace = readJson(ctx, path.join(ctx.changeDir, RUNTIME_TRACE_PATH));
  if (!verificationTrace || !runtimeTrace) return;

  const expected = buildExpectedModel(ctx, verificationTrace, runtimeTrace);
  const runtimeModel = buildRuntimeModel(ctx, runtimeTrace);

  validateKebabCaseKeys(ctx, verificationTrace);
  validateTopLevelShape(ctx, verificationTrace);
  validateCommonTrace(ctx, verificationTrace, expected);
  validateManifest(ctx);
  validateForbiddenStringLeaves(ctx, verificationTrace);

  const sliceModel = validateSliceRegister(ctx, verificationTrace, runtimeModel);
  validateVerificationGate(ctx, verificationTrace, runtimeModel, sliceModel);
  validateDeliveryPlane(ctx, verificationTrace, sliceModel);
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

function buildExpectedModel(ctx, verificationTrace, runtimeTrace) {
  const runtimeSchema = strip(runtimeTrace["schema-name"]);
  const traceSchema = strip(verificationTrace["schema-name"]);
  const schemaName = runtimeSchema || traceSchema;
  if (schemaName !== OBLIGATION_SCHEMA && schemaName !== DEFAULT_SCHEMA) {
    addError(ctx, "VAL-VERIFICATION-RUNTIME-SCHEMA-001", RUNTIME_TRACE_PATH, `不支持的 runtime schema-name：${schemaName || "(empty)"}`);
  }
  return {
    schemaName,
    runtimeSchema,
  };
}

function validateTopLevelShape(ctx, trace) {
  for (const key of Object.keys(trace)) {
    if (!ALLOWED_TOP_LEVEL_KEYS.has(key)) {
      addError(ctx, "VAL-VERIFICATION-SHAPE-001", VERIFICATION_TRACE_PATH, `verification trace 顶层字段不允许：${key}。`);
    }
    if (FORBIDDEN_TOP_LEVEL_KEYS.has(key)) {
      addError(ctx, "VAL-VERIFICATION-SHAPE-002", VERIFICATION_TRACE_PATH, `verification-slice-register-v2 禁止旧字段：${key}。`);
    }
  }
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

  expectEqual(ctx, "VAL-VERIFICATION-SOURCE-001", VERIFICATION_TRACE_PATH, sourceInterface["runtime-trace"], RUNTIME_TRACE_PATH, "source-interface.runtime-trace");
  if (Object.prototype.hasOwnProperty.call(sourceInterface, "proposal-trace")) {
    addError(ctx, "VAL-VERIFICATION-SOURCE-002", VERIFICATION_TRACE_PATH, "source-interface.proposal-trace 不再是 verification semantic input。");
  }
  expectEqual(ctx, "VAL-VERIFICATION-SOURCE-003", VERIFICATION_TRACE_PATH, sourceInterface["design-trace"], DESIGN_TRACE_PATH, "source-interface.design-trace");
  requireArray(ctx, "VAL-VERIFICATION-SOURCE-004", VERIFICATION_TRACE_PATH, sourceInterface["spec-traces"], "source-interface.spec-traces");
}

function validateManifest(ctx) {
  const manifestRelPath = "trace/manifest.json";
  const manifest = readJson(ctx, path.join(ctx.changeDir, manifestRelPath));
  if (!manifest) return;

  expectEqual(ctx, "VAL-VERIFICATION-MANIFEST-001", manifestRelPath, manifest["trace-schema"], TRACE_SCHEMA, "trace-schema");
  expectEqual(ctx, "VAL-VERIFICATION-MANIFEST-003", manifestRelPath, manifest["trace-contract-version"], TRACE_CONTRACT_VERSION, "trace-contract-version");

  const artifacts = requireArray(ctx, "VAL-VERIFICATION-MANIFEST-004", manifestRelPath, manifest.artifacts, "artifacts");
  const sidecarEntries = artifacts.filter((entry) => strip(entry?.["trace-path"]) === PROOF_SLICES_TRACE_PATH);
  if (sidecarEntries.length > 0) {
    addError(ctx, "VAL-VERIFICATION-V2-LEGACY-002", manifestRelPath, "verification-slice-register-v2 manifest 不得注册 trace/verification.proof-slices.json。");
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

function buildRuntimeModel(ctx, runtimeTrace) {
  const rowsById = new Map();
  const facts = requireArray(ctx, "VAL-VERIFICATION-RUNTIME-001", RUNTIME_TRACE_PATH, runtimeTrace["runtime-fact-register"], "runtime-fact-register");
  for (const [index, row] of facts.entries()) {
    const id = strip(row?.["runtime-fact-id"]);
    if (!id) {
      addError(ctx, "VAL-VERIFICATION-RUNTIME-002", RUNTIME_TRACE_PATH, `runtime-fact-register[${index}] 缺少 runtime-fact-id。`);
      continue;
    }
    if (!RUNTIME_FACT_ID_RE.test(id)) {
      addError(ctx, "VAL-VERIFICATION-RUNTIME-003", RUNTIME_TRACE_PATH, `runtime-fact-register[${index}] runtime fact id 非法：${id}。`);
      continue;
    }
    if (rowsById.has(id)) {
      addError(ctx, "VAL-VERIFICATION-RUNTIME-004", RUNTIME_TRACE_PATH, `runtime fact id 重复：${id}。`);
      continue;
    }
    const scopeRole = strip(row?.["scope-role"]);
    if (!VERIFICATION_SCOPE_ROLES.has(scopeRole)) {
      addError(ctx, "VAL-VERIFICATION-RUNTIME-010", RUNTIME_TRACE_PATH, `${id} scope-role 必须是 required behavior 或 preserve boundary。`);
    }
    rowsById.set(id, {
      id,
      rowType: strip(row?.["fact-type"]) || rowTypeForRuntimeFactId(id),
      scopeRole,
    });
  }

  return {
    rowsById,
    verificationRowIds: [...rowsById.values()]
      .filter((row) => VERIFICATION_SCOPE_ROLES.has(row.scopeRole))
      .map((row) => row.id),
  };
}

function validateSliceRegister(ctx, trace, runtimeModel) {
  const slices = requireArray(ctx, "VAL-VERIFICATION-SLICE-REGISTER-001", VERIFICATION_TRACE_PATH, trace["verification-slice-register"], "verification-slice-register");
  if (slices.length === 0) {
    addError(ctx, "VAL-VERIFICATION-SLICE-REGISTER-002", VERIFICATION_TRACE_PATH, "verification-slice-register 不能为空。");
  }

  const slicesById = new Map();
  const runtimeRowsBySlice = new Map();
  const coveredRuntimeFactIds = new Set();
  for (const [index, slice] of slices.entries()) {
    const label = `verification-slice-register[${index}]`;
    for (const field of REQUIRED_SLICE_FIELDS) {
      if (field === "runtime-fact-ids") continue;
      requireString(ctx, "VAL-VERIFICATION-SLICE-001", VERIFICATION_TRACE_PATH, slice?.[field], `${label}.${field}`);
    }
    for (const key of Object.keys(asObject(slice))) {
      if (FORBIDDEN_SLICE_KEYS.has(key)) {
        addError(ctx, "VAL-VERIFICATION-SLICE-002", VERIFICATION_TRACE_PATH, `${label} 禁止旧字段：${key}。`);
      }
    }

    const sliceId = requireId(ctx, "VAL-VERIFICATION-SLICE-003", VERIFICATION_TRACE_PATH, slice?.["slice-id"], `${label}.slice-id`, PROOF_SLICE_ID_RE);
    if (!sliceId) continue;
    if (slicesById.has(sliceId)) {
      addError(ctx, "VAL-VERIFICATION-SLICE-004", VERIFICATION_TRACE_PATH, `Proof Slice ID 重复：${sliceId}。`);
    }
    slicesById.set(sliceId, slice);

    const rowIds = requireRuntimeFactIdArray(ctx, "VAL-VERIFICATION-SLICE-005", VERIFICATION_TRACE_PATH, slice?.["runtime-fact-ids"], `${label}.runtime-fact-ids`);
    if (rowIds.length === 0) {
      addError(ctx, "VAL-VERIFICATION-SLICE-006", VERIFICATION_TRACE_PATH, `${sliceId} 必须至少引用一个 runtime fact。`);
    }
    for (const rowId of rowIds) {
      if (!runtimeModel.rowsById.has(rowId)) {
        addError(ctx, "VAL-VERIFICATION-SLICE-007", VERIFICATION_TRACE_PATH, `${sliceId} 引用未定义 runtime fact：${rowId}。`);
      } else {
        coveredRuntimeFactIds.add(rowId);
      }
    }
    runtimeRowsBySlice.set(sliceId, new Set(rowIds));

    const primaryRowId = requireId(ctx, "VAL-VERIFICATION-SLICE-008", VERIFICATION_TRACE_PATH, slice?.["primary-runtime-fact-id"], `${label}.primary-runtime-fact-id`, RUNTIME_FACT_ID_RE);
    if (primaryRowId && !rowIds.includes(primaryRowId)) {
      addError(ctx, "VAL-VERIFICATION-SLICE-009", VERIFICATION_TRACE_PATH, `${sliceId} primary-runtime-fact-id 必须包含在 runtime-fact-ids 中。`);
    }
    if (primaryRowId && !runtimeModel.rowsById.has(primaryRowId)) {
      addError(ctx, "VAL-VERIFICATION-SLICE-010", VERIFICATION_TRACE_PATH, `${sliceId} primary-runtime-fact-id 未定义：${primaryRowId}。`);
    }

    validateEnum(ctx, "VAL-VERIFICATION-SLICE-011", VERIFICATION_TRACE_PATH, slice?.["proof-type"], PROOF_TYPES, `${label}.proof-type`);
    const layer = validateEnum(ctx, "VAL-VERIFICATION-SLICE-012", VERIFICATION_TRACE_PATH, slice?.["test-layer"], TEST_LAYERS, `${label}.test-layer`);
    const evidenceMode = validateEnum(ctx, "VAL-VERIFICATION-SLICE-013", VERIFICATION_TRACE_PATH, slice?.["proof-evidence-mode"], PROOF_EVIDENCE_MODES, `${label}.proof-evidence-mode`);
    validateProductionOwner(ctx, slice?.["production-owner"], `${label}.production-owner`);
    validatePlacement(ctx, { slice, sliceId, label, layer, evidenceMode });
  }

  return {
    slicesById,
    runtimeRowsBySlice,
    coveredRuntimeFactIds,
  };
}

function validatePlacement(ctx, options) {
  const plannedDirectory = strip(options.slice?.["planned-test-directory"]);
  const reason = strip(options.slice?.["non-persistent-reason"]);
  if (options.evidenceMode === "durable-test") {
    if (/^(?:N\/A|None|null)$/iu.test(plannedDirectory)) {
      addError(ctx, "VAL-VERIFICATION-PLACEMENT-001", VERIFICATION_TRACE_PATH, `${options.sliceId} durable-test slice 必须声明外置 tests/** 目录 glob。`);
    }
    validatePersistentPlacement(ctx, options.sliceId, options.layer, plannedDirectory);
    if (!reason) {
      addError(ctx, "VAL-VERIFICATION-PLACEMENT-002", VERIFICATION_TRACE_PATH, `${options.sliceId}.non-persistent-reason 必须存在；durable-test 使用 N/A。`);
    }
    return;
  }

  expectEqual(ctx, "VAL-VERIFICATION-PLACEMENT-003", VERIFICATION_TRACE_PATH, plannedDirectory, "N/A", `${options.sliceId}.planned-test-directory`);
  if (!reason || /^(?:N\/A|None|null)$/iu.test(reason)) {
    addError(ctx, "VAL-VERIFICATION-PLACEMENT-004", VERIFICATION_TRACE_PATH, `${options.sliceId} non-durable slice 必须给出 non-persistent-reason。`);
  }
}

function validatePersistentPlacement(ctx, sliceId, testLayer, plannedDirectory) {
  if (!plannedDirectory.endsWith("/**")) {
    addError(ctx, "VAL-VERIFICATION-PLACEMENT-005", VERIFICATION_TRACE_PATH, `${sliceId} planned-test-directory 必须是以 /** 结尾的目录 glob。`);
  }
  if (!/(?:^|\/)tests\//u.test(plannedDirectory)) {
    addError(ctx, "VAL-VERIFICATION-PLACEMENT-006", VERIFICATION_TRACE_PATH, `${sliceId} planned-test-directory 必须落在外置 tests/ 子树。`);
  }
  if (TEST_FILE_RE.test(plannedDirectory)) {
    addError(ctx, "VAL-VERIFICATION-PLACEMENT-007", VERIFICATION_TRACE_PATH, `${sliceId} planned-test-directory 不得写具体 .test/.spec 文件。`);
  }
  if (/(?:^|\/)tests\/runtime(?:\/|$)/u.test(plannedDirectory)) {
    addError(ctx, "VAL-VERIFICATION-PLACEMENT-008", VERIFICATION_TRACE_PATH, `${sliceId} planned-test-directory 不得使用 tests/runtime/**。`);
  }
  const allowedSubtrees = LAYER_TEST_SUBTREES[testLayer] ?? [];
  if (allowedSubtrees.length > 0 && !allowedSubtrees.some((subtree) => plannedDirectory.endsWith(subtree))) {
    addError(ctx, "VAL-VERIFICATION-PLACEMENT-009", VERIFICATION_TRACE_PATH, `${sliceId} planned-test-directory 与 test-layer ${testLayer} 的默认 tests 子树不匹配。`);
  }
}

function validateVerificationGate(ctx, trace, runtimeModel, sliceModel) {
  const gate = requireObject(ctx, "VAL-VERIFICATION-GATE-001", VERIFICATION_TRACE_PATH, trace["verification-gate"], "verification-gate");
  for (const field of REQUIRED_GATE_FIELDS) {
    const rows = requireArray(ctx, "VAL-VERIFICATION-GATE-002", VERIFICATION_TRACE_PATH, gate[field], `verification-gate.${field}`);
    if (rows.length > 0) {
      addError(ctx, "VAL-VERIFICATION-GATE-003", VERIFICATION_TRACE_PATH, `verification-gate.${field} 必须为空；非空表示 artifact 未闭合。`);
    }
  }

  const missing = runtimeModel.verificationRowIds.filter((rowId) => !sliceModel.coveredRuntimeFactIds.has(rowId));
  if (missing.length > 0) {
    addError(ctx, "VAL-VERIFICATION-COVERAGE-001", VERIFICATION_TRACE_PATH, `verification-slice-register 缺少 required / preserve runtime facts：${missing.join(", ")}。`);
  }

  const invalidGateRefs = asArray(gate["invalid-runtime-refs"]).map(strip).filter(Boolean);
  for (const rowId of invalidGateRefs) {
    if (!RUNTIME_FACT_ID_RE.test(rowId)) {
      addError(ctx, "VAL-VERIFICATION-GATE-004", VERIFICATION_TRACE_PATH, `verification-gate.invalid-runtime-refs 包含非法 runtime fact id：${rowId}。`);
    }
  }
}

function validateDeliveryPlane(ctx, trace, sliceModel) {
  const delivery = requireObject(ctx, "VAL-VERIFICATION-DELIVERY-001", VERIFICATION_TRACE_PATH, trace["delivery-plane"], "delivery-plane");
  const intent = requireObject(ctx, "VAL-VERIFICATION-DELIVERY-002", VERIFICATION_TRACE_PATH, delivery["verification-intent"], "delivery-plane.verification-intent");
  for (const field of ["scope", "runtime-source", "out-of-scope"]) {
    requireString(ctx, "VAL-VERIFICATION-DELIVERY-003", VERIFICATION_TRACE_PATH, intent[field], `delivery-plane.verification-intent.${field}`);
  }
  if (sliceModel.slicesById.size === 0) {
    addError(ctx, "VAL-VERIFICATION-DELIVERY-004", VERIFICATION_TRACE_PATH, "Proof Slice Matrix 无法从空 verification-slice-register 投影。");
  }
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

function requireId(ctx, ruleId, file, value, label, regex) {
  const id = requireString(ctx, ruleId, file, value, label);
  if (id && !regex.test(id)) {
    addError(ctx, ruleId, file, `${label} 包含非法 ID：${id}。`);
  }
  return id;
}

function requireRuntimeFactIdArray(ctx, ruleId, file, value, label) {
  return requireIdArray(ctx, ruleId, file, value, label, RUNTIME_FACT_ID_RE);
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
    addError(ctx, ruleId, file, `${label} 必须是 ${[...allowed].join(", ")}；实际为 ${actual}。`);
  }
  return actual;
}

function expectEqual(ctx, ruleId, file, actual, expected, label) {
  if (actual !== expected) {
    addError(ctx, ruleId, file, `${label} 必须为 ${expected}；实际为 ${actual ?? "(missing)"}。`);
  }
}

function rowTypeForRuntimeFactId(id) {
  if (id.startsWith("RS-")) return "surface";
  if (id.startsWith("OP-")) return "operation";
  if (id.startsWith("ST-")) return "state";
  if (id.startsWith("CH-")) return "chain";
  return "";
}

function collectStringLeaves(value, pointer = "") {
  if (typeof value === "string") return [{ pointer, value }];
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectStringLeaves(item, `${pointer}/${index}`));
  }
  return Object.entries(value).flatMap(([key, child]) => collectStringLeaves(child, `${pointer}/${escapePointer(key)}`));
}

function escapePointer(value) {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function strip(value) {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}

function rel(ctx, fullPath) {
  return path.relative(ctx.root, fullPath) || ".";
}

function addWarning(ctx, ruleId, file, message) {
  ctx.warnings.push({ level: "warning", ruleId, file, message });
}

function addError(ctx, ruleId, file, message) {
  ctx.errors.push({ level: "error", ruleId, file, message });
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
  return lines.join("\n");
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

function printHelp() {
  console.log(`Usage:
  node openspec/agent-runtime/scripts/validators/validate-verification-artifact.mjs --change <slug> [--root <path>]
`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    process.exit(0);
  }
  const result = validateVerificationArtifact(options);
  console.log(formatResult(result, options));
  process.exit(result.ok ? 0 : 1);
}
