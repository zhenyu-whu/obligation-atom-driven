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

const DESIGN_TRACE_PATH = "trace/design.trace.json";
const SPECS_TRACE_DIR = "trace/specs";
const NO_DELTA_TRACE_PATH = "trace/specs/no-spec-delta/README.trace.json";
const RUNTIME_TRACE_PATH = "trace/runtime-acceptance.trace.json";
const RUNTIME_ARTIFACT_PATH = "runtime-acceptance.md";

const ANY_GA_ID_RE = /\bGA-\d{4}\b/u;
const ANY_SI_ID_RE = /\bSI-\d{3}\b/u;
const IMPLEMENTATION_DESIGN_ID_RE = /^IDR-\d{3}$/u;
const RUNTIME_FACT_ID_RE = /^(RS|OP|ST|CH)-\d{3}$/u;
const MARKDOWN_INPUT_RE = /(?:^|\/)(?:proposal|design)\.md$|(?:^|\/)specs\/.+\.md$/iu;
const OWNER_LIST_RE = /[,，;+、]|(?:^|\s)(?:and|和|与)(?:\s|$)/iu;

const FACT_TYPES = new Set(["surface", "operation", "state", "chain"]);
const SCOPE_ROLES = new Set(["required behavior", "preserve boundary"]);
const RUNTIME_GATE_FIELDS = [
  "blockers",
  "uncovered-spec-scenarios",
  "uncovered-runtime-design-decisions",
  "orphan-runtime-facts",
  "invalid-source-refs",
  "delivery-projection-mismatch",
];

const LEGACY_RUNTIME_FIELDS = [
  "canonical-row-index",
  "upstream-runtime-obligation-inventory",
  "runtime-not-applicable-inventory",
  "runtime-upstream-coverage-map",
  "runtime-coverage-source-map",
  "coverage-closure-checklist",
  "design-decision-index",
  "design-obligation-matrix",
  "ui-control-contracts",
  "proof-expectation-handoff",
];

const LEGACY_RUNTIME_FACT_FIELDS = [
  "fact-id",
  "source-anchor",
  "source-type",
  "source-handling",
  "fact-layer",
  "fact-kind",
  "fact",
  "runtime-row-id",
  "runtime-row-ids",
  "not-applicable-reason",
];

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
  if (!runtimeTrace) return;

  const expected = buildExpectedRuntimeModel(ctx, runtimeTrace);
  if (!expected) return;

  const specs = buildSpecsTraceModel(ctx, expected.schemaName);
  const designTrace = readJson(ctx, path.join(ctx.changeDir, DESIGN_TRACE_PATH));

  validateCommonRuntimeTrace(ctx, runtimeTrace, expected, specs);
  validateLegacyRuntimeFieldsAbsent(ctx, runtimeTrace);
  validateRuntimeManifest(ctx);
  validateProfileLeaks(ctx, runtimeTrace, expected);
  validateForbiddenTraceShape(ctx, runtimeTrace);

  if (!designTrace) return;

  const design = buildDesignModel(ctx, designTrace);
  const factModel = validateRuntimeFactRegister(ctx, runtimeTrace, expected, specs, design);
  validateRuntimeDeliveryProjection(ctx, runtimeTrace, factModel);
  validateRuntimeCoverage(ctx, specs, design, factModel);
  validateRuntimeGate(ctx, runtimeTrace);
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

function buildExpectedRuntimeModel(ctx, runtimeTrace) {
  const schemaName = strip(runtimeTrace["schema-name"]);
  if (schemaName === OBLIGATION_SCHEMA) {
    return {
      schemaName,
      oppositeIdRegex: ANY_SI_ID_RE,
      oppositeIdLabel: "SI-###",
      forbiddenIdentityKey: "scope-item-id",
      forbiddenLegacyIdentityKey: "global-atom-id",
    };
  }

  if (schemaName === DEFAULT_SCHEMA) {
    return {
      schemaName,
      oppositeIdRegex: ANY_GA_ID_RE,
      oppositeIdLabel: "GA-####",
      forbiddenIdentityKey: "global-atom-id",
    };
  }

  addError(ctx, "VAL-RUNTIME-TRACE-013", RUNTIME_TRACE_PATH, `不支持的 runtime schema-name：${schemaName || "(empty)"}`);
  return null;
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
      scenarioIds: new Set(),
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
      scenarioIds: new Set(),
    };
  }

  const scenarios = [];
  for (const tracePath of tracePaths) {
    const trace = readJson(ctx, path.join(ctx.changeDir, tracePath));
    if (!trace) continue;
    expectEqual(ctx, "VAL-RUNTIME-SPECS-010", tracePath, trace["artifact-id"], "specs", "artifact-id");
    expectEqual(ctx, "VAL-RUNTIME-SPECS-011", tracePath, trace["schema-name"], schemaName, "schema-name");
    expectEqual(ctx, "VAL-RUNTIME-SPECS-012", tracePath, trace["specs-completion-mode"], "delta", "specs-completion-mode");
    const rows = requireArray(ctx, "VAL-RUNTIME-SPECS-013", tracePath, trace["spec-delta-register"], "spec-delta-register");
    for (const [deltaIndex, row] of rows.entries()) {
      const deltaOp = strip(row?.["delta-op"]);
      if (deltaOp !== "added" && deltaOp !== "modified") continue;
      const requirement = requireString(ctx, "VAL-RUNTIME-SPECS-014", tracePath, row?.requirement, `spec-delta-register[${deltaIndex}].requirement`);
      for (const [scenarioIndex, scenario] of requireArray(ctx, "VAL-RUNTIME-SPECS-015", tracePath, row?.scenarios, `spec-delta-register[${deltaIndex}].scenarios`).entries()) {
        const scenarioName = requireString(ctx, "VAL-RUNTIME-SPECS-016", tracePath, scenario?.name, `spec-delta-register[${deltaIndex}].scenarios[${scenarioIndex}].name`);
        scenarios.push({
          tracePath,
          tracePointer: `#/spec-delta-register/${deltaIndex}/scenarios/${scenarioIndex}`,
          requirement,
          scenario: scenarioName,
        });
      }
    }
  }

  return {
    mode: "delta",
    tracePaths,
    scenarios,
    scenarioIds: new Set(scenarios.map((scenario) => `${scenario.tracePath}${scenario.tracePointer}`)),
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
  const delivery = requireObject(ctx, "VAL-RUNTIME-TRACE-008", RUNTIME_TRACE_PATH, trace["delivery-plane"], "delivery-plane");
  requireArray(ctx, "VAL-RUNTIME-TRACE-009", RUNTIME_TRACE_PATH, trace["runtime-fact-register"], "runtime-fact-register");
  requireObject(ctx, "VAL-RUNTIME-TRACE-010", RUNTIME_TRACE_PATH, trace["runtime-gate"], "runtime-gate");
  requireObject(ctx, "VAL-RUNTIME-TRACE-011", RUNTIME_TRACE_PATH, delivery["runtime-acceptance-intent"], "delivery-plane.runtime-acceptance-intent");
  requireObject(ctx, "VAL-RUNTIME-TRACE-012", RUNTIME_TRACE_PATH, delivery["fact-sections"], "delivery-plane.fact-sections");
  if (Object.prototype.hasOwnProperty.call(delivery, "canonical-rows")) {
    addError(ctx, "VAL-RUNTIME-LEGACY-002", RUNTIME_TRACE_PATH, "delivery-plane 不得包含旧字段：canonical-rows。");
  }

  if (Object.prototype.hasOwnProperty.call(sourceInterface, "proposal-trace")) {
    addError(ctx, "VAL-RUNTIME-SOURCE-INTERFACE-001", RUNTIME_TRACE_PATH, "source-interface.proposal-trace 不再是 runtime semantic input。");
  }
  expectEqual(ctx, "VAL-RUNTIME-SOURCE-INTERFACE-002", RUNTIME_TRACE_PATH, sourceInterface["design-trace"], DESIGN_TRACE_PATH, "source-interface.design-trace");
  expectEqual(ctx, "VAL-RUNTIME-SOURCE-INTERFACE-003", RUNTIME_TRACE_PATH, sourceInterface["specs-completion-mode"], specs.mode, "source-interface.specs-completion-mode");
  const specTraces = requireArray(ctx, "VAL-RUNTIME-SOURCE-INTERFACE-004", RUNTIME_TRACE_PATH, sourceInterface["spec-traces"], "source-interface.spec-traces")
    .map(strip)
    .filter(Boolean);
  expectSameSet(ctx, "VAL-RUNTIME-SOURCE-INTERFACE-005", RUNTIME_TRACE_PATH, specTraces, specs.tracePaths, "source-interface.spec-traces");
  validateSourceInterfaceStringLeaves(ctx, sourceInterface, specs.tracePaths);
}

function validateSourceInterfaceStringLeaves(ctx, sourceInterface, specTracePaths) {
  const allowedTracePaths = new Set([DESIGN_TRACE_PATH, ...specTracePaths]);
  for (const item of collectStringLeaves(sourceInterface)) {
    const value = item.value.replace(/\\/gu, "/");
    if (MARKDOWN_INPUT_RE.test(value)) {
      addError(ctx, "VAL-RUNTIME-SOURCE-INTERFACE-010", RUNTIME_TRACE_PATH, `source-interface${item.pointer} 不得把 proposal/spec/design Markdown 作为 semantic input。`);
    }
    if (/^trace\/.+\.json$/u.test(value) && !allowedTracePaths.has(value)) {
      addError(ctx, "VAL-RUNTIME-SOURCE-INTERFACE-011", RUNTIME_TRACE_PATH, `source-interface${item.pointer} 只能列 specs/design JSON trace 输入，不能引用 ${value}。`);
    }
  }
}

function validateRuntimeManifest(ctx) {
  const manifestRelPath = "trace/manifest.json";
  const manifest = readJson(ctx, path.join(ctx.changeDir, manifestRelPath));
  if (!manifest) return;

  expectEqual(ctx, "VAL-RUNTIME-MANIFEST-001", manifestRelPath, manifest["trace-schema"], TRACE_SCHEMA, "trace-schema");
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

function validateProfileLeaks(ctx, trace, expected) {
  const keyRefs = collectObjectKeyRefs(trace);
  for (const ref of keyRefs) {
    if (ref.key === expected.forbiddenIdentityKey || ref.key === expected.forbiddenLegacyIdentityKey) {
      addError(ctx, "VAL-RUNTIME-PROFILE-001", RUNTIME_TRACE_PATH, `${expected.schemaName} runtime trace 不得包含 ${ref.key}。`);
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

function validateLegacyRuntimeFieldsAbsent(ctx, trace) {
  for (const field of LEGACY_RUNTIME_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(trace, field)) {
      addError(ctx, "VAL-RUNTIME-LEGACY-001", RUNTIME_TRACE_PATH, `runtime trace 不得包含旧字段：${field}。`);
    }
  }
}

function buildDesignModel(ctx, designTrace) {
  const rows = requireArray(ctx, "VAL-RUNTIME-DESIGN-001", DESIGN_TRACE_PATH, designTrace["implementation-design-register"], "implementation-design-register");
  const designIds = new Set();
  const runtimeDesignIds = new Set();
  for (const [index, row] of rows.entries()) {
    const id = requireId(ctx, "VAL-RUNTIME-DESIGN-002", DESIGN_TRACE_PATH, row?.["implementation-design-id"], `implementation-design-register[${index}].implementation-design-id`, IMPLEMENTATION_DESIGN_ID_RE);
    if (!id) continue;
    designIds.add(id);
    if (isRuntimeAffectingDesignDecision(row)) {
      runtimeDesignIds.add(id);
    }
  }
  return {
    designIds,
    runtimeDesignIds,
  };
}

function isRuntimeAffectingDesignDecision(row) {
  const layer = strip(row?.layer);
  const text = [
    row?.title,
    row?.decision,
    row?.["implementation-boundary"],
    row?.["implementation-contract"],
    row?.["guard-failure-handling"],
    row?.["verification-handoff"],
    row?.["no-scope-expansion"],
  ].map(strip).join("\n");

  if (/不产生(?:独立)?可观察运行态事实|无可观察运行态事实|只(?:约束|涉及)(?:验证|rollout|发布|回滚|实现组织)/u.test(text)) {
    return false;
  }
  if (layer === "verification-rollout" && !/(API|UI|DB|data|状态|分支|异步|worker|queue|SSE|权限|auth|运行|可观察|surface|operation|state|chain)/iu.test(text)) {
    return false;
  }
  return true;
}

function validateRuntimeFactRegister(ctx, trace, expected, specs, design) {
  const rows = requireArray(
    ctx,
    "VAL-RUNTIME-FACT-001",
    RUNTIME_TRACE_PATH,
    trace["runtime-fact-register"],
    "runtime-fact-register",
  );

  const factIds = new Set();
  const coveredSpecScenarios = new Set();
  const coveredDesignDecisions = new Set();
  const factTypesById = new Map();
  const scopeRolesById = new Map();

  for (const [index, row] of rows.entries()) {
    const label = `runtime-fact-register[${index}]`;
    validateLegacyRuntimeFactFieldsAbsent(ctx, row, label);

    const factId = requireId(ctx, "VAL-RUNTIME-FACT-002", RUNTIME_TRACE_PATH, row?.["runtime-fact-id"], `${label}.runtime-fact-id`, RUNTIME_FACT_ID_RE);
    if (factId) {
      if (factIds.has(factId)) {
        addError(ctx, "VAL-RUNTIME-FACT-003", RUNTIME_TRACE_PATH, `${label}.runtime-fact-id 重复：${factId}。`);
      }
      factIds.add(factId);
    }

    const factType = requireString(ctx, "VAL-RUNTIME-FACT-004", RUNTIME_TRACE_PATH, row?.["fact-type"], `${label}.fact-type`);
    if (factType && !FACT_TYPES.has(factType)) {
      addError(ctx, "VAL-RUNTIME-FACT-005", RUNTIME_TRACE_PATH, `${label}.fact-type 非法：${factType}。`);
    }
    if (factId && factType && runtimeFactTypeForId(factId) !== factType) {
      addError(ctx, "VAL-RUNTIME-FACT-006", RUNTIME_TRACE_PATH, `${label}.runtime-fact-id 前缀与 fact-type 不一致：${factId} / ${factType}。`);
    }
    if (factId) factTypesById.set(factId, factType);

    const scopeRole = requireString(ctx, "VAL-RUNTIME-FACT-007", RUNTIME_TRACE_PATH, row?.["scope-role"], `${label}.scope-role`);
    if (scopeRole && !SCOPE_ROLES.has(scopeRole)) {
      addError(ctx, "VAL-RUNTIME-FACT-008", RUNTIME_TRACE_PATH, `${label}.scope-role 非法：${scopeRole}。`);
    }
    if (factId) scopeRolesById.set(factId, scopeRole);

    const owner = requireString(ctx, "VAL-RUNTIME-FACT-009", RUNTIME_TRACE_PATH, row?.["owner-candidate"], `${label}.owner-candidate`);
    if (owner && OWNER_LIST_RE.test(owner)) {
      addError(ctx, "VAL-RUNTIME-FACT-010", RUNTIME_TRACE_PATH, `${label}.owner-candidate 必须是单一 advisory owner。`);
    }
    requireString(ctx, "VAL-RUNTIME-FACT-011", RUNTIME_TRACE_PATH, row?.["runtime-fact"], `${label}.runtime-fact`);
    requireString(ctx, "VAL-RUNTIME-FACT-012", RUNTIME_TRACE_PATH, row?.["observable-fact"], `${label}.observable-fact`);
    requireString(ctx, "VAL-RUNTIME-FACT-013", RUNTIME_TRACE_PATH, row?.["default-path-policy"], `${label}.default-path-policy`);
    requireString(ctx, "VAL-RUNTIME-FACT-014", RUNTIME_TRACE_PATH, row?.["external-boundary"], `${label}.external-boundary`);
    requireString(ctx, "VAL-RUNTIME-FACT-015", RUNTIME_TRACE_PATH, row?.["no-scope-expansion-check"], `${label}.no-scope-expansion-check`);

    const sourceBasis = requireObject(ctx, "VAL-RUNTIME-FACT-016", RUNTIME_TRACE_PATH, row?.["source-basis"], `${label}.source-basis`);
    validateRuntimeSourceBasisKeys(ctx, sourceBasis, label);
    const specScenarios = requireIdLikeArray(ctx, "VAL-RUNTIME-FACT-017", sourceBasis["spec-scenarios"], `${label}.source-basis.spec-scenarios`);
    const designDecisions = requireIdArray(ctx, "VAL-RUNTIME-FACT-018", RUNTIME_TRACE_PATH, sourceBasis["design-decisions"], `${label}.source-basis.design-decisions`, IMPLEMENTATION_DESIGN_ID_RE);

    for (const scenarioId of specScenarios) {
      if (!specs.scenarioIds.has(scenarioId)) {
        addError(ctx, "VAL-RUNTIME-FACT-020", RUNTIME_TRACE_PATH, `${label}.source-basis.spec-scenarios 引用未知 specs scenario：${scenarioId}。`);
      }
      coveredSpecScenarios.add(scenarioId);
    }
    for (const designId of designDecisions) {
      if (!design.designIds.has(designId)) {
        addError(ctx, "VAL-RUNTIME-FACT-021", RUNTIME_TRACE_PATH, `${label}.source-basis.design-decisions 引用未知 design decision：${designId}。`);
      }
      coveredDesignDecisions.add(designId);
    }

    if (specScenarios.length === 0 && designDecisions.length === 0) {
      addError(ctx, "VAL-RUNTIME-FACT-023", RUNTIME_TRACE_PATH, `${label} 必须至少引用一个 spec scenario 或 design decision。`);
    }
  }

  return {
    factIds,
    factTypesById,
    scopeRolesById,
    coveredSpecScenarios,
    coveredDesignDecisions,
  };
}

function validateRuntimeSourceBasisKeys(ctx, sourceBasis, label) {
  const allowed = new Set(["spec-scenarios", "design-decisions"]);
  for (const key of Object.keys(sourceBasis)) {
    if (!allowed.has(key)) {
      addError(ctx, "VAL-RUNTIME-FACT-019", RUNTIME_TRACE_PATH, `${label}.source-basis 不得包含 ${key}；runtime source basis 只能来自 specs/design。`);
    }
  }
}

function validateLegacyRuntimeFactFieldsAbsent(ctx, row, label) {
  for (const field of LEGACY_RUNTIME_FACT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(row ?? {}, field)) {
      addError(ctx, "VAL-RUNTIME-LEGACY-003", RUNTIME_TRACE_PATH, `${label} 不得包含旧字段：${field}。`);
    }
  }
}

function validateRuntimeDeliveryProjection(ctx, trace, factModel) {
  const delivery = requireObject(ctx, "VAL-RUNTIME-DELIVERY-001", RUNTIME_TRACE_PATH, trace["delivery-plane"], "delivery-plane");
  const sections = requireObject(ctx, "VAL-RUNTIME-DELIVERY-002", RUNTIME_TRACE_PATH, delivery["fact-sections"], "delivery-plane.fact-sections");
  const allSectionIds = [];
  const seen = new Set();
  const sectionConfig = [
    ["surface-facts", /^RS-\d{3}$/u, "surface"],
    ["operation-facts", /^OP-\d{3}$/u, "operation"],
    ["state-facts", /^ST-\d{3}$/u, "state"],
    ["chain-facts", /^CH-\d{3}$/u, "chain"],
  ];
  for (const [field, regex, factType] of sectionConfig) {
    const ids = requireIdArray(ctx, "VAL-RUNTIME-DELIVERY-003", RUNTIME_TRACE_PATH, sections[field], `delivery-plane.fact-sections.${field}`, regex);
    for (const id of ids) {
      allSectionIds.push(id);
      if (seen.has(id)) {
        addError(ctx, "VAL-RUNTIME-DELIVERY-004", RUNTIME_TRACE_PATH, `delivery-plane.fact-sections 重复引用 runtime fact：${id}。`);
      }
      seen.add(id);
      if (!factModel.factIds.has(id)) {
        addError(ctx, "VAL-RUNTIME-DELIVERY-005", RUNTIME_TRACE_PATH, `delivery-plane.fact-sections.${field} 引用未定义 runtime fact：${id}。`);
      }
      if (factModel.factTypesById.get(id) && factModel.factTypesById.get(id) !== factType) {
        addError(ctx, "VAL-RUNTIME-DELIVERY-006", RUNTIME_TRACE_PATH, `${id} fact-type 与 ${field} 不一致。`);
      }
    }
  }
  expectSameSet(ctx, "VAL-RUNTIME-DELIVERY-007", RUNTIME_TRACE_PATH, allSectionIds, [...factModel.factIds], "delivery-plane.fact-sections runtime facts");
}

function validateRuntimeCoverage(ctx, specs, design, factModel) {
  expectSameSet(
    ctx,
    "VAL-RUNTIME-COVERAGE-SPEC-001",
    RUNTIME_TRACE_PATH,
    [...factModel.coveredSpecScenarios],
    [...specs.scenarioIds],
    "runtime facts covered spec scenarios",
  );
  expectSameSet(
    ctx,
    "VAL-RUNTIME-COVERAGE-DESIGN-001",
    RUNTIME_TRACE_PATH,
    [...factModel.coveredDesignDecisions].filter((id) => design.runtimeDesignIds.has(id)),
    [...design.runtimeDesignIds],
    "runtime facts covered runtime-affecting design decisions",
  );
}

function validateRuntimeGate(ctx, trace) {
  const gate = requireObject(ctx, "VAL-RUNTIME-GATE-001", RUNTIME_TRACE_PATH, trace["runtime-gate"], "runtime-gate");
  for (const field of Object.keys(gate)) {
    if (!RUNTIME_GATE_FIELDS.includes(field)) {
      addError(ctx, "VAL-RUNTIME-GATE-004", RUNTIME_TRACE_PATH, `runtime-gate 不得包含未知字段：${field}。`);
    }
  }
  for (const field of RUNTIME_GATE_FIELDS) {
    const rows = requireArray(ctx, "VAL-RUNTIME-GATE-002", RUNTIME_TRACE_PATH, gate[field], `runtime-gate.${field}`);
    if (rows.length > 0) {
      addError(ctx, "VAL-RUNTIME-GATE-003", RUNTIME_TRACE_PATH, `runtime-gate.${field} 必须为空才能通过 validator。`);
    }
  }
}

function runtimeFactTypeForId(id) {
  if (id.startsWith("RS-")) return "surface";
  if (id.startsWith("OP-")) return "operation";
  if (id.startsWith("ST-")) return "state";
  if (id.startsWith("CH-")) return "chain";
  return "";
}

function requireIdLikeArray(ctx, ruleId, value, label) {
  const values = requireArray(ctx, ruleId, RUNTIME_TRACE_PATH, value, label).map(strip).filter(Boolean);
  const seen = new Set();
  for (const id of values) {
    if (!/^trace\/specs\/.+\.trace\.json#\/spec-delta-register\/\d+\/scenarios\/\d+$/u.test(id)) {
      addError(ctx, ruleId, RUNTIME_TRACE_PATH, `${label} 包含非法 scenario pointer：${id}`);
    }
    if (seen.has(id)) {
      addError(ctx, ruleId, RUNTIME_TRACE_PATH, `${label} 包含重复 ID：${id}`);
    }
    seen.add(id);
  }
  return values;
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
