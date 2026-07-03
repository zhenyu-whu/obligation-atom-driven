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
const TASKS_TRACE_PATH = "trace/tasks.trace.json";
const TASKS_ARTIFACT_PATH = "tasks.md";

const GA_ID_RE = /^GA-\d{4}$/u;
const SI_ID_RE = /^SI-\d{3}$/u;
const ANY_GA_ID_RE = /\bGA-\d{4}\b/u;
const ANY_SI_ID_RE = /\bSI-\d{3}\b/u;
const AC_ID_RE = /^AC-\d{3}$/u;
const TASK_ID_RE = /^AC-\d{3}\.\d+$/u;
const DECISION_ID_RE = /^D-\d{3}$/u;
const RUNTIME_ROW_ID_RE = /^(RS|OP|ST|CH)-\d{3}$/u;
const KEBAB_KEY_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;

const SCOPE_ROLES = new Set(["required behavior", "preserve boundary", "proof-only"]);
const PROJECTION_STATUSES = new Set(["projected", "not-applicable", "blocked"]);
const PROOF_ONLY_HANDLINGS = new Set(["not-proof-only", "production-work-required", "proof-projection-only"]);
const COVERAGE_STATUSES = new Set([
  "projected-to-production-task",
  "projected-to-existing-production-task",
  "not-applicable",
  "blocked",
]);

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
]);

const FORBIDDEN_TEXT_RE = /\b(?:Test Evidence Matrix|Regression Test Deposit|Test Layer Plan|Fixed Command|Test File \/ Name|Evidence Directory|Evidence Status|Deposit Status|Test IDs)\b/iu;
const MARKDOWN_INPUT_RE = /(?:^|\/)(?:proposal|design|runtime-acceptance|verification|tasks)\.md$|(?:^|\/)specs\/.+\.md$/iu;
const VERIFICATION_TRACE_RE = /(?:^|\/)trace\/verification(?:\.trace|\.proof-slices)\.json\b/iu;
const TEST_FILE_RE = /(?:^|\/)[^/\s]+\.(?:test|spec)\.[cm]?[jt]sx?\b/u;
const EVIDENCE_PATH_RE = /(?:^|\/)(?:openspec-results|test-results)\//u;
const APPLY_EVIDENCE_RE = /(?:^|\/)(?:apply-result\.md|proof-test-map\.json)\b/u;
const COMMAND_RE = /\b(?:pnpm|npm|yarn|npx|vitest|jest|playwright test|go test|pytest|cargo test|bun test|node\s+(?:--[a-z-]+|[-\w./]+\.m?js))\b/u;

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
  const proposalTrace = readJson(ctx, path.join(ctx.changeDir, PROPOSAL_TRACE_PATH));
  const runtimeTrace = readJson(ctx, path.join(ctx.changeDir, RUNTIME_TRACE_PATH));
  if (!tasksTrace || !proposalTrace || !runtimeTrace) return;

  const expected = buildExpectedModel(ctx, proposalTrace);
  if (!expected) return;
  const specs = buildSpecsModel(ctx, expected.schemaName);
  const design = buildDesignModel(ctx);
  const runtime = buildRuntimeModel(ctx, runtimeTrace);

  validateKebabCaseKeys(ctx, tasksTrace);
  validateCommonTrace(ctx, tasksTrace, expected, specs);
  validateManifest(ctx);
  validateRender(ctx);
  validateSourceInterfaceBoundaries(ctx, tasksTrace["source-interface"]);
  validateForbiddenShape(ctx, tasksTrace);
  validateProfileLeaks(ctx, tasksTrace, expected);

  const deliveryModel = validateDeliveryPlane(ctx, tasksTrace, runtime);
  const indexModel = validateRuntimeAcceptanceIndex(ctx, tasksTrace, runtime, deliveryModel);
  validateRuntimeAcceptanceProjection(ctx, tasksTrace, runtime, deliveryModel, indexModel);
  validateAcceptanceDrivenCoverage(ctx, tasksTrace, expected, specs, design, runtime, deliveryModel);
  validateArtifactForbiddenText(ctx);
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

function buildExpectedModel(ctx, proposalTrace) {
  const schemaName = strip(proposalTrace["schema-name"]);
  if (schemaName === OBLIGATION_SCHEMA) {
    const rows = requireArray(
      ctx,
      "VAL-TASKS-PROPOSAL-001",
      PROPOSAL_TRACE_PATH,
      proposalTrace["change-atom-coverage-register"],
      "change-atom-coverage-register",
    );
    return buildExpectedRows({
      schemaName,
      rows,
      idField: "global-atom-id",
      idRegex: GA_ID_RE,
      projectionField: "artifact-projection",
    });
  }

  if (schemaName === DEFAULT_SCHEMA) {
    const rows = requireArray(
      ctx,
      "VAL-TASKS-PROPOSAL-010",
      PROPOSAL_TRACE_PATH,
      proposalTrace["change-scope-coverage"],
      "change-scope-coverage",
    );
    return buildExpectedRows({
      schemaName,
      rows,
      idField: "scope-item-id",
      idRegex: SI_ID_RE,
      projectionField: "artifact-handling",
    });
  }

  addError(ctx, "VAL-TASKS-PROPOSAL-020", PROPOSAL_TRACE_PATH, `不支持的 proposal schema-name：${schemaName || "(empty)"}`);
  return null;
}

function buildExpectedRows(config) {
  const rowsById = new Map();
  const ids = [];
  for (const row of config.rows) {
    const id = strip(row?.[config.idField]);
    if (!id) continue;
    ids.push(id);
    if (!rowsById.has(id)) rowsById.set(id, row);
  }
  return {
    ...config,
    ids,
    rowsById,
  };
}

function buildSpecsModel(ctx, schemaName) {
  const tracePaths = listFiles(path.join(ctx.changeDir, SPECS_TRACE_DIR))
    .filter((file) => file.endsWith(".trace.json"))
    .map((file) => toPosix(path.relative(ctx.changeDir, file)))
    .sort();

  if (tracePaths.length === 0) {
    addError(ctx, "VAL-TASKS-SPECS-001", SPECS_TRACE_DIR, "tasks 已存在，但未发现 specs trace；tasks 必须消费已完成 specs trace。");
    return { mode: "", tracePaths, scenariosByKey: new Map() };
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
      scenariosByKey: new Map(),
    };
  }

  const scenariosByKey = new Map();
  for (const tracePath of tracePaths) {
    const trace = readJson(ctx, path.join(ctx.changeDir, tracePath));
    if (!trace) continue;
    expectEqual(ctx, "VAL-TASKS-SPECS-010", tracePath, trace["artifact-id"], "specs", "artifact-id");
    expectEqual(ctx, "VAL-TASKS-SPECS-011", tracePath, trace["schema-name"], schemaName, "schema-name");
    expectEqual(ctx, "VAL-TASKS-SPECS-012", tracePath, trace["specs-completion-mode"], "delta", "specs-completion-mode");
    const rows = requireArray(ctx, "VAL-TASKS-SPECS-013", tracePath, trace["requirement-source-trace"], "requirement-source-trace");
    for (const [index, row] of rows.entries()) {
      const requirement = requireString(ctx, "VAL-TASKS-SPECS-014", tracePath, row?.requirement, `requirement-source-trace[${index}].requirement`);
      const scenario = requireString(ctx, "VAL-TASKS-SPECS-015", tracePath, row?.scenario, `requirement-source-trace[${index}].scenario`);
      if (requirement && scenario) {
        scenariosByKey.set(specScenarioKey(tracePath, requirement, scenario), {
          tracePath,
          requirement,
          scenario,
        });
      }
    }
  }

  return {
    mode: "delta",
    tracePaths,
    scenariosByKey,
  };
}

function buildDesignModel(ctx) {
  const trace = readJson(ctx, path.join(ctx.changeDir, DESIGN_TRACE_PATH));
  const decisionIds = new Set();
  const matrixRowIds = new Set();
  if (!trace) return { decisionIds, matrixRowIds };

  for (const [index, row] of requireArray(ctx, "VAL-TASKS-DESIGN-001", DESIGN_TRACE_PATH, trace["design-decision-index"], "design-decision-index").entries()) {
    const decisionId = requireId(ctx, "VAL-TASKS-DESIGN-002", DESIGN_TRACE_PATH, row?.["decision-id"], `design-decision-index[${index}].decision-id`, DECISION_ID_RE);
    if (decisionId) decisionIds.add(decisionId);
  }

  for (const [index, row] of requireArray(ctx, "VAL-TASKS-DESIGN-010", DESIGN_TRACE_PATH, trace["design-obligation-matrix"], "design-obligation-matrix").entries()) {
    const matrixRowId = requireString(ctx, "VAL-TASKS-DESIGN-011", DESIGN_TRACE_PATH, row?.["matrix-row-id"], `design-obligation-matrix[${index}].matrix-row-id`);
    if (matrixRowId) matrixRowIds.add(matrixRowId);
  }

  return { decisionIds, matrixRowIds };
}

function buildRuntimeModel(ctx, trace) {
  const rows = new Map();
  const delivery = requireObject(ctx, "VAL-TASKS-RUNTIME-001", RUNTIME_TRACE_PATH, trace["delivery-plane"], "delivery-plane");
  const canonicalRows = delivery["canonical-rows"];
  const values = Array.isArray(canonicalRows)
    ? canonicalRows
    : Object.entries(requireObject(ctx, "VAL-TASKS-RUNTIME-002", RUNTIME_TRACE_PATH, canonicalRows, "delivery-plane.canonical-rows"))
        .map(([id, row]) => ({ id, ...Object(row) }));

  for (const [index, row] of values.entries()) {
    const id = strip(row?.id ?? row?.["surface-id"] ?? row?.["operation-id"] ?? row?.["state-id"] ?? row?.["chain-id"]);
    if (!id) {
      addError(ctx, "VAL-TASKS-RUNTIME-003", RUNTIME_TRACE_PATH, `delivery-plane.canonical-rows[${index}] 缺少 runtime row id。`);
      continue;
    }
    if (!RUNTIME_ROW_ID_RE.test(id)) {
      addError(ctx, "VAL-TASKS-RUNTIME-004", RUNTIME_TRACE_PATH, `delivery-plane.canonical-rows[${index}] runtime row id 非法：${id}。`);
      continue;
    }
    if (rows.has(id)) {
      addError(ctx, "VAL-TASKS-RUNTIME-005", RUNTIME_TRACE_PATH, `canonical runtime row 重复：${id}。`);
    }
    rows.set(id, {
      id,
      row,
      rowType: rowTypeForRuntimeId(id),
      scopeRole: strip(row?.["scope-role"]),
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
  requireObject(ctx, "VAL-TASKS-TRACE-009", TASKS_TRACE_PATH, trace["acceptance-driven-coverage"], "acceptance-driven-coverage");
  requireObject(ctx, "VAL-TASKS-TRACE-010", TASKS_TRACE_PATH, trace["runtime-acceptance-index"], "runtime-acceptance-index");
  requireObject(ctx, "VAL-TASKS-TRACE-011", TASKS_TRACE_PATH, trace["runtime-acceptance-projection"], "runtime-acceptance-projection");

  expectEqual(ctx, "VAL-TASKS-SOURCE-001", TASKS_TRACE_PATH, sourceInterface["proposal-trace"], PROPOSAL_TRACE_PATH, "source-interface.proposal-trace");
  expectEqual(ctx, "VAL-TASKS-SOURCE-002", TASKS_TRACE_PATH, sourceInterface["design-trace"], DESIGN_TRACE_PATH, "source-interface.design-trace");
  expectEqual(ctx, "VAL-TASKS-SOURCE-003", TASKS_TRACE_PATH, sourceInterface["runtime-acceptance-trace"], RUNTIME_TRACE_PATH, "source-interface.runtime-acceptance-trace");
  expectEqual(ctx, "VAL-TASKS-SOURCE-004", TASKS_TRACE_PATH, sourceInterface["specs-completion-mode"], specs.mode, "source-interface.specs-completion-mode");
  const specTraces = requireArray(ctx, "VAL-TASKS-SOURCE-005", TASKS_TRACE_PATH, sourceInterface["spec-traces"], "source-interface.spec-traces")
    .map(strip)
    .filter(Boolean);
  expectSameSet(ctx, "VAL-TASKS-SOURCE-006", TASKS_TRACE_PATH, specTraces, specs.tracePaths, "source-interface.spec-traces");
  requireString(ctx, "VAL-TASKS-SOURCE-007", TASKS_TRACE_PATH, sourceInterface["verification-input-policy"], "source-interface.verification-input-policy");
  requireString(ctx, "VAL-TASKS-SOURCE-008", TASKS_TRACE_PATH, sourceInterface["markdown-input-policy"], "source-interface.markdown-input-policy");
}

function validateManifest(ctx) {
  const manifestRelPath = "trace/manifest.json";
  const manifest = readJson(ctx, path.join(ctx.changeDir, manifestRelPath));
  if (!manifest) return;

  expectEqual(ctx, "VAL-TASKS-MANIFEST-001", manifestRelPath, manifest["trace-schema"], TRACE_SCHEMA, "trace-schema");
  expectEqual(ctx, "VAL-TASKS-MANIFEST-002", manifestRelPath, manifest["render-contract-version"], RENDER_CONTRACT_VERSION, "render-contract-version");
  expectEqual(ctx, "VAL-TASKS-MANIFEST-003", manifestRelPath, manifest["trace-contract-version"], TRACE_CONTRACT_VERSION, "trace-contract-version");

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

function validateRender(ctx) {
  const artifactFullPath = path.join(ctx.changeDir, TASKS_ARTIFACT_PATH);
  if (!fs.existsSync(artifactFullPath)) {
    addError(ctx, "VAL-TASKS-RENDER-001", TASKS_ARTIFACT_PATH, "tasks.md 缺失；writer 必须通过 renderer 生成 Markdown。");
    return;
  }

  let rendered;
  try {
    rendered = renderChangeArtifact({
      root: ctx.root,
      change: ctx.change,
      artifact: "tasks",
    }).markdown;
  } catch (error) {
    addError(ctx, "VAL-TASKS-RENDER-002", TASKS_TRACE_PATH, error.message);
    return;
  }

  const actual = fs.readFileSync(artifactFullPath, "utf8");
  if (actual !== rendered) {
    addError(ctx, "VAL-TASKS-RENDER-003", TASKS_ARTIFACT_PATH, "tasks.md 与 renderer 从 trace/tasks.trace.json 生成的结果不一致。");
  }
}

function validateSourceInterfaceBoundaries(ctx, sourceInterface) {
  for (const item of collectStringLeaves(sourceInterface)) {
    const value = strip(item.value);
    if (MARKDOWN_INPUT_RE.test(value)) {
      addError(ctx, "VAL-TASKS-SOURCE-010", TASKS_TRACE_PATH, `source-interface${item.pointer} 不得把 Markdown artifact 作为 semantic input：${value}。`);
    }
    if (VERIFICATION_TRACE_RE.test(value)) {
      addError(ctx, "VAL-TASKS-SOURCE-011", TASKS_TRACE_PATH, `source-interface${item.pointer} 不得声明 verification trace 或 proof-slices sidecar 输入：${value}。`);
    }
    if (TEST_FILE_RE.test(value) || EVIDENCE_PATH_RE.test(value) || APPLY_EVIDENCE_RE.test(value)) {
      addError(ctx, "VAL-TASKS-SOURCE-012", TASKS_TRACE_PATH, `source-interface${item.pointer} 不得声明测试文件、apply evidence 或 openspec-results 输入：${value}。`);
    }
  }
}

function validateForbiddenShape(ctx, trace) {
  for (const ref of collectObjectKeyRefs(trace)) {
    if (FORBIDDEN_TRACE_KEYS.has(ref.key)) {
      addError(ctx, "VAL-TASKS-FORBIDDEN-001", TASKS_TRACE_PATH, `tasks trace 不得包含旧测试矩阵、verification、evidence/deposit 或旧字段：${ref.pointer}。`);
    }
    if (!KEBAB_KEY_RE.test(ref.key)) {
      addError(ctx, "VAL-TASKS-KEY-001", TASKS_TRACE_PATH, `tasks trace key 必须使用 kebab-case：${ref.pointer}。`);
    }
  }

  for (const item of collectStringLeaves(trace)) {
    const value = strip(item.value);
    if (FORBIDDEN_TEXT_RE.test(value) || TEST_FILE_RE.test(value) || EVIDENCE_PATH_RE.test(value) || APPLY_EVIDENCE_RE.test(value) || COMMAND_RE.test(value)) {
      addError(ctx, "VAL-TASKS-FORBIDDEN-002", TASKS_TRACE_PATH, `tasks trace 不得包含测试矩阵、固定命令、具体测试文件或 evidence/apply path：${item.pointer}。`);
    }
  }
}

function validateProfileLeaks(ctx, trace, expected) {
  const refs =
    expected.schemaName === DEFAULT_SCHEMA
      ? collectIds(trace, ANY_GA_ID_RE)
      : collectIds(trace, ANY_SI_ID_RE);
  for (const ref of refs) {
    const label = expected.schemaName === DEFAULT_SCHEMA ? "GA-####" : "SI-###";
    addError(ctx, "VAL-TASKS-PROFILE-001", TASKS_TRACE_PATH, `${expected.schemaName} tasks trace 不得出现 ${label}：${ref.id}。`);
  }
}

function validateDeliveryPlane(ctx, trace, runtime) {
  const delivery = requireObject(ctx, "VAL-TASKS-DELIVERY-001", TASKS_TRACE_PATH, trace["delivery-plane"], "delivery-plane");
  const slices = requireArray(ctx, "VAL-TASKS-DELIVERY-002", TASKS_TRACE_PATH, delivery["acceptance-slices"], "delivery-plane.acceptance-slices");
  if (slices.length === 0) {
    addError(ctx, "VAL-TASKS-DELIVERY-003", TASKS_TRACE_PATH, "delivery-plane.acceptance-slices 不能为空。");
  }

  const acById = new Map();
  const acOrder = new Map();
  const taskById = new Map();
  const taskToAc = new Map();

  for (const [index, slice] of slices.entries()) {
    const label = `delivery-plane.acceptance-slices[${index}]`;
    const acId = requireId(ctx, "VAL-TASKS-AC-001", TASKS_TRACE_PATH, slice?.["ac-id"], `${label}.ac-id`, AC_ID_RE);
    if (!acId) continue;
    if (acById.has(acId)) {
      addError(ctx, "VAL-TASKS-AC-002", TASKS_TRACE_PATH, `AC 重复：${acId}。`);
    }
    acOrder.set(acId, index);

    const runtimeRows = requireRuntimeRows(ctx, slice?.["runtime-rows"], `${label}.runtime-rows`, runtime);
    const runtimeRowSet = new Set(runtimeRows);
    const contractRows = requireArray(ctx, "VAL-TASKS-AC-003", TASKS_TRACE_PATH, slice?.["resolved-runtime-contract"], `${label}.resolved-runtime-contract`);
    const contractRowIds = [];
    for (const [contractIndex, row] of contractRows.entries()) {
      const rowId = requireRuntimeRow(ctx, row?.row, `${label}.resolved-runtime-contract[${contractIndex}].row`, runtime);
      if (rowId) contractRowIds.push(rowId);
      requireString(ctx, "VAL-TASKS-AC-004", TASKS_TRACE_PATH, row?.["worker-facing-obligation"], `${label}.resolved-runtime-contract[${contractIndex}].worker-facing-obligation`);
      requireString(ctx, "VAL-TASKS-AC-005", TASKS_TRACE_PATH, row?.["observable-proof"], `${label}.resolved-runtime-contract[${contractIndex}].observable-proof`);
      requireString(ctx, "VAL-TASKS-AC-006", TASKS_TRACE_PATH, row?.["default-no-scope-boundary"], `${label}.resolved-runtime-contract[${contractIndex}].default-no-scope-boundary`);
    }
    expectSameSet(ctx, "VAL-TASKS-AC-007", TASKS_TRACE_PATH, contractRowIds, runtimeRows, `${acId} resolved-runtime-contract rows vs runtime-rows`);

    const tasks = requireArray(ctx, "VAL-TASKS-TASK-001", TASKS_TRACE_PATH, slice?.tasks, `${label}.tasks`);
    if (tasks.length === 0) {
      addError(ctx, "VAL-TASKS-TASK-002", TASKS_TRACE_PATH, `${acId} 必须包含至少一个 checkbox task。`);
    }

    for (const [taskIndex, task] of tasks.entries()) {
      const taskLabel = `${label}.tasks[${taskIndex}]`;
      const taskId = requireId(ctx, "VAL-TASKS-TASK-003", TASKS_TRACE_PATH, task?.["task-id"], `${taskLabel}.task-id`, TASK_ID_RE);
      if (!taskId) continue;
      if (!taskId.startsWith(`${acId}.`)) {
        addError(ctx, "VAL-TASKS-TASK-004", TASKS_TRACE_PATH, `${taskLabel}.task-id 必须属于同一 AC：${acId}。`);
      }
      if (taskById.has(taskId)) {
        addError(ctx, "VAL-TASKS-TASK-005", TASKS_TRACE_PATH, `task-id 重复：${taskId}。`);
      }
      const taskRuntimeRows = requireRuntimeRows(ctx, task?.["runtime-rows"], `${taskLabel}.runtime-rows`, runtime);
      for (const rowId of taskRuntimeRows) {
        if (!runtimeRowSet.has(rowId)) {
          addError(ctx, "VAL-TASKS-TASK-006", TASKS_TRACE_PATH, `${taskId} runtime row 不属于 ${acId} Runtime Rows：${rowId}。`);
        }
      }
      requireString(ctx, "VAL-TASKS-TASK-007", TASKS_TRACE_PATH, task?.title, `${taskLabel}.title`);
      requireString(ctx, "VAL-TASKS-TASK-008", TASKS_TRACE_PATH, task?.acceptance, `${taskLabel}.acceptance`);
      requireString(ctx, "VAL-TASKS-TASK-009", TASKS_TRACE_PATH, task?.preserve, `${taskLabel}.preserve`);
      requireString(ctx, "VAL-TASKS-TASK-010", TASKS_TRACE_PATH, task?.proof, `${taskLabel}.proof`);
      requireString(ctx, "VAL-TASKS-TASK-011", TASKS_TRACE_PATH, task?.["mock-default-path-policy"], `${taskLabel}.mock-default-path-policy`);
      taskById.set(taskId, {
        taskId,
        acId,
        runtimeRows: taskRuntimeRows,
      });
      taskToAc.set(taskId, acId);
    }

    acById.set(acId, {
      acId,
      runtimeRows,
      runtimeRowSet,
    });
  }

  return {
    acById,
    acOrder,
    taskById,
    taskToAc,
  };
}

function validateRuntimeAcceptanceIndex(ctx, trace, runtime, deliveryModel) {
  const indexRoot = requireObject(ctx, "VAL-TASKS-INDEX-001", TASKS_TRACE_PATH, trace["runtime-acceptance-index"], "runtime-acceptance-index");
  const rows = requireArray(ctx, "VAL-TASKS-INDEX-002", TASKS_TRACE_PATH, indexRoot["ac-runtime-ownership-index"], "runtime-acceptance-index.ac-runtime-ownership-index");
  const byAcId = new Map();

  for (const [index, row] of rows.entries()) {
    const label = `runtime-acceptance-index.ac-runtime-ownership-index[${index}]`;
    const acId = requireId(ctx, "VAL-TASKS-INDEX-003", TASKS_TRACE_PATH, row?.["ac-id"], `${label}.ac-id`, AC_ID_RE);
    if (!acId) continue;
    validateAcRef(ctx, acId, deliveryModel, `${label}.ac-id`, "VAL-TASKS-INDEX-004");
    if (byAcId.has(acId)) {
      addError(ctx, "VAL-TASKS-INDEX-005", TASKS_TRACE_PATH, `runtime-acceptance-index AC 重复：${acId}。`);
    }
    byAcId.set(acId, row);

    const detailRows = requireRuntimeRows(ctx, row?.["detail-matrix-rows"], `${label}.detail-matrix-rows`, runtime);
    const ac = deliveryModel.acById.get(acId);
    if (ac) {
      expectSameSet(ctx, "VAL-TASKS-INDEX-006", TASKS_TRACE_PATH, detailRows, ac.runtimeRows, `${acId} detail-matrix-rows vs AC Runtime Rows`);
    }
    for (const field of ["runtime-surface-rows", "operation-rows", "state-branch-rows", "async-realtime-rows", "provides-rows", "consumes-rows"]) {
      requireRuntimeRows(ctx, row?.[field] ?? [], `${label}.${field}`, runtime);
    }
    const dependsOn = requireAcIdArray(ctx, "VAL-TASKS-INDEX-007", row?.["depends-on-ac-ids"] ?? [], `${label}.depends-on-ac-ids`);
    validateDependencyOrder(ctx, acId, dependsOn, deliveryModel, `${label}.depends-on-ac-ids`, "VAL-TASKS-INDEX-008");
    validateEnum(ctx, "VAL-TASKS-INDEX-009", TASKS_TRACE_PATH, row?.["scope-role"], SCOPE_ROLES, `${label}.scope-role`);
    requireString(ctx, "VAL-TASKS-INDEX-010", TASKS_TRACE_PATH, row?.["runtime-proof-summary"], `${label}.runtime-proof-summary`);
  }

  expectSameSet(ctx, "VAL-TASKS-INDEX-011", TASKS_TRACE_PATH, [...byAcId.keys()], [...deliveryModel.acById.keys()], "runtime-acceptance-index AC set");

  return { byAcId };
}

function validateRuntimeAcceptanceProjection(ctx, trace, runtime, deliveryModel, indexModel) {
  const projectionRoot = requireObject(ctx, "VAL-TASKS-PROJECTION-001", TASKS_TRACE_PATH, trace["runtime-acceptance-projection"], "runtime-acceptance-projection");
  const rows = requireArray(ctx, "VAL-TASKS-PROJECTION-002", TASKS_TRACE_PATH, projectionRoot["runtime-row-ownership-projection"], "runtime-acceptance-projection.runtime-row-ownership-projection");
  const byRuntimeRowId = new Map();

  for (const [index, row] of rows.entries()) {
    const label = `runtime-acceptance-projection.runtime-row-ownership-projection[${index}]`;
    const rowId = requireRuntimeRow(ctx, row?.["runtime-row-id"], `${label}.runtime-row-id`, runtime);
    if (!rowId) continue;
    if (byRuntimeRowId.has(rowId)) {
      addError(ctx, "VAL-TASKS-PROJECTION-003", TASKS_TRACE_PATH, `runtime-row-ownership-projection runtime row 重复：${rowId}。`);
    }
    byRuntimeRowId.set(rowId, row);

    const runtimeRecord = runtime.rows.get(rowId);
    expectEqual(ctx, "VAL-TASKS-PROJECTION-004", TASKS_TRACE_PATH, row?.["row-type"], runtimeRecord?.rowType, `${label}.row-type`);
    expectEqual(ctx, "VAL-TASKS-PROJECTION-005", TASKS_TRACE_PATH, row?.["scope-role"], runtimeRecord?.scopeRole, `${label}.scope-role`);

    const status = validateEnum(ctx, "VAL-TASKS-PROJECTION-006", TASKS_TRACE_PATH, row?.["projection-status"], PROJECTION_STATUSES, `${label}.projection-status`);
    const proofOnlyHandling = validateEnum(ctx, "VAL-TASKS-PROJECTION-007", TASKS_TRACE_PATH, row?.["proof-only-handling"], PROOF_ONLY_HANDLINGS, `${label}.proof-only-handling`);
    if (runtimeRecord?.scopeRole === "proof-only" && proofOnlyHandling === "not-proof-only") {
      addError(ctx, "VAL-TASKS-PROJECTION-008", TASKS_TRACE_PATH, `${rowId} 是 proof-only runtime row，proof-only-handling 不能是 not-proof-only。`);
    }
    if (runtimeRecord?.scopeRole !== "proof-only" && proofOnlyHandling && proofOnlyHandling !== "not-proof-only") {
      addError(ctx, "VAL-TASKS-PROJECTION-009", TASKS_TRACE_PATH, `${rowId} 不是 proof-only runtime row，proof-only-handling 必须是 not-proof-only。`);
    }

    const ownerAcId = strip(row?.["owner-ac-id"]);
    if (status === "projected") {
      validateAcRef(ctx, ownerAcId, deliveryModel, `${label}.owner-ac-id`, "VAL-TASKS-PROJECTION-010");
      requireString(ctx, "VAL-TASKS-PROJECTION-011", TASKS_TRACE_PATH, row?.["runtime-proof-summary"], `${label}.runtime-proof-summary`);
    }

    const taskIds = requireTaskIdArray(ctx, "VAL-TASKS-PROJECTION-012", row?.["implementation-task-ids"] ?? [], `${label}.implementation-task-ids`, deliveryModel);
    if (status === "projected" && taskIds.length === 0) {
      addError(ctx, "VAL-TASKS-PROJECTION-013", TASKS_TRACE_PATH, `${label}.implementation-task-ids projected row 必须引用至少一个 checkbox task。`);
    }
    for (const taskId of taskIds) {
      const task = deliveryModel.taskById.get(taskId);
      if (task && !task.runtimeRows.includes(rowId)) {
        addError(ctx, "VAL-TASKS-PROJECTION-014", TASKS_TRACE_PATH, `${label}.implementation-task-ids 引用的 ${taskId} 未声明 runtime row ${rowId}。`);
      }
    }

    requireRuntimeRows(ctx, row?.["provides-rows"] ?? [], `${label}.provides-rows`, runtime);
    requireRuntimeRows(ctx, row?.["consumes-rows"] ?? [], `${label}.consumes-rows`, runtime);
    const dependsOn = requireAcIdArray(ctx, "VAL-TASKS-PROJECTION-015", row?.["depends-on-ac-ids"] ?? [], `${label}.depends-on-ac-ids`);
    if (ownerAcId) {
      validateDependencyOrder(ctx, ownerAcId, dependsOn, deliveryModel, `${label}.depends-on-ac-ids`, "VAL-TASKS-PROJECTION-016");
    }
    if ((status === "not-applicable" || status === "blocked") && isEmptyReason(row?.["blocker-not-applicable-reason"])) {
      addError(ctx, "VAL-TASKS-PROJECTION-017", TASKS_TRACE_PATH, `${label}.blocker-not-applicable-reason 必须说明 blocker/not-applicable reason。`);
    }
    if (proofOnlyHandling === "proof-projection-only") {
      const ownerIndex = indexModel.byAcId.get(ownerAcId);
      if (strip(ownerIndex?.["scope-role"]) === "proof-only") {
        addError(ctx, "VAL-TASKS-PROJECTION-018", TASKS_TRACE_PATH, `${rowId} proof-projection-only 不得投影到 proof-only AC：${ownerAcId}。`);
      }
    }
  }

  for (const [rowId, runtimeRecord] of runtime.rows.entries()) {
    if (!SCOPE_ROLES.has(runtimeRecord.scopeRole)) continue;
    const projection = byRuntimeRowId.get(rowId);
    if (!projection) {
      addError(ctx, "VAL-TASKS-PROJECTION-020", TASKS_TRACE_PATH, `${rowId} 缺少 runtime-row-ownership-projection row。`);
      continue;
    }
    const status = strip(projection["projection-status"]);
    if (status === "projected") continue;
    if (isEmptyReason(projection["blocker-not-applicable-reason"])) {
      addError(ctx, "VAL-TASKS-PROJECTION-021", TASKS_TRACE_PATH, `${rowId} 未 projected 时必须提供 explicit blocker/not-applicable reason。`);
    }
  }

  validateProviderConsumerProjection(ctx, projectionRoot, runtime, deliveryModel);
}

function validateProviderConsumerProjection(ctx, projectionRoot, runtime, deliveryModel) {
  const rows = requireArray(ctx, "VAL-TASKS-PROVIDER-001", TASKS_TRACE_PATH, projectionRoot["provider-consumer-projection"] ?? [], "runtime-acceptance-projection.provider-consumer-projection");
  for (const [index, row] of rows.entries()) {
    const label = `runtime-acceptance-projection.provider-consumer-projection[${index}]`;
    const providerAcId = requireId(ctx, "VAL-TASKS-PROVIDER-002", TASKS_TRACE_PATH, row?.["provider-ac-id"], `${label}.provider-ac-id`, AC_ID_RE);
    const consumerAcId = requireId(ctx, "VAL-TASKS-PROVIDER-003", TASKS_TRACE_PATH, row?.["consumer-ac-id"], `${label}.consumer-ac-id`, AC_ID_RE);
    validateAcRef(ctx, providerAcId, deliveryModel, `${label}.provider-ac-id`, "VAL-TASKS-PROVIDER-004");
    validateAcRef(ctx, consumerAcId, deliveryModel, `${label}.consumer-ac-id`, "VAL-TASKS-PROVIDER-005");
    requireRuntimeRows(ctx, row?.["provider-runtime-row-ids"], `${label}.provider-runtime-row-ids`, runtime);
    requireRuntimeRows(ctx, row?.["consumer-runtime-row-ids"], `${label}.consumer-runtime-row-ids`, runtime);
    requireString(ctx, "VAL-TASKS-PROVIDER-006", TASKS_TRACE_PATH, row?.["dependency-reason"], `${label}.dependency-reason`);
    requireString(ctx, "VAL-TASKS-PROVIDER-007", TASKS_TRACE_PATH, row?.["start-gate-effect"], `${label}.start-gate-effect`);
    if (providerAcId && consumerAcId) {
      validateDependencyOrder(ctx, consumerAcId, [providerAcId], deliveryModel, `${label}.provider-ac-id`, "VAL-TASKS-PROVIDER-008");
    }
  }
}

function validateAcceptanceDrivenCoverage(ctx, trace, expected, specs, design, runtime, deliveryModel) {
  const coverage = requireObject(ctx, "VAL-TASKS-COVERAGE-001", TASKS_TRACE_PATH, trace["acceptance-driven-coverage"], "acceptance-driven-coverage");
  if (expected.schemaName === OBLIGATION_SCHEMA) {
    validateMainCoverageRows(ctx, {
      rows: requireArray(ctx, "VAL-TASKS-COVERAGE-002", TASKS_TRACE_PATH, coverage["obligation-atom-coverage"], "acceptance-driven-coverage.obligation-atom-coverage"),
      expected,
      idField: "global-atom-id",
      projectionField: "artifact-projection",
      rowLabel: "obligation-atom-coverage",
      runtime,
      deliveryModel,
    });
    validateRequirementCoverageRows(ctx, coverage["requirement-scenario-coverage"], expected, specs, runtime, deliveryModel);
    validateDesignCoverageRows(ctx, coverage["design-obligation-coverage"], expected, design, runtime, deliveryModel, "design-obligation-coverage");
    if (coverage["scope-item-coverage"] !== undefined || coverage["design-decision-coverage"] !== undefined) {
      addError(ctx, "VAL-TASKS-COVERAGE-003", TASKS_TRACE_PATH, "obligation schema tasks coverage 不得包含 default coverage 表。");
    }
    return;
  }

  validateMainCoverageRows(ctx, {
    rows: requireArray(ctx, "VAL-TASKS-COVERAGE-010", TASKS_TRACE_PATH, coverage["scope-item-coverage"], "acceptance-driven-coverage.scope-item-coverage"),
    expected,
    idField: "scope-item-id",
    projectionField: "artifact-handling",
    rowLabel: "scope-item-coverage",
    runtime,
    deliveryModel,
  });
  validateRequirementCoverageRows(ctx, coverage["requirement-scenario-coverage"], expected, specs, runtime, deliveryModel);
  validateDesignCoverageRows(ctx, coverage["design-decision-coverage"], expected, design, runtime, deliveryModel, "design-decision-coverage");
  if (coverage["obligation-atom-coverage"] !== undefined || coverage["design-obligation-coverage"] !== undefined) {
    addError(ctx, "VAL-TASKS-COVERAGE-011", TASKS_TRACE_PATH, "default schema tasks coverage 不得包含 obligation coverage 表。");
  }
}

function validateMainCoverageRows(ctx, options) {
  const actualIds = [];
  for (const [index, row] of options.rows.entries()) {
    const label = `acceptance-driven-coverage.${options.rowLabel}[${index}]`;
    const id = requireId(ctx, "VAL-TASKS-COVERAGE-ID-001", TASKS_TRACE_PATH, row?.[options.idField], `${label}.${options.idField}`, options.expected.idRegex);
    if (!id) continue;
    actualIds.push(id);
    const proposalRow = options.expected.rowsById.get(id);
    if (!proposalRow) {
      addError(ctx, "VAL-TASKS-COVERAGE-ID-002", TASKS_TRACE_PATH, `${label}.${options.idField} 不属于 proposal source/scope set：${id}。`);
    } else {
      expectEqual(ctx, "VAL-TASKS-COVERAGE-ID-003", TASKS_TRACE_PATH, row?.[options.projectionField], proposalRow?.[options.projectionField], `${label}.${options.projectionField}`);
    }
    validateCoverageProjectionFields(ctx, row, label, options.runtime, options.deliveryModel);
  }
  expectSameSet(ctx, "VAL-TASKS-COVERAGE-ID-004", TASKS_TRACE_PATH, actualIds, options.expected.ids, `acceptance-driven-coverage.${options.rowLabel} source/scope IDs`);
}

function validateRequirementCoverageRows(ctx, value, expected, specs, runtime, deliveryModel) {
  const rows = requireArray(ctx, "VAL-TASKS-COVERAGE-REQ-001", TASKS_TRACE_PATH, value, "acceptance-driven-coverage.requirement-scenario-coverage");
  for (const [index, row] of rows.entries()) {
    const label = `acceptance-driven-coverage.requirement-scenario-coverage[${index}]`;
    const tracePath = requireString(ctx, "VAL-TASKS-COVERAGE-REQ-002", TASKS_TRACE_PATH, row?.["trace-path"], `${label}.trace-path`);
    const requirement = requireString(ctx, "VAL-TASKS-COVERAGE-REQ-003", TASKS_TRACE_PATH, row?.requirement, `${label}.requirement`);
    const scenario = requireString(ctx, "VAL-TASKS-COVERAGE-REQ-004", TASKS_TRACE_PATH, row?.scenario, `${label}.scenario`);
    if (tracePath && requirement && scenario && !specs.scenariosByKey.has(specScenarioKey(tracePath, requirement, scenario))) {
      addError(ctx, "VAL-TASKS-COVERAGE-REQ-005", TASKS_TRACE_PATH, `${label} 引用未知 specs scenario：${tracePath} / ${requirement} / ${scenario}。`);
    }
    validateSourceItemIds(ctx, row?.["source-item-ids"], expected, `${label}.source-item-ids`);
    validateCoverageProjectionFields(ctx, row, label, runtime, deliveryModel);
  }
  if (specs.scenariosByKey.size === 0 && rows.length > 0) {
    addError(ctx, "VAL-TASKS-COVERAGE-REQ-006", TASKS_TRACE_PATH, "no-delta specs 不得生成 requirement-scenario-coverage rows。");
  }
}

function validateDesignCoverageRows(ctx, value, expected, design, runtime, deliveryModel, labelName) {
  const rows = requireArray(ctx, "VAL-TASKS-COVERAGE-DESIGN-001", TASKS_TRACE_PATH, value, `acceptance-driven-coverage.${labelName}`);
  for (const [index, row] of rows.entries()) {
    const label = `acceptance-driven-coverage.${labelName}[${index}]`;
    validateSourceItemIds(ctx, row?.["source-item-ids"], expected, `${label}.source-item-ids`);
    const decisionIds = requireIdArray(ctx, "VAL-TASKS-COVERAGE-DESIGN-002", TASKS_TRACE_PATH, row?.["decision-ids"] ?? [], `${label}.decision-ids`, DECISION_ID_RE);
    for (const decisionId of decisionIds) {
      if (!design.decisionIds.has(decisionId)) {
        addError(ctx, "VAL-TASKS-COVERAGE-DESIGN-003", TASKS_TRACE_PATH, `${label}.decision-ids 引用未知 design decision：${decisionId}。`);
      }
    }
    if (labelName === "design-obligation-coverage") {
      const obligationId = requireString(ctx, "VAL-TASKS-COVERAGE-DESIGN-004", TASKS_TRACE_PATH, row?.["design-obligation-id"], `${label}.design-obligation-id`);
      if (obligationId && !design.matrixRowIds.has(obligationId) && !design.decisionIds.has(obligationId)) {
        addError(ctx, "VAL-TASKS-COVERAGE-DESIGN-005", TASKS_TRACE_PATH, `${label}.design-obligation-id 不属于 design-obligation-matrix 或 design-decision-index：${obligationId}。`);
      }
    }
    validateCoverageProjectionFields(ctx, row, label, runtime, deliveryModel);
  }
}

function validateCoverageProjectionFields(ctx, row, label, runtime, deliveryModel) {
  const runtimeRows = requireRuntimeRows(ctx, row?.["runtime-row-ids"], `${label}.runtime-row-ids`, runtime);
  const acIds = requireAcIdArray(ctx, "VAL-TASKS-COVERAGE-REF-001", row?.["acceptance-slice-ids"] ?? [], `${label}.acceptance-slice-ids`);
  for (const acId of acIds) {
    validateAcRef(ctx, acId, deliveryModel, `${label}.acceptance-slice-ids`, "VAL-TASKS-COVERAGE-REF-002");
  }
  const taskIds = requireTaskIdArray(ctx, "VAL-TASKS-COVERAGE-REF-003", row?.["implementation-task-ids"] ?? [], `${label}.implementation-task-ids`, deliveryModel);
  const status = validateEnum(ctx, "VAL-TASKS-COVERAGE-REF-004", TASKS_TRACE_PATH, row?.["coverage-status"], COVERAGE_STATUSES, `${label}.coverage-status`);
  if (status === "projected-to-production-task" || status === "projected-to-existing-production-task") {
    if (runtimeRows.length === 0 || acIds.length === 0 || taskIds.length === 0) {
      addError(ctx, "VAL-TASKS-COVERAGE-REF-005", TASKS_TRACE_PATH, `${label} projected coverage 必须引用 runtime rows、AC 和 implementation tasks。`);
    }
    requireString(ctx, "VAL-TASKS-COVERAGE-REF-006", TASKS_TRACE_PATH, row?.["runtime-proof-summary"], `${label}.runtime-proof-summary`);
  }
  if ((status === "not-applicable" || status === "blocked") && isEmptyReason(row?.["blocker-not-applicable-reason"])) {
    addError(ctx, "VAL-TASKS-COVERAGE-REF-007", TASKS_TRACE_PATH, `${label}.blocker-not-applicable-reason 必须说明 blocker/not-applicable reason。`);
  }
}

function validateSourceItemIds(ctx, value, expected, label) {
  const ids = requireIdArray(ctx, "VAL-TASKS-COVERAGE-SOURCE-001", TASKS_TRACE_PATH, value, label, expected.idRegex);
  for (const id of ids) {
    if (!expected.rowsById.has(id)) {
      addError(ctx, "VAL-TASKS-COVERAGE-SOURCE-002", TASKS_TRACE_PATH, `${label} 引用未知 proposal source/scope ID：${id}。`);
    }
  }
  if (ids.length === 0) {
    addError(ctx, "VAL-TASKS-COVERAGE-SOURCE-003", TASKS_TRACE_PATH, `${label} 必须至少引用一个 proposal source/scope ID。`);
  }
}

function validateArtifactForbiddenText(ctx) {
  const artifactPath = path.join(ctx.changeDir, TASKS_ARTIFACT_PATH);
  if (!fs.existsSync(artifactPath)) return;
  const markdown = fs.readFileSync(artifactPath, "utf8");
  if (FORBIDDEN_TEXT_RE.test(markdown) || TEST_FILE_RE.test(markdown) || EVIDENCE_PATH_RE.test(markdown) || APPLY_EVIDENCE_RE.test(markdown) || COMMAND_RE.test(markdown)) {
    addError(ctx, "VAL-TASKS-FORBIDDEN-003", TASKS_ARTIFACT_PATH, "tasks.md 不得包含测试矩阵、固定命令、具体测试文件或 evidence/apply path。");
  }
}

function validateKebabCaseKeys(ctx, trace) {
  for (const ref of collectObjectKeyRefs(trace)) {
    if (!KEBAB_KEY_RE.test(ref.key)) {
      addError(ctx, "VAL-TASKS-KEY-001", TASKS_TRACE_PATH, `tasks trace key 必须使用 kebab-case：${ref.pointer}。`);
    }
  }
}

function requireRuntimeRows(ctx, value, label, runtime) {
  const rowIds = requireIdArray(ctx, "VAL-TASKS-RUNTIME-ROW-001", TASKS_TRACE_PATH, value, label, RUNTIME_ROW_ID_RE);
  for (const rowId of rowIds) {
    if (!runtime.rows.has(rowId)) {
      addError(ctx, "VAL-TASKS-RUNTIME-ROW-002", TASKS_TRACE_PATH, `${label} 引用未定义 runtime row：${rowId}。`);
    }
  }
  return rowIds;
}

function requireRuntimeRow(ctx, value, label, runtime) {
  const rowId = requireId(ctx, "VAL-TASKS-RUNTIME-ROW-001", TASKS_TRACE_PATH, value, label, RUNTIME_ROW_ID_RE);
  if (rowId && !runtime.rows.has(rowId)) {
    addError(ctx, "VAL-TASKS-RUNTIME-ROW-002", TASKS_TRACE_PATH, `${label} 引用未定义 runtime row：${rowId}。`);
  }
  return rowId;
}

function requireAcIdArray(ctx, ruleId, value, label) {
  return requireIdArray(ctx, ruleId, TASKS_TRACE_PATH, value, label, AC_ID_RE);
}

function requireTaskIdArray(ctx, ruleId, value, label, deliveryModel) {
  const taskIds = requireIdArray(ctx, ruleId, TASKS_TRACE_PATH, value, label, TASK_ID_RE);
  for (const taskId of taskIds) {
    if (!deliveryModel.taskById.has(taskId)) {
      addError(ctx, "VAL-TASKS-TASK-REF-001", TASKS_TRACE_PATH, `${label} 引用未知 checkbox task：${taskId}。`);
    }
  }
  return taskIds;
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

function specScenarioKey(tracePath, requirement, scenario) {
  return `${strip(tracePath)}::${strip(requirement)}::${strip(scenario)}`;
}

function isEmptyReason(value) {
  const text = strip(value);
  return !text || /^(?:无|none|n\/a|na)$/iu.test(text);
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
