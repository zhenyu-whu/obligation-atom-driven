#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  isAutomatedProofSliceRequired,
  isProofSlicePlacementSupported,
} from "./proof-slice-placement-policy.mjs";

const TRACE_SCHEMA = "openspec-trace-v1";
const PROOF_SLICES_TRACE_SCHEMA = "openspec-proof-slices-v1";
const TRACE_CONTRACT_PROOF_SLICES = "proof-slices-v1";
const SOURCE_ALIGNED_TRACE_CONTRACT = "source-aligned-trace-v1";
const SOURCE_ALIGNED_MANIFEST_SCHEMA = "source-aligned-orchestrate-manifest-v1";
const SOURCE_ALIGNED_GLOBAL_ATOM_INDEX_SCHEMA = "source-aligned-global-atom-index-v1";
const SOURCE_ALIGNED_ATOM_PLAN_MAPPING_SCHEMA = "source-aligned-atom-plan-mapping-v1";
const SOURCE_ALIGNED_FINAL_PACKET_INDEX_SCHEMA = "source-aligned-final-packet-index-v1";
const SOURCE_ALIGNED_PHASE_5_SCHEMA = "source-aligned-phase-5-trace-v1";
const PROOF_SLICES_TRACE_PATH = "trace/verification.proof-slices.json";
const RUNTIME_ROW_RE = /\b(?:RS|OP|ST|CH)-\d{3}\b/g;
const PROOF_SLICE_RE = /\bPS-\d{3}\b/g;
const AC_ID_RE = /\bAC-\d{3}\b/g;
const TASK_ID_RE = /\bAC-\d{3}\.\d+\b/g;
const GA_ID_RE = /\bGA-\d{4}\b/g;
const SI_ID_RE = /\bSI-\d{3}\b/g;
const D_ID_RE = /\bD-\d{3}\b/g;
const P_ID_RE = /\bP-\d{3}\b/g;
const KEBAB_KEY_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

const SPEC_HANDLINGS = new Set([
  "direct-spec-requirement",
  "direct-spec-guard",
  "derived-capability-contract-requirement",
  "derived-capability-contract-guard",
]);

const DERIVED_SPEC_HANDLINGS = new Set([
  "derived-capability-contract-requirement",
  "derived-capability-contract-guard",
]);

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

const PROOF_SLICE_COLUMNS = [
  "Slice ID",
  "Runtime Row IDs",
  "Primary Runtime Row ID",
  "Primitive Type",
  "Branch / Variant",
  "Observable Surface",
  "Oracle Fragment",
  "Failure Signal",
  "Primary Layer",
  "Production Owner",
  "Primary Assertion Shape",
  "Fixture / Mock Boundary",
  "Regression Intent",
  "Manual / Environment Gate",
];

const FORBIDDEN_ARTIFACT_FIELDS = [
  "Test Evidence Matrix",
  "Regression Test Deposit",
  "Test Layer Plan",
  "Fixed Command",
  "Test File / Name",
  "Evidence Directory",
  "Evidence Status",
  "Deposit Status",
  "Test IDs",
];

const TRACE_REQUIREMENTS = {
  proposal: {
    common: ["proposal-alignment-gate"],
    obligation: ["obligation-atom-preconditions", "change-atom-coverage-register", "source-window-read-set"],
    default: ["baseline-input-read-set", "change-scope-coverage"],
  },
  specs: {
    common: ["requirement-source-trace", "production-alignment-gate"],
  },
  design: {
    common: ["production-source-map", "design-obligation-matrix", "production-alignment-gate"],
  },
  "runtime-acceptance": {
    common: ["runtime-upstream-coverage-map", "runtime-coverage-source-map", "coverage-closure-checklist"],
  },
  verification: {
    common: ["runtime-coverage-reconciliation", "slice-consistency-checklist"],
  },
  tasks: {
    common: ["acceptance-driven-coverage", "runtime-acceptance-index", "runtime-acceptance-projection"],
  },
};

const PRODUCTION_WORDS_RE =
  /生产|实现|代码|schema|migration|API|domain|UI|auth|security|config|provider|observability|deployment|日志|脱敏|持久化|路由|组件|权限|配置|迁移/iu;
const PROOF_ONLY_AC_RE =
  /proof\s*closure|verification\s*closure|evidence\s*closure|coverage\s*closure|acceptance\s*closure|证明收束|验收证明|验证收束|证据收束|覆盖收束|闭合证明/iu;

const NON_ATOMIC_PATTERNS = [
  {
    id: "VAL-PS-401",
    label: "edit/add/delete",
    regex:
      /\bedit\b[\s\S]{0,60}\badd\b[\s\S]{0,60}\bdelete\b|\bedit\b[\s\S]{0,60}\bdelete\b[\s\S]{0,60}\badd\b|改名[\s\S]{0,40}补充[\s\S]{0,40}删除|改名[\s\S]{0,40}删除[\s\S]{0,40}补充|编辑[\s\S]{0,40}补充[\s\S]{0,40}删除|edit\/delete\/add|edit\/add\/delete/iu,
  },
  {
    id: "VAL-PS-402",
    label: "replay/mismatch",
    regex:
      /\breplay\b[\s\S]{0,50}\bmismatch\b|\bmismatch\b[\s\S]{0,50}\breplay\b|幂等[\s\S]{0,40}mismatch|replay\/mismatch/iu,
  },
  {
    id: "VAL-PS-403",
    label: "success/failure",
    regex:
      /\bsuccess\b[\s\S]{0,50}\bfailure\b|\bfailure\b[\s\S]{0,50}\bsuccess\b|成功[\s\S]{0,40}失败|success\/failure/iu,
  },
  {
    id: "VAL-PS-404",
    label: "provider failure variants",
    regex:
      /\bretryable\b[\s\S]{0,80}\bnon[-_ ]?retryable\b|\bnon[-_ ]?retryable\b[\s\S]{0,80}\bretryable\b|\bretryable\b[\s\S]{0,80}\bempty\b[\s\S]{0,80}\btimeout\b|可重试[\s\S]{0,50}不可重试|empty result[\s\S]{0,50}timeout/iu,
  },
  {
    id: "VAL-PS-405",
    label: "viewport variants",
    regex:
      /\bdesktop\b[\s\S]{0,80}\bmobile\b|\bnotebook\b[\s\S]{0,80}\bmobile\b|desktop\/notebook\/mobile|desktop\/mobile|mobile[\s\S]{0,40}notebook|多个 viewport|多档 viewport/iu,
  },
  {
    id: "VAL-PS-406",
    label: "log categories",
    regex:
      /日志类别|log categories|创建[\s\S]{0,80}覆盖[\s\S]{0,80}提取|extract\.success[\s\S]{0,80}extract\.failure|idempotency\.replay[\s\S]{0,80}idempotency\.mismatch/iu,
  },
  {
    id: "VAL-PS-407",
    label: "redaction categories",
    regex:
      /redaction 类别|脱敏类别|source_text[\s\S]{0,100}raw provider response|Brief item text[\s\S]{0,100}token|token[\s\S]{0,80}cookie[\s\S]{0,80}email|完整原文[\s\S]{0,80}raw response[\s\S]{0,80}token/iu,
  },
  {
    id: "VAL-PS-408",
    label: "auth/security branches",
    regex:
      /unauthenticated[\s\S]{0,80}foreign|foreign[\s\S]{0,80}deleted|匿名[\s\S]{0,40}跨用户|跨用户[\s\S]{0,40}软删除|多个 security branches|多个 auth\/security/iu,
  },
];

export function validateChange(options = {}) {
  const root = options.root ?? process.cwd();
  const change = options.change;
  if (!change) {
    throw new Error("validateChange requires a change slug");
  }

  const complete = Boolean(options.complete);
  const changeDir = path.join(root, "openspec", "changes", change);
  const issues = [];
  if (!fs.existsSync(changeDir)) {
    addIssue(issues, "error", "VAL-000", `openspec/changes/${change}`, "Change 目录不存在。");
    return summarize(issues);
  }

  const schemaName = readSchemaName(changeDir);
  const schemaKind = schemaName === "production-default-acceptance-driven" ? "default" : "obligation";
  const files = readChangeFiles(root, changeDir);
  const trace = loadTracePlane(root, changeDir, files, schemaKind, issues, { complete });
  validateProposalAuthorityTrace(root, change, files.byName["proposal.md"], trace.get("proposal"), schemaKind, issues);

  if (complete) {
    for (const artifact of ["runtime-acceptance.md", "verification.md", "tasks.md"]) {
      if (!files.byName[artifact]) {
        addIssue(issues, "error", "VAL-001", artifact, "complete 校验要求 apply-required artifact 已存在。");
      }
    }
  }

  const runtimeRows = files.byName["runtime-acceptance.md"]
    ? validateRuntimeAcceptance(files.byName["runtime-acceptance.md"], trace.get("runtime-acceptance"), issues)
    : new Map();

  const proofSlices = files.byName["verification.md"]
    ? validateVerification(
        files.byName["verification.md"],
        runtimeRows,
        issues,
        trace.get("verification-proof-slices"),
        trace.traceContractVersion,
      )
    : new Map();

  const taskModel = files.byName["tasks.md"]
    ? validateTasks(files.byName["tasks.md"], trace.get("tasks"), runtimeRows, issues)
    : { acSections: [], taskIds: new Set() };

  validateVerificationReconciliation(trace.get("verification"), proofSlices, runtimeRows, issues);
  validateSourceScopeTrace(trace, schemaKind, files, issues);
  validateRuntimeCoverageTrace(trace.get("runtime-acceptance"), runtimeRows, trace, issues);
  validateTasksTrace(trace.get("tasks"), runtimeRows, taskModel, issues);

  return summarize(issues);
}

function readSchemaName(changeDir) {
  const yamlPath = path.join(changeDir, ".openspec.yaml");
  if (!fs.existsSync(yamlPath)) {
    return "";
  }
  const text = fs.readFileSync(yamlPath, "utf8");
  return text.match(/^schema:\s*(\S+)/m)?.[1] ?? "";
}

function readChangeFiles(root, changeDir) {
  const byName = {};
  const byArtifact = new Map();
  const all = [];
  for (const fullPath of walkFiles(changeDir).filter((file) => file.endsWith(".md"))) {
    const relPath = path.relative(changeDir, fullPath);
    const repoRelPath = path.relative(root, fullPath);
    const text = fs.readFileSync(fullPath, "utf8");
    const file = {
      name: path.basename(fullPath),
      artifactId: artifactIdForPath(relPath),
      relPath,
      repoRelPath,
      fullPath,
      text,
      lines: text.split(/\r?\n/),
    };
    all.push(file);
    byName[relPath] = file;
    if (!relPath.includes(path.sep)) {
      byName[file.name] = file;
    }
    byArtifact.set(file.artifactId === "specs" ? `specs:${specTraceName(relPath)}` : file.artifactId, file);
  }
  return { all, byName, byArtifact };
}

function artifactIdForPath(relPath) {
  if (relPath === "proposal.md") return "proposal";
  if (relPath === "design.md") return "design";
  if (relPath === "runtime-acceptance.md") return "runtime-acceptance";
  if (relPath === "verification.md") return "verification";
  if (relPath === "tasks.md") return "tasks";
  if (relPath.startsWith(`specs${path.sep}`) && relPath.endsWith(".md")) return "specs";
  return "unknown";
}

function specTraceName(relPath) {
  return relPath.replace(/^specs[\\/]/, "").replace(/[\\/]spec\.md$/, "").replace(/\.md$/, "");
}

function loadTracePlane(root, changeDir, files, schemaKind, issues, options = {}) {
  const traces = new Map();
  const manifestPath = path.join(changeDir, "trace", "manifest.json");
  let manifest = null;
  let traceContractVersion = "";
  if (!fs.existsSync(manifestPath)) {
    addIssue(issues, "error", "VAL-TR-001", path.relative(root, manifestPath), "缺少 trace/manifest.json。");
  } else {
    manifest = readJson(manifestPath, root, issues);
    if (manifest) {
      validateKebabKeys(manifest, "trace/manifest.json", issues);
      if (manifest["trace-schema"] !== TRACE_SCHEMA) {
        addIssue(issues, "error", "VAL-TR-002", "trace/manifest.json", `trace-schema 必须为 ${TRACE_SCHEMA}。`);
      }
      traceContractVersion = strip(manifest["trace-contract-version"]);
      if (traceContractVersion && traceContractVersion !== TRACE_CONTRACT_PROOF_SLICES) {
        addIssue(
          issues,
          "error",
          "VAL-TR-017",
          "trace/manifest.json",
          `trace-contract-version 不支持：${traceContractVersion}。`,
        );
      }
    }
  }

  for (const file of files.all.filter((candidate) => candidate.artifactId !== "unknown")) {
    const pointer = parseTracePointer(file, issues);
    if (!pointer) {
      continue;
    }
    const tracePath = path.join(changeDir, pointer.path);
    const traceRel = path.relative(root, tracePath);
    if (!fs.existsSync(tracePath)) {
      addIssue(issues, "error", "VAL-TR-003", `${file.repoRelPath}`, `Trace file 不存在：${pointer.path}。`);
      continue;
    }
    const digest = sha256File(tracePath);
    if (pointer.digest !== digest) {
      addIssue(issues, "error", "VAL-TR-004", `${file.repoRelPath}`, `Trace digest 不匹配，应为 ${digest}。`);
    }
    const manifestEntry = findManifestEntry(manifest, file.relPath, pointer.path);
    if (!manifestEntry) {
      addIssue(issues, "error", "VAL-TR-005", "trace/manifest.json", `manifest 缺少 artifact ${file.relPath}。`);
    } else {
      if (manifestEntry["trace-path"] !== pointer.path) {
        addIssue(issues, "error", "VAL-TR-006", "trace/manifest.json", `${file.relPath} 的 trace-path 与 artifact pointer 不一致。`);
      }
      if (manifestEntry["trace-digest"] !== digest) {
        addIssue(issues, "error", "VAL-TR-007", "trace/manifest.json", `${file.relPath} 的 trace-digest 与实际文件不一致。`);
      }
    }
    const data = readJson(tracePath, root, issues);
    if (!data) {
      continue;
    }
    validateKebabKeys(data, traceRel, issues);
    if (data["trace-schema"] !== TRACE_SCHEMA) {
      addIssue(issues, "error", "VAL-TR-008", traceRel, `trace-schema 必须为 ${TRACE_SCHEMA}。`);
    }
    if (data["artifact-path"] && data["artifact-path"] !== file.relPath) {
      addIssue(issues, "error", "VAL-TR-009", traceRel, "artifact-path 与 artifact 实际路径不一致。");
    }
    validateTraceSections(data, file, schemaKind, traceRel, issues);
    traces.set(file.artifactId === "specs" ? `specs:${specTraceName(file.relPath)}` : file.artifactId, data);
  }
  const shouldLoadProofSlices =
    traceContractVersion === TRACE_CONTRACT_PROOF_SLICES && (options.complete || Boolean(files.byName["verification.md"]));
  if (shouldLoadProofSlices) {
    const proofSlicesTrace = loadProofSlicesTrace(root, changeDir, manifest, issues);
    if (proofSlicesTrace) {
      traces.set("verification-proof-slices", proofSlicesTrace);
    }
  }
  traces.traceContractVersion = traceContractVersion;
  return traces;
}

function findManifestEntry(manifest, artifactPath, tracePath = null) {
  const artifacts = Array.isArray(manifest?.artifacts) ? manifest.artifacts : [];
  return artifacts.find(
    (entry) => entry?.["artifact-path"] === artifactPath && (!tracePath || entry?.["trace-path"] === tracePath),
  );
}

function findManifestTraceEntry(manifest, tracePath) {
  const artifacts = Array.isArray(manifest?.artifacts) ? manifest.artifacts : [];
  return artifacts.find((entry) => entry?.["trace-path"] === tracePath);
}

function loadProofSlicesTrace(root, changeDir, manifest, issues) {
  const fullPath = path.join(changeDir, PROOF_SLICES_TRACE_PATH);
  const repoRelPath = path.relative(root, fullPath);
  if (!fs.existsSync(fullPath)) {
    addIssue(
      issues,
      "error",
      "VAL-PST-001",
      repoRelPath,
      "trace-contract-version=proof-slices-v1 时必须存在 verification.proof-slices.json。",
    );
    return null;
  }
  const digest = sha256File(fullPath);
  const manifestEntry = findManifestTraceEntry(manifest, PROOF_SLICES_TRACE_PATH);
  if (!manifestEntry) {
    addIssue(issues, "error", "VAL-PST-002", "trace/manifest.json", `manifest 缺少 ${PROOF_SLICES_TRACE_PATH}。`);
  } else {
    if (manifestEntry["trace-schema"] !== PROOF_SLICES_TRACE_SCHEMA) {
      addIssue(
        issues,
        "error",
        "VAL-PST-003",
        "trace/manifest.json",
        `${PROOF_SLICES_TRACE_PATH} 的 trace-schema 必须为 ${PROOF_SLICES_TRACE_SCHEMA}。`,
      );
    }
    if (manifestEntry["trace-digest"] !== digest) {
      addIssue(
        issues,
        "error",
        "VAL-PST-004",
        "trace/manifest.json",
        `${PROOF_SLICES_TRACE_PATH} 的 trace-digest 与实际文件不一致。`,
      );
    }
  }
  const data = readJson(fullPath, root, issues);
  if (!data) {
    return null;
  }
  validateKebabKeys(data, repoRelPath, issues);
  return data;
}

function parseTracePointer(file, issues) {
  const index = file.lines.findIndex((line) => line.trim() === "## Trace Appendix");
  if (index < 0) {
    addIssue(issues, "error", "VAL-TR-010", file.repoRelPath, "artifact 缺少 Trace Appendix 指针块。");
    return null;
  }
  const tail = file.lines.slice(index + 1).filter((line) => line.trim() !== "");
  if (tail.some((line) => /^#{3,6}\s+/.test(line.trim()) || isTableLine(line))) {
    addIssue(issues, "error", "VAL-TR-011", file.repoRelPath, "Trace Appendix 只能包含 JSON trace 指针，不得保留完整 Markdown trace 表格。");
  }
  const traceFile = tail.map((line) => line.match(/^Trace file:\s+`([^`]+)`\s*$/)?.[1]).find(Boolean);
  const traceSchema = tail.map((line) => line.match(/^Trace schema:\s+`([^`]+)`\s*$/)?.[1]).find(Boolean);
  const traceDigest = tail.map((line) => line.match(/^Trace digest:\s+`([^`]+)`\s*$/)?.[1]).find(Boolean);
  if (!traceFile || !traceSchema || !traceDigest) {
    addIssue(issues, "error", "VAL-TR-012", file.repoRelPath, "Trace Appendix 指针必须包含 Trace file/schema/digest。");
    return null;
  }
  if (traceSchema !== TRACE_SCHEMA) {
    addIssue(issues, "error", "VAL-TR-013", file.repoRelPath, `Trace schema 必须为 ${TRACE_SCHEMA}。`);
  }
  return { path: traceFile, schema: traceSchema, digest: traceDigest };
}

function validateTraceSections(data, file, schemaKind, traceRel, issues) {
  const requirements = TRACE_REQUIREMENTS[file.artifactId];
  if (!requirements) {
    return;
  }
  for (const key of requirements.common ?? []) {
    if (!(key in data)) {
      addIssue(issues, "error", "VAL-TR-014", traceRel, `缺少 trace section ${key}。`);
    }
  }
  const profileKeys = schemaKind === "default" ? requirements.default : requirements.obligation;
  for (const key of profileKeys ?? []) {
    if (!(key in data)) {
      addIssue(issues, "error", "VAL-TR-014", traceRel, `缺少 trace section ${key}。`);
    }
  }
}

function validateRuntimeAcceptance(file, trace, issues) {
  const requiredSections = [
    "## Runtime Acceptance Intent",
    "## Runtime Surface Inventory",
    "## Operation Coverage Matrix",
    "## State / Branch Coverage Matrix",
    "## Async / Realtime Chain Matrix",
    "## Trace Appendix",
  ];
  for (const section of requiredSections) {
    if (!file.text.includes(section)) {
      addIssue(issues, "error", "VAL-RA-001", file.repoRelPath, `缺少章节 ${section}。`);
    }
  }
  for (const forbidden of FORBIDDEN_ARTIFACT_FIELDS) {
    if (hasForbiddenField(file.lines, forbidden)) {
      addIssue(issues, "error", "VAL-RA-002", file.repoRelPath, `runtime-acceptance.md 不得包含 ${forbidden}。`);
    }
  }

  const rows = new Map();
  const tableHeadings = [
    "## Runtime Surface Inventory",
    "## Operation Coverage Matrix",
    "## State / Branch Coverage Matrix",
    "## Async / Realtime Chain Matrix",
  ];
  for (const heading of tableHeadings) {
    const table = getTableAfterHeading(file, heading);
    if (!table) {
      addIssue(issues, "error", "VAL-RA-003", file.repoRelPath, `缺少 ${heading} 表格。`);
      continue;
    }
    const scopeRoleIndex = table.headers.findIndex((header) => normalizeHeader(header) === "scope role");
    const ownerIndex = table.headers.findIndex((header) => normalizeHeader(header) === "owner candidate");
    const sourceBasisIndex = table.headers.findIndex((header) => normalizeHeader(header) === "source basis");
    if (sourceBasisIndex < 0) {
      addIssue(issues, "error", "VAL-RA-007", `${file.repoRelPath}:${table.line}`, `${heading} 表格缺少 Source Basis 列。`);
    }
    for (const row of table.rows) {
      const id = strip(row.cells[0]);
      if (!/^(RS|OP|ST|CH)-\d{3}$/.test(id)) {
        continue;
      }
      if (rows.has(id)) {
        addIssue(issues, "error", "VAL-RA-004", `${file.repoRelPath}:${row.line}`, `runtime row ${id} 重复。`);
      }
      const owner = ownerIndex >= 0 ? strip(row.cells[ownerIndex]) : "";
      if (ownerIndex >= 0 && !owner) {
        addIssue(issues, "error", "VAL-RA-005", `${file.repoRelPath}:${row.line}`, `runtime row ${id} 缺少 Owner Candidate。`);
      }
      const scopeRole = scopeRoleIndex >= 0 ? strip(row.cells[scopeRoleIndex]) : "";
      if (!scopeRole) {
        addIssue(issues, "error", "VAL-RA-006", `${file.repoRelPath}:${row.line}`, `runtime row ${id} 缺少 Scope Role。`);
      }
      const sourceBasis = sourceBasisIndex >= 0 ? strip(row.cells[sourceBasisIndex]) : "";
      if (sourceBasisIndex >= 0 && !sourceBasis) {
        addIssue(issues, "error", "VAL-RA-007", `${file.repoRelPath}:${row.line}`, `runtime row ${id} 缺少 Source Basis。`);
      }
      rows.set(id, { id, rowType: id.slice(0, 2), scopeRole, sourceBasis, line: row.line });
    }
  }
  return rows;
}

function validateVerification(file, runtimeRows, issues, proofSlicesTrace = null, traceContractVersion = "") {
  const requiredSections = [
    "## Verification Intent",
    "## Proof Slice Matrix",
    "## Layer / Harness / Fixture Notes",
    "## Do Not Test",
    "## Trace Appendix",
  ];
  for (const section of requiredSections) {
    if (!file.text.includes(section)) {
      addIssue(issues, "error", "VAL-VF-001", file.repoRelPath, `缺少章节 ${section}。`);
    }
  }
  for (const forbidden of FORBIDDEN_ARTIFACT_FIELDS) {
    if (hasForbiddenField(file.lines, forbidden)) {
      addIssue(issues, "error", "VAL-VF-002", file.repoRelPath, `verification.md 不得包含 ${forbidden}。`);
    }
  }
  if (/(^|\s)(?:tests\/|test-results\/|openspec-results\/|\.test\.[cm]?[jt]sx?|\.spec\.[cm]?[jt]sx?)/iu.test(file.text)) {
    addIssue(issues, "error", "VAL-VF-003", file.repoRelPath, "verification.md 不得写入具体测试路径、测试文件名或 evidence/apply 产物路径。");
  }

  const table = getTableAfterHeading(file, "## Proof Slice Matrix");
  const slices = new Map();
  if (!table) {
    addIssue(issues, "error", "VAL-PS-001", file.repoRelPath, "缺少 Proof Slice Matrix 表格。");
    return slices;
  }

  const indexes = requireColumns(table, PROOF_SLICE_COLUMNS, file.repoRelPath, "VAL-PS-002", issues);
  if (!indexes) {
    return slices;
  }

  for (const row of table.rows) {
    const slice = proofSliceFromMarkdownRow(row, indexes);
    if (!/^PS-\d{3}$/.test(slice.id)) {
      continue;
    }
    if (slices.has(slice.id)) {
      addIssue(issues, "error", "VAL-PS-003", `${file.repoRelPath}:${row.line}`, `Proof Slice ${slice.id} 重复。`);
    }

    validateProofSliceModel(slice, `${file.repoRelPath}:${row.line}`, runtimeRows, issues);
    slices.set(slice.id, slice);
  }
  if (traceContractVersion === TRACE_CONTRACT_PROOF_SLICES) {
    const jsonSlices = validateProofSlicesTrace(proofSlicesTrace, slices, runtimeRows, issues);
    return jsonSlices.size > 0 ? jsonSlices : slices;
  }
  return slices;
}

function proofSliceFromMarkdownRow(row, indexes) {
  return {
    id: strip(row.cells[indexes["Slice ID"]]),
    runtimeRowIds: idsFromValue(row.cells[indexes["Runtime Row IDs"]], RUNTIME_ROW_RE),
    primaryRowId: strip(row.cells[indexes["Primary Runtime Row ID"]]),
    primitive: strip(row.cells[indexes["Primitive Type"]]),
    branch: strip(row.cells[indexes["Branch / Variant"]]),
    surface: strip(row.cells[indexes["Observable Surface"]]),
    oracle: strip(row.cells[indexes["Oracle Fragment"]]),
    failure: strip(row.cells[indexes["Failure Signal"]]),
    layer: strip(row.cells[indexes["Primary Layer"]]),
    owner: strip(row.cells[indexes["Production Owner"]]),
    assertion: strip(row.cells[indexes["Primary Assertion Shape"]]),
    fixture: strip(row.cells[indexes["Fixture / Mock Boundary"]]),
    regression: strip(row.cells[indexes["Regression Intent"]]),
    manual: strip(row.cells[indexes["Manual / Environment Gate"]]),
    line: row.line,
  };
}

function proofSliceFromTraceRow(row) {
  return {
    id: strip(row["slice-id"]),
    runtimeRowIds: idsFromValue(row["runtime-row-ids"], RUNTIME_ROW_RE),
    primaryRowId: strip(row["primary-runtime-row-id"]),
    primitive: strip(row["primitive-type"]),
    branch: strip(row["branch-variant"]),
    surface: strip(row["observable-surface"]),
    oracle: strip(row["oracle-fragment"]),
    failure: strip(row["failure-signal"]),
    layer: strip(row["primary-layer"]),
    owner: strip(row["production-owner"]),
    assertion: strip(row["primary-assertion-shape"]),
    fixture: strip(row["fixture-mock-boundary"]),
    regression: strip(row["regression-intent"]),
    manual: strip(row["manual-environment-gate"]),
  };
}

function validateProofSliceModel(slice, ref, runtimeRows, issues) {
  if (!slice.runtimeRowIds.includes(slice.primaryRowId)) {
    addIssue(issues, "error", "VAL-PS-004", ref, `${slice.id} 的 Primary Runtime Row ID 不在 Runtime Row IDs 中。`);
  }
  for (const runtimeRowId of slice.runtimeRowIds) {
    if (runtimeRows.size > 0 && !runtimeRows.has(runtimeRowId)) {
      addIssue(issues, "error", "VAL-PS-005", ref, `${slice.id} 引用未定义 runtime row ${runtimeRowId}。`);
    }
  }
  if (!PRIMITIVE_TYPES.has(slice.primitive)) {
    addIssue(issues, "error", "VAL-PS-006", ref, `${slice.id} Primitive Type 非法：${slice.primitive || "(empty)"}。`);
  }
  if (!PRIMARY_LAYERS.has(slice.layer)) {
    addIssue(issues, "error", "VAL-PS-007", ref, `${slice.id} Primary Layer 非法：${slice.layer || "(empty)"}。`);
  }
  if (!slice.owner || isOwnerListOrNonProduction(slice.owner)) {
    addIssue(issues, "error", "VAL-PS-008", ref, `${slice.id} Production Owner 必须是单一 production owner token，不能是 owner list、测试路径或 evidence 路径。`);
  }
  if (
    isAutomatedProofSliceRequired(slice) &&
    slice.owner &&
    !isOwnerListOrNonProduction(slice.owner) &&
    PRIMARY_LAYERS.has(slice.layer) &&
    !isProofSlicePlacementSupported(slice)
  ) {
    addIssue(
      issues,
      "error",
      "VAL-PS-009",
      ref,
      `${slice.id} Production Owner + Primary Layer 没有 placement-policy compliant tests/** 落点：${slice.owner} + ${slice.layer}。请改为合法 owner/layer 组合，或改为 source/scope-backed manual/not-applicable。`,
    );
  }

  const combined = [slice.branch, slice.oracle, slice.assertion].join(" ");
  for (const pattern of NON_ATOMIC_PATTERNS) {
    if (pattern.regex.test(combined)) {
      addIssue(issues, "warning", pattern.id, ref, `${slice.id} 疑似聚合多个独立可失败分支：${pattern.label}。`);
    }
  }
}

function validateProofSlicesTrace(trace, markdownSlices, runtimeRows, issues) {
  const slices = new Map();
  if (!trace) {
    return slices;
  }
  if (trace["trace-schema"] !== PROOF_SLICES_TRACE_SCHEMA) {
    addIssue(
      issues,
      "error",
      "VAL-PST-005",
      PROOF_SLICES_TRACE_PATH,
      `trace-schema 必须为 ${PROOF_SLICES_TRACE_SCHEMA}。`,
    );
  }
  if (trace["artifact-id"] !== "verification") {
    addIssue(issues, "error", "VAL-PST-006", PROOF_SLICES_TRACE_PATH, "artifact-id 必须为 verification。");
  }
  if (trace["artifact-path"] !== "verification.md") {
    addIssue(issues, "error", "VAL-PST-007", PROOF_SLICES_TRACE_PATH, "artifact-path 必须为 verification.md。");
  }

  const rows = asArray(trace["proof-slices"]);
  if (rows.length === 0) {
    addIssue(issues, "error", "VAL-PST-008", PROOF_SLICES_TRACE_PATH, "proof-slices 必须至少包含一行。");
  }
  const summaryCount = Number(trace["proof-slice-summary"]?.["proof-slice-count"]);
  if (Number.isFinite(summaryCount) && summaryCount !== rows.length) {
    addIssue(
      issues,
      "error",
      "VAL-PST-009",
      PROOF_SLICES_TRACE_PATH,
      `proof-slice-summary.proof-slice-count 必须等于 proof-slices 行数 ${rows.length}。`,
    );
  }

  for (const [index, row] of rows.entries()) {
    const ref = `${PROOF_SLICES_TRACE_PATH}#/proof-slices/${index}`;
    const slice = proofSliceFromTraceRow(row);
    if (!/^PS-\d{3}$/.test(slice.id)) {
      addIssue(issues, "error", "VAL-PST-010", ref, `slice-id 非法：${slice.id || "(empty)"}。`);
      continue;
    }
    if (slices.has(slice.id)) {
      addIssue(issues, "error", "VAL-PST-011", ref, `Proof Slice ${slice.id} 重复。`);
    }
    validateProofSliceModel(slice, ref, runtimeRows, issues);
    validateProofSliceTestContract(row["test-contract"], slice.id, ref, issues);
    slices.set(slice.id, slice);

    const markdown = markdownSlices.get(slice.id);
    if (!markdown) {
      addIssue(issues, "error", "VAL-PST-012", ref, `${slice.id} 缺少 verification.md 镜像行。`);
    } else {
      compareProofSliceMirror(slice, markdown, ref, issues);
    }
  }

  for (const sliceId of markdownSlices.keys()) {
    if (!slices.has(sliceId)) {
      addIssue(issues, "error", "VAL-PST-013", PROOF_SLICES_TRACE_PATH, `${sliceId} 存在于 verification.md 但缺少 JSON canonical row。`);
    }
  }
  return slices;
}

function validateProofSliceTestContract(contract, sliceId, ref, issues) {
  if (!contract || typeof contract !== "object" || Array.isArray(contract)) {
    addIssue(issues, "error", "VAL-PST-020", ref, `${sliceId} 缺少 test-contract。`);
    return;
  }
  if (strip(contract["primary-test-cardinality"]) !== "exactly-one") {
    addIssue(issues, "error", "VAL-PST-021", ref, `${sliceId} primary-test-cardinality 必须为 exactly-one。`);
  }
  if (strip(contract["test-title-prefix"]) !== sliceId) {
    addIssue(issues, "error", "VAL-PST-022", ref, `${sliceId} test-title-prefix 必须等于 slice-id。`);
  }
  if (contract["allow-shared-setup"] !== true) {
    addIssue(issues, "error", "VAL-PST-023", ref, `${sliceId} allow-shared-setup 必须为 true。`);
  }
  if (contract["allow-multi-slice-primary-test"] !== false) {
    const waiver = contract["multi-slice-waiver"];
    if (
      contract["allow-multi-slice-primary-test"] !== true ||
      !waiver ||
      typeof waiver !== "object" ||
      !idsFromValue(waiver["slice-ids"], PROOF_SLICE_RE).includes(sliceId) ||
      !strip(waiver.reason)
    ) {
      addIssue(
        issues,
        "error",
        "VAL-PST-024",
        ref,
        `${sliceId} allow-multi-slice-primary-test 只能在提供 multi-slice-waiver 时为 true。`,
      );
    }
  }
  if (contract["waiver-required-for-multi-slice"] !== true) {
    addIssue(issues, "error", "VAL-PST-025", ref, `${sliceId} waiver-required-for-multi-slice 必须为 true。`);
  }
}

function compareProofSliceMirror(jsonSlice, markdownSlice, ref, issues) {
  const checks = [
    ["runtime-row-ids", jsonSlice.runtimeRowIds, markdownSlice.runtimeRowIds],
    ["primary-runtime-row-id", jsonSlice.primaryRowId, markdownSlice.primaryRowId],
    ["primitive-type", jsonSlice.primitive, markdownSlice.primitive],
    ["branch-variant", jsonSlice.branch, markdownSlice.branch],
    ["observable-surface", jsonSlice.surface, markdownSlice.surface],
    ["oracle-fragment", jsonSlice.oracle, markdownSlice.oracle],
    ["failure-signal", jsonSlice.failure, markdownSlice.failure],
    ["primary-layer", jsonSlice.layer, markdownSlice.layer],
    ["production-owner", jsonSlice.owner, markdownSlice.owner],
    ["primary-assertion-shape", jsonSlice.assertion, markdownSlice.assertion],
    ["fixture-mock-boundary", jsonSlice.fixture, markdownSlice.fixture],
    ["regression-intent", jsonSlice.regression, markdownSlice.regression],
    ["manual-environment-gate", jsonSlice.manual, markdownSlice.manual],
  ];
  for (const [field, left, right] of checks) {
    const same = Array.isArray(left) || Array.isArray(right) ? sameArray(left, right) : strip(left) === strip(right);
    if (!same) {
      addIssue(issues, "error", "VAL-PST-030", ref, `${jsonSlice.id} 的 ${field} 与 verification.md 镜像不一致。`);
    }
  }
}

function validateVerificationReconciliation(trace, proofSlices, runtimeRows, issues) {
  if (!trace) {
    return;
  }
  const rows = asArray(trace["runtime-coverage-reconciliation"]);
  const reconciledRuntimeRows = new Set();
  const referencedProofSlices = new Set();
  for (const [index, row] of rows.entries()) {
    const ref = traceRef("verification", "runtime-coverage-reconciliation", index);
    const runtimeRowId = strip(row["runtime-row-id"]);
    if (!/^(RS|OP|ST|CH)-\d{3}$/.test(runtimeRowId)) {
      addIssue(issues, "error", "VAL-RC-001", ref, "runtime-coverage-reconciliation row 缺少合法 runtime-row-id。");
      continue;
    }
    if (runtimeRows.size > 0 && !runtimeRows.has(runtimeRowId)) {
      addIssue(issues, "error", "VAL-RC-002", ref, `runtime-coverage-reconciliation 引用未定义 runtime row ${runtimeRowId}。`);
    } else if (runtimeRows.has(runtimeRowId)) {
      reconciledRuntimeRows.add(runtimeRowId);
    }
    const expected = idsFromValue(row["expected-proof-slice-ids"], PROOF_SLICE_RE);
    const missing = idsFromValue(row["missing-proof-slice-ids"], PROOF_SLICE_RE);
    const status = strip(row["coverage-status"]).toLowerCase();
    for (const sliceId of expected) {
      if (!proofSlices.has(sliceId)) {
        addIssue(issues, "error", "VAL-RC-003", ref, `${runtimeRowId} expected slice ${sliceId} 不存在。`);
      } else {
        referencedProofSlices.add(sliceId);
      }
    }
    if (status === "covered" && missing.length > 0) {
      addIssue(issues, "error", "VAL-RC-004", ref, `${runtimeRowId} 标记 covered 时 missing-proof-slice-ids 必须为空。`);
    }
    if (status === "covered" && expected.length === 0) {
      addIssue(issues, "error", "VAL-RC-005", ref, `${runtimeRowId} 标记 covered 但没有 expected-proof-slice-ids。`);
    }
  }
  compareIdSets(
    [...runtimeRows.keys()],
    [...reconciledRuntimeRows],
    "VAL-RC-006",
    "trace/verification.trace.json#/runtime-coverage-reconciliation",
    "runtime-coverage-reconciliation 必须覆盖每个 runtime acceptance row",
    issues,
  );
  compareIdSets(
    [...proofSlices.keys()],
    [...referencedProofSlices],
    "VAL-RC-007",
    "trace/verification.trace.json#/runtime-coverage-reconciliation",
    "每个 Proof Slice 必须至少被一个 expected-proof-slice-ids 引用",
    issues,
  );
}

function validateTasks(file, trace, runtimeRows, issues) {
  for (const forbidden of FORBIDDEN_ARTIFACT_FIELDS) {
    if (hasForbiddenField(file.lines, forbidden)) {
      addIssue(issues, "error", "VAL-TS-001", file.repoRelPath, `tasks.md 不得包含 ${forbidden}。`);
    }
  }
  if (!/^## AC-\d{3}/m.test(file.text.trimStart())) {
    addIssue(issues, "error", "VAL-TS-002", file.repoRelPath, "tasks.md Delivery Plane 必须以 AC section 开始。");
  }
  if (!file.text.includes("## Trace Appendix")) {
    addIssue(issues, "error", "VAL-TS-003", file.repoRelPath, "tasks.md 缺少 Trace Appendix 指针块。");
  }
  for (const runtimeRowId of unique(file.text.match(RUNTIME_ROW_RE) ?? [])) {
    if (runtimeRows.size > 0 && !runtimeRows.has(runtimeRowId)) {
      addIssue(issues, "error", "VAL-TS-004", file.repoRelPath, `tasks.md 引用未定义 runtime row ${runtimeRowId}。`);
    }
  }

  const sections = splitAcSections(file);
  const taskIds = extractTaskIds(file.text);
  for (const section of sections) {
    validateAcSection(file, section, runtimeRows, issues);
  }
  return { acSections: sections, taskIds };
}

function validateAcSection(file, section, runtimeRows, issues) {
  const acRows = extractAcRuntimeRows(section.text);
  const contractTable = getTableAfterText(section.text, "Resolved Runtime Contract:", section.startLine);
  if (!contractTable) {
    addIssue(issues, "error", "VAL-AC-001", `${file.repoRelPath}:${section.startLine}`, `${section.id} 缺少 Resolved Runtime Contract 表。`);
    return;
  }

  const contractRows = contractTable.rows.map((row) => strip(row.cells[0])).filter((id) => /^(RS|OP|ST|CH)-\d{3}$/.test(id));
  const acRuntimeRows = acRows.filter((id) => /^(RS|OP|ST|CH)-\d{3}$/.test(id));
  if (!sameSet(contractRows, acRuntimeRows)) {
    addIssue(issues, "error", "VAL-AC-002", `${file.repoRelPath}:${section.startLine}`, `${section.id} 的 Resolved Runtime Contract row IDs 必须与 AC Runtime Rows 一致。`);
  }
  for (const runtimeRowId of acRuntimeRows) {
    if (runtimeRows.size > 0 && !runtimeRows.has(runtimeRowId)) {
      addIssue(issues, "error", "VAL-AC-003", `${file.repoRelPath}:${section.startLine}`, `${section.id} 引用未定义 runtime row ${runtimeRowId}。`);
    }
  }

  const proofOnlyRows = acRuntimeRows.filter((id) => runtimeRows.get(id)?.scopeRole?.toLowerCase().includes("proof-only"));
  if (acRuntimeRows.length > 0 && proofOnlyRows.length === acRuntimeRows.length) {
    const proofOnlySignal = getAcIntentText(section.text);
    if (PROOF_ONLY_AC_RE.test(proofOnlySignal) && !PRODUCTION_WORDS_RE.test(proofOnlySignal)) {
      addIssue(issues, "error", "VAL-AC-004", `${file.repoRelPath}:${section.startLine}`, `${section.id} 只承载 proof-only rows，且看起来是 proof/coverage closure AC。proof-only row 不得创建 proof-only AC/checkbox。`);
    }
  }
}

function validateSourceScopeTrace(trace, schemaKind, files, issues) {
  const proposal = trace.get("proposal");
  if (!proposal) {
    return;
  }
  const idRegex = schemaKind === "default" ? SI_ID_RE : GA_ID_RE;
  const idLabel = schemaKind === "default" ? "SI" : "GA";
  const registerKey = schemaKind === "default" ? "change-scope-coverage" : "change-atom-coverage-register";
  const registered = new Set();
  const registeredRows = new Map();
  for (const [index, row] of asArray(proposal[registerKey]).entries()) {
    const ids = idsFromValue(schemaKind === "default" ? row["scope-item-id"] ?? row["global-atom-id"] : row["global-atom-id"], idRegex);
    if (ids.length !== 1) {
      addIssue(issues, "error", "VAL-SRC-001", traceRef("proposal", registerKey, index), `${registerKey} 每行必须包含一个 exact ${idLabel} ID。`);
      continue;
    }
    registered.add(ids[0]);
    registeredRows.set(ids[0], row);
  }

  for (const [key, data] of trace.entries()) {
    if (key === "proposal") {
      continue;
    }
    const refs = collectIds(data, idRegex);
    for (const ref of refs) {
      if (!registered.has(ref.id)) {
        addIssue(issues, "error", "VAL-SRC-002", `${key}${ref.pointer}`, `${ref.id} 未在 proposal trace register 中登记。`);
      }
    }
  }

  if (schemaKind === "obligation") {
    validateObligationSpecsTraceProjection(trace, registeredRows, files, issues);
    validateDesignTrace(trace.get("design"), files.byName["design.md"], trace, registeredRows, issues);
  }
}

function validateProposalAuthorityTrace(root, change, proposalFile, proposal, schemaKind, issues) {
  if (schemaKind !== "obligation" || !proposal) {
    return;
  }

  const preconditions = asObject(proposal["obligation-atom-preconditions"]);
  const jsonAuthority = loadSourceAlignedHandoffAuthority(root, change, preconditions, issues);
  if (jsonAuthority?.invalid) {
    return;
  }
  if (jsonAuthority) {
    const registerRows = parseProposalRegister(proposal, issues);

    compareIdSets(
      [...jsonAuthority.packetRows.keys()],
      [...registerRows.keys()],
      "VAL-PR-005",
      "trace/proposal.trace.json#/change-atom-coverage-register",
      "proposal register 必须与 source-aligned JSON handoff direct atom 集合完全一致",
      issues,
    );

    for (const [globalAtomId, expectedRow] of jsonAuthority.packetRows.entries()) {
      const registerRow = registerRows.get(globalAtomId);
      if (registerRow) {
        compareProposalAuthorityFields(
          globalAtomId,
          expectedRow,
          registerRow,
          "VAL-PR-006",
          `trace/proposal.trace.json#/change-atom-coverage-register/${globalAtomId}`,
          "proposal register",
          issues,
        );
      }
    }

    validateProposalSourceWindowReadSet(proposal, jsonAuthority.packetRows, issues);
    validateProposalProductionSourceCoverage(proposal, jsonAuthority.packetRows, issues);
    validateProposalAlignmentGate(proposal, jsonAuthority.packetRows, issues);
    validateProposalDeliveryPlaneLeakage(proposalFile, issues);
    return;
  }

  const packetRelPath =
    strip(preconditions["canonical-change-packet"]) ||
    path.join("openspec", "orchestrate", "change-capability-anchors", change, `${change}.md`);
  const atomIndexRelPath =
    strip(preconditions["global-atom-index"]) ||
    path.join("openspec", "orchestrate", "change-capability-anchors", "obligation-atom-index.md");

  const packetText = readAuthorityText(root, packetRelPath, issues, "VAL-PR-001", "canonical change packet");
  const atomIndexText = readAuthorityText(root, atomIndexRelPath, issues, "VAL-PR-002", "global atom index");
  if (!packetText || !atomIndexText) {
    return;
  }

  const packetRows = parseFinalPacketDirectAtoms(packetText, packetRelPath, issues);
  const atomIndexRows = parseGlobalAtomIndex(atomIndexText, atomIndexRelPath, issues);
  const registerRows = parseProposalRegister(proposal, issues);

  compareIdSets(
    [...packetRows.keys()],
    [...registerRows.keys()],
    "VAL-PR-005",
    "trace/proposal.trace.json#/change-atom-coverage-register",
    "proposal register 必须与 final packet direct atom 集合完全一致",
    issues,
  );

  for (const [globalAtomId, packetRow] of packetRows.entries()) {
    const registerRow = registerRows.get(globalAtomId);
    if (registerRow) {
      compareProposalAuthorityFields(
        globalAtomId,
        packetRow,
        registerRow,
        "VAL-PR-006",
        `trace/proposal.trace.json#/change-atom-coverage-register/${globalAtomId}`,
        "proposal register",
        issues,
      );
    }

    const atomIndexRow = atomIndexRows.get(globalAtomId);
    if (!atomIndexRow) {
      addIssue(issues, "error", "VAL-PR-007", atomIndexRelPath, `${globalAtomId} 不存在于 global atom index。`);
    } else {
      compareProposalAuthorityFields(
        globalAtomId,
        packetRow,
        atomIndexRow,
        "VAL-PR-008",
        `${atomIndexRelPath}#${globalAtomId}`,
        "global atom index",
        issues,
      );
    }
  }

  validateProposalSourceWindowReadSet(proposal, packetRows, issues);
  validateProposalProductionSourceCoverage(proposal, packetRows, issues);
  validateProposalAlignmentGate(proposal, packetRows, issues);
  validateProposalDeliveryPlaneLeakage(proposalFile, issues);
}

function loadSourceAlignedHandoffAuthority(root, change, preconditions, issues) {
  const paths = {
    manifest:
      strip(preconditions["orchestrate-manifest"]) ||
      path.join("openspec", "orchestrate", "trace", "manifest.json"),
    globalIndex:
      strip(preconditions["global-atom-index-json"]) ||
      path.join("openspec", "orchestrate", "change-capability-anchors", "obligation-atom-index.json"),
    atomPlanMapping:
      strip(preconditions["atom-plan-mapping-json"]) ||
      path.join("openspec", "orchestrate", "phase-works", "phase-5", "atom-plan-mapping.json"),
    finalPacketIndex:
      strip(preconditions["final-packet-index-json"]) ||
      path.join("openspec", "orchestrate", "phase-works", "phase-5", "final-packet-index.json"),
  };
  const explicitJson = [
    "orchestrate-manifest",
    "global-atom-index-json",
    "atom-plan-mapping-json",
    "final-packet-index-json",
  ].some((key) => Boolean(strip(preconditions[key])));
  const fullPaths = Object.fromEntries(
    Object.entries(paths).map(([key, relPath]) => [key, path.isAbsolute(relPath) ? relPath : path.join(root, relPath)]),
  );
  const existingJsonCount = Object.values(fullPaths).filter((fullPath) => fs.existsSync(fullPath)).length;
  if (!explicitJson && existingJsonCount === 0) {
    return null;
  }

  const missing = Object.entries(fullPaths).filter(([, fullPath]) => !fs.existsSync(fullPath));
  if (missing.length > 0) {
    for (const [key] of missing) {
      addIssue(issues, "error", "VAL-PR-012", paths[key], `source-aligned JSON handoff 缺少 ${paths[key]}。`);
    }
    return { invalid: true };
  }

  const manifest = readJson(fullPaths.manifest, root, issues);
  const globalIndex = readJson(fullPaths.globalIndex, root, issues);
  const mapping = readJson(fullPaths.atomPlanMapping, root, issues);
  const packetIndex = readJson(fullPaths.finalPacketIndex, root, issues);
  if (!manifest || !globalIndex || !mapping || !packetIndex) {
    return { invalid: true };
  }

  validateSourceAlignedJsonBasics(manifest, paths.manifest, SOURCE_ALIGNED_MANIFEST_SCHEMA, issues);
  validateSourceAlignedJsonBasics(globalIndex, paths.globalIndex, SOURCE_ALIGNED_GLOBAL_ATOM_INDEX_SCHEMA, issues);
  validateSourceAlignedJsonBasics(mapping, paths.atomPlanMapping, SOURCE_ALIGNED_ATOM_PLAN_MAPPING_SCHEMA, issues);
  validateSourceAlignedJsonBasics(packetIndex, paths.finalPacketIndex, SOURCE_ALIGNED_FINAL_PACKET_INDEX_SCHEMA, issues);
  const phase5TraceStatus = validateSourceAlignedPhase5Trace(root, paths.manifest, issues);
  validateSourceAlignedManifest(root, manifest, paths, fullPaths, issues, phase5TraceStatus);

  const packet = asArray(packetIndex.packets).find((item) => strip(asObject(item).change) === change);
  if (!packet) {
    addIssue(issues, "error", "VAL-PR-014", paths.finalPacketIndex, `${change} 不存在于 final-packet-index.json。`);
    return { invalid: true };
  }

  const packetRow = asObject(packet);
  const packetRelPath =
    strip(packetRow["packet-path"]) ||
    strip(preconditions["canonical-change-packet"]) ||
    path.join("openspec", "orchestrate", "change-capability-anchors", change, `${change}.md`);
  const directIds = asArray(packetRow["direct-atom-ids"]).map(strip).filter(Boolean);
  const invalidDirectIds = directIds.filter((id) => !/^GA-\d{4}$/u.test(id));
  for (const atomId of invalidDirectIds) {
    addIssue(issues, "error", "VAL-PR-014", paths.finalPacketIndex, `direct-atom-ids 包含非法 GA ID：${atomId}。`);
  }

  const mappingRows = new Map();
  for (const row of asArray(mapping.rows)) {
    const item = asObject(row);
    const atomId = strip(item["global-atom-id"]);
    if (atomId) {
      mappingRows.set(atomId, item);
    }
  }
  const mappingDirectIds = [];
  for (const [atomId, row] of mappingRows.entries()) {
    if (strip(row["final-owner-change"]) === change && strip(row["final-relation"]) === "direct") {
      mappingDirectIds.push(atomId);
    }
  }
  compareIdSets(
    directIds,
    mappingDirectIds,
    "VAL-PR-015",
    paths.atomPlanMapping,
    "atom-plan-mapping.json direct ownership 必须与 final-packet-index.json direct-atom-ids 一致",
    issues,
  );

  const globalRows = new Map();
  for (const row of asArray(globalIndex["global-atoms"])) {
    const item = asObject(row);
    const atomId = strip(item["global-atom-id"]);
    if (atomId) {
      globalRows.set(atomId, item);
    }
  }

  const packetRows = new Map();
  for (const atomId of directIds) {
    const globalRow = globalRows.get(atomId);
    const mappingRow = mappingRows.get(atomId);
    if (!globalRow) {
      addIssue(issues, "error", "VAL-PR-016", paths.globalIndex, `${atomId} 不存在于 obligation-atom-index.json。`);
      continue;
    }
    if (!mappingRow) {
      addIssue(issues, "error", "VAL-PR-015", paths.atomPlanMapping, `${atomId} 不存在于 atom-plan-mapping.json。`);
      continue;
    }
    packetRows.set(atomId, {
      "global-atom-id": atomId,
      "source-document": strip(globalRow["source-document"]),
      lines: strip(globalRow.lines),
      "atom-type": strip(globalRow["atom-type"]),
      "source-fact": strip(globalRow["source-fact"]),
      normativity: strip(globalRow.normativity),
      "artifact-projection": strip(mappingRow["final-artifact-projection"]) || strip(globalRow["artifact-projection"]),
      "owner-capability": strip(mappingRow["final-owner-capability"]) || strip(globalRow["owner-capability"]),
      "atom-relation": strip(mappingRow["final-relation"]) || strip(globalRow["atom-relation"]),
      "propose-use": strip(globalRow["propose-use"]),
      "evidence-need": strip(globalRow["evidence-need"]),
    });
  }

  validateFinalPacketMarkdownMirror(root, packetRelPath, packetRows, packetRow, issues);
  return { packetRows };
}

function validateSourceAlignedJsonBasics(data, relPath, expectedSchema, issues) {
  validateKebabKeys(data, relPath, issues);
  if (data["trace-schema"] !== expectedSchema) {
    addIssue(issues, "error", "VAL-PR-012", relPath, `trace-schema 必须为 ${expectedSchema}。`);
  }
  if (data["trace-contract-version"] !== SOURCE_ALIGNED_TRACE_CONTRACT) {
    addIssue(issues, "error", "VAL-PR-013", relPath, `trace-contract-version 必须为 ${SOURCE_ALIGNED_TRACE_CONTRACT}。`);
  }
}

function validateSourceAlignedManifest(root, manifest, paths, fullPaths, issues, phase5TraceStatus = "") {
  const phase5Status = sourceAlignedPhaseStatus(manifest["phase-statuses"]);
  if (phase5Status && !["accepted", "adjusted"].includes(phase5Status)) {
    addIssue(issues, "error", "VAL-PR-013", paths.manifest, `Phase 5 status 必须为 accepted 或 adjusted，实际为 ${phase5Status}。`);
  }
  if (phase5Status && phase5TraceStatus && phase5Status !== phase5TraceStatus) {
    addIssue(
      issues,
      "error",
      "VAL-PR-013",
      paths.manifest,
      `manifest phase-statuses.phase-5 必须与 trace/phase-5.trace.json status 一致：manifest=${phase5Status}，trace=${phase5TraceStatus}。`,
    );
  }
  const artifacts = asArray(manifest.artifacts);
  for (const fullPath of Object.values(fullPaths)) {
    const relPath = path.relative(root, fullPath).split(path.sep).join("/");
    const entry = artifacts.find((item) => strip(asObject(item)["trace-path"]) === relPath);
    const digest = strip(asObject(entry).sha256);
    if (entry && digest) {
      const current = sha256FileCompat(fullPath);
      if (digest !== current.hex && digest !== current.prefixed) {
        addIssue(issues, "error", "VAL-PR-013", paths.manifest, `${relPath} 的 sha256 与实际文件不一致。`);
      }
    }
  }
}

function sourceAlignedPhaseStatus(phaseStatuses) {
  const phase5 = asObject(phaseStatuses)["phase-5"];
  if (typeof phase5 === "string") {
    return strip(phase5);
  }
  const phase5Object = asObject(phase5);
  return strip(phase5Object.status || phase5Object.decision);
}

function validateSourceAlignedPhase5Trace(root, manifestRelPath, issues) {
  const fullPath = path.join(root, "openspec", "orchestrate", "trace", "phase-5.trace.json");
  if (!fs.existsSync(fullPath)) {
    return;
  }
  const trace = readJson(fullPath, root, issues);
  if (!trace) {
    return;
  }
  const relPath = path.relative(root, fullPath).split(path.sep).join("/");
  validateKebabKeys(trace, relPath, issues);
  if (trace["trace-schema"] !== SOURCE_ALIGNED_PHASE_5_SCHEMA) {
    addIssue(issues, "error", "VAL-PR-012", relPath, `trace-schema 必须为 ${SOURCE_ALIGNED_PHASE_5_SCHEMA}。`);
  }
  if (trace["trace-contract-version"] !== SOURCE_ALIGNED_TRACE_CONTRACT) {
    addIssue(issues, "error", "VAL-PR-013", relPath, `trace-contract-version 必须为 ${SOURCE_ALIGNED_TRACE_CONTRACT}。`);
  }
  const status = strip(trace.status);
  if (status && !["accepted", "adjusted"].includes(status)) {
    addIssue(issues, "error", "VAL-PR-013", manifestRelPath, `Phase 5 status 必须为 accepted 或 adjusted，实际为 ${status}。`);
  }
  return status;
}

function validateFinalPacketMarkdownMirror(root, packetRelPath, packetRows, packetIndexRow, issues) {
  const fullPath = path.isAbsolute(packetRelPath) ? packetRelPath : path.join(root, packetRelPath);
  if (!fs.existsSync(fullPath)) {
    addIssue(issues, "error", "VAL-PR-001", packetRelPath, `缺少 canonical change packet：${packetRelPath}。`);
    return;
  }
  const packetText = fs.readFileSync(fullPath, "utf8");
  const digest = strip(packetIndexRow["packet-digest"]);
  if (digest) {
    const current = sha256FileCompat(fullPath);
    if (digest !== current.hex && digest !== current.prefixed) {
      addIssue(issues, "error", "VAL-PR-017", packetRelPath, "final packet Markdown digest 与 final-packet-index.json 不一致。");
    }
  }
  for (const atomId of packetRows.keys()) {
    if (!packetText.includes(atomId)) {
      addIssue(issues, "error", "VAL-PR-017", packetRelPath, `final packet Markdown 未包含 direct atom ${atomId}。`);
    }
  }

  const markdownRows = parseFinalPacketDirectAtomsBestEffort(packetText);
  if (!markdownRows) {
    return;
  }
  compareIdSets(
    [...packetRows.keys()],
    [...markdownRows.keys()],
    "VAL-PR-005",
    packetRelPath,
    "final packet Markdown direct atom mirror 必须与 source-aligned JSON handoff direct atom 集合一致",
    issues,
  );
  for (const [atomId, expectedRow] of packetRows.entries()) {
    const markdownRow = markdownRows.get(atomId);
    if (markdownRow) {
      compareProposalAuthorityFields(
        atomId,
        expectedRow,
        markdownRow,
        "VAL-PR-006",
        `${packetRelPath}#${atomId}`,
        "final packet Markdown mirror",
        issues,
      );
    }
  }
}

function parseFinalPacketDirectAtomsBestEffort(text) {
  const table = getTableAfterMarkdownHeading(text, "## Final Direct Owner Atoms");
  if (!table) {
    return null;
  }
  const required = [
    "Global Atom ID",
    "Source Document",
    "Lines",
    "Atom Type",
    "Source Fact",
    "Normativity",
    "Artifact Projection",
    "Owner Capability",
    "Atom Relation",
    "Propose Use",
    "Evidence Need",
  ];
  const indexes = {};
  for (const requiredColumn of required) {
    const found = table.headers.findIndex((header) => normalizeHeader(header) === normalizeHeader(requiredColumn));
    if (found < 0) {
      return null;
    }
    indexes[requiredColumn] = found;
  }
  const rows = new Map();
  for (const row of table.rows) {
    const ids = idsFromValue(row.cells[indexes["Global Atom ID"]], GA_ID_RE);
    if (ids.length !== 1) {
      continue;
    }
    rows.set(ids[0], {
      "global-atom-id": ids[0],
      "source-document": strip(row.cells[indexes["Source Document"]]),
      lines: strip(row.cells[indexes["Lines"]]),
      "atom-type": strip(row.cells[indexes["Atom Type"]]),
      "source-fact": strip(row.cells[indexes["Source Fact"]]),
      normativity: strip(row.cells[indexes["Normativity"]]),
      "artifact-projection": strip(row.cells[indexes["Artifact Projection"]]),
      "owner-capability": strip(row.cells[indexes["Owner Capability"]]),
      "atom-relation": strip(row.cells[indexes["Atom Relation"]]),
      "propose-use": strip(row.cells[indexes["Propose Use"]]),
      "evidence-need": strip(row.cells[indexes["Evidence Need"]]),
    });
  }
  return rows;
}

function sha256FileCompat(fullPath) {
  const hex = crypto.createHash("sha256").update(fs.readFileSync(fullPath)).digest("hex");
  return { hex, prefixed: `sha256-${hex}` };
}

function parseFinalPacketDirectAtoms(text, relPath, issues) {
  const table = getTableAfterMarkdownHeading(text, "## Final Direct Owner Atoms");
  if (!table) {
    addIssue(issues, "error", "VAL-PR-003", relPath, "final change packet 缺少 Final Direct Owner Atoms 表。");
    return new Map();
  }
  const required = [
    "Global Atom ID",
    "Source Document",
    "Lines",
    "Atom Type",
    "Source Fact",
    "Normativity",
    "Artifact Projection",
    "Owner Capability",
    "Atom Relation",
    "Propose Use",
    "Evidence Need",
  ];
  const indexes = requireColumns(table, required, relPath, "VAL-PR-003", issues);
  if (!indexes) {
    return new Map();
  }

  const rows = new Map();
  for (const row of table.rows) {
    const ids = idsFromValue(row.cells[indexes["Global Atom ID"]], GA_ID_RE);
    if (ids.length !== 1) {
      addIssue(issues, "error", "VAL-PR-004", `${relPath}:${row.line}`, "Final Direct Owner Atoms 每行必须包含一个 exact GA ID。");
      continue;
    }
    const globalAtomId = ids[0];
    if (rows.has(globalAtomId)) {
      addIssue(issues, "error", "VAL-PR-004", `${relPath}:${row.line}`, `${globalAtomId} 在 Final Direct Owner Atoms 中重复。`);
    }
    rows.set(globalAtomId, {
      "global-atom-id": globalAtomId,
      "source-document": strip(row.cells[indexes["Source Document"]]),
      lines: strip(row.cells[indexes["Lines"]]),
      "atom-type": strip(row.cells[indexes["Atom Type"]]),
      "source-fact": strip(row.cells[indexes["Source Fact"]]),
      normativity: strip(row.cells[indexes["Normativity"]]),
      "artifact-projection": strip(row.cells[indexes["Artifact Projection"]]),
      "owner-capability": strip(row.cells[indexes["Owner Capability"]]),
      "atom-relation": strip(row.cells[indexes["Atom Relation"]]),
      "propose-use": strip(row.cells[indexes["Propose Use"]]),
      "evidence-need": strip(row.cells[indexes["Evidence Need"]]),
    });
  }
  return rows;
}

function parseGlobalAtomIndex(text, relPath, issues) {
  const table = getFirstMarkdownTableWithHeader(text, "Global Atom ID");
  if (!table) {
    addIssue(issues, "error", "VAL-PR-003", relPath, "global atom index 缺少 Global Atom ID 表。");
    return new Map();
  }
  const required = [
    "Global Atom ID",
    "Source Document",
    "Lines",
    "Atom Type",
    "Source Fact",
    "Normativity",
    "Artifact Projection",
    "Owner Capability",
    "Atom Relation",
    "Propose Use",
    "Evidence Need",
  ];
  const indexes = requireColumns(table, required, relPath, "VAL-PR-003", issues);
  if (!indexes) {
    return new Map();
  }

  const rows = new Map();
  for (const row of table.rows) {
    const ids = idsFromValue(row.cells[indexes["Global Atom ID"]], GA_ID_RE);
    if (ids.length !== 1) {
      continue;
    }
    const globalAtomId = ids[0];
    rows.set(globalAtomId, {
      "global-atom-id": globalAtomId,
      "source-document": strip(row.cells[indexes["Source Document"]]),
      lines: strip(row.cells[indexes["Lines"]]),
      "atom-type": strip(row.cells[indexes["Atom Type"]]),
      "source-fact": strip(row.cells[indexes["Source Fact"]]),
      normativity: strip(row.cells[indexes["Normativity"]]),
      "artifact-projection": strip(row.cells[indexes["Artifact Projection"]]),
      "owner-capability": strip(row.cells[indexes["Owner Capability"]]),
      "atom-relation": strip(row.cells[indexes["Atom Relation"]]),
      "propose-use": strip(row.cells[indexes["Propose Use"]]),
      "evidence-need": strip(row.cells[indexes["Evidence Need"]]),
    });
  }
  return rows;
}

function parseProposalRegister(proposal, issues) {
  const rows = new Map();
  const requiredFields = [
    "source-document",
    "lines",
    "atom-type",
    "source-fact",
    "normativity",
    "artifact-projection",
    "projection-source",
    "owner-capability",
    "atom-relation",
    "propose-use",
    "evidence-need",
    "downstream-coverage-expectation",
  ];
  for (const [index, row] of asArray(proposal["change-atom-coverage-register"]).entries()) {
    const ids = idsFromValue(row["global-atom-id"], GA_ID_RE);
    if (ids.length !== 1) {
      continue;
    }
    const globalAtomId = ids[0];
    if (rows.has(globalAtomId)) {
      addIssue(issues, "error", "VAL-PR-004", traceRef("proposal", "change-atom-coverage-register", index), `${globalAtomId} 在 proposal register 中重复。`);
    }
    for (const field of requiredFields) {
      if (!strip(row[field])) {
        addIssue(issues, "error", "VAL-PR-004", traceRef("proposal", "change-atom-coverage-register", index), `${globalAtomId} 缺少必填字段 ${field}。`);
      }
    }
    rows.set(globalAtomId, row);
  }
  return rows;
}

function compareProposalAuthorityFields(globalAtomId, expected, actual, ruleId, ref, label, issues) {
  const fields = [
    "source-document",
    "lines",
    "atom-type",
    "source-fact",
    "normativity",
    "artifact-projection",
    "owner-capability",
    "atom-relation",
    "propose-use",
    "evidence-need",
  ];
  for (const field of fields) {
    const expectedValue = normalizeTraceComparable(expected[field]);
    const actualValue = normalizeTraceComparable(actual[field]);
    if (expectedValue && actualValue && expectedValue !== actualValue) {
      addIssue(issues, "error", ruleId, ref, `${label} 中 ${globalAtomId} 的 ${field} 与 final packet 不一致：应为 "${expectedValue}"，实际为 "${actualValue}"。`);
    }
  }
}

function validateProposalSourceWindowReadSet(proposal, packetRows, issues) {
  const rows = asArray(proposal["source-window-read-set"]);
  const readRows = new Map();
  for (const [index, row] of rows.entries()) {
    const ids = idsFromValue(row["global-atom-id"], GA_ID_RE);
    const ref = traceRef("proposal", "source-window-read-set", index);
    if (ids.length !== 1) {
      addIssue(issues, "error", "VAL-PR-009", ref, "source-window-read-set 每行必须包含一个 exact GA ID。");
      continue;
    }
    const globalAtomId = ids[0];
    if (readRows.has(globalAtomId)) {
      addIssue(issues, "error", "VAL-PR-009", ref, `${globalAtomId} 在 source-window-read-set 中重复。`);
    }
    readRows.set(globalAtomId, row);

    const packetRow = packetRows.get(globalAtomId);
    if (!packetRow) {
      continue;
    }
    const sourceDocument = normalizeTraceComparable(row["source-document"]);
    const lineRange = normalizeTraceComparable(row["line-range"] ?? row.lines);
    const interpretation = normalizeTraceComparable(row["interpretation-result"]);
    if (sourceDocument && sourceDocument !== normalizeTraceComparable(packetRow["source-document"])) {
      addIssue(issues, "error", "VAL-PR-009", ref, `${globalAtomId} 的 source-document 与 final packet 不一致。`);
    }
    if (lineRange && lineRange !== normalizeTraceComparable(packetRow.lines)) {
      addIssue(issues, "error", "VAL-PR-009", ref, `${globalAtomId} 的 line-range 与 final packet 不一致。`);
    }
    if (interpretation && interpretation !== normalizeTraceComparable(packetRow["source-fact"])) {
      addIssue(issues, "error", "VAL-PR-009", ref, `${globalAtomId} 的 interpretation-result 与 final packet source fact 不一致。`);
    }
  }
  compareIdSets(
    [...packetRows.keys()],
    [...readRows.keys()],
    "VAL-PR-009",
    "trace/proposal.trace.json#/source-window-read-set",
    "source-window-read-set 必须覆盖每个 final packet direct atom",
    issues,
  );
}

function validateProposalProductionSourceCoverage(proposal, packetRows, issues) {
  const sourceCoverageRows = asArray(proposal["production-source-coverage"]);
  const covered = new Set();
  for (const [index, row] of sourceCoverageRows.entries()) {
    const ref = traceRef("proposal", "production-source-coverage", index);
    const ids = idsFromValue(row["global-atom-ids"], GA_ID_RE);
    for (const id of ids) {
      covered.add(id);
      if (!packetRows.has(id)) {
        addIssue(issues, "error", "VAL-PR-011", ref, `${id} 不属于 final packet direct atoms。`);
      }
    }
    const atomCount = Number(row["atom-count"]);
    if (Number.isFinite(atomCount) && atomCount !== ids.length) {
      addIssue(issues, "error", "VAL-PR-011", ref, `atom-count 必须等于 global-atom-ids 数量 ${ids.length}。`);
    }
  }
  compareIdSets(
    [...packetRows.keys()],
    [...covered],
    "VAL-PR-011",
    "trace/proposal.trace.json#/production-source-coverage",
    "production-source-coverage 必须覆盖每个 final packet direct atom",
    issues,
  );
}

function validateProposalAlignmentGate(proposal, packetRows, issues) {
  const gate = asObject(proposal["proposal-alignment-gate"]);
  const directAtoms = asObject(gate["direct-atoms"]);
  const gateIds = idsFromValue(directAtoms.ids, GA_ID_RE);
  compareIdSets(
    [...packetRows.keys()],
    gateIds,
    "VAL-PR-010",
    "trace/proposal.trace.json#/proposal-alignment-gate/direct-atoms",
    "proposal alignment gate direct-atoms 必须与 final packet direct atoms 一致",
    issues,
  );
  const gateCount = Number(directAtoms.count);
  if (Number.isFinite(gateCount) && gateCount !== gateIds.length) {
    addIssue(issues, "error", "VAL-PR-010", "trace/proposal.trace.json#/proposal-alignment-gate/direct-atoms", `direct-atoms.count 必须等于 ids 数量 ${gateIds.length}。`);
  }
}

function validateProposalDeliveryPlaneLeakage(proposalFile, issues) {
  if (!proposalFile) {
    return;
  }
  const forbidden = /Direct atoms|Projection mix|Global Atoms:|Final Direct Owner Atoms|change-atom-coverage-register/iu;
  if (forbidden.test(proposalFile.text)) {
    addIssue(issues, "error", "VAL-PR-012", proposalFile.repoRelPath, "proposal Delivery Plane 不得泄漏 exhaustive GA coverage/register/projection 内容。");
  }
  const bodyBeforeTrace = proposalFile.text.split(/\n## Trace Appendix\b/u, 1)[0] ?? proposalFile.text;
  const gaIds = unique(bodyBeforeTrace.match(GA_ID_RE) ?? []);
  if (gaIds.length > 5) {
    addIssue(issues, "error", "VAL-PR-012", proposalFile.repoRelPath, "proposal Delivery Plane 不得包含大量 GA coverage 列表；完整覆盖应只写入 JSON trace。");
  }
}

function validateObligationSpecsTraceProjection(trace, registeredRows, files, issues) {
  const requiredSpecProjectionIds = [...registeredRows.entries()]
    .filter(([, row]) => ["spec-requirement", "spec-guard"].includes(strip(row["artifact-projection"])))
    .map(([globalAtomId]) => globalAtomId);
  const coveredSpecProjectionIds = new Set();
  let sawSpecsTrace = false;

  for (const [key, data] of trace.entries()) {
    if (!key.startsWith("specs:")) {
      continue;
    }
    sawSpecsTrace = true;
    const specFile = files?.byArtifact?.get(key);
    const anchors = specFile ? parseSpecMarkdownAnchors(specFile, issues) : null;
    for (const [index, row] of asArray(data["requirement-source-trace"]).entries()) {
      const ref = `${key}#/requirement-source-trace/${index}`;
      const ids = idsFromValue(row["global-atom-id"] ?? row["atom-id"] ?? row["source-item-id"], GA_ID_RE);
      if (ids.length !== 1) {
        addIssue(issues, "error", "VAL-SP-001", ref, "requirement-source-trace 每行必须包含一个 exact GA ID。");
        continue;
      }
      const globalAtomId = ids[0];
      const proposalRow = registeredRows.get(globalAtomId);
      if (!proposalRow) {
        continue;
      }
      validateSpecsTraceSourceFields(globalAtomId, proposalRow, row, ref, issues);
      validateSpecsTraceMarkdownAnchor(row, specFile, anchors, ref, issues);

      const proposalProjection = strip(proposalRow["artifact-projection"]);
      const sourceProjection = strip(row["source-projection"] ?? row["artifact-projection"] ?? row["projection"]);
      if (sourceProjection && sourceProjection !== proposalProjection) {
        addIssue(issues, "error", "VAL-SP-002", ref, `${globalAtomId} source-projection 必须保留 proposal projection ${proposalProjection}。`);
      }
      const effectiveProjection = sourceProjection || proposalProjection;
      const handling = strip(row["spec-handling"]);
      if (!SPEC_HANDLINGS.has(handling)) {
        addIssue(issues, "error", "VAL-SP-003", ref, `spec-handling 非法或缺失：${handling || "(empty)"}。`);
        continue;
      }

      if (effectiveProjection === "spec-requirement" && handling !== "direct-spec-requirement") {
        addIssue(issues, "error", "VAL-SP-004", ref, `${globalAtomId} 是 spec-requirement，spec-handling 必须为 direct-spec-requirement。`);
      } else if (effectiveProjection === "spec-guard" && handling !== "direct-spec-guard") {
        addIssue(issues, "error", "VAL-SP-005", ref, `${globalAtomId} 是 spec-guard，spec-handling 必须为 direct-spec-guard。`);
      } else if (effectiveProjection === "spec-requirement" || effectiveProjection === "spec-guard") {
        coveredSpecProjectionIds.add(globalAtomId);
        // Correct direct spec projections are fully validated by the handling checks above.
        continue;
      } else if (effectiveProjection === "design-obligation") {
        if (!DERIVED_SPEC_HANDLINGS.has(handling)) {
          addIssue(issues, "error", "VAL-SP-006", ref, `${globalAtomId} 是 design-obligation，写入 specs 时必须使用 derived-capability-contract-* handling。`);
        }
        if (!strip(row["derivation-reason"])) {
          addIssue(issues, "error", "VAL-SP-007", ref, `${globalAtomId} 派生 specs 时必须记录 derivation-reason。`);
        }
        if (!strip(row["no-scope-expansion-check"])) {
          addIssue(issues, "error", "VAL-SP-008", ref, `${globalAtomId} 派生 specs 时必须记录 no-scope-expansion-check。`);
        }
      } else if (effectiveProjection === "verification-obligation") {
        addIssue(issues, "error", "VAL-SP-009", ref, `${globalAtomId} 是 verification-obligation，不得直接写入 requirement-source-trace。`);
      } else {
        addIssue(issues, "error", "VAL-SP-010", ref, `${globalAtomId} projection ${effectiveProjection || "(empty)"} 不能写入 specs requirement-source-trace。`);
      }
    }
  }
  if (sawSpecsTrace) {
    compareIdSets(
      requiredSpecProjectionIds,
      [...coveredSpecProjectionIds],
      "VAL-SP-011",
      "trace/specs/**/*.trace.json#/requirement-source-trace",
      "spec-requirement/spec-guard direct atoms 必须全部落到 specs requirement-source-trace",
      issues,
    );
  }
}

function validateSpecsTraceSourceFields(globalAtomId, proposalRow, row, ref, issues) {
  for (const field of ["source-document", "lines", "source-fact"]) {
    const expectedValue = normalizeTraceComparable(proposalRow[field]);
    const actualValue = normalizeTraceComparable(row[field]);
    if (!actualValue) {
      addIssue(issues, "error", "VAL-SP-012", ref, `${globalAtomId} requirement-source-trace 缺少 ${field}。`);
    } else if (expectedValue && actualValue !== expectedValue) {
      addIssue(
        issues,
        "error",
        "VAL-SP-012",
        ref,
        `${globalAtomId} requirement-source-trace 的 ${field} 与 proposal register 不一致：应为 "${expectedValue}"，实际为 "${actualValue}"。`,
      );
    }
  }
}

function validateSpecsTraceMarkdownAnchor(row, specFile, anchors, ref, issues) {
  const requirement = strip(row.requirement);
  const scenario = strip(row.scenario);
  if (!specFile) {
    addIssue(issues, "error", "VAL-SP-013", ref, "requirement-source-trace 缺少对应 specs Markdown artifact。");
    return;
  }
  if (!requirement || !scenario) {
    addIssue(issues, "error", "VAL-SP-013", ref, "requirement-source-trace 必须同时填写 requirement 和 scenario。");
    return;
  }
  if (!anchors.requirements.has(requirement)) {
    addIssue(issues, "error", "VAL-SP-013", ref, `Requirement 不存在于 ${specFile.relPath}：${requirement}。`);
    return;
  }
  if (!anchors.scenarios.has(specScenarioKey(requirement, scenario))) {
    addIssue(issues, "error", "VAL-SP-013", ref, `Scenario 不存在于 ${specFile.relPath} 的 Requirement "${requirement}" 下：${scenario}。`);
  }
}

function parseSpecMarkdownAnchors(file, issues) {
  const requirements = new Map();
  const scenarios = new Set();
  let currentRequirement = null;
  for (let index = 0; index < file.lines.length; index += 1) {
    const line = file.lines[index];
    const requirementMatch = line.match(/^### Requirement:\s*(.+?)\s*$/u);
    if (requirementMatch) {
      currentRequirement = strip(requirementMatch[1]);
      if (requirements.has(currentRequirement)) {
        addIssue(issues, "error", "VAL-SP-014", `${file.repoRelPath}:${index + 1}`, `Requirement 重复：${currentRequirement}。`);
      }
      requirements.set(currentRequirement, { line: index + 1, scenarioCount: 0 });
      continue;
    }
    const scenarioMatch = line.match(/^#### Scenario:\s*(.+?)\s*$/u);
    if (scenarioMatch) {
      const scenario = strip(scenarioMatch[1]);
      if (!currentRequirement) {
        addIssue(issues, "error", "VAL-SP-014", `${file.repoRelPath}:${index + 1}`, `Scenario 缺少所属 Requirement：${scenario}。`);
        continue;
      }
      const key = specScenarioKey(currentRequirement, scenario);
      if (scenarios.has(key)) {
        addIssue(issues, "error", "VAL-SP-014", `${file.repoRelPath}:${index + 1}`, `Scenario 重复：${scenario}。`);
      }
      scenarios.add(key);
      requirements.get(currentRequirement).scenarioCount += 1;
    }
  }
  if (requirements.size === 0) {
    addIssue(issues, "error", "VAL-SP-014", file.repoRelPath, "spec artifact 必须至少包含一个 Requirement。");
  }
  for (const [requirement, meta] of requirements.entries()) {
    if (meta.scenarioCount === 0) {
      addIssue(issues, "error", "VAL-SP-014", `${file.repoRelPath}:${meta.line}`, `Requirement 必须至少包含一个 Scenario：${requirement}。`);
    }
  }
  return { requirements, scenarios };
}

function specScenarioKey(requirement, scenario) {
  return `${requirement}\u0000${scenario}`;
}

function validateDesignTrace(design, designFile, tracePlane, registeredRows, issues) {
  if (!design) {
    return;
  }

  const productionSourceRows = parseDesignProductionSourceMap(design, issues);
  compareIdSets(
    [...registeredRows.keys()],
    [...productionSourceRows.keys()],
    "VAL-DG-001",
    "trace/design.trace.json#/production-source-map",
    "design production-source-map 必须与 proposal register direct atom 集合一致",
    issues,
  );

  validateDesignSourceFields(productionSourceRows, registeredRows, issues);
  validateDesignSpecTraceAnchors(productionSourceRows, tracePlane, issues);
  validateDesignDecisionAnchors(design, designFile, issues);
  validateDesignObligationMatrix(design, productionSourceRows, issues);
  validateDesignImplementationPlacements(design, issues);
  validateDesignAlignmentGate(design, productionSourceRows, issues);
}

function parseDesignProductionSourceMap(design, issues) {
  const rows = new Map();
  for (const [index, row] of asArray(design["production-source-map"]).entries()) {
    const ref = traceRef("design", "production-source-map", index);
    const ids = idsFromValue(row["global-atom-id"], GA_ID_RE);
    if (ids.length !== 1) {
      addIssue(issues, "error", "VAL-DG-001", ref, "production-source-map 每行必须包含一个 exact GA ID。");
      continue;
    }
    const globalAtomId = ids[0];
    if (rows.has(globalAtomId)) {
      addIssue(issues, "error", "VAL-DG-001", ref, `${globalAtomId} 在 production-source-map 中重复。`);
    }
    rows.set(globalAtomId, { row, index });
  }
  return rows;
}

function validateDesignSourceFields(productionSourceRows, registeredRows, issues) {
  const fields = [
    ["source-document", "source-document"],
    ["lines", "lines"],
    ["atom-type", "atom-type"],
    ["source-fact", "source-fact"],
    ["normativity", "normativity"],
    ["artifact-projection", "artifact-projection"],
    ["capability", "owner-capability"],
  ];

  for (const [globalAtomId, { row, index }] of productionSourceRows.entries()) {
    const proposalRow = registeredRows.get(globalAtomId);
    if (!proposalRow) {
      continue;
    }
    const ref = traceRef("design", "production-source-map", index);
    for (const [designField, proposalField] of fields) {
      const expectedValue = normalizeTraceComparable(proposalRow[proposalField] ?? proposalRow[designField]);
      const actualValue = normalizeTraceComparable(row[designField]);
      if (expectedValue && !actualValue) {
        addIssue(issues, "error", "VAL-DG-002", ref, `${globalAtomId} production-source-map 缺少 ${designField}。`);
      } else if (expectedValue && actualValue !== expectedValue) {
        addIssue(
          issues,
          "error",
          "VAL-DG-002",
          ref,
          `${globalAtomId} production-source-map 的 ${designField} 与 proposal register 不一致：应为 "${expectedValue}"，实际为 "${actualValue}"。`,
        );
      }
    }
  }
}

function validateDesignSpecTraceAnchors(productionSourceRows, tracePlane, issues) {
  for (const [globalAtomId, { row, index }] of productionSourceRows.entries()) {
    const projection = strip(row["artifact-projection"]);
    const anchors = asArray(row["spec-trace-anchors"]);
    if (["spec-requirement", "spec-guard"].includes(projection) && anchors.length === 0) {
      addIssue(
        issues,
        "error",
        "VAL-DG-003",
        traceRef("design", "production-source-map", index),
        `${globalAtomId} 是 ${projection}，design spec-trace-anchors 至少需要一个 specs trace anchor。`,
      );
    }

    for (const [anchorIndex, anchor] of anchors.entries()) {
      const ref = `trace/design.trace.json#/production-source-map/${index}/spec-trace-anchors/${anchorIndex}`;
      const tracePath = strip(anchor["trace-path"]);
      const tracePointer = strip(anchor["trace-pointer"]);
      const specTrace = tracePlane.get(specKeyFromTracePath(tracePath));
      if (!tracePath || !specTrace) {
        addIssue(issues, "error", "VAL-DG-003", ref, `${globalAtomId} spec-trace-anchor 引用不存在的 specs trace：${tracePath || "(empty)"}。`);
        continue;
      }
      const pointerMatch = tracePointer.match(/^#\/requirement-source-trace\/(\d+)$/u);
      if (!pointerMatch) {
        addIssue(issues, "error", "VAL-DG-003", ref, `${globalAtomId} spec-trace-anchor trace-pointer 非法：${tracePointer || "(empty)"}。`);
        continue;
      }
      const targetIndex = Number(pointerMatch[1]);
      const targetRow = asArray(specTrace["requirement-source-trace"])[targetIndex];
      if (!targetRow) {
        addIssue(issues, "error", "VAL-DG-003", ref, `${globalAtomId} spec-trace-anchor 指向不存在的 requirement-source-trace row：${tracePointer}。`);
        continue;
      }

      const targetIds = idsFromValue(targetRow["global-atom-id"] ?? targetRow["atom-id"] ?? targetRow["source-item-id"], GA_ID_RE);
      if (!targetIds.includes(globalAtomId)) {
        addIssue(issues, "error", "VAL-DG-003", ref, `${globalAtomId} spec-trace-anchor 指向的 specs row 未引用同一个 GA。`);
      }
      compareDesignAnchorField(globalAtomId, anchor, targetRow, "requirement", "requirement", ref, issues);
      compareDesignAnchorField(globalAtomId, anchor, targetRow, "scenario", "scenario", ref, issues);
      compareDesignAnchorField(globalAtomId, anchor, targetRow, "spec-handling", "spec-handling", ref, issues);

      const expectedProjection = normalizeTraceComparable(
        targetRow["source-projection"] ?? targetRow["artifact-projection"] ?? targetRow.projection,
      );
      const actualProjection = normalizeTraceComparable(anchor["source-projection"]);
      if (expectedProjection && !actualProjection) {
        addIssue(issues, "error", "VAL-DG-003", ref, `${globalAtomId} spec-trace-anchor 缺少 source-projection。`);
      } else if (expectedProjection && actualProjection !== expectedProjection) {
        addIssue(
          issues,
          "error",
          "VAL-DG-003",
          ref,
          `${globalAtomId} spec-trace-anchor 的 source-projection 与 specs trace 不一致：应为 "${expectedProjection}"，实际为 "${actualProjection}"。`,
        );
      }
    }
  }
}

function compareDesignAnchorField(globalAtomId, anchor, targetRow, anchorField, targetField, ref, issues) {
  const expectedValue = normalizeTraceComparable(targetRow[targetField]);
  const actualValue = normalizeTraceComparable(anchor[anchorField]);
  if (expectedValue && !actualValue) {
    addIssue(issues, "error", "VAL-DG-003", ref, `${globalAtomId} spec-trace-anchor 缺少 ${anchorField}。`);
  } else if (expectedValue && actualValue !== expectedValue) {
    addIssue(
      issues,
      "error",
      "VAL-DG-003",
      ref,
      `${globalAtomId} spec-trace-anchor 的 ${anchorField} 与 specs trace 不一致：应为 "${expectedValue}"，实际为 "${actualValue}"。`,
    );
  }
}

function validateDesignDecisionAnchors(design, designFile, issues) {
  const markdownDecisionIds = parseDesignMarkdownDecisionIds(designFile, issues);
  const indexDecisionIds = parseDesignDecisionIndexIds(design, issues);
  const referencedDecisionIds = new Set(collectIds(design, D_ID_RE).map((ref) => ref.id));

  compareIdSets(
    [...markdownDecisionIds],
    [...indexDecisionIds],
    "VAL-DG-004",
    "trace/design.trace.json#/design-decision-index",
    "design-decision-index 必须与 design.md D decisions 一致",
    issues,
  );

  for (const decisionId of referencedDecisionIds) {
    if (!markdownDecisionIds.has(decisionId)) {
      addIssue(issues, "error", "VAL-DG-004", "trace/design.trace.json", `${decisionId} 未锚定到 design.md 的 ### ${decisionId} decision。`);
    }
    if (!indexDecisionIds.has(decisionId)) {
      addIssue(issues, "error", "VAL-DG-004", "trace/design.trace.json#/design-decision-index", `${decisionId} 未登记到 design-decision-index。`);
    }
  }
}

function parseDesignMarkdownDecisionIds(designFile, issues) {
  const ids = new Set();
  if (!designFile) {
    addIssue(issues, "error", "VAL-DG-004", "design.md", "design trace 缺少对应 design.md artifact。");
    return ids;
  }
  for (let index = 0; index < designFile.lines.length; index += 1) {
    const match = designFile.lines[index].match(/^###\s+(D-\d{3})\b/u);
    if (!match) {
      continue;
    }
    if (ids.has(match[1])) {
      addIssue(issues, "error", "VAL-DG-004", `${designFile.repoRelPath}:${index + 1}`, `${match[1]} 在 design.md 中重复。`);
    }
    ids.add(match[1]);
  }
  return ids;
}

function parseDesignDecisionIndexIds(design, issues) {
  const ids = new Set();
  for (const [index, row] of asArray(design["design-decision-index"]).entries()) {
    const ref = traceRef("design", "design-decision-index", index);
    const rowIds = idsFromValue(row["decision-id"], D_ID_RE);
    if (rowIds.length !== 1) {
      addIssue(issues, "error", "VAL-DG-004", ref, "design-decision-index 每行必须包含一个 exact D ID。");
      continue;
    }
    if (ids.has(rowIds[0])) {
      addIssue(issues, "error", "VAL-DG-004", ref, `${rowIds[0]} 在 design-decision-index 中重复。`);
    }
    ids.add(rowIds[0]);
  }
  return ids;
}

function validateDesignObligationMatrix(design, productionSourceRows, issues) {
  const matrixIds = new Map();
  for (const [index, row] of asArray(design["design-obligation-matrix"]).entries()) {
    const ids = idsFromValue(row["global-atom-id"] ?? row.item, GA_ID_RE);
    if (ids.length === 0) {
      continue;
    }
    const ref = traceRef("design", "design-obligation-matrix", index);
    if (ids.length !== 1) {
      addIssue(issues, "error", "VAL-DG-005", ref, "design-obligation-matrix direct atom row 必须包含一个 exact GA ID。");
      continue;
    }
    const globalAtomId = ids[0];
    if (matrixIds.has(globalAtomId)) {
      addIssue(issues, "error", "VAL-DG-005", ref, `${globalAtomId} 在 design-obligation-matrix direct atom rows 中重复。`);
    }
    matrixIds.set(globalAtomId, index);
  }

  compareIdSets(
    [...productionSourceRows.keys()],
    [...matrixIds.keys()],
    "VAL-DG-005",
    "trace/design.trace.json#/design-obligation-matrix",
    "design-obligation-matrix 必须覆盖每个 production-source-map direct atom",
    issues,
  );
}

function validateDesignImplementationPlacements(design, issues) {
  const placementRows = asArray(asObject(design["source-scope-map"])["implementation-placement-map"]);
  const definedPlacements = new Set();
  for (const [index, row] of placementRows.entries()) {
    const ref = `trace/design.trace.json#/source-scope-map/implementation-placement-map/${index}`;
    const ids = idsFromValue(row["placement-id"], P_ID_RE);
    if (ids.length !== 1) {
      addIssue(issues, "error", "VAL-DG-006", ref, "implementation-placement-map 每行必须包含一个 exact P ID。");
      continue;
    }
    if (definedPlacements.has(ids[0])) {
      addIssue(issues, "error", "VAL-DG-006", ref, `${ids[0]} 在 implementation-placement-map 中重复。`);
    }
    definedPlacements.add(ids[0]);
  }

  for (const ref of collectIds(design, P_ID_RE)) {
    if (!definedPlacements.has(ref.id)) {
      addIssue(issues, "error", "VAL-DG-006", `trace/design.trace.json${ref.pointer}`, `${ref.id} 未在 source-scope-map.implementation-placement-map 中定义。`);
    }
  }
}

function validateDesignAlignmentGate(design, productionSourceRows, issues) {
  const gate = asObject(design["production-alignment-gate"]);
  const gateCount = Number(gate["direct-atom-count"]);
  if (!Number.isFinite(gateCount)) {
    addIssue(issues, "error", "VAL-DG-007", "trace/design.trace.json#/production-alignment-gate/direct-atom-count", "production-alignment-gate 必须声明 direct-atom-count。");
  } else if (gateCount !== productionSourceRows.size) {
    addIssue(
      issues,
      "error",
      "VAL-DG-007",
      "trace/design.trace.json#/production-alignment-gate/direct-atom-count",
      `direct-atom-count 与 production-source-map 数量不一致：应为 ${productionSourceRows.size}，实际为 ${gateCount}。`,
    );
  }

  const directHandlingRows = asArray(asObject(design["source-scope-map"])["direct-atom-handling"]);
  const directHandlingIds = [];
  for (const [index, row] of directHandlingRows.entries()) {
    const ref = `trace/design.trace.json#/source-scope-map/direct-atom-handling/${index}`;
    const ids = idsFromValue(row["global-atom-id"], GA_ID_RE);
    if (ids.length !== 1) {
      addIssue(issues, "error", "VAL-DG-007", ref, "direct-atom-handling 每行必须包含一个 exact GA ID。");
      continue;
    }
    directHandlingIds.push(ids[0]);
  }
  compareIdSets(
    [...productionSourceRows.keys()],
    directHandlingIds,
    "VAL-DG-007",
    "trace/design.trace.json#/source-scope-map/direct-atom-handling",
    "source-scope-map.direct-atom-handling 必须与 production-source-map direct atoms 一致",
    issues,
  );

  const blockers = gate.blockers;
  if (Array.isArray(blockers) && blockers.length > 0) {
    addIssue(issues, "error", "VAL-DG-007", "trace/design.trace.json#/production-alignment-gate/blockers", "production-alignment-gate blockers 必须为空。");
  } else if (!Array.isArray(blockers)) {
    const blockerText = strip(blockers);
    if (blockerText && !/^(none|无)$/iu.test(blockerText)) {
      addIssue(issues, "error", "VAL-DG-007", "trace/design.trace.json#/production-alignment-gate/blockers", "production-alignment-gate blockers 必须为空、None 或 无。");
    }
  }
}

function specKeyFromTracePath(tracePath) {
  const normalized = strip(tracePath).replace(/\\/g, "/").replace(/^trace\/specs\//u, "").replace(/\.trace\.json$/u, "");
  return normalized ? `specs:${normalized}` : "";
}

function validateRuntimeCoverageTrace(runtimeTrace, runtimeRows, tracePlane, issues) {
  if (!runtimeTrace) {
    return;
  }
  const upstreamCoverage = parseRuntimeUpstreamCoverage(runtimeTrace, runtimeRows, issues);
  const sourceMapCoverage = parseRuntimeSourceMapCoverage(runtimeTrace, runtimeRows, issues);

  validateRuntimeProposalCoverage(tracePlane, upstreamCoverage.records, issues);
  validateRuntimeSpecScenarioCoverage(tracePlane, upstreamCoverage.records, issues);
  validateRuntimeDesignDecisionCoverage(tracePlane, upstreamCoverage.records, issues);
  validateRuntimeSourceBasisMachineIds(runtimeRows, upstreamCoverage, sourceMapCoverage, issues);
  validateRuntimeRowOrphans(runtimeRows, upstreamCoverage, sourceMapCoverage, issues);
}

function parseRuntimeUpstreamCoverage(runtimeTrace, runtimeRows, issues) {
  const records = [];
  const coveredRuntimeRows = new Set();
  const machineIds = new Set();
  const seen = new Set();

  for (const [index, row] of asArray(runtimeTrace["runtime-upstream-coverage-map"]).entries()) {
    const ref = traceRef("runtime-acceptance", "runtime-upstream-coverage-map", index);
    const upstreamItemId = runtimeUpstreamItemId(row);
    const upstreamItemType = runtimeUpstreamItemType(row);
    if (!upstreamItemId || !upstreamItemType) {
      addIssue(issues, "error", "VAL-RA-103", ref, "runtime-upstream-coverage-map 每行必须声明 upstream-item-id/upstream-item 和 upstream-item-type/upstream-type。");
    } else {
      const key = `${upstreamItemType}::${upstreamItemId}`;
      if (seen.has(key)) {
        addIssue(issues, "error", "VAL-RA-103", ref, `${key} 在 runtime-upstream-coverage-map 中重复。`);
      }
      seen.add(key);
    }

    const mode = strip(row["coverage-mode"]).toLowerCase();
    const rowIds = idsFromValue(row["runtime-row-ids"], RUNTIME_ROW_RE);
    if (!mode.includes("not-applicable") && rowIds.length === 0) {
      addIssue(issues, "error", "VAL-RA-101", ref, "covered upstream item 必须映射到至少一个 runtime row。");
    }
    for (const rowId of rowIds) {
      if (runtimeRows.size > 0 && !runtimeRows.has(rowId)) {
        addIssue(issues, "error", "VAL-RA-102", ref, `runtime-upstream-coverage-map 引用未定义 runtime row ${rowId}。`);
      }
    }

    const rowMachineIds = machineIdsFromValue(row);
    for (const id of rowMachineIds) {
      machineIds.add(id);
    }
    for (const rowId of rowIds) {
      coveredRuntimeRows.add(rowId);
    }
    records.push({ index, row, ref, upstreamItemId, upstreamItemType, rowIds, machineIds: rowMachineIds });
  }
  return { records, coveredRuntimeRows, machineIds };
}

function parseRuntimeSourceMapCoverage(runtimeTrace, runtimeRows, issues) {
  const coveredRuntimeRows = new Set();
  const machineIds = new Set();
  for (const [index, row] of asArray(runtimeTrace["runtime-coverage-source-map"]).entries()) {
    const ref = traceRef("runtime-acceptance", "runtime-coverage-source-map", index);
    const rowIds = idsFromValue(row["row-ids"] ?? row["runtime-row-ids"], RUNTIME_ROW_RE);
    if (rowIds.length === 0) {
      addIssue(issues, "error", "VAL-RA-109", ref, "runtime-coverage-source-map 每行必须声明至少一个 row-ids/runtime-row-ids。");
    }
    for (const rowId of rowIds) {
      coveredRuntimeRows.add(rowId);
      if (runtimeRows.size > 0 && !runtimeRows.has(rowId)) {
        addIssue(issues, "error", "VAL-RA-109", ref, `runtime-coverage-source-map 引用未定义 runtime row ${rowId}。`);
      }
    }
    for (const id of machineIdsFromValue(row)) {
      machineIds.add(id);
    }
  }
  return { coveredRuntimeRows, machineIds };
}

function validateRuntimeProposalCoverage(tracePlane, upstreamRecords, issues) {
  const proposal = tracePlane.get("proposal");
  if (!proposal) {
    return;
  }
  const expected = [];
  for (const row of asArray(proposal["change-atom-coverage-register"])) {
    expected.push(...idsFromValue(row["global-atom-id"], GA_ID_RE));
  }
  const covered = new Set(upstreamRecords.flatMap((record) => record.machineIds.filter(isGaId)));
  compareIdSets(
    unique(expected),
    [...covered],
    "VAL-RA-104",
    "trace/runtime-acceptance.trace.json#/runtime-upstream-coverage-map",
    "runtime-upstream-coverage-map 必须覆盖 proposal direct atoms",
    issues,
  );
}

function validateRuntimeSpecScenarioCoverage(tracePlane, upstreamRecords, issues) {
  const requiredScenarios = new Map();
  for (const [key, specsTrace] of tracePlane.entries()) {
    if (!key.startsWith("specs:")) {
      continue;
    }
    for (const [index, row] of asArray(specsTrace["requirement-source-trace"]).entries()) {
      const requirement = strip(row.requirement);
      const scenario = strip(row.scenario);
      if (!requirement || !scenario) {
        continue;
      }
      const scenarioKey = specScenarioKey(requirement, scenario);
      if (!requiredScenarios.has(scenarioKey)) {
        requiredScenarios.set(scenarioKey, { requirement, scenario, ref: `${key}#/requirement-source-trace/${index}` });
      }
    }
  }

  for (const { requirement, scenario, ref } of requiredScenarios.values()) {
    if (!upstreamRecords.some((record) => runtimeUpstreamMentionsSpecScenario(record, requirement, scenario))) {
      addIssue(
        issues,
        "error",
        "VAL-RA-105",
        "trace/runtime-acceptance.trace.json#/runtime-upstream-coverage-map",
        `${ref} 的 specs scenario 未映射到 runtime-upstream-coverage-map：${requirement} / ${scenario}。`,
      );
    }
  }
}

function validateRuntimeDesignDecisionCoverage(tracePlane, upstreamRecords, issues) {
  const design = tracePlane.get("design");
  if (!design) {
    return;
  }
  const expected = [];
  for (const row of asArray(design["design-decision-index"])) {
    expected.push(...idsFromValue(row["decision-id"], D_ID_RE));
  }
  const covered = new Set(upstreamRecords.flatMap((record) => record.machineIds.filter(isDesignDecisionId)));
  compareIdSets(
    unique(expected),
    [...covered],
    "VAL-RA-106",
    "trace/runtime-acceptance.trace.json#/runtime-upstream-coverage-map",
    "runtime-upstream-coverage-map 必须覆盖 design decisions",
    issues,
  );
}

function validateRuntimeSourceBasisMachineIds(runtimeRows, upstreamCoverage, sourceMapCoverage, issues) {
  const markdownIds = new Set();
  for (const row of runtimeRows.values()) {
    for (const id of machineIdsFromValue(row.sourceBasis)) {
      markdownIds.add(id);
    }
  }

  const jsonIds = new Set([...upstreamCoverage.machineIds, ...sourceMapCoverage.machineIds]);
  compareIdSets(
    [...markdownIds],
    [...jsonIds],
    "VAL-RA-107",
    "runtime-acceptance.md#Source Basis",
    "runtime Markdown Source Basis 中的 GA/D IDs 必须与 runtime JSON coverage/source-map 中的 GA/D IDs 一致",
    issues,
  );
}

function validateRuntimeRowOrphans(runtimeRows, upstreamCoverage, sourceMapCoverage, issues) {
  const covered = new Set([...upstreamCoverage.coveredRuntimeRows, ...sourceMapCoverage.coveredRuntimeRows]);
  compareIdSets(
    [...runtimeRows.keys()],
    [...covered],
    "VAL-RA-108",
    "trace/runtime-acceptance.trace.json#/runtime-upstream-coverage-map",
    "每个 canonical runtime row 必须被 runtime-upstream-coverage-map 或 runtime-coverage-source-map 引用",
    issues,
  );
}

function runtimeUpstreamItemId(row) {
  return strip(row["upstream-item-id"] ?? row["upstream-item"] ?? row["source-item-id"]);
}

function runtimeUpstreamItemType(row) {
  return strip(row["upstream-item-type"] ?? row["upstream-type"] ?? row["source-item-type"]);
}

function runtimeUpstreamMentionsSpecScenario(record, requirement, scenario) {
  const text = normalizeTraceComparable(JSON.stringify(record.row)).toLowerCase();
  return text.includes(normalizeTraceComparable(requirement).toLowerCase()) &&
    text.includes(normalizeTraceComparable(scenario).toLowerCase());
}

function machineIdsFromValue(value) {
  return unique([
    ...collectIds(value, GA_ID_RE).map((ref) => ref.id),
    ...collectIds(value, D_ID_RE).map((ref) => ref.id),
  ]);
}

function isGaId(value) {
  return /^GA-\d{4}$/u.test(strip(value));
}

function isDesignDecisionId(value) {
  return /^D-\d{3}$/u.test(strip(value));
}

function validateTasksTrace(trace, runtimeRows, taskModel, issues) {
  if (!trace) {
    return;
  }
  const acById = new Map(taskModel.acSections.map((section) => [section.id, section]));
  const acRuntimeRowsById = new Map(
    taskModel.acSections.map((section) => [section.id, new Set(extractAcRuntimeRows(section.text))]),
  );
  const ownershipRows = asArray(trace["runtime-acceptance-index"]?.["ac-runtime-ownership-index"]);
  const graph = new Map();
  for (const [index, row] of ownershipRows.entries()) {
    const ref = traceRef("tasks", "runtime-acceptance-index/ac-runtime-ownership-index", index);
    const acId = strip(row["ac-id"]);
    if (!/^AC-\d{3}$/.test(acId) || !acById.has(acId)) {
      addIssue(issues, "error", "VAL-TS-101", ref, `AC Runtime Ownership Index 引用不存在的 AC：${acId || "(empty)"}。`);
      continue;
    }
    const detailRows = idsFromValue(row["detail-matrix-rows"], RUNTIME_ROW_RE);
    const acRows = extractAcRuntimeRows(acById.get(acId).text);
    if (!sameSet(detailRows, acRows)) {
      addIssue(issues, "error", "VAL-TS-102", ref, `${acId} trace detail-matrix-rows 必须与 Delivery Plane Runtime Rows 一致。`);
    }
    for (const rowId of detailRows) {
      if (runtimeRows.size > 0 && !runtimeRows.has(rowId)) {
        addIssue(issues, "error", "VAL-TS-103", ref, `${acId} trace 引用未定义 runtime row ${rowId}。`);
      }
    }
    const depends = idsFromValue(row["depends-on-ac-ids"], AC_ID_RE);
    graph.set(acId, depends);
    for (const dep of depends) {
      if (!acById.has(dep)) {
        addIssue(issues, "error", "VAL-TS-104", ref, `${acId} depends-on-ac-ids 引用不存在的 ${dep}。`);
      } else if (acById.get(dep).startLine > acById.get(acId).startLine) {
        addIssue(issues, "error", "VAL-TS-105", ref, `${acId} 依赖后置 AC ${dep}。`);
      }
    }
  }
  validateAcyclicGraph(graph, issues);

  const projectionRows = asArray(trace["runtime-acceptance-projection"]?.["runtime-row-ownership-projection"]);
  const projectedRuntimeRows = new Set();
  const ownerByRuntimeRow = new Map();
  for (const [index, row] of projectionRows.entries()) {
    const ref = traceRef("tasks", "runtime-acceptance-projection/runtime-row-ownership-projection", index);
    const runtimeRowId = strip(row["runtime-row-id"]);
    const runtimeRowIdValid = /^(RS|OP|ST|CH)-\d{3}$/.test(runtimeRowId);
    if (!runtimeRowIdValid) {
      addIssue(issues, "error", "VAL-TS-110", ref, "Runtime Row Ownership Projection 缺少合法 runtime-row-id。");
    } else if (runtimeRows.size > 0 && !runtimeRows.has(runtimeRowId)) {
      addIssue(issues, "error", "VAL-TS-106", ref, `Runtime Row Ownership Projection 引用未定义 runtime row ${runtimeRowId}。`);
    } else {
      if (projectedRuntimeRows.has(runtimeRowId)) {
        addIssue(issues, "error", "VAL-TS-110", ref, `${runtimeRowId} 在 runtime-row-ownership-projection 中重复。`);
      }
      projectedRuntimeRows.add(runtimeRowId);
    }

    const ownerAcId = strip(row["owner-ac-id"]);
    const ownerAcExists = /^AC-\d{3}$/.test(ownerAcId) && acById.has(ownerAcId);
    if (!ownerAcExists) {
      addIssue(issues, "error", "VAL-TS-111", ref, `owner-ac-id 引用不存在的 AC：${ownerAcId || "(empty)"}。`);
    } else {
      if (runtimeRowIdValid && !acRuntimeRowsById.get(ownerAcId)?.has(runtimeRowId)) {
        addIssue(issues, "error", "VAL-TS-112", ref, `${runtimeRowId} 不属于 owner-ac-id ${ownerAcId} 的 Delivery Plane Runtime Rows。`);
      }
      if (runtimeRowIdValid && !ownerByRuntimeRow.has(runtimeRowId)) {
        ownerByRuntimeRow.set(runtimeRowId, ownerAcId);
      }
    }

    const implementationTaskIds = idsFromValue(row["implementation-task-ids"], TASK_ID_RE);
    const projectionStatus = strip(row["projection-status"]).toLowerCase();
    if (projectionStatus.includes("projected") && implementationTaskIds.length === 0) {
      addIssue(issues, "error", "VAL-TS-113", ref, "projected runtime row 必须填写至少一个 implementation-task-ids。");
    }
    for (const taskId of implementationTaskIds) {
      if (!taskModel.taskIds.has(taskId)) {
        addIssue(issues, "error", "VAL-TS-107", ref, `Implementation Task ID ${taskId} 无法解析到 checkbox。`);
      }
    }
    for (const dep of idsFromValue(row["depends-on-ac-ids"], AC_ID_RE)) {
      if (!acById.has(dep)) {
        addIssue(issues, "error", "VAL-TS-108", ref, `Runtime Row Ownership Projection depends-on-ac-ids 引用不存在的 ${dep}。`);
      }
    }
  }
  if (runtimeRows.size > 0) {
    compareIdSets(
      [...runtimeRows.keys()],
      [...projectedRuntimeRows],
      "VAL-TS-110",
      "trace/tasks.trace.json#/runtime-acceptance-projection/runtime-row-ownership-projection",
      "runtime-row-ownership-projection 必须覆盖每个 runtime acceptance row",
      issues,
    );
  }
  validateTasksAcceptanceDrivenCoverage(
    trace,
    runtimeRows,
    acById,
    taskModel,
    { projectedRuntimeRows, ownerByRuntimeRow },
    issues,
  );
}

function validateTasksAcceptanceDrivenCoverage(trace, runtimeRows, acById, taskModel, projectionModel, issues) {
  const coverage = asObject(trace["acceptance-driven-coverage"]);
  const coveredRuntimeRows = new Set();
  for (const [sectionKey, rowsValue] of Object.entries(coverage)) {
    if (!Array.isArray(rowsValue)) {
      addIssue(issues, "error", "VAL-TS-114", `trace/tasks.trace.json#/acceptance-driven-coverage/${sectionKey}`, "acceptance-driven-coverage section 必须为数组。");
      continue;
    }
    for (const [index, row] of rowsValue.entries()) {
      const ref = traceRef("tasks", `acceptance-driven-coverage/${sectionKey}`, index);
      const runtimeRowIds = idsFromValue(row["runtime-row-ids"], RUNTIME_ROW_RE);
      const acIds = idsFromValue(row["acceptance-slice-ids"], AC_ID_RE);
      const taskIds = idsFromValue(row["implementation-task-ids"], TASK_ID_RE);
      const status = strip(row["coverage-status"]).toLowerCase();

      if (status.includes("projected") && (runtimeRowIds.length === 0 || acIds.length === 0 || taskIds.length === 0)) {
        addIssue(issues, "error", "VAL-TS-114", ref, "projected coverage row 必须同时填写 runtime-row-ids、acceptance-slice-ids 和 implementation-task-ids。");
      }

      for (const runtimeRowId of runtimeRowIds) {
        if (runtimeRows.size > 0 && !runtimeRows.has(runtimeRowId)) {
          addIssue(issues, "error", "VAL-TS-114", ref, `acceptance-driven-coverage 引用未定义 runtime row ${runtimeRowId}。`);
          continue;
        }
        coveredRuntimeRows.add(runtimeRowId);
        if (!projectionModel.projectedRuntimeRows.has(runtimeRowId)) {
          addIssue(issues, "error", "VAL-TS-114", ref, `${runtimeRowId} 未闭合到 runtime-row-ownership-projection。`);
        }
        const ownerAcId = projectionModel.ownerByRuntimeRow.get(runtimeRowId);
        if (ownerAcId && acIds.length > 0 && !acIds.includes(ownerAcId)) {
          addIssue(issues, "error", "VAL-TS-115", ref, `${runtimeRowId} 的 owner AC ${ownerAcId} 未列入 acceptance-slice-ids。`);
        }
      }

      for (const acId of acIds) {
        if (!acById.has(acId)) {
          addIssue(issues, "error", "VAL-TS-114", ref, `acceptance-driven-coverage 引用不存在的 AC ${acId}。`);
        }
      }

      for (const taskId of taskIds) {
        if (!taskModel.taskIds.has(taskId)) {
          addIssue(issues, "error", "VAL-TS-114", ref, `acceptance-driven-coverage 引用不存在的 implementation task ${taskId}。`);
          continue;
        }
        const taskAcId = acIdForTaskId(taskId);
        if (taskAcId && acIds.length > 0 && !acIds.includes(taskAcId)) {
          addIssue(issues, "error", "VAL-TS-115", ref, `${taskId} 所属 AC 未列入 acceptance-slice-ids。`);
        }
      }
    }
  }
  if (runtimeRows.size > 0) {
    compareIdSets(
      [...runtimeRows.keys()],
      [...coveredRuntimeRows],
      "VAL-TS-116",
      "trace/tasks.trace.json#/acceptance-driven-coverage",
      "acceptance-driven-coverage 必须覆盖每个 runtime acceptance row",
      issues,
    );
  }
}

function validateAcyclicGraph(graph, issues) {
  const visiting = new Set();
  const visited = new Set();
  const stack = [];
  function visit(node) {
    if (visited.has(node)) return;
    if (visiting.has(node)) {
      const cycle = [...stack.slice(stack.indexOf(node)), node].join(" -> ");
      addIssue(issues, "error", "VAL-TS-109", "trace/tasks.trace.json", `AC dependency graph 存在循环：${cycle}。`);
      return;
    }
    visiting.add(node);
    stack.push(node);
    for (const dep of graph.get(node) ?? []) {
      if (graph.has(dep)) visit(dep);
    }
    stack.pop();
    visiting.delete(node);
    visited.add(node);
  }
  for (const node of graph.keys()) visit(node);
}

function getAcIntentText(text) {
  const heading = text.split(/\r?\n/, 1)[0] ?? "";
  const outcome = extractNamedBlock(text, "Outcome:");
  const implementationScope = extractNamedBlock(text, "Implementation Scope:");
  const checkboxTitles = [...text.matchAll(/^\s*-\s+\[[ xX]\]\s+(.+)$/gm)].map((match) => match[1]).join("\n");
  return [heading, outcome, implementationScope, checkboxTitles].join("\n");
}

function extractNamedBlock(text, fieldName) {
  const start = text.indexOf(fieldName);
  if (start < 0) return "";
  const after = start + fieldName.length;
  const rest = text.slice(after);
  const nextField = rest.search(/\n(?:Start Gate|Runtime Rows|Resolved Runtime Contract|Implementation Scope|Preserve|Proof Contract):/);
  return nextField >= 0 ? rest.slice(0, nextField) : rest;
}

function getTableAfterHeading(file, heading) {
  const headingIndex = file.lines.findIndex((line) => line.trim() === heading);
  if (headingIndex < 0) return null;
  return getFirstTable(file.lines, headingIndex + 1, 1);
}

function getTableAfterMarkdownHeading(text, heading) {
  const lines = String(text ?? "").split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => line.trim() === heading);
  if (headingIndex < 0) return null;
  return getFirstTable(lines, headingIndex + 1, 1);
}

function getFirstMarkdownTableWithHeader(text, headerName) {
  const lines = String(text ?? "").split(/\r?\n/);
  for (let i = 0; i < lines.length - 1; i += 1) {
    if (!isTableLine(lines[i]) || !isSeparatorLine(lines[i + 1])) continue;
    const headers = splitTableRow(lines[i]);
    if (!headers.some((header) => normalizeHeader(header) === normalizeHeader(headerName))) continue;
    const rows = [];
    let j = i + 2;
    while (j < lines.length && isTableLine(lines[j])) {
      const cells = splitTableRow(lines[j]);
      if (cells.length === headers.length) rows.push({ cells, line: j + 1 });
      j += 1;
    }
    return { headers, rows, line: i + 1 };
  }
  return null;
}

function getTableAfterText(text, marker, startLine) {
  const lines = text.split(/\r?\n/);
  const markerIndex = lines.findIndex((line) => line.trim() === marker);
  if (markerIndex < 0) return null;
  return getFirstTable(lines, markerIndex + 1, startLine);
}

function getFirstTable(lines, fromIndex, baseLine) {
  for (let i = fromIndex; i < lines.length - 1; i += 1) {
    if (!isTableLine(lines[i]) || !isSeparatorLine(lines[i + 1])) continue;
    const headers = splitTableRow(lines[i]);
    const rows = [];
    let j = i + 2;
    while (j < lines.length && isTableLine(lines[j])) {
      const cells = splitTableRow(lines[j]);
      if (cells.length === headers.length) rows.push({ cells, line: baseLine + j });
      j += 1;
    }
    return { headers, rows, line: baseLine + i };
  }
  return null;
}

function splitAcSections(file) {
  const sections = [];
  let current = null;
  for (let i = 0; i < file.lines.length; i += 1) {
    const match = file.lines[i].match(/^## (AC-\d{3})\b/);
    if (match) {
      if (current) {
        current.text = file.lines.slice(current.startIndex, i).join("\n");
        sections.push(current);
      }
      current = { id: match[1], startIndex: i, startLine: i + 1, text: "" };
      continue;
    }
    if (current && /^## Trace Appendix\b/.test(file.lines[i])) {
      current.text = file.lines.slice(current.startIndex, i).join("\n");
      sections.push(current);
      current = null;
      break;
    }
  }
  if (current) {
    current.text = file.lines.slice(current.startIndex).join("\n");
    sections.push(current);
  }
  return sections;
}

function extractAcRuntimeRows(text) {
  const marker = text.indexOf("Runtime Rows:");
  if (marker < 0) return [];
  const endMarkers = [
    text.indexOf("Resolved Runtime Contract:", marker),
    text.indexOf("Implementation Scope:", marker),
    text.indexOf("Preserve:", marker),
  ].filter((index) => index > marker);
  const end = endMarkers.length > 0 ? Math.min(...endMarkers) : marker + 500;
  return unique(text.slice(marker, end).match(RUNTIME_ROW_RE) ?? []);
}

function extractTaskIds(text) {
  return new Set([...text.matchAll(/^\s*-\s+\[[ xX]\]\s+(AC-\d{3}\.\d+)\b/gm)].map((match) => match[1]));
}

function acIdForTaskId(taskId) {
  return strip(taskId).match(/^(AC-\d{3})\.\d+$/u)?.[1] ?? "";
}

function requireColumns(table, requiredColumns, fileRef, ruleId, issues) {
  const indexByHeader = {};
  for (const required of requiredColumns) {
    const found = table.headers.findIndex((header) => normalizeHeader(header) === normalizeHeader(required));
    if (found < 0) {
      addIssue(issues, "error", ruleId, `${fileRef}:${table.line}`, `表格缺少列 ${required}。`);
      return null;
    }
    indexByHeader[required] = found;
  }
  return indexByHeader;
}

function readJson(fullPath, root, issues) {
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch (error) {
    addIssue(issues, "error", "VAL-TR-015", path.relative(root, fullPath), `JSON 无法解析：${error.message}`);
    return null;
  }
}

function readAuthorityText(root, relOrAbsPath, issues, ruleId, label) {
  const fullPath = path.isAbsolute(relOrAbsPath) ? relOrAbsPath : path.join(root, relOrAbsPath);
  if (!fs.existsSync(fullPath)) {
    addIssue(issues, "error", ruleId, relOrAbsPath, `缺少 ${label}：${relOrAbsPath}。`);
    return null;
  }
  try {
    return fs.readFileSync(fullPath, "utf8");
  } catch (error) {
    addIssue(issues, "error", ruleId, relOrAbsPath, `${label} 无法读取：${error.message}`);
    return null;
  }
}

function validateKebabKeys(value, location, issues, pointer = "") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateKebabKeys(item, location, issues, `${pointer}/${index}`));
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (!KEBAB_KEY_RE.test(key)) {
      addIssue(issues, "error", "VAL-TR-016", `${location}${pointer}/${key}`, "JSON trace key 必须使用 kebab-case。");
    }
    validateKebabKeys(child, location, issues, `${pointer}/${key}`);
  }
}

function collectIds(value, regex, pointer = "") {
  const result = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => result.push(...collectIds(item, regex, `${pointer}/${index}`)));
    return result;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      result.push(...collectIds(child, regex, `${pointer}/${key}`));
    }
    return result;
  }
  for (const id of idsFromValue(value, regex)) {
    result.push({ id, pointer });
  }
  return result;
}

function sha256File(fullPath) {
  const hash = crypto.createHash("sha256").update(fs.readFileSync(fullPath)).digest("hex");
  return `sha256-${hash}`;
}

function walkFiles(dir) {
  const result = [];
  if (!fs.existsSync(dir)) return result;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...walkFiles(fullPath));
    else result.push(fullPath);
  }
  return result;
}

function isTableLine(line) {
  return /^\s*\|.*\|\s*$/.test(line);
}

function isSeparatorLine(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function splitTableRow(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function normalizeHeader(value) {
  return strip(value).toLowerCase().replace(/\s+/g, " ");
}

function idsFromValue(value, regex) {
  if (Array.isArray(value)) return unique(value.flatMap((item) => idsFromValue(item, regex)));
  return unique(strip(value).match(regex) ?? []);
}

function strip(value) {
  return String(value ?? "").replace(/<!--[\s\S]*?-->/g, "").replace(/`/g, "").trim();
}

function normalizeTraceComparable(value) {
  return strip(value).replace(/\s+/g, " ");
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function unique(values) {
  return [...new Set(values)];
}

function compareIdSets(expected, actual, ruleId, ref, label, issues) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const missing = [...expectedSet].filter((id) => !actualSet.has(id));
  const extra = [...actualSet].filter((id) => !expectedSet.has(id));
  if (missing.length > 0 || extra.length > 0) {
    const parts = [];
    if (missing.length > 0) parts.push(`缺失：${missing.join(", ")}`);
    if (extra.length > 0) parts.push(`多余：${extra.join(", ")}`);
    addIssue(issues, "error", ruleId, ref, `${label}；${parts.join("；")}。`);
  }
}

function sameSet(a, b) {
  const left = new Set(a);
  const right = new Set(b);
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
}

function sameArray(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function isOwnerListOrNonProduction(owner) {
  if (/tests?\/|openspec-results|test-results|evidence|runner|vitest|playwright|\.test\.|\.spec\./iu.test(owner)) return true;
  if (/[,，;+]|(?:^|\s)(?:and|和|与)(?:\s|$)/iu.test(owner)) return true;
  if ((owner.match(/`/g) ?? []).length > 2) return true;
  if (/\s{2,}/.test(owner)) return true;
  return false;
}

function hasForbiddenField(lines, fieldName) {
  const escaped = escapeRegExp(fieldName);
  const headingRe = new RegExp(`^#{1,6}\\s+${escaped}\\b`, "iu");
  const fieldRe = new RegExp(`^\\s*${escaped}\\s*:`, "iu");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (headingRe.test(line) || fieldRe.test(line)) return true;
    if (line.includes(fieldName) && isTableLine(line) && isSeparatorLine(lines[index + 1] ?? "")) return true;
  }
  return false;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function traceRef(artifact, section, index) {
  return `trace/${artifact}.trace.json#/${section}/${index}`;
}

function addIssue(issues, severity, ruleId, file, message) {
  issues.push({ severity, ruleId, file, message });
}

function summarize(issues) {
  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  return { ok: errors.length === 0, errorCount: errors.length, warningCount: warnings.length, issues };
}

function parseCli(argv) {
  const options = { root: process.cwd(), complete: false, json: false, strictWarnings: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--change") options.change = argv[++i];
    else if (arg === "--root") options.root = path.resolve(argv[++i]);
    else if (arg === "--complete" || arg === "--final") options.complete = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--strict-warnings") options.strictWarnings = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`未知参数：${arg}`);
  }
  return options;
}

function printHelp() {
  console.log(`Usage:
  node openspec/agent-runtime/scripts/validate-production-artifacts.mjs --change <slug> [--complete] [--json] [--strict-warnings]

Options:
  --change <slug>     OpenSpec change slug under openspec/changes.
  --complete          Require apply-required artifacts: runtime-acceptance.md, verification.md, tasks.md.
  --json              Print machine-readable result.
  --strict-warnings   Exit non-zero when warnings are present.
`);
}

function printTextResult(result) {
  const status = result.ok ? "PASS" : "FAIL";
  console.log(`OpenSpec artifact validation: ${status} (${result.errorCount} errors, ${result.warningCount} warnings)`);
  for (const issue of result.issues) {
    console.log(`[${issue.severity}] ${issue.ruleId} ${issue.file}: ${issue.message}`);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const options = parseCli(process.argv.slice(2));
    if (options.help || !options.change) {
      printHelp();
      process.exit(options.help ? 0 : 2);
    }
    const result = validateChange(options);
    if (options.json) console.log(JSON.stringify(result, null, 2));
    else printTextResult(result);
    process.exit(result.errorCount > 0 || (options.strictWarnings && result.warningCount > 0) ? 1 : 0);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
}
