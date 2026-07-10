#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  NO_DELTA_SPECS_COMPLETION_MODE,
  TRACE_CONTRACT_VERSION,
  TRACE_SCHEMA,
} from "../render-production-artifacts.mjs";

const OBLIGATION_SCHEMA = "production-obligation-atom-driven";
const DEFAULT_SCHEMA = "production-default-acceptance-driven";

const PROPOSAL_TRACE_PATH = "trace/proposal.trace.json";
const DESIGN_TRACE_PATH = "trace/design.trace.json";
const SPECS_TRACE_DIR = "trace/specs";
const NO_DELTA_TRACE_PATH = "trace/specs/no-spec-delta/README.trace.json";
const RUNTIME_TRACE_PATH = "trace/runtime-acceptance.trace.json";
const TASKS_TRACE_PATH = "trace/tasks.trace.json";
const TASKS_ARTIFACT_PATH = "tasks.md";

const AC_ID_RE = /^AC-\d{3}$/u;
const TASK_ID_RE = /^AC-\d{3}\.\d+$/u;
const RUNTIME_FACT_ID_RE = /^(RS|OP|ST|CH)-\d{3}$/u;
const IMPLEMENTATION_DETAIL_ID_RE = /^(IDR-\d{3})-D\d{3}$/u;
const SPEC_SCENARIO_POINTER_RE = /^trace\/specs\/.+\.trace\.json#\/spec-delta-register\/\d+\/scenarios\/\d+$/u;
const KEBAB_KEY_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;

const TARGET_SCOPE_ROLES = new Set(["required behavior", "preserve boundary"]);
const WORK_STAGES = new Set(["foundation", "contract", "behavior", "surface", "integration", "preserve-boundary", "rollout"]);
const SPEC_CONTRIBUTIONS = new Set(["supports", "completes"]);
const DESIGN_CONTRIBUTIONS = new Set(["uses", "implements-part", "completes"]);
const RUNTIME_CONTRIBUTIONS = new Set(["supports", "contributes", "completes", "enforces"]);
const SPEC_CLOSING_CONTRIBUTIONS = new Set(["completes"]);
const DESIGN_CLOSING_CONTRIBUTIONS = new Set(["completes"]);

const TOP_LEVEL_KEYS = new Set([
  "trace-schema",
  "artifact-id",
  "artifact-path",
  "change-name",
  "schema-name",
  "agent-role",
  "source-interface",
  "implementation-step-register",
  "task-gate",
  "delivery-plane",
]);
const SOURCE_INTERFACE_KEYS = new Set([
  "proposal-trace",
  "specs-completion-mode",
  "spec-traces",
  "design-trace",
  "runtime-acceptance-trace",
  "input-policy",
]);
const IMPLEMENTATION_STEP_KEYS = new Set([
  "step-id",
  "title",
  "work-stage",
  "depends-on-step-ids",
  "spec-scenario-links",
  "design-detail-links",
  "runtime-fact-links",
  "tasks",
]);
const CHECKBOX_TASK_KEYS = new Set([
  "task-id",
  "title",
  "work-stage",
  "spec-scenario-links",
  "design-detail-links",
  "runtime-fact-links",
  "work",
]);
const TASK_GATE_KEYS = new Set([
  "blockers",
  "uncovered-spec-scenarios",
  "incomplete-design-details",
  "incomplete-runtime-facts",
  "invalid-spec-refs",
  "invalid-design-detail-refs",
  "invalid-runtime-fact-refs",
  "dependency-order-violations",
  "hidden-dependency-violations",
  "non-production-task-violations",
  "delivery-projection-mismatch",
]);
const DELIVERY_PLANE_KEYS = new Set(["step-sections"]);

const FORBIDDEN_TRACE_KEYS = new Set([
  "acceptance-proof",
  "row-classification",
  "verification-trace",
  "proof-slices-sidecar",
  "proof-slice-model",
  "proof-slices",
  "test-evidence-matrix",
  "regression-test-deposit",
  "test-layer-plan",
  "fixed-command",
  "test-file-name",
  "test-file",
  "test-command",
  "evidence-directory",
  "evidence-status",
  "deposit-status",
  "test-ids",
  "evidence",
  "deposit",
  "global-atom-id",
  "artifact-projection",
  "owner-capability",
  "requirement-source-trace",
  "acceptance-driven-coverage",
  "obligation-atom-coverage",
  "scope-item-coverage",
  "runtime-acceptance-index",
  "runtime-acceptance-projection",
  "acceptance-slices",
  "resolved-runtime-contract",
  "mock-default-path-policy",
  "runtime-facts",
  "runtime-fact-ids",
  "implementation-scope",
  "proof-contract",
  "start-gate",
  "outcome",
  "preserve",
  "proof",
  "acceptance",
]);

const FORBIDDEN_TEXT_RE = /\b(?:Test Evidence Matrix|Regression Test Deposit|Test Layer Plan|Fixed Command|Test File \/ Name|Evidence Directory|Evidence Status|Deposit Status|Test IDs)\b/iu;
const LEGACY_PROOF_TEXT_RE = /\b(?:Proof|Acceptance|Evidence|Deposit|Fixed Command)\s*:/iu;
const MARKDOWN_INPUT_RE = /(?:^|\/)(?:proposal|design|runtime-acceptance|verification|tasks)\.md$|(?:^|\/)specs\/.+\.md$/iu;
const VERIFICATION_TRACE_RE = /(?:^|\/)trace\/verification(?:\.trace|\.proof-slices)\.json\b/iu;
const TEST_FILE_RE = /(?:^|\/)[^/\s]+\.(?:test|spec)\.[cm]?[jt]sx?\b/u;
const EVIDENCE_PATH_RE = /(?:^|[\s`"'(（])(?:openspec-results|test-results)\//u;
const APPLY_EVIDENCE_RE = /(?:^|[\s`"'(（])(?:apply-result\.md|proof-test-map\.json)\b/u;
const DEPOSIT_RESULT_PATH_RE = /(?:^|[\s`"'(（])(?:proof-test-results|regression-test-deposit)\//u;
const TEST_COMMAND_RE = /\b(?:vitest|jest|playwright test|go test|pytest|cargo test|bun test)\b/u;
const OBLIGATION_SOURCE_LEAK_RE = /\bGA-\d{4}\b|\bobligation-atom-coverage\b/u;
const DEFAULT_SOURCE_LEAK_RE = /\bSI-\d{3}\b|\bscope-item-coverage\b/u;

export function validateTasksArtifact(options = {}) {
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

  validateTasksIfPresent(ctx);

  return resultFor(ctx);
}

function validateTasksIfPresent(ctx) {
  const inventory = collectTasksInventory(ctx);
  if (!inventory.hasAnyTasksOutput) {
    addWarning(ctx, "VAL-TASKS-000", TASKS_TRACE_PATH, "未发现 tasks trace/artifact/manifest entry；partial validator 跳过 tasks。");
    return;
  }

  if (!inventory.traceExists) {
    addError(ctx, "VAL-TASKS-001", TASKS_TRACE_PATH, "tasks artifact 或 manifest entry 已存在，但 trace/tasks.trace.json 缺失。");
    return;
  }

  const tasksTrace = readJson(ctx, path.join(ctx.changeDir, TASKS_TRACE_PATH));
  const runtimeTrace = readJson(ctx, path.join(ctx.changeDir, RUNTIME_TRACE_PATH));
  if (!tasksTrace || !runtimeTrace) return;

  const expected = buildExpectedModel(ctx, tasksTrace);
  if (!expected) return;
  const specs = buildSpecsModel(ctx, expected.schemaName);
  const designTrace = readJson(ctx, path.join(ctx.changeDir, DESIGN_TRACE_PATH));
  const design = buildDesignModel(ctx, designTrace, expected.schemaName);
  const runtime = buildRuntimeModel(ctx, runtimeTrace, expected.schemaName);

  validateAllowedKeys(ctx, "VAL-TASKS-SHAPE-001", TASKS_TRACE_PATH, tasksTrace, "trace/tasks.trace.json", TOP_LEVEL_KEYS);
  validateCommonTrace(ctx, tasksTrace, expected, specs);
  validateManifest(ctx);
  validateTaskCheckboxWriteback(ctx, tasksTrace);
  validateSourceInterfaceBoundaries(ctx, tasksTrace["source-interface"]);
  validateForbiddenShape(ctx, tasksTrace, expected.schemaName);
  validateTaskTextRisk(ctx, tasksTrace);

  const stepModel = validateImplementationSteps(ctx, tasksTrace, { specs, design, runtime });
  const deliveryModel = validateDeliveryPlane(ctx, tasksTrace, stepModel);
  validateStepDependencyOrder(ctx, deliveryModel);
  validateSpecScenarioCoverage(ctx, specs, deliveryModel);
  validateDesignDetailCoverage(ctx, design, deliveryModel);
  validateRuntimeClosure(ctx, runtime, deliveryModel);
  validateTaskGate(ctx, tasksTrace);
}

function collectTasksInventory(ctx) {
  const traceFullPath = path.join(ctx.changeDir, TASKS_TRACE_PATH);
  const artifactFullPath = path.join(ctx.changeDir, TASKS_ARTIFACT_PATH);
  const manifestEntries = readManifestEntriesLenient(ctx).filter(isTasksManifestEntry);
  return {
    traceExists: fs.existsSync(traceFullPath),
    artifactExists: fs.existsSync(artifactFullPath),
    manifestEntries,
    hasAnyTasksOutput: fs.existsSync(traceFullPath) || fs.existsSync(artifactFullPath) || manifestEntries.length > 0,
  };
}

function buildExpectedModel(ctx, tasksTrace) {
  const schemaName = strip(tasksTrace["schema-name"]);
  if (schemaName === OBLIGATION_SCHEMA) {
    return { schemaName };
  }

  if (schemaName === DEFAULT_SCHEMA) {
    return { schemaName };
  }

  addError(ctx, "VAL-TASKS-TRACE-011", TASKS_TRACE_PATH, `不支持的 tasks schema-name：${schemaName || "(empty)"}`);
  return null;
}

function buildSpecsModel(ctx, schemaName) {
  const tracePaths = listFiles(path.join(ctx.changeDir, SPECS_TRACE_DIR))
    .filter((file) => file.endsWith(".trace.json"))
    .map((file) => toPosix(path.relative(ctx.changeDir, file)))
    .sort();

  if (tracePaths.length === 0) {
    addError(ctx, "VAL-TASKS-SPECS-001", SPECS_TRACE_DIR, "tasks 已存在，但未发现 specs trace；tasks 必须消费已完成 specs trace。");
    return { mode: "", tracePaths, scenariosByPointer: new Map(), scenarioPointers: [] };
  }

  const hasNoDelta = tracePaths.includes(NO_DELTA_TRACE_PATH);
  if (hasNoDelta && tracePaths.length > 1) {
    addError(ctx, "VAL-TASKS-SPECS-002", SPECS_TRACE_DIR, "tasks source-interface 不能同时包含 no-delta specs marker 和 normal specs traces。");
  }

  if (hasNoDelta) {
    const trace = readJson(ctx, path.join(ctx.changeDir, NO_DELTA_TRACE_PATH));
    if (trace) {
      expectEqual(ctx, "VAL-TASKS-SPECS-003", NO_DELTA_TRACE_PATH, trace["schema-name"], schemaName, "specs schema-name");
      expectEqual(ctx, "VAL-TASKS-SPECS-004", NO_DELTA_TRACE_PATH, trace["specs-completion-mode"], NO_DELTA_SPECS_COMPLETION_MODE, "specs-completion-mode");
    }
    return {
      mode: NO_DELTA_SPECS_COMPLETION_MODE,
      tracePaths,
      scenariosByPointer: new Map(),
      scenarioPointers: [],
    };
  }

  const scenariosByPointer = new Map();
  for (const tracePath of tracePaths) {
    const trace = readJson(ctx, path.join(ctx.changeDir, tracePath));
    if (!trace) continue;
    expectEqual(ctx, "VAL-TASKS-SPECS-010", tracePath, trace["artifact-id"], "specs", "artifact-id");
    expectEqual(ctx, "VAL-TASKS-SPECS-011", tracePath, trace["schema-name"], schemaName, "schema-name");
    expectEqual(ctx, "VAL-TASKS-SPECS-012", tracePath, trace["specs-completion-mode"], "delta", "specs-completion-mode");
    const rows = requireArray(ctx, "VAL-TASKS-SPECS-013", tracePath, trace["spec-delta-register"], "spec-delta-register");
    for (const [deltaIndex, row] of rows.entries()) {
      const deltaOp = strip(row?.["delta-op"]);
      if (deltaOp !== "added" && deltaOp !== "modified") continue;
      for (const [scenarioIndex, scenario] of requireArray(ctx, "VAL-TASKS-SPECS-015", tracePath, row?.scenarios, `spec-delta-register[${deltaIndex}].scenarios`).entries()) {
        if (scenario && typeof scenario === "object" && !Array.isArray(scenario)) {
          const pointer = `${tracePath}#/spec-delta-register/${deltaIndex}/scenarios/${scenarioIndex}`;
          scenariosByPointer.set(pointer, {
            pointer,
            tracePath,
          });
        }
      }
    }
  }

  return {
    mode: "delta",
    tracePaths,
    scenariosByPointer,
    scenarioPointers: [...scenariosByPointer.keys()],
  };
}

function buildDesignModel(ctx, trace, schemaName) {
  const details = new Map();
  const targetDetailIds = new Set();
  if (!trace) return { details, targetDetailIds };

  expectEqual(ctx, "VAL-TASKS-DESIGN-001", DESIGN_TRACE_PATH, trace["artifact-id"], "design", "artifact-id");
  expectEqual(ctx, "VAL-TASKS-DESIGN-007", DESIGN_TRACE_PATH, trace["schema-name"], schemaName, "schema-name");
  const rows = requireArray(ctx, "VAL-TASKS-DESIGN-002", DESIGN_TRACE_PATH, trace["implementation-design-register"], "implementation-design-register");
  for (const [registerIndex, row] of rows.entries()) {
    const parentId = strip(row?.["implementation-design-id"]);
    const detailRows = requireArray(
      ctx,
      "VAL-TASKS-DESIGN-003",
      DESIGN_TRACE_PATH,
      row?.["implementation-details"],
      `implementation-design-register[${registerIndex}].implementation-details`,
    );
    for (const [detailIndex, detail] of detailRows.entries()) {
      const label = `implementation-design-register[${registerIndex}].implementation-details[${detailIndex}]`;
      const detailId = strip(detail?.["detail-id"]);
      if (!detailId) {
        addError(ctx, "VAL-TASKS-DESIGN-004", DESIGN_TRACE_PATH, `${label}.detail-id 缺失。`);
        continue;
      }
      if (!IMPLEMENTATION_DETAIL_ID_RE.test(detailId)) {
        addError(ctx, "VAL-TASKS-DESIGN-005", DESIGN_TRACE_PATH, `${label}.detail-id 非法：${detailId}。`);
        continue;
      }
      if (details.has(detailId)) {
        addError(ctx, "VAL-TASKS-DESIGN-006", DESIGN_TRACE_PATH, `implementation detail 重复：${detailId}。`);
      }
      const detailType = strip(detail?.["detail-type"]);
      details.set(detailId, {
        id: detailId,
        parentId,
        detailType,
      });
      if (detailType !== "non-applicable") {
        targetDetailIds.add(detailId);
      }
    }
  }

  return { details, targetDetailIds };
}

function buildRuntimeModel(ctx, trace, schemaName) {
  const rows = new Map();
  expectEqual(ctx, "VAL-TASKS-RUNTIME-006", RUNTIME_TRACE_PATH, trace["artifact-id"], "runtime-acceptance", "artifact-id");
  expectEqual(ctx, "VAL-TASKS-RUNTIME-007", RUNTIME_TRACE_PATH, trace["schema-name"], schemaName, "schema-name");
  const values = requireArray(ctx, "VAL-TASKS-RUNTIME-001", RUNTIME_TRACE_PATH, trace["runtime-fact-register"], "runtime-fact-register");

  for (const [index, row] of values.entries()) {
    const id = strip(row?.["runtime-fact-id"]);
    if (!id) {
      addError(ctx, "VAL-TASKS-RUNTIME-003", RUNTIME_TRACE_PATH, `runtime-fact-register[${index}] 缺少 runtime fact id。`);
      continue;
    }
    if (!RUNTIME_FACT_ID_RE.test(id)) {
      addError(ctx, "VAL-TASKS-RUNTIME-004", RUNTIME_TRACE_PATH, `runtime-fact-register[${index}] runtime fact id 非法：${id}。`);
      continue;
    }
    if (rows.has(id)) {
      addError(ctx, "VAL-TASKS-RUNTIME-005", RUNTIME_TRACE_PATH, `runtime fact 重复：${id}。`);
    }
    const scopeRole = requireString(ctx, "VAL-TASKS-RUNTIME-008", RUNTIME_TRACE_PATH, row?.["scope-role"], `runtime-fact-register[${index}].scope-role`);
    if (scopeRole && !TARGET_SCOPE_ROLES.has(scopeRole)) {
      addError(ctx, "VAL-TASKS-RUNTIME-009", RUNTIME_TRACE_PATH, `runtime-fact-register[${index}].scope-role 非法：${scopeRole}。`);
    }
    rows.set(id, {
      id,
      row,
      rowType: strip(row?.["fact-type"]) || rowTypeForRuntimeId(id),
      scopeRole,
    });
  }

  return {
    rows,
    rowIds: new Set(rows.keys()),
  };
}

function validateCommonTrace(ctx, trace, expected, specs) {
  expectEqual(ctx, "VAL-TASKS-TRACE-001", TASKS_TRACE_PATH, trace["trace-schema"], TRACE_SCHEMA, "trace-schema");
  expectEqual(ctx, "VAL-TASKS-TRACE-002", TASKS_TRACE_PATH, trace["artifact-id"], "tasks", "artifact-id");
  expectEqual(ctx, "VAL-TASKS-TRACE-003", TASKS_TRACE_PATH, trace["artifact-path"], TASKS_ARTIFACT_PATH, "artifact-path");
  expectEqual(ctx, "VAL-TASKS-TRACE-004", TASKS_TRACE_PATH, trace["change-name"], ctx.change, "change-name");
  expectEqual(ctx, "VAL-TASKS-TRACE-005", TASKS_TRACE_PATH, trace["schema-name"], expected.schemaName, "schema-name");
  requireString(ctx, "VAL-TASKS-TRACE-006", TASKS_TRACE_PATH, trace["agent-role"], "agent-role");
  const sourceInterface = requireObject(ctx, "VAL-TASKS-TRACE-007", TASKS_TRACE_PATH, trace["source-interface"], "source-interface");
  requireObject(ctx, "VAL-TASKS-TRACE-008", TASKS_TRACE_PATH, trace["delivery-plane"], "delivery-plane");
  requireArray(ctx, "VAL-TASKS-TRACE-009", TASKS_TRACE_PATH, trace["implementation-step-register"], "implementation-step-register");
  requireObject(ctx, "VAL-TASKS-TRACE-010", TASKS_TRACE_PATH, trace["task-gate"], "task-gate");
  validateAllowedKeys(ctx, "VAL-TASKS-SOURCE-020", TASKS_TRACE_PATH, sourceInterface, "source-interface", SOURCE_INTERFACE_KEYS);

  expectEqual(ctx, "VAL-TASKS-SOURCE-001", TASKS_TRACE_PATH, sourceInterface["proposal-trace"], PROPOSAL_TRACE_PATH, "source-interface.proposal-trace");
  expectEqual(ctx, "VAL-TASKS-SOURCE-002", TASKS_TRACE_PATH, sourceInterface["design-trace"], DESIGN_TRACE_PATH, "source-interface.design-trace");
  expectEqual(ctx, "VAL-TASKS-SOURCE-003", TASKS_TRACE_PATH, sourceInterface["runtime-acceptance-trace"], RUNTIME_TRACE_PATH, "source-interface.runtime-acceptance-trace");
  expectEqual(ctx, "VAL-TASKS-SOURCE-004", TASKS_TRACE_PATH, sourceInterface["specs-completion-mode"], specs.mode, "source-interface.specs-completion-mode");
  const specTraces = requireArray(ctx, "VAL-TASKS-SOURCE-005", TASKS_TRACE_PATH, sourceInterface["spec-traces"], "source-interface.spec-traces")
    .map(strip)
    .filter(Boolean);
  expectSameSet(ctx, "VAL-TASKS-SOURCE-006", TASKS_TRACE_PATH, specTraces, specs.tracePaths, "source-interface.spec-traces");
  requireString(ctx, "VAL-TASKS-SOURCE-007", TASKS_TRACE_PATH, sourceInterface["input-policy"], "source-interface.input-policy");
}

function validateManifest(ctx) {
  const manifestRelPath = "trace/manifest.json";
  const manifestFullPath = path.join(ctx.changeDir, manifestRelPath);
  if (!fs.existsSync(manifestFullPath)) return;
  const manifest = readJson(ctx, manifestFullPath);
  if (!manifest) return;

  warnIfNotEqual(ctx, "VAL-TASKS-MANIFEST-010", manifestRelPath, manifest["trace-schema"], TRACE_SCHEMA, "trace-schema");
  warnIfNotEqual(ctx, "VAL-TASKS-MANIFEST-010", manifestRelPath, manifest["trace-contract-version"], TRACE_CONTRACT_VERSION, "trace-contract-version");

  const entries = requireArray(ctx, "VAL-TASKS-MANIFEST-004", manifestRelPath, manifest.artifacts, "artifacts").filter(isTasksManifestEntry);
  if (entries.length !== 1) {
    addError(ctx, "VAL-TASKS-MANIFEST-005", manifestRelPath, "manifest 必须有且仅有一个 tasks -> trace/tasks.trace.json registry entry。");
    return;
  }
  expectEqual(ctx, "VAL-TASKS-MANIFEST-006", manifestRelPath, entries[0]["artifact-id"], "tasks", "tasks entry artifact-id");
  expectEqual(ctx, "VAL-TASKS-MANIFEST-007", manifestRelPath, entries[0]["artifact-path"], TASKS_ARTIFACT_PATH, "tasks entry artifact-path");
  expectEqual(ctx, "VAL-TASKS-MANIFEST-008", manifestRelPath, entries[0]["trace-path"], TASKS_TRACE_PATH, "tasks entry trace-path");
  expectEqual(ctx, "VAL-TASKS-MANIFEST-009", manifestRelPath, entries[0]["trace-schema"], TRACE_SCHEMA, "tasks entry trace-schema");
}

function validateTaskCheckboxWriteback(ctx, tasksTrace) {
  const artifactFullPath = path.join(ctx.changeDir, TASKS_ARTIFACT_PATH);
  if (!fs.existsSync(artifactFullPath)) {
    addError(ctx, "VAL-TASKS-CHECKBOX-001", TASKS_ARTIFACT_PATH, "tasks.md 缺失；apply 需要可回写的 implementation checkbox。");
    return;
  }

  const actual = fs.readFileSync(artifactFullPath, "utf8");
  for (const step of asArray(tasksTrace["implementation-step-register"])) {
    for (const task of asArray(step?.tasks)) {
      const taskId = strip(task?.["task-id"]);
      if (!taskId) continue;
      const checkboxRe = new RegExp(`^\\s*[-*]\\s+\\[[ xX]\\]\\s+${escapeRegExp(taskId)}(?:\\s|$)`, "mu");
      if (!checkboxRe.test(actual)) {
        addError(ctx, "VAL-TASKS-CHECKBOX-002", TASKS_ARTIFACT_PATH, `tasks.md 缺少可回写 checkbox 行：${taskId}。`);
      }
    }
  }
}

function validateSourceInterfaceBoundaries(ctx, sourceInterface) {
  for (const item of collectStringLeaves(sourceInterface)) {
    if (isInputPolicyPointer(item.pointer)) continue;
    const value = normalizePathText(strip(item.value));
    if (MARKDOWN_INPUT_RE.test(value)) {
      addError(ctx, "VAL-TASKS-SOURCE-010", TASKS_TRACE_PATH, `source-interface${item.pointer} 不得把 Markdown artifact 作为 semantic input：${value}。`);
    }
    if (VERIFICATION_TRACE_RE.test(value)) {
      addError(ctx, "VAL-TASKS-SOURCE-011", TASKS_TRACE_PATH, `source-interface${item.pointer} 不得声明 verification trace 或 proof-slices sidecar 输入：${value}。`);
    }
    if (TEST_FILE_RE.test(value) || EVIDENCE_PATH_RE.test(value) || APPLY_EVIDENCE_RE.test(value) || DEPOSIT_RESULT_PATH_RE.test(value)) {
      addError(ctx, "VAL-TASKS-SOURCE-012", TASKS_TRACE_PATH, `source-interface${item.pointer} 不得声明测试文件、apply evidence 或 openspec-results 输入：${value}。`);
    }
  }
}

function validateForbiddenShape(ctx, trace, schemaName) {
  for (const ref of collectObjectKeyRefs(trace)) {
    if (FORBIDDEN_TRACE_KEYS.has(ref.key)) {
      addError(ctx, "VAL-TASKS-FORBIDDEN-001", TASKS_TRACE_PATH, `tasks trace 不得包含旧测试矩阵、verification、evidence/deposit 或旧字段：${ref.pointer}。`);
    }
    if (!KEBAB_KEY_RE.test(ref.key)) {
      addError(ctx, "VAL-TASKS-KEY-001", TASKS_TRACE_PATH, `tasks trace key 必须使用 kebab-case：${ref.pointer}。`);
    }
  }

  const sourceLeakRe = sourceLeakRegexForSchema(schemaName);
  for (const item of collectStringLeaves(trace)) {
    if (isSourceInputPolicyPointer(item.pointer)) continue;
    const value = normalizePathText(strip(item.value));
    if (FORBIDDEN_TEXT_RE.test(value) || LEGACY_PROOF_TEXT_RE.test(value) || EVIDENCE_PATH_RE.test(value) || APPLY_EVIDENCE_RE.test(value) || DEPOSIT_RESULT_PATH_RE.test(value)) {
      addError(ctx, "VAL-TASKS-FORBIDDEN-002", TASKS_TRACE_PATH, `tasks trace 不得包含旧测试矩阵、legacy proof/evidence 文本或 evidence/apply path：${item.pointer}。`);
    }
    if (sourceLeakRe?.test(value)) {
      addError(ctx, "VAL-TASKS-SOURCE-013", TASKS_TRACE_PATH, `tasks trace 不得泄漏 schema source coverage 身份：${item.pointer}。`);
    }
  }
}

function validateTaskTextRisk(ctx, trace) {
  for (const item of collectTaskTextLeaves(trace)) {
    const value = normalizePathText(strip(item.value));
    if (TEST_FILE_RE.test(value) || TEST_COMMAND_RE.test(value)) {
      addWarning(ctx, "VAL-TASKS-TEXT-001", TASKS_TRACE_PATH, `AC/task 文本疑似包含测试文件或测试 runner 命令，reviewer/preflight 必须判断是否为 proof/test/evidence-only task：${item.pointer}。`);
    }
  }
}

function validateImplementationSteps(ctx, trace, models) {
  const steps = requireArray(ctx, "VAL-TASKS-STEPS-001", TASKS_TRACE_PATH, trace["implementation-step-register"], "implementation-step-register");
  if (steps.length === 0) {
    addError(ctx, "VAL-TASKS-STEPS-002", TASKS_TRACE_PATH, "implementation-step-register 不能为空。");
  }

  const acById = new Map();
  const registerOrder = new Map();
  const taskById = new Map();

  for (const [index, step] of steps.entries()) {
    const label = `implementation-step-register[${index}]`;
    validateAllowedKeys(ctx, "VAL-TASKS-STEP-000", TASKS_TRACE_PATH, step, label, IMPLEMENTATION_STEP_KEYS);
    const acId = requireId(ctx, "VAL-TASKS-AC-001", TASKS_TRACE_PATH, step?.["step-id"], `${label}.step-id`, AC_ID_RE);
    if (!acId) continue;
    if (acById.has(acId)) {
      addError(ctx, "VAL-TASKS-AC-002", TASKS_TRACE_PATH, `AC 重复：${acId}。`);
    }
    registerOrder.set(acId, index);

    requireString(ctx, "VAL-TASKS-AC-003", TASKS_TRACE_PATH, step?.title, `${label}.title`);
    validateWorkStage(ctx, step?.["work-stage"], `${label}.work-stage`);
    const dependsOn = requireAcIdArray(ctx, "VAL-TASKS-AC-004", step?.["depends-on-step-ids"] ?? [], `${label}.depends-on-step-ids`);
    const stepLinks = validateTaskLinks(ctx, step, label, models);

    const tasks = requireArray(ctx, "VAL-TASKS-TASK-001", TASKS_TRACE_PATH, step?.tasks, `${label}.tasks`);
    if (tasks.length === 0) {
      addError(ctx, "VAL-TASKS-TASK-002", TASKS_TRACE_PATH, `${acId} 必须包含至少一个 checkbox task。`);
    }

    const taskLinkAggregation = emptyLinkBuckets();
    for (const [taskIndex, task] of tasks.entries()) {
      const taskLabel = `${label}.tasks[${taskIndex}]`;
      validateAllowedKeys(ctx, "VAL-TASKS-TASK-000", TASKS_TRACE_PATH, task, taskLabel, CHECKBOX_TASK_KEYS);
      const taskId = requireId(ctx, "VAL-TASKS-TASK-003", TASKS_TRACE_PATH, task?.["task-id"], `${taskLabel}.task-id`, TASK_ID_RE);
      if (!taskId) continue;
      if (!taskId.startsWith(`${acId}.`)) {
        addError(ctx, "VAL-TASKS-TASK-004", TASKS_TRACE_PATH, `${taskLabel}.task-id 必须属于同一 AC：${acId}。`);
      }
      if (taskById.has(taskId)) {
        addError(ctx, "VAL-TASKS-TASK-005", TASKS_TRACE_PATH, `task-id 重复：${taskId}。`);
      }
      requireString(ctx, "VAL-TASKS-TASK-007", TASKS_TRACE_PATH, task?.title, `${taskLabel}.title`);
      validateWorkStage(ctx, task?.["work-stage"], `${taskLabel}.work-stage`);
      const taskLinks = validateTaskLinks(ctx, task, taskLabel, models);
      requireString(ctx, "VAL-TASKS-TASK-009", TASKS_TRACE_PATH, task?.work, `${taskLabel}.work`);
      mergeLinkBuckets(taskLinkAggregation, taskLinks);
      taskById.set(taskId, {
        taskId,
        acId,
        links: taskLinks,
      });
    }

    validateStepLinksMatchTaskAggregation(ctx, acId, stepLinks, taskLinkAggregation);
    acById.set(acId, {
      acId,
      dependsOn,
      links: stepLinks,
    });
  }

  return {
    acById,
    acOrder: registerOrder,
    taskById,
  };
}

function validateDeliveryPlane(ctx, trace, stepModel) {
  const delivery = requireObject(ctx, "VAL-TASKS-DELIVERY-001", TASKS_TRACE_PATH, trace["delivery-plane"], "delivery-plane");
  validateAllowedKeys(ctx, "VAL-TASKS-DELIVERY-000", TASKS_TRACE_PATH, delivery, "delivery-plane", DELIVERY_PLANE_KEYS);
  const sectionIds = requireAcIdArray(ctx, "VAL-TASKS-DELIVERY-002", delivery["step-sections"], "delivery-plane.step-sections");
  if (sectionIds.length === 0) {
    addError(ctx, "VAL-TASKS-DELIVERY-003", TASKS_TRACE_PATH, "delivery-plane.step-sections 不能为空。");
  }
  for (const stepId of sectionIds) {
    validateAcRef(ctx, stepId, stepModel, "delivery-plane.step-sections", "VAL-TASKS-DELIVERY-004");
  }
  expectSameSet(ctx, "VAL-TASKS-DELIVERY-005", TASKS_TRACE_PATH, sectionIds, [...stepModel.acById.keys()], "delivery-plane.step-sections vs implementation-step-register");

  return {
    ...stepModel,
  };
}

function validateStepDependencyOrder(ctx, deliveryModel) {
  for (const [acId, step] of deliveryModel.acById.entries()) {
    validateDependencyOrder(ctx, acId, step.dependsOn, deliveryModel, `${acId}.depends-on-step-ids`, "VAL-TASKS-DEPENDENCY-001");
  }
}

function validateSpecScenarioCoverage(ctx, specs, deliveryModel) {
  const completed = new Set();
  for (const task of deliveryModel.taskById.values()) {
    for (const link of task.links.spec) {
      if (SPEC_CLOSING_CONTRIBUTIONS.has(link.contribution)) completed.add(link.id);
    }
  }
  for (const pointer of specs.scenarioPointers) {
    if (!completed.has(pointer)) {
      addError(ctx, "VAL-TASKS-SPEC-COVERAGE-001", TASKS_TRACE_PATH, `${pointer} 是 in-scope spec scenario，但未被 checkbox task completes。`);
    }
  }
}

function validateDesignDetailCoverage(ctx, design, deliveryModel) {
  const completed = new Set();
  for (const task of deliveryModel.taskById.values()) {
    for (const link of task.links.design) {
      if (DESIGN_CLOSING_CONTRIBUTIONS.has(link.contribution)) completed.add(link.id);
    }
  }
  for (const detailId of design.targetDetailIds) {
    if (!completed.has(detailId)) {
      addError(ctx, "VAL-TASKS-DESIGN-COVERAGE-001", TASKS_TRACE_PATH, `${detailId} 是 implementation detail，但未被 checkbox task completes。`);
    }
  }
}

function validateRuntimeClosure(ctx, runtime, deliveryModel) {
  const closed = new Map();
  for (const task of deliveryModel.taskById.values()) {
    for (const link of task.links.runtime) {
      if (!closed.has(link.id)) closed.set(link.id, new Set());
      closed.get(link.id).add(link.contribution);
    }
  }
  for (const [rowId, runtimeRecord] of runtime.rows.entries()) {
    if (!TARGET_SCOPE_ROLES.has(runtimeRecord.scopeRole)) continue;
    const contributions = closed.get(rowId) ?? new Set();
    const isClosed = runtimeRecord.scopeRole === "preserve boundary"
      ? contributions.has("enforces")
      : contributions.has("completes");
    if (!isClosed) {
      const expected = runtimeRecord.scopeRole === "preserve boundary" ? "enforces" : "completes";
      addError(ctx, "VAL-TASKS-RUNTIME-CLOSURE-001", TASKS_TRACE_PATH, `${rowId} 是 ${runtimeRecord.scopeRole} runtime fact，但未被 checkbox task ${expected}。`);
    }
  }
}

function validateTaskGate(ctx, trace) {
  const gate = requireObject(ctx, "VAL-TASKS-GATE-001", TASKS_TRACE_PATH, trace["task-gate"], "task-gate");
  validateAllowedKeys(ctx, "VAL-TASKS-GATE-000", TASKS_TRACE_PATH, gate, "task-gate", TASK_GATE_KEYS);
  for (const field of [
    "blockers",
    "uncovered-spec-scenarios",
    "incomplete-design-details",
    "incomplete-runtime-facts",
    "invalid-spec-refs",
    "invalid-design-detail-refs",
    "invalid-runtime-fact-refs",
    "dependency-order-violations",
    "hidden-dependency-violations",
    "non-production-task-violations",
    "delivery-projection-mismatch",
  ]) {
    const rows = requireArray(ctx, "VAL-TASKS-GATE-002", TASKS_TRACE_PATH, gate[field], `task-gate.${field}`);
    if (rows.length > 0) {
      addError(ctx, "VAL-TASKS-GATE-003", TASKS_TRACE_PATH, `task-gate.${field} 必须为空。`);
    }
  }
}

function validateWorkStage(ctx, value, label) {
  const stage = requireString(ctx, "VAL-TASKS-WORK-STAGE-001", TASKS_TRACE_PATH, value, label);
  if (stage && !WORK_STAGES.has(stage)) {
    addError(ctx, "VAL-TASKS-WORK-STAGE-002", TASKS_TRACE_PATH, `${label} 不在允许集合：${stage}。`);
  }
  return stage;
}

function validateTaskLinks(ctx, row, label, models) {
  const links = emptyLinkBuckets();
  links.spec = validateSpecScenarioLinks(ctx, row?.["spec-scenario-links"], `${label}.spec-scenario-links`, models.specs);
  links.design = validateDesignDetailLinks(ctx, row?.["design-detail-links"], `${label}.design-detail-links`, models.design);
  links.runtime = validateRuntimeFactLinks(ctx, row?.["runtime-fact-links"], `${label}.runtime-fact-links`, models.runtime);
  if (links.spec.length + links.design.length + links.runtime.length === 0) {
    addError(ctx, "VAL-TASKS-LINKS-001", TASKS_TRACE_PATH, `${label} 必须至少声明一个 spec/design/runtime link。`);
  }
  return links;
}

function validateSpecScenarioLinks(ctx, value, label, specs) {
  return requireArray(ctx, "VAL-TASKS-SPEC-LINK-001", TASKS_TRACE_PATH, value, label).map((link, index) => {
    const linkLabel = `${label}[${index}]`;
    const row = requireObject(ctx, "VAL-TASKS-SPEC-LINK-002", TASKS_TRACE_PATH, link, linkLabel);
    validateAllowedKeys(ctx, "VAL-TASKS-SPEC-LINK-003", TASKS_TRACE_PATH, row, linkLabel, new Set(["spec-scenario", "contribution"]));
    const id = requireString(ctx, "VAL-TASKS-SPEC-LINK-004", TASKS_TRACE_PATH, row["spec-scenario"], `${linkLabel}.spec-scenario`);
    if (id && !SPEC_SCENARIO_POINTER_RE.test(id)) {
      addError(ctx, "VAL-TASKS-SPEC-LINK-005", TASKS_TRACE_PATH, `${linkLabel}.spec-scenario 必须是 specs scenario pointer：${id}。`);
    }
    if (id && !specs.scenariosByPointer.has(id)) {
      addError(ctx, "VAL-TASKS-SPEC-LINK-006", TASKS_TRACE_PATH, `${linkLabel}.spec-scenario 引用未定义 spec scenario：${id}。`);
    }
    const contribution = validateContribution(ctx, row.contribution, SPEC_CONTRIBUTIONS, `${linkLabel}.contribution`, "VAL-TASKS-SPEC-LINK-007");
    return { id, contribution };
  }).filter((link) => link.id && link.contribution);
}

function validateDesignDetailLinks(ctx, value, label, design) {
  return requireArray(ctx, "VAL-TASKS-DESIGN-LINK-001", TASKS_TRACE_PATH, value, label).map((link, index) => {
    const linkLabel = `${label}[${index}]`;
    const row = requireObject(ctx, "VAL-TASKS-DESIGN-LINK-002", TASKS_TRACE_PATH, link, linkLabel);
    validateAllowedKeys(ctx, "VAL-TASKS-DESIGN-LINK-003", TASKS_TRACE_PATH, row, linkLabel, new Set(["design-detail-id", "contribution"]));
    const id = requireId(ctx, "VAL-TASKS-DESIGN-LINK-004", TASKS_TRACE_PATH, row["design-detail-id"], `${linkLabel}.design-detail-id`, IMPLEMENTATION_DETAIL_ID_RE);
    if (id && !design.details.has(id)) {
      addError(ctx, "VAL-TASKS-DESIGN-LINK-005", TASKS_TRACE_PATH, `${linkLabel}.design-detail-id 引用未定义 implementation detail：${id}。`);
    }
    const contribution = validateContribution(ctx, row.contribution, DESIGN_CONTRIBUTIONS, `${linkLabel}.contribution`, "VAL-TASKS-DESIGN-LINK-006");
    return { id, contribution };
  }).filter((link) => link.id && link.contribution);
}

function validateRuntimeFactLinks(ctx, value, label, runtime) {
  return requireArray(ctx, "VAL-TASKS-RUNTIME-LINK-001", TASKS_TRACE_PATH, value, label).map((link, index) => {
    const linkLabel = `${label}[${index}]`;
    const row = requireObject(ctx, "VAL-TASKS-RUNTIME-LINK-002", TASKS_TRACE_PATH, link, linkLabel);
    validateAllowedKeys(ctx, "VAL-TASKS-RUNTIME-LINK-003", TASKS_TRACE_PATH, row, linkLabel, new Set(["runtime-fact-id", "contribution"]));
    const id = requireId(ctx, "VAL-TASKS-RUNTIME-LINK-004", TASKS_TRACE_PATH, row["runtime-fact-id"], `${linkLabel}.runtime-fact-id`, RUNTIME_FACT_ID_RE);
    const runtimeRecord = runtime.rows.get(id);
    if (id && !runtimeRecord) {
      addError(ctx, "VAL-TASKS-RUNTIME-LINK-005", TASKS_TRACE_PATH, `${linkLabel}.runtime-fact-id 引用未定义 runtime fact：${id}。`);
    }
    if (runtimeRecord && !TARGET_SCOPE_ROLES.has(runtimeRecord.scopeRole)) {
      addError(ctx, "VAL-TASKS-RUNTIME-LINK-006", TASKS_TRACE_PATH, `${linkLabel}.runtime-fact-id 只能引用 required/preserve runtime fact，不得引用 ${runtimeRecord.scopeRole || "(empty)"}：${id}。`);
    }
    const contribution = validateContribution(ctx, row.contribution, RUNTIME_CONTRIBUTIONS, `${linkLabel}.contribution`, "VAL-TASKS-RUNTIME-LINK-007");
    return { id, contribution };
  }).filter((link) => link.id && link.contribution);
}

function validateContribution(ctx, value, allowed, label, ruleId) {
  const contribution = requireString(ctx, ruleId, TASKS_TRACE_PATH, value, label);
  if (contribution && !allowed.has(contribution)) {
    addError(ctx, ruleId, TASKS_TRACE_PATH, `${label} 不在允许集合：${contribution}。`);
  }
  return contribution;
}

function validateStepLinksMatchTaskAggregation(ctx, acId, stepLinks, taskLinks) {
  for (const [kind, description] of [
    ["spec", "spec-scenario-links"],
    ["design", "design-detail-links"],
    ["runtime", "runtime-fact-links"],
  ]) {
    const stepSet = linkSet(stepLinks[kind]);
    const taskSet = linkSet(taskLinks[kind]);
    const missing = [...taskSet].filter((item) => !stepSet.has(item));
    const extra = [...stepSet].filter((item) => !taskSet.has(item));
    if (missing.length > 0 || extra.length > 0) {
      addError(
        ctx,
        "VAL-TASKS-LINKS-002",
        TASKS_TRACE_PATH,
        `${acId} ${description} 必须等于子 checkbox links 聚合；缺少 ${missing.join(", ") || "无"}；多余 ${extra.join(", ") || "无"}。`,
      );
    }
  }
}

function emptyLinkBuckets() {
  return { spec: [], design: [], runtime: [] };
}

function mergeLinkBuckets(target, source) {
  target.spec.push(...source.spec);
  target.design.push(...source.design);
  target.runtime.push(...source.runtime);
}

function linkSet(links) {
  return new Set(links.map((link) => `${link.id}:${link.contribution}`));
}

function sourceLeakRegexForSchema(schemaName) {
  if (schemaName === OBLIGATION_SCHEMA) return OBLIGATION_SOURCE_LEAK_RE;
  if (schemaName === DEFAULT_SCHEMA) return DEFAULT_SOURCE_LEAK_RE;
  return null;
}

function isInputPolicyPointer(pointer) {
  return pointer === "/input-policy" || pointer.startsWith("/input-policy/");
}

function isSourceInputPolicyPointer(pointer) {
  return pointer === "/source-interface/input-policy" || pointer.startsWith("/source-interface/input-policy/");
}

function normalizePathText(value) {
  return strip(value).replace(/\\/gu, "/");
}

function collectTaskTextLeaves(trace) {
  const leaves = [];
  for (const [stepIndex, step] of asArray(trace?.["implementation-step-register"]).entries()) {
    if (typeof step?.title === "string") {
      leaves.push({ value: step.title, pointer: `/implementation-step-register/${stepIndex}/title` });
    }
    for (const [taskIndex, task] of asArray(step?.tasks).entries()) {
      if (typeof task?.title === "string") {
        leaves.push({ value: task.title, pointer: `/implementation-step-register/${stepIndex}/tasks/${taskIndex}/title` });
      }
      if (typeof task?.work === "string") {
        leaves.push({ value: task.work, pointer: `/implementation-step-register/${stepIndex}/tasks/${taskIndex}/work` });
      }
    }
  }
  return leaves;
}

function requireAcIdArray(ctx, ruleId, value, label) {
  return requireIdArray(ctx, ruleId, TASKS_TRACE_PATH, value, label, AC_ID_RE);
}

function validateAcRef(ctx, acId, deliveryModel, label, ruleId) {
  if (!AC_ID_RE.test(strip(acId))) {
    addError(ctx, ruleId, TASKS_TRACE_PATH, `${label} 包含非法 AC ID：${acId || "(empty)"}。`);
    return;
  }
  if (!deliveryModel.acById.has(acId)) {
    addError(ctx, ruleId, TASKS_TRACE_PATH, `${label} 引用未知 AC：${acId}。`);
  }
}

function validateDependencyOrder(ctx, acId, dependsOn, deliveryModel, label, ruleId) {
  const acOrder = deliveryModel.acOrder.get(acId);
  for (const dependency of dependsOn) {
    validateAcRef(ctx, dependency, deliveryModel, label, ruleId);
    const dependencyOrder = deliveryModel.acOrder.get(dependency);
    if (typeof acOrder === "number" && typeof dependencyOrder === "number" && dependencyOrder >= acOrder) {
      addError(ctx, ruleId, TASKS_TRACE_PATH, `${acId} 依赖的 ${dependency} 必须出现在它之前。`);
    }
  }
}

function rowTypeForRuntimeId(id) {
  if (id.startsWith("RS-")) return "surface";
  if (id.startsWith("OP-")) return "operation";
  if (id.startsWith("ST-")) return "state";
  if (id.startsWith("CH-")) return "chain";
  return "";
}

function readManifestEntriesLenient(ctx) {
  const manifestPath = path.join(ctx.changeDir, "trace", "manifest.json");
  if (!fs.existsSync(manifestPath)) return [];
  const manifest = readJson(ctx, manifestPath);
  return Array.isArray(manifest?.artifacts) ? manifest.artifacts : [];
}

function isTasksManifestEntry(entry) {
  return (
    strip(entry?.["artifact-id"]) === "tasks" ||
    strip(entry?.["artifact-path"]) === TASKS_ARTIFACT_PATH ||
    strip(entry?.["trace-path"]) === TASKS_TRACE_PATH
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
    addError(ctx, ruleId, file, `${label} 包含非法 ID：${id}。`);
  }
  return id;
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

function validateAllowedKeys(ctx, ruleId, file, value, label, allowedKeys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      addError(ctx, ruleId, file, `${label} 包含不允许的字段：${key}。`);
    }
  }
}

function expectEqual(ctx, ruleId, file, actual, expected, label) {
  if (actual !== expected) {
    addError(ctx, ruleId, file, `${label} 不一致：实际 ${formatValue(actual)}，期望 ${formatValue(expected)}。`);
  }
}

function warnIfNotEqual(ctx, ruleId, file, actual, expected, label) {
  if (actual !== expected) {
    addWarning(ctx, ruleId, file, `${label} 不一致：实际 ${formatValue(actual)}，期望 ${formatValue(expected)}。`);
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

function escapePointer(value) {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
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
  lines.push(`${result.ok ? "PASS" : "FAIL"} validate-tasks-artifact${options.change ? ` --change ${options.change}` : ""}`);
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
  node openspec/agent-runtime/scripts/validators/validate-tasks-artifact.mjs --change <slug> [--root <path>]
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

function unique(values) {
  return [...new Set(values)];
}

function formatValue(value) {
  return value === undefined ? "(undefined)" : JSON.stringify(value);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(usage());
      process.exit(0);
    }
    const result = validateTasksArtifact(options);
    process.stdout.write(formatResult(result, options));
    process.exit(result.ok ? 0 : 1);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
